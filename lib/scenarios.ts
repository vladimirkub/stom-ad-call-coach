// Server-only: merges public data with the secret persona prompt and hidden objection, fitted to the trainee's clinic.
import pub from "./scenarios-public.json" with { type: "json" };
import priv from "./scenarios-private.json" with { type: "json" };
import { patientPrompt } from "./patient-behavior.ts";
import { clinicContext, clinicDoctor, personaVars, type ClinicContext } from "./clinic-context.ts";
import { fillHours } from "./clinic-hours.ts";
import { fillFormer } from "./former-doctors.ts";
import type { CallDirection } from "./direction.ts";

/**
 * A call variant (Viktor's warranty claim, Sergey's complaint): what the patient knows in this call and the truth for the judge. The page
 * picks one per call and shows its treatment record (scenarios-public.json) to the administrator.
 */
/** urgent: the right handling is to route the patient to a doctor now, not to book a visit (lib/scoring.ts). */
type Variant = { patient: string; judge: string; specialty?: string; urgent?: boolean };
type Visit = { date: string; work: string; tooth: string; warranty?: string; doctor?: string };
export type TreatmentRecord = { patient: string; visits: Visit[]; rules: string };
/** today: what the patient knows about today that the fit must not rewrite, such as the late slot ("{{slot}}"). */
type Private = { voiceId: string; prompt: string; judgeNote?: string; today?: string; variants?: Record<string, Variant> };

export const scenarioIds = pub.map((s) => s.id);

/**
 * The variant asked for, or the patient's first one; null for patients without variants. "{{doctor}}" in its texts
 * becomes this clinic's treating doctor for the variant's specialty (lib/clinic-context.ts).
 */
function pickVariant(secret: Private, variant: unknown, ctx: ClinicContext): ({ id: string; doctor: string } & Variant) | null {
  const ids = Object.keys(secret.variants ?? {});
  if (!ids.length) return null;
  const id = typeof variant === "string" && ids.includes(variant) ? variant : ids[0];
  const v = secret.variants![id];
  const doctor = clinicDoctor(ctx, v.specialty);
  const fill = (text: string) => fillFormer(fillHours(text.replaceAll("{{doctor}}", doctor), ctx), ctx, id);
  return { id, doctor, ...v, patient: fill(v.patient), judge: fill(v.judge) };
}

/** The clinic's record for this call variant, with the treating doctor filled in; null when there is none. */
export function scenarioRecord(ctx: ClinicContext, id: string, variant: unknown): TreatmentRecord | null {
  const open = pub.find((s) => s.id === id);
  const v = pickVariant((priv as Record<string, Private>)[id] ?? { voiceId: "", prompt: "" }, variant, ctx);
  const record = v && open && "variants" in open ? ((open.variants as { id: string; record?: TreatmentRecord }[] | undefined)?.find((x) => x.id === v.id)?.record) : undefined;
  if (!v || !record) return null;
  return JSON.parse(fillHours(JSON.stringify(record).replaceAll("{{doctor}}", v.doctor), ctx)) as TreatmentRecord;
}

/** The patient's dynamic variables for this clinic, direction and call variant (text fills them in, voice passes them). */
export function scenarioVars(ctx: ClinicContext, id: string, direction: CallDirection = "outbound", variant?: unknown) {
  const vars = personaVars(ctx, id, direction);
  const secret = (priv as Record<string, Private>)[id] ?? { voiceId: "", prompt: "" };
  const v = pickVariant(secret, variant, ctx);
  const situation = [vars.situation, secret.today && fillHours(secret.today, ctx), v?.patient].filter(Boolean).join("\n\n");
  return { ...vars, situation };
}

/** The patient's opening line for this clinic and call variant (the late patient names its last slot, Yuri his doctor). */
export function firstLine(ctx: ClinicContext, id: string, variant: string = "d1"): string {
  return fillFormer(fillHours(pub.find((s) => s.id === id)?.firstMessage ?? "", ctx), ctx, variant);
}

/** A patient as this clinic's trainees meet them (the shared demo clinic when `ctx` is omitted). */
export function getScenario(id: unknown, ctx: ClinicContext = clinicContext(null), direction: CallDirection = "outbound", variant?: unknown) {
  const open = pub.find((s) => s.id === id);
  const secret = (priv as Record<string, Private>)[String(id)];
  if (!open || !secret) return null;
  const fit = ctx.personas[open.id];
  const v = pickVariant(secret, variant, ctx);
  const record = v ? (scenarioRecord(ctx, open.id, v.id) ?? undefined) : undefined;
  return {
    ...open,
    firstMessage: firstLine(ctx, open.id, v?.id),
    voiceId: secret.voiceId,
    lead: fit.lead,
    hiddenObjection: fit.hiddenObjection,
    showUpRisk: fit.showUpRisk,
    // How the judge should score this patient's condition of the day; kept off the trainee's pages.
    judgeNote: secret.judgeNote && fillHours(secret.judgeNote, ctx),
    // This call's variant: the record the administrator saw and the truth behind the complaint, for the judge.
    variant: v && { id: v.id, judge: v.judge, urgent: !!v.urgent, record },
    prompt: patientPrompt(secret.prompt, scenarioVars(ctx, open.id, direction, v?.id)),
  };
}
