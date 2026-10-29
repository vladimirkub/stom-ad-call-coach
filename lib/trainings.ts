// Training history: one row per evaluated call with a virtual patient, saved by /api/evaluate for the signed-in user.
// The client gives each call an id when it starts, so evaluating the same call again updates the row instead of adding one.
import { db } from "./db.ts";
import type { EvaluationResult, Turn } from "./schemas.ts";

export type TrainingMode = "voice" | "text";
export type EndedBy = "patient" | "operator";

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = 864e5;

/** Validates the client's description of the call; null if anything is off (then the evaluation is returned but not saved). */
export function parseAttempt(raw: unknown, now = Date.now()): { id: string; mode: TrainingMode; startedAt: number; endedBy: EndedBy | null; live: string[] } | null {
  const a = raw as Record<string, unknown> | null;
  if (!a || typeof a.id !== "string" || !ID.test(a.id)) return null;
  if (a.mode !== "voice" && a.mode !== "text") return null;
  const startedAt = Number(a.startedAt);
  // A call starts at most a day before its evaluation and never in the future.
  if (!Number.isFinite(startedAt) || startedAt > now + 60_000 || startedAt < now - DAY) return null;
  const endedBy = a.endedBy === "patient" || a.endedBy === "operator" ? a.endedBy : null;
  const live = Array.isArray(a.live) ? a.live.filter((x): x is string => typeof x === "string").slice(0, 40) : [];
  return { id: a.id.toLowerCase(), mode: a.mode, startedAt, endedBy, live };
}

export function saveTraining(t: {
  attempt: NonNullable<ReturnType<typeof parseAttempt>>;
  userId: number;
  clinicId: number | null;
  scenarioId: string;
  /** Version of the clinic legend the call ran on; null for the shared demo clinic. */
  legendVersion?: number | null;
  transcript: Turn[];
  result: EvaluationResult;
  now?: number;
}) {
  const now = t.now ?? Date.now();
  const { attempt, result } = t;
  db()
    .prepare(
      `INSERT INTO trainings (id, user_id, clinic_id, scenario_id, mode, legend_version, started_at, duration_s, ended_by,
         transcript, live_checklist, scores, total, booked, evaluation, evaluated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET transcript = excluded.transcript, live_checklist = excluded.live_checklist,
         scores = excluded.scores, total = excluded.total, booked = excluded.booked, evaluation = excluded.evaluation,
         duration_s = excluded.duration_s, ended_by = excluded.ended_by, evaluated_at = excluded.evaluated_at
       WHERE trainings.user_id = excluded.user_id`,
    )
    .run(
      attempt.id,
      t.userId,
      t.clinicId,
      t.scenarioId,
      attempt.mode,
      t.legendVersion == null ? null : String(t.legendVersion),
      attempt.startedAt,
      Math.max(0, Math.round((now - attempt.startedAt) / 1000)),
      attempt.endedBy,
      JSON.stringify(t.transcript),
      JSON.stringify(attempt.live),
      JSON.stringify(result.scores),
      Math.round(result.total),
      result.appointmentBooked ? 1 : 0,
      JSON.stringify(result),
      now,
    );
}

export type Progress = { count: number; average: number | null; last7: { count: number; average: number | null }; change7: number | null };

/** What a trainee sees about themself: how many calls, the average score, and how the last 7 days compare to the 7 before. */
export function userProgress(userId: number, now = Date.now()): Progress {
  const q = db().prepare("SELECT COUNT(*) AS n, AVG(total) AS avg FROM trainings WHERE user_id = ? AND started_at >= ? AND started_at < ?");
  const all = q.get(userId, 0, now + DAY) as { n: number; avg: number | null };
  const last = q.get(userId, now - 7 * DAY, now + DAY) as { n: number; avg: number | null };
  const prev = q.get(userId, now - 14 * DAY, now - 7 * DAY) as { n: number; avg: number | null };
  const round = (v: number | null) => (v == null ? null : Math.round(v));
  return {
    count: all.n,
    average: round(all.avg),
    last7: { count: last.n, average: round(last.avg) },
    change7: last.avg != null && prev.avg != null ? Math.round(last.avg - prev.avg) : null,
  };
}
