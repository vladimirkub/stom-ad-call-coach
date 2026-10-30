// Owner statistics over the training history: all clinics, one clinic, one trainee, one call.
// Only trainees count (the owner's own test calls are left out). Windows are rolling: last 7 / 30 days.
import { db } from "./db.ts";
import { SKILL_KEYS, type SkillKey } from "./rubric.ts";
import { rubricFor } from "./scoring.ts";
import { TEMPO } from "./tempo.ts";
import scenarios from "./scenarios-public.json" with { type: "json" };

const DAY = 864e5;
const round = (v: number | null | undefined) => (v == null ? null : Math.round(v));
const round1 = (v: number | null | undefined) => (v == null ? null : Math.round(v * 10) / 10);
const scenarioName = (id: string) => scenarios.find((s) => s.id === id)?.name ?? id;
const skillAverages = (where: string, ...args: (number | string)[]) => {
  const cols = SKILL_KEYS.map((k) => `AVG(json_extract(t.scores, '$.${k}')) AS ${k}`).join(", ");
  const row = db().prepare(`SELECT ${cols} FROM trainings t JOIN users u ON u.id = t.user_id WHERE u.role = 'trainee' AND ${where}`).get(...args) as Record<SkillKey, number | null>;
  return Object.fromEntries(SKILL_KEYS.map((k) => [k, round1(row[k])])) as Record<SkillKey, number | null>;
};

