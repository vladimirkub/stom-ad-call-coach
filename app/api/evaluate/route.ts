import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/ratelimit";
import { EvaluationSchema, TranscriptSchema, type EvaluationResult } from "@/lib/schemas";
import { gemmaJson } from "@/lib/gemma";
import { CUT_OFF_IDS, URGENT_SKIP_SKILLS, rubricFor, skillScores, totalScore, type ChecklistItem } from "@/lib/scoring";
import { evaluationPrompt, evaluationSystem } from "@/lib/evaluation";
import { TEMPO_NOTES, onTime } from "@/lib/tempo";
import { getScenario } from "@/lib/scenarios";
import { currentClinicContext, currentUser } from "@/lib/session";
import { parseAttempt, saveTraining } from "@/lib/trainings";
import { FEATURES, OFF_MESSAGE } from "@/lib/features";
import { parseDirection } from "@/lib/direction";

export async function POST(req: Request) {
  const limited = rateLimit(req, "llm", 12);
  if (limited) return limited;
  const body = await req.json().catch(() => null);
  const real = body?.scenarioId === "real";
  const direction = parseDirection(body?.direction);
  if (real && !FEATURES.realCalls) return NextResponse.json({ error: OFF_MESSAGE }, { status: 403 });
  const ctx = await currentClinicContext();
  const scenario = real ? null : getScenario(body?.scenarioId, ctx, direction, body?.variant);
  const parsed = TranscriptSchema.safeParse(body?.transcript);
  if ((!real && !scenario) || !parsed.success) return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  const transcript = parsed.data;
  if (transcript.filter((t) => t.role === "user").length < 2) {
    return NextResponse.json({ error: "Нужно хотя бы две реплики оператора, чтобы оценить звонок." }, { status: 422 });
  }

  // Real calls are judged on the checklist alone; the clinic's wishes are for its trainings.
  const wishes = real ? "" : ctx.wishes;
  // Variant calls: after how many operator replies the administrator opened the patient's record (null: never).
  const recordOpenedAfter = Number.isInteger(body?.recordOpenedAfter) ? (body.recordOpenedAfter as number) : null;
  const prompt = evaluationPrompt({ scenario, memo: ctx.memo, transcript, wishes, recordOpenedAfter });
  const attempt = scenario ? parseAttempt(body?.attempt) : null;
  const hungUp = attempt?.endedBy === "patient";

  try {
    const ev = await gemmaJson({ system: evaluationSystem(real, direction, !!wishes.trim(), hungUp), prompt, schema: EvaluationSchema, tier: "smart" });

    const passed = new Set(ev.passed);
    const notes = new Map(ev.missed.map((m) => [m.id, m.note]));
    const checklist: ChecklistItem[] = rubricFor(real, direction).map((r) => ({
      ...r,
      done: passed.has(r.id) && !notes.has(r.id),
      evidence: notes.get(r.id),
    }));
    // Deterministic cross-checks so the checklist cannot contradict the other fields.
    const set = (id: string, done: boolean) => {
      const item = checklist.find((c) => c.id === id);
      if (item) item.done = done;
    };
    if (ev.unsupportedClaims.length > 0) set("noFalsePromises", false);
    if (!real) set("uncoveredHidden", ev.objectionUncovered);
    if (!ev.appointmentBooked) set("gotAgreement", false);
    // The patient agreed and hung up before the operator could answer: the closing items they had no turn for are not counted.
    // Not when the time ran out (the wrap-up note told the patient to say goodbye): then the operator ran out of time.
    const replies = transcript.filter((t) => t.role === "user").length;
    const wrapUp = TEMPO_NOTES.find((n) => n.stage === "wrapUp")!;
    const timedOut = !!attempt && (attempt.mode === "voice" ? (attempt.durationS ?? 0) >= wrapUp.voiceSeconds : replies >= wrapUp.textReplies);
    const lastOperatorTurn = transcript.findLastIndex((t) => t.role === "user") + 1;
    const agreed = ev.agreedTurn;
    if (hungUp && !timedOut && ev.appointmentBooked && agreed > lastOperatorTurn && transcript[agreed - 1]?.role === "agent") {
      for (const c of checklist) {
        if (CUT_OFF_IDS.includes(c.id) && !c.done) Object.assign(c, { cutOff: true, evidence: "пациент положил трубку сразу после согласия" });
      }
    }
    // Danger signs, and the operator routed the patient to a doctor at once: booking a visit was not the task.
    if (scenario?.variant?.urgent && ev.urgentRouted) {
      for (const c of checklist) {
        if ((URGENT_SKIP_SKILLS as readonly string[]).includes(c.skill) && !c.done) Object.assign(c, { cutOff: true, evidence: "не требовалось: пациент срочно передан врачу" });
      }
    }
    // Tempo: booked within the target (lib/tempo.ts): 3 minutes in voice, 10 operator replies in text.
    const tempoOk = !!attempt && ev.appointmentBooked && onTime(attempt.mode, attempt.durationS ?? Infinity, replies);
    set("onTime", tempoOk);
    if (attempt && !tempoOk) {
      const item = checklist.find((c) => c.id === "onTime");
      if (item) item.evidence = !ev.appointmentBooked ? "пациент не записан" : attempt.mode === "voice" ? `звонок длился ${Math.floor((attempt.durationS ?? 0) / 60)}:${String((attempt.durationS ?? 0) % 60).padStart(2, "0")}` : `понадобилось реплик: ${replies}`;
    }

    const scores = skillScores(checklist);
    const result: EvaluationResult = {
      ...ev,
      objectionUncovered: real ? false : ev.objectionUncovered,
      checklist,
      moments: ev.moments.filter((m) => m.turn <= transcript.length && transcript[m.turn - 1].role === "user"),
      scores,
      total: totalScore(scores),
      hiddenObjection: scenario?.hiddenObjection ?? "",
      showUpRisk: scenario?.showUpRisk ?? "",
    };
    // Calls with a virtual patient go into the trainee's history; real-call analysis does not.
    const user = attempt ? await currentUser() : null;
    if (attempt && user && scenario) {
      saveTraining({ attempt, userId: user.id, clinicId: user.clinic?.id ?? null, scenarioId: scenario.id, legendVersion: ctx.legendVersion, direction, transcript, result });
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error("[evaluate]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Не удалось оценить сессию" }, { status: 502 });
  }
}
