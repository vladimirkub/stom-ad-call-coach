// The clinic manager sets their clinic up alone (when the clinic is "autonomous"): sites, offers, directions, wishes,
// former doctors and their own facts, then one rebuild. The rebuild reads the sites, adds the own facts and, if nothing
// that matters changed (prices, offers, payment, doctors), applies the new legend and refits the patients by itself;
// otherwise the manager reviews just those changes first. Every version can be returned to; Stom AD sees who did what.
import { db } from "./db.ts";
import {
  OWN_SOURCE, approveDraft, approvedLegend, cleanFacts, compareFacts, discardDraft, getFormerDoctors, getOffers, getSites, getWishes, legendHistory,
  setFormerDoctors, setOffers, setSites, setWishes, startAnalysis, workingLegend, type Fact, type SectionKey,
} from "./legend.ts";
import { getDirections, setDirections } from "./directions.ts";
import { personaFitState, startPersonaFit } from "./persona-fit.ts";
import pub from "./scenarios-public.json" with { type: "json" };

const PATIENTS = pub.length;

/** Rebuilds a manager may start in 24 hours: each one reads the sites and refits every patient. */
export const REBUILDS_PER_DAY = 5;
/** Changes in these sections wait for the manager's review; the rest applies by itself. */
export const SIGNIFICANT: SectionKey[] = ["services", "promotions", "payment", "doctors"];

export function isAutonomous(clinicId: number): boolean {
  const row = db().prepare("SELECT autonomous FROM clinics WHERE id = ?").get(clinicId) as { autonomous: number } | undefined;
  return !!row?.autonomous;
}

export function setAutonomous(clinicId: number, on: boolean) {
  db().prepare("UPDATE clinics SET autonomous = ? WHERE id = ?").run(on ? 1 : 0, clinicId);
}

/** The manager's own facts: what the site does not say (parking, installment terms), added to every rebuild. */
export function getOwnFacts(clinicId: number): Fact[] {
  const row = db().prepare("SELECT own_facts FROM clinics WHERE id = ?").get(clinicId) as { own_facts: string } | undefined;
  if (!row) throw new Error("Клиника не найдена");
  return JSON.parse(row.own_facts || "[]");
}

export function setOwnFacts(clinicId: number, raw: unknown): Fact[] {
  const facts = cleanFacts(raw)
    .filter((f) => f.section !== "missing")
    .map((f) => ({ ...f, source: OWN_SOURCE }))
    .slice(0, 40);
  db().prepare("UPDATE clinics SET own_facts = ? WHERE id = ?").run(JSON.stringify(facts), clinicId);
  return facts;
}

const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** The drafted facts with the manager's own ones, which replace any earlier copy of themselves. */
export function withOwnFacts(drafted: Fact[], own: Fact[]): Fact[] {
  const ownTexts = new Set(own.map((f) => norm(f.text)));
  return [...drafted.filter((f) => f.source !== OWN_SOURCE && !ownTexts.has(norm(f.text))), ...own];
}

/** What the draft changes in prices, offers, payment and doctors against the approved version. */
export function significantChanges(draft: Fact[], approved: Fact[]) {
  const pick = (fs: Fact[]) => fs.filter((f) => SIGNIFICANT.includes(f.section));
  return compareFacts(pick(draft), pick(approved));
}

export function rebuildsToday(clinicId: number, now = Date.now()): number {
  return (
    db().prepare("SELECT COUNT(*) AS n FROM rebuilds WHERE clinic_id = ? AND started_at > ?").get(clinicId, now - 24 * 3600_000) as { n: number }
  ).n;
}

type Saved = { sites?: unknown; offers?: unknown; directions?: unknown; wishes?: unknown; formerDoctors?: unknown; ownFacts?: unknown };

/** Saves the setup fields the manager sent (each one only when present). Former doctors take effect at once. */
export function saveSetup(clinicId: number, raw: Saved) {
  if (raw.sites !== undefined) setSites(clinicId, raw.sites);
  if (raw.offers !== undefined) setOffers(clinicId, raw.offers);
  if (raw.directions !== undefined) setDirections(clinicId, raw.directions);
  if (raw.wishes !== undefined) setWishes(clinicId, raw.wishes);
  if (raw.formerDoctors !== undefined) setFormerDoctors(clinicId, raw.formerDoctors);
  if (raw.ownFacts !== undefined) setOwnFacts(clinicId, raw.ownFacts);
}

