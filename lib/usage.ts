// Voice usage per clinic and administrator. The browser reports each ElevenLabs conversation when it connects; the exact
// length and price come from ElevenLabs afterwards (syncUsage), so a closed tab or a lost "call ended" still counts.
import { db } from "./db.ts";
import { recommendPlan, USD_RUB } from "./plans.ts";

export type CallKind = "patient" | "operator";
type Conversation = { status?: string; metadata?: { call_duration_secs?: number; charging?: { platform_price?: number; llm_price?: number } } };
export type FetchConversation = (id: string) => Promise<Conversation | null>;

const DAY = 864e5;
const CONVERSATION_ID = /^conv_[A-Za-z0-9]{8,64}$/;
const FINAL = new Set(["done", "failed", "missing"]);
/** Gemini's share of an evaluated call (live checklist and review), an estimate: ElevenLabs reports only its own part. */
const GEMINI_PER_TRAINING_USD = 0.03;

/** Remembers who started this conversation. Returns false for an id that does not look like ElevenLabs'. */
export function recordCall(c: { conversationId: unknown; userId: number; clinicId: number | null; kind: CallKind; scenarioId: string | null; now?: number }) {
  if (typeof c.conversationId !== "string" || !CONVERSATION_ID.test(c.conversationId)) return false;
  db()
    .prepare("INSERT OR IGNORE INTO usage (conversation_id, user_id, clinic_id, kind, scenario_id, started_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(c.conversationId, c.userId, c.clinicId, c.kind, c.scenarioId, c.now ?? Date.now());
  return true;
}

export const fetchConversation: FetchConversation = async (id) => {
  const res = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(id)}`, {
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "" },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}`);
  return (await res.json()) as Conversation;
};

/**
 * Fills in length and price for calls ElevenLabs has finished processing. Bounded per run (the admin page calls it on
 * every load); a call still unknown to ElevenLabs a day later is marked missing and no longer asked about.
 */
export async function syncUsage(fetchOne: FetchConversation = fetchConversation, now = Date.now(), limit = 60) {
  const rows = db()
    .prepare(
      `SELECT conversation_id AS id, started_at AS startedAt FROM usage
       WHERE (status IS NULL OR status NOT IN ('done', 'failed', 'missing')) AND started_at < ? ORDER BY started_at DESC LIMIT ?`,
    )
    .all(now - 20_000, limit) as { id: string; startedAt: number }[];
  const update = db().prepare("UPDATE usage SET duration_s = ?, cost_usd = ?, status = ?, synced_at = ? WHERE conversation_id = ?");
  let failed = 0;
  for (let i = 0; i < rows.length; i += 5) {
    await Promise.all(
      rows.slice(i, i + 5).map(async (r) => {
        try {
          const c = await fetchOne(r.id);
          if (!c) {
            if (now - r.startedAt > DAY) update.run(0, 0, "missing", now, r.id);
            return;
          }
          const charging = c.metadata?.charging;
          const cost = charging ? (charging.platform_price ?? 0) + (charging.llm_price ?? 0) : null;
          update.run(c.metadata?.call_duration_secs ?? null, cost, c.status ?? null, now, r.id);
        } catch {
          failed++;
        }
      }),
    );
  }
  return { checked: rows.length, failed };
}

type Row = {
  userId: number; firstName: string; lastName: string; login: string; role: string; clinicId: number | null;
  calls30: number; patientS30: number; operatorS30: number; cost30: number; pending30: number;
  callsAll: number; secondsAll: number; costAll: number; text30: number; evaluated30: number;
};

const minutes = (s: number) => Math.round((s / 60) * 10) / 10;
const rub = (usd: number) => Math.round(usd * USD_RUB);

