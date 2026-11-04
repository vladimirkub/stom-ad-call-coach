// Server-only: merges public data with the secret persona prompt and hidden objection, fitted to the trainee's clinic.
import pub from "./scenarios-public.json" with { type: "json" };
import priv from "./scenarios-private.json" with { type: "json" };
import { patientPrompt } from "./patient-behavior.ts";
import { clinicContext, personaVars, type ClinicContext } from "./clinic-context.ts";
import type { CallDirection } from "./direction.ts";

/**
 * A call variant (Viktor's warranty claim): what the patient knows in this call and the truth for the judge. The page
 * picks one per call and shows its treatment record (scenarios-public.json) to the administrator.
 */
type Variant = { patient: string; judge: string };
type Private = { voiceId: string; prompt: string; judgeNote?: string; variants?: Record<string, Variant> };

export const scenarioIds = pub.map((s) => s.id);

/** The variant asked for, or the patient's first one; null for patients without variants. */
function pickVariant(secret: Private, variant: unknown): { id: string } & Variant | null {
  const ids = Object.keys(secret.variants ?? {});
  if (!ids.length) return null;
  const id = typeof variant === "string" && ids.includes(variant) ? variant : ids[0];
  return { id, ...secret.variants![id] };
}

/** The patient's dynamic variables for this clinic, direction and call variant (text fills them in, voice passes them). */
export function scenarioVars(ctx: ClinicContext, id: string, direction: CallDirection = "outbound", variant?: unknown) {
  const vars = personaVars(ctx, id, direction);
  const v = pickVariant((priv as Record<string, Private>)[id] ?? { voiceId: "", prompt: "" }, variant);
  return v ? { ...vars, situation: `${vars.situation}\n\n${v.patient}` } : vars;
}

/** A patient as this clinic's trainees meet them (the shared demo clinic when `ctx` is omitted). */
export function getScenario(id: unknown, ctx: ClinicContext = clinicContext(null), direction: CallDirection = "outbound", variant?: unknown) {
  const open = pub.find((s) => s.id === id);
  const secret = (priv as Record<string, Private>)[String(id)];
  if (!open || !secret) return null;
  const fit = ctx.personas[open.id];
  const v = pickVariant(secret, variant);
  const record = v && "variants" in open ? open.variants?.find((x) => x.id === v.id)?.record : undefined;
  return {
    ...open,
    voiceId: secret.voiceId,
    lead: fit.lead,
    hiddenObjection: fit.hiddenObjection,
    showUpRisk: fit.showUpRisk,
    // How the judge should score this patient's condition of the day; kept off the trainee's pages.
    judgeNote: secret.judgeNote,
    // This call's variant: the record the administrator saw and the truth behind the complaint, for the judge.
    variant: v && { id: v.id, judge: v.judge, record },
    prompt: patientPrompt(secret.prompt, scenarioVars(ctx, open.id, direction, v?.id)),
  };
}
