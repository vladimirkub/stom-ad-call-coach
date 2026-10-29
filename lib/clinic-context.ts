// What a training knows about the trainee's clinic: the operator memo, the facts the patients "read", and the
// patients adapted to its services, prices and offers. Built from the clinic's approved legend; without one (or for the
// owner) it is the shared demo clinic from clinic.json and the default personas.
import pub from "./scenarios-public.json" with { type: "json" };
import priv from "./scenarios-private.json" with { type: "json" };
import clinic from "./clinic.json" with { type: "json" };
import { db } from "./db.ts";
import { SECTIONS, type Fact } from "./legend.ts";

export type PersonaFit = { lead: string; situation: string; concerns: string; hiddenObjection: string; showUpRisk: string; direction?: string };
export type ClinicContext = {
  clinicId: number | null;
  legendVersion: number | null;
  memo: string[];
  siteFacts: string;
  personas: Record<string, PersonaFit>;
};

type Private = { hiddenObjection: string; showUpRisk: string; situation: string; concerns: string };

export function defaultPersonas(): Record<string, PersonaFit> {
  return Object.fromEntries(
    pub.map((s) => {
      const p = (priv as Record<string, Private>)[s.id];
      return [s.id, { lead: s.lead, situation: p.situation, concerns: p.concerns, hiddenObjection: p.hiddenObjection, showUpRisk: p.showUpRisk }];
    }),
  );
}

const label = (key: string) => SECTIONS.find((s) => s.key === key)?.label ?? key;

/** The operator's memo: one line per section, "missing" last as a warning not to invent. */
export function memoFromFacts(facts: Fact[]): string[] {
  const lines: string[] = [];
  for (const s of SECTIONS) {
    if (s.key === "missing") continue;
    const items = facts.filter((f) => f.section === s.key).map((f) => f.text.replace(/\.$/, ""));
    if (items.length) lines.push(`${s.label}: ${items.join("; ")}.`);
  }
  const missing = facts.filter((f) => f.section === "missing").map((f) => f.text.replace(/\.$/, ""));
  if (missing.length) lines.push(`Чего на сайте НЕТ: ${missing.join("; ")}. Не выдумывайте: уточните у врача на консультации или пришлите в СМС после записи.`);
  return lines;
}

/** What the patients know about the clinic: only what its ads and site say. */
export function siteFactsFromFacts(facts: Fact[]): string {
  const known = facts.filter((f) => f.section !== "missing").map((f) => `- ${label(f.section)}: ${f.text}`);
  const missing = facts.filter((f) => f.section === "missing").map((f) => f.text.replace(/\.$/, ""));
  return [
    "ЧТО ТЫ ВИДЕЛ(А) В РЕКЛАМЕ И ПРОЧИТАЛ(А) НА САЙТЕ СТОМАТОЛОГИЧЕСКОЙ КЛИНИКИ и запомнил(а) — больше о клинике ты ничего не знаешь:",
    ...known,
    ...(missing.length ? [`- Чего ты на сайте НЕ нашёл(ла): ${missing.join("; ")}.`] : []),
  ].join("\n");
}

const DEFAULT: ClinicContext = { clinicId: null, legendVersion: null, memo: clinic.memo, siteFacts: clinic.promptFacts, personas: defaultPersonas() };

/** The context for a clinic (null: the shared demo). Adapted patients are used once their adaptation for this version is ready. */
export function clinicContext(clinicId: number | null | undefined): ClinicContext {
  if (clinicId == null) return DEFAULT;
  const row = db().prepare("SELECT version, facts, personas, personas_status FROM legends WHERE clinic_id = ? AND status = 'approved'").get(clinicId) as
    | { version: number; facts: string; personas: string; personas_status: string | null }
    | undefined;
  if (!row) return { ...DEFAULT, clinicId };
  const facts = JSON.parse(row.facts) as Fact[];
  const fitted = row.personas_status === "ready" ? (JSON.parse(row.personas) as Record<string, PersonaFit>) : {};
  return {
    clinicId,
    legendVersion: row.version,
    memo: memoFromFacts(facts),
    siteFacts: siteFactsFromFacts(facts),
    personas: { ...DEFAULT.personas, ...fitted },
  };
}

/** The dynamic variables of a voice patient: the same clinic-specific text the text mode gets. */
export function personaVars(ctx: ClinicContext, scenarioId: string) {
  const p = ctx.personas[scenarioId];
  return { situation: p.situation, concerns: p.concerns, site_facts: ctx.siteFacts };
}
