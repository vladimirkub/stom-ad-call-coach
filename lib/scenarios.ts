// Server-only: merges public data with the secret persona prompt and hidden objection, fitted to the trainee's clinic.
import pub from "./scenarios-public.json" with { type: "json" };
import priv from "./scenarios-private.json" with { type: "json" };
import { patientPrompt } from "./patient-behavior.ts";
import { clinicContext, personaVars, type ClinicContext } from "./clinic-context.ts";

type Private = { voiceId: string; prompt: string };

export const scenarioIds = pub.map((s) => s.id);

/** A patient as this clinic's trainees meet them (the shared demo clinic when `ctx` is omitted). */
export function getScenario(id: unknown, ctx: ClinicContext = clinicContext(null)) {
  const open = pub.find((s) => s.id === id);
  const secret = (priv as Record<string, Private>)[String(id)];
  if (!open || !secret) return null;
  const fit = ctx.personas[open.id];
  return {
    ...open,
    voiceId: secret.voiceId,
    lead: fit.lead,
    hiddenObjection: fit.hiddenObjection,
    showUpRisk: fit.showUpRisk,
    prompt: patientPrompt(secret.prompt, personaVars(ctx, open.id)),
  };
}