/** Checklist items missed most often across these evaluated calls, with the share of calls that missed each. */
function topMisses(rows: { evaluation: string }[], limit = 6) {
  const rubric = rubricFor(false);
  const missed = new Map<string, number>();
  for (const r of rows) {
    const checklist = (JSON.parse(r.evaluation) as { checklist?: { id: string; done: boolean }[] }).checklist ?? [];
    for (const item of checklist) if (!item.done) missed.set(item.id, (missed.get(item.id) ?? 0) + 1);
  }
  return [...missed.entries()]
    .map(([id, n]) => ({ id, label: rubric.find((r) => r.id === id)?.label ?? id, count: n, share: Math.round((100 * n) / rows.length) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function overview(now = Date.now()) {
  const totals = db()
    .prepare(
      `SELECT SUM(t.started_at >= ?) AS d7, COUNT(*) AS d30, COUNT(DISTINCT CASE WHEN t.started_at >= ? THEN t.user_id END) AS active7, AVG(t.total) AS avg30
       FROM trainings t JOIN users u ON u.id = t.user_id WHERE u.role = 'trainee' AND t.started_at >= ?`,
    )
    .get(now - 7 * DAY, now - 7 * DAY, now - 30 * DAY) as { d7: number | null; d30: number; active7: number; avg30: number | null };
  const clinics = db()
    .prepare(
      `SELECT c.id, c.legal_name AS legalName, c.city,
         (SELECT COUNT(*) FROM users u WHERE u.clinic_id = c.id AND u.role = 'trainee' AND u.active = 1) AS users,
         COUNT(DISTINCT CASE WHEN t.started_at >= ? THEN t.user_id END) AS active7,
         SUM(t.started_at >= ?) AS trainings7, SUM(t.started_at >= ?) AS trainings30,
         AVG(CASE WHEN t.started_at >= ? THEN t.total END) AS avg30, MAX(t.started_at) AS lastAt
       FROM clinics c LEFT JOIN trainings t ON t.clinic_id = c.id
       GROUP BY c.id ORDER BY lastAt IS NULL, lastAt DESC, c.legal_name`,
    )
    .all(now - 7 * DAY, now - 7 * DAY, now - 30 * DAY, now - 30 * DAY) as {
    id: number; legalName: string; city: string; users: number; active7: number; trainings7: number | null; trainings30: number | null; avg30: number | null; lastAt: number | null;
  }[];
  return {
    totals: { trainings7: totals.d7 ?? 0, trainings30: totals.d30, activeUsers7: totals.active7, average30: round(totals.avg30) },
    clinics: clinics.map((c) => ({ ...c, trainings7: c.trainings7 ?? 0, trainings30: c.trainings30 ?? 0, avg30: round(c.avg30) })),
  };
}

export function clinicStats(clinicId: number, now = Date.now()) {
  const clinic = db().prepare("SELECT id, legal_name AS legalName, slug, city FROM clinics WHERE id = ?").get(clinicId) as
    | { id: number; legalName: string; slug: string; city: string }
    | undefined;
  if (!clinic) return null;
  const users = db()
    .prepare(
      `SELECT u.id, u.first_name AS firstName, u.last_name AS lastName, u.login, u.active,
         COUNT(t.id) AS count, AVG(t.total) AS average,
         AVG(CASE WHEN t.started_at >= ? THEN t.total END) AS avg7,
         AVG(CASE WHEN t.started_at >= ? AND t.started_at < ? THEN t.total END) AS avgPrev7,
         SUM(t.booked) AS booked, MAX(t.started_at) AS lastAt,
         AVG(CASE WHEN t.mode = 'voice' THEN t.duration_s END) AS voiceAvgS,
         SUM(t.mode = 'voice') AS voiceCalls, SUM(t.mode = 'voice' AND t.duration_s <= ?) AS voiceOnTime
       FROM users u LEFT JOIN trainings t ON t.user_id = u.id
       WHERE u.clinic_id = ? AND u.role = 'trainee' GROUP BY u.id ORDER BY lastAt IS NULL, lastAt DESC, u.last_name`,
    )
    .all(now - 7 * DAY, now - 14 * DAY, now - 7 * DAY, TEMPO.targetSeconds, clinicId) as {
    id: number; firstName: string; lastName: string; login: string; active: number; count: number; average: number | null; avg7: number | null; avgPrev7: number | null; booked: number | null; lastAt: number | null;
    voiceAvgS: number | null; voiceCalls: number | null; voiceOnTime: number | null;
  }[];

  // Most frequent misses over the last 30 days: which checklist items the team fails most often.
  const rows = db()
    .prepare("SELECT t.evaluation FROM trainings t JOIN users u ON u.id = t.user_id WHERE u.role = 'trainee' AND t.clinic_id = ? AND t.started_at >= ?")
    .all(clinicId, now - 30 * DAY) as { evaluation: string }[];
  const misses = topMisses(rows);

  return {
    clinic,
    calls30: rows.length,
    skills: skillAverages("t.clinic_id = ? AND t.started_at >= ?", clinicId, now - 30 * DAY),
    misses,
    users: users.map((u) => ({
      id: u.id, firstName: u.firstName, lastName: u.lastName, login: u.login, active: !!u.active,
      count: u.count, average: round(u.average), booked: u.booked ?? 0, lastAt: u.lastAt,
      change7: u.avg7 != null && u.avgPrev7 != null ? Math.round(u.avg7 - u.avgPrev7) : null,
      // Voice calls only: text has no clock worth trusting (lib/tempo.ts).
      voiceAvgS: u.voiceAvgS == null ? null : Math.round(u.voiceAvgS),
      onTimeShare: u.voiceCalls ? Math.round((100 * (u.voiceOnTime ?? 0)) / u.voiceCalls) : null,
    })),
  };
}

export function userStats(userId: number) {
  const user = db()
    .prepare(
      `SELECT u.id, u.first_name AS firstName, u.last_name AS lastName, u.login, u.active, c.id AS clinicId, c.legal_name AS clinicName
       FROM users u LEFT JOIN clinics c ON c.id = u.clinic_id WHERE u.id = ? AND u.role = 'trainee'`,
    )
    .get(userId) as { id: number; firstName: string; lastName: string; login: string; active: number; clinicId: number; clinicName: string } | undefined;
  if (!user) return null;
  const trainings = db()
    .prepare("SELECT id, scenario_id AS scenarioId, mode, started_at AS startedAt, duration_s AS duration, ended_by AS endedBy, total, booked FROM trainings WHERE user_id = ? ORDER BY started_at DESC LIMIT 200")
    .all(userId) as { id: string; scenarioId: string; mode: string; startedAt: number; duration: number; endedBy: string | null; total: number; booked: number }[];
  const avg = trainings.length ? Math.round(trainings.reduce((s, t) => s + t.total, 0) / trainings.length) : null;
  const evaluations = db().prepare("SELECT evaluation FROM trainings WHERE user_id = ?").all(userId) as { evaluation: string }[];
  return {
    user: { ...user, active: !!user.active },
    count: trainings.length,
    average: avg,
    booked: trainings.filter((t) => t.booked).length,
    skills: skillAverages("t.user_id = ?", userId),
    misses: topMisses(evaluations),
    trainings: trainings.map((t) => ({ ...t, booked: !!t.booked, patient: scenarioName(t.scenarioId) })),
  };
}

export function trainingDetail(id: string) {
  const t = db()
    .prepare(
      `SELECT t.id, t.scenario_id AS scenarioId, t.mode, t.started_at AS startedAt, t.duration_s AS duration, t.ended_by AS endedBy,
         t.transcript, t.live_checklist AS live, t.evaluation, u.first_name AS firstName, u.last_name AS lastName, u.id AS userId
       FROM trainings t JOIN users u ON u.id = t.user_id WHERE t.id = ?`,
    )
    .get(id) as Record<string, string | number | null> | undefined;
  if (!t) return null;
  return {
    id: String(t.id),
    patient: scenarioName(String(t.scenarioId)),
    trainee: `${t.firstName} ${t.lastName}`,
    userId: Number(t.userId),
    mode: String(t.mode),
    startedAt: Number(t.startedAt),
    duration: Number(t.duration),
    endedBy: t.endedBy == null ? null : String(t.endedBy),
    transcript: JSON.parse(String(t.transcript)) as { role: "user" | "agent"; text: string }[],
    live: JSON.parse(String(t.live)) as string[],
    evaluation: JSON.parse(String(t.evaluation)),
  };
}