/** Per administrator, per clinic and in total: voice minutes, calls, text trainings and our cost; plus the plan each clinic's last 30 days point to. */
export function usageReport(now = Date.now()) {
  const since = now - 30 * DAY;
  const rows = db()
    .prepare(
      `SELECT u.id AS userId, u.first_name AS firstName, u.last_name AS lastName, u.login, u.role, u.clinic_id AS clinicId,
         COALESCE(v.calls30, 0) AS calls30, COALESCE(v.patientS30, 0) AS patientS30, COALESCE(v.operatorS30, 0) AS operatorS30,
         COALESCE(v.cost30, 0) AS cost30, COALESCE(v.pending30, 0) AS pending30,
         COALESCE(v.callsAll, 0) AS callsAll, COALESCE(v.secondsAll, 0) AS secondsAll, COALESCE(v.costAll, 0) AS costAll,
         COALESCE(t.text30, 0) AS text30, COALESCE(t.evaluated30, 0) AS evaluated30
       FROM users u
       LEFT JOIN (
         SELECT user_id,
           SUM(started_at >= ?) AS calls30,
           SUM(CASE WHEN started_at >= ? AND kind = 'patient' THEN COALESCE(duration_s, 0) ELSE 0 END) AS patientS30,
           SUM(CASE WHEN started_at >= ? AND kind = 'operator' THEN COALESCE(duration_s, 0) ELSE 0 END) AS operatorS30,
           SUM(CASE WHEN started_at >= ? THEN COALESCE(cost_usd, 0) ELSE 0 END) AS cost30,
           SUM(started_at >= ? AND (status IS NULL OR status NOT IN ('done', 'failed', 'missing'))) AS pending30,
           COUNT(*) AS callsAll, SUM(COALESCE(duration_s, 0)) AS secondsAll, SUM(COALESCE(cost_usd, 0)) AS costAll
         FROM usage GROUP BY user_id
       ) v ON v.user_id = u.id
       LEFT JOIN (
         SELECT user_id, SUM(mode = 'text') AS text30, COUNT(*) AS evaluated30 FROM trainings WHERE started_at >= ? GROUP BY user_id
       ) t ON t.user_id = u.id
       ORDER BY u.last_name, u.first_name`,
    )
    .all(since, since, since, since, since, since) as Row[];

  const person = (r: Row) => {
    const costUsd = r.cost30 + r.evaluated30 * GEMINI_PER_TRAINING_USD;
    return {
      id: r.userId,
      name: `${r.lastName} ${r.firstName}`.trim(),
      login: r.login,
      calls30: r.calls30,
      minutes30: minutes(r.patientS30 + r.operatorS30),
      patientMinutes30: minutes(r.patientS30),
      operatorMinutes30: minutes(r.operatorS30),
      text30: r.text30,
      pending30: r.pending30,
      costRub30: rub(costUsd),
      minutesAll: minutes(r.secondsAll),
      active30: r.calls30 + r.evaluated30 > 0,
    };
  };
  const sum = (people: ReturnType<typeof person>[]) => ({
    calls30: people.reduce((s, p) => s + p.calls30, 0),
    minutes30: minutes(people.reduce((s, p) => s + p.minutes30 * 60, 0)),
    text30: people.reduce((s, p) => s + p.text30, 0),
    pending30: people.reduce((s, p) => s + p.pending30, 0),
    costRub30: people.reduce((s, p) => s + p.costRub30, 0),
    minutesAll: minutes(people.reduce((s, p) => s + p.minutesAll * 60, 0)),
  });

  const clinics = (db().prepare("SELECT id, legal_name AS legalName, city FROM clinics ORDER BY legal_name").all() as { id: number; legalName: string; city: string }[]).map((c) => {
    const users = rows.filter((r) => r.clinicId === c.id && r.role === "trainee").map(person);
    const seats = (db().prepare("SELECT COUNT(*) AS n FROM users WHERE clinic_id = ? AND role = 'trainee' AND active = 1").get(c.id) as { n: number }).n;
    const totals = sum(users);
    return { ...c, seats, active30: users.filter((u) => u.active30).length, ...totals, plan: recommendPlan(seats, totals.minutes30), users };
  });
  const owner = rows.filter((r) => r.role === "owner").map(person);
  const clinicTotals = sum(clinics.flatMap((c) => c.users));
  return { usdRub: USD_RUB, totals: clinicTotals, owner: sum(owner), clinics: clinics.sort((a, b) => b.minutes30 - a.minutes30 || b.minutesAll - a.minutesAll) };
}