/** Applies the manager's draft as the next version and refits the patients. */
export function applyDraft(clinicId: number, author: string, rawFacts?: unknown, fit: typeof startPersonaFit = startPersonaFit) {
  approveDraft(clinicId, rawFacts, { author, note: "Пересборка" });
  fit(clinicId);
}

/**
 * The manager's rebuild: reads the sites and offers anew, adds the own facts, then either applies the result at once
 * (nothing significant changed) or leaves it as a draft for review. Trainings keep the current version meanwhile.
 */
export function startRebuild(clinicId: number, author: string, deps?: Parameters<typeof startAnalysis>[1], fit: typeof startPersonaFit = startPersonaFit) {
  if (!getWishes(clinicId).trim()) throw new Error("Заполните пожелания к тренировке: без них пересборка не запускается");
  if (!getSites(clinicId).length && !getOffers(clinicId).trim()) throw new Error("Добавьте хотя бы один сайт или текст рекламных офферов");
  if (rebuildsToday(clinicId) >= REBUILDS_PER_DAY) throw new Error(`Сегодня уже ${REBUILDS_PER_DAY} пересборок. Следующая будет доступна через сутки после первой.`);
  const started = startAnalysis(clinicId, deps, {
    origin: "manager",
    author,
    onDraft: () => {
      const draft = workingLegend(clinicId);
      if (!draft || draft.status !== "draft") return;
      const facts = withOwnFacts(draft.facts, getOwnFacts(clinicId));
      db().prepare("UPDATE legends SET facts = ? WHERE id = ?").run(JSON.stringify(facts), draft.id);
      const approved = approvedLegend(clinicId);
      const changes = significantChanges(facts, approved?.facts ?? []);
      if (approved && !changes.added.length && !changes.removed.length) applyDraft(clinicId, author, undefined, fit);
    },
  });
  db().prepare("INSERT INTO rebuilds (clinic_id, started_at) VALUES (?, ?)").run(clinicId, Date.now());
  return started;
}

/** Returns to an older version: it becomes the next version (history stays whole) and the patients are refitted. */
export function rollbackTo(clinicId: number, version: number, author: string, fit: typeof startPersonaFit = startPersonaFit) {
  const working = workingLegend(clinicId);
  if (working?.status === "analyzing") throw new Error("Дождитесь окончания пересборки");
  const row = db().prepare("SELECT facts FROM legends WHERE clinic_id = ? AND version = ? AND status IN ('approved', 'archived')").get(clinicId, version) as { facts: string } | undefined;
  if (!row) throw new Error("Такой версии нет");
  if (approvedLegend(clinicId)?.version === version) throw new Error("Эта версия уже текущая");
  discardDraft(clinicId);
  const back = approveDraft(clinicId, JSON.parse(row.facts), { author, note: `Возврат к версии ${version}` });
  db().prepare("UPDATE legends SET origin = 'rollback' WHERE id = ?").run(back.id);
  fit(clinicId);
}

/** Everything the manager's setup page shows. */
export function setupState(clinicId: number) {
  const approved = approvedLegend(clinicId);
  const working = workingLegend(clinicId);
  const review = working?.status === "draft" && working.origin === "manager";
  return {
    sites: getSites(clinicId),
    offers: getOffers(clinicId),
    directions: getDirections(clinicId),
    wishes: getWishes(clinicId),
    formerDoctors: getFormerDoctors(clinicId),
    ownFacts: getOwnFacts(clinicId),
    version: approved?.version ?? null,
    rebuild: working?.origin === "manager" ? { status: working.status, error: working.error, startedAt: working.createdAt } : null,
    // The draft waiting for the manager: its significant changes, and all its facts for "Поправить факты".
    review: review ? { changes: significantChanges(working.facts, approved?.facts ?? []), facts: working.facts } : null,
    patients: (() => {
      const p = personaFitState(clinicId);
      return p && { status: p.status, error: p.error, ready: Object.keys(p.personas).length, total: PATIENTS };
    })(),
    rebuildsLeft: Math.max(0, REBUILDS_PER_DAY - rebuildsToday(clinicId)),
    history: legendHistory(clinicId),
  };
}
