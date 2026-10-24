// Shared knowledge base of best practices learned from virtual-operator calls.
// Stored as one JSON file (no database); entries are injected into the operator's instructions on every new call.
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

export type KbKind = "do" | "avoid";
export type KbEntry = {
  id: string;
  kind: KbKind;
  situation: string; // when it applies, e.g. "пациент говорит «дорого»"
  advice: string;
  example?: string; // a concrete phrase
  confirmations: number; // how many calls confirmed it
  createdAt: number;
  lastSeenAt: number;
  sourceRole?: string; // patient role of the first call that produced it
};
export type Kb = { version: 1; entries: KbEntry[] };

export const MAX_ENTRIES = 60;
export const MAX_ADD_PER_CALL = 3;
const LIMITS = { situation: 90, advice: 240, example: 200 };

const KB_PATH = process.env.KB_PATH || join(process.cwd(), "data", "knowledge-base.json");

// The KB is fed back into a prompt, so anything that looks like an instruction, price, discount or promise is rejected.
const FORBIDDEN = [
  /игнорир|ignore|disregard|forget|system|ты теперь|новые инструкции|промпт|prompt/i,
  /\d[\d\s.,]*\s?(₽|руб|р\.|%|процент|евро|€|\$)/i,
  /скидк|акци[яи] до|рассрочк[уа] на|гаранти(я|ю) на/i,
  /https?:\/\/|@\w|\b\d{3}[\s-]?\d{2}[\s-]?\d{2}\b/i,
];

const clean = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").replace(/[<>`{}]/g, "").trim().slice(0, max);

/** Returns a sanitized entry or null if it must not enter the knowledge base. */
export function sanitizeCandidate(c: { kind?: unknown; situation?: unknown; advice?: unknown; example?: unknown }): Pick<KbEntry, "kind" | "situation" | "advice" | "example"> | null {
  if (c.kind !== "do" && c.kind !== "avoid") return null;
  const situation = clean(c.situation, LIMITS.situation);
  const advice = clean(c.advice, LIMITS.advice);
  const example = clean(c.example, LIMITS.example) || undefined;
  if (situation.length < 5 || advice.length < 15) return null;
  if ([situation, advice, example ?? ""].some((t) => FORBIDDEN.some((re) => re.test(t)))) return null;
  return { kind: c.kind, situation, advice, example };
}

export type Learning = { add: unknown[]; reinforce: string[] };

/** Pure merge: reinforce existing entries, add sanitized new ones (deduplicated), prune to MAX_ENTRIES. */
export function applyLearning(kb: Kb, learning: Learning, meta: { now?: number; sourceRole?: string; allowDo?: boolean } = {}): { kb: Kb; added: number; reinforced: number } {
  const now = meta.now ?? Date.now();
  const entries = kb.entries.map((e) => ({ ...e }));
  let reinforced = 0;
  for (const id of new Set(learning.reinforce)) {
    const e = entries.find((x) => x.id === id);
    if (e && (e.kind === "avoid" || meta.allowDo !== false)) {
      e.confirmations += 1;
      e.lastSeenAt = now;
      reinforced++;
    }
  }
  let added = 0;
  for (const raw of learning.add.slice(0, MAX_ADD_PER_CALL)) {
    const c = sanitizeCandidate((raw ?? {}) as Record<string, unknown>);
    if (!c) continue;
    if (c.kind === "do" && meta.allowDo === false) continue;
    const key = (t: string) => t.toLowerCase().replace(/[^a-zа-я0-9]/g, "");
    if (entries.some((e) => e.kind === c.kind && key(e.advice) === key(c.advice))) continue;
    entries.push({ id: randomUUID().slice(0, 8), ...c, confirmations: 1, createdAt: now, lastSeenAt: now, sourceRole: meta.sourceRole });
    added++;
  }
  entries.sort((a, b) => b.confirmations - a.confirmations || b.lastSeenAt - a.lastSeenAt);
  return { kb: { version: 1, entries: entries.slice(0, MAX_ENTRIES) }, added, reinforced };
}

/** The practices injected into the operator's instructions: the most confirmed first. */
export function selectPractices(kb: Kb, limits = { do: 8, avoid: 4 }) {
  const ranked = [...kb.entries].sort((a, b) => b.confirmations - a.confirmations || b.lastSeenAt - a.lastSeenAt);
  return {
    dos: ranked.filter((e) => e.kind === "do").slice(0, limits.do),
    avoids: ranked.filter((e) => e.kind === "avoid").slice(0, limits.avoid),
  };
}

// --- persistence (single JSON file, serialized writes, atomic rename) ---
let queue: Promise<unknown> = Promise.resolve();

export async function loadKb(): Promise<Kb> {
  try {
    const parsed = JSON.parse(await readFile(KB_PATH, "utf8"));
    return Array.isArray(parsed?.entries) ? { version: 1, entries: parsed.entries } : { version: 1, entries: [] };
  } catch {
    return { version: 1, entries: [] };
  }
}

/** Read-modify-write under a lock so concurrent calls cannot lose each other's updates. */
export function updateKb<T>(fn: (kb: Kb) => { kb: Kb; value: T }): Promise<T> {
  const run = queue.then(async () => {
    const { kb, value } = fn(await loadKb());
    await mkdir(dirname(KB_PATH), { recursive: true });
    const tmp = `${KB_PATH}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(kb, null, 2));
    await rename(tmp, KB_PATH);
    return value;
  });
  queue = run.catch(() => undefined);
  return run;
}
