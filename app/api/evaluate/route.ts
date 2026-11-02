import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/ratelimit";
import { EvaluationSchema, TranscriptSchema, type EvaluationResult } from "@/lib/schemas";
import { gemmaJson } from "@/lib/gemma";
import { rubricFor, skillScores, totalScore, type ChecklistItem } from "@/lib/scoring";
import { evaluationPrompt, evaluationSystem } from "@/lib/evaluation";
import { onTime } from "@/lib/tempo";
import { getScenario } from "@/lib/scenarios";
import { currentClinicContext, currentUser } from "@/lib/session";
import { parseAttempt, saveTraining } from "@/lib/trainings";
import { FEATURES, OFF_MESSAGE } from "@/lib/features";

export async function POST(req: Request) {
  const limited = rateLimit(req, "llm", 12);
  if (limited) return limited;
  const body = await req.json().catch(() => null);
  const real = body?.scenarioId === "real";
  if (real && !FEATURES.realCalls) return NextResponse.json({ error: OFF_MESSAGE }, { status: 403 });
  const ctx = await currentClinicContext();
  const scenario = real ? null : getScenario(body?.scenarioId, ctx);
  const parsed = TranscriptSchema.safeParse(body?.transcript);
  if ((!real && !scenario) || !parsed.success) return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  const transcript = parsed.data;
  if (transcript.filter((t) => t.role === "user").length < 2) {
    return NextResponse.json({ error: "Нужно хотя бы две реплики оператора, чтобы оценить звонок." }, { status: 422 });
  }

  const prompt = evaluationPrompt({ scenario, memo: ctx.memo, transcript });

  try {
    const ev = await gemmaJson({ system: evaluationSystem(real), prompt, schema: EvaluationSchema, tier: "smart" });

    const passed = new Set(ev.passed);
    const notes = new Map(ev.missed.map((m) => [m.id, m.note]));
    const checklist: ChecklistItem[] = rubricFor(real).map((r) => ({
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
    // Tempo: booked within the target (lib/tempo.ts): 3 minutes in voice, 10 operator replies in text.
    const attempt = scenario ? parseAttempt(body?.attempt) : null;
    const replies = transcript.filter((t) => t.role === "user").length;
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
      saveTraining({ attempt, userId: user.id, clinicId: user.clinic?.id ?? null, scenarioId: scenario.id, legendVersion: ctx.legendVersion, transcript, result });
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error("[evaluate]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Не удалось оценить сессию" }, { status: 502 });
  }
}
