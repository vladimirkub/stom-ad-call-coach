// Server-only: merges public data with the secret persona prompt and hidden objection.
import pub from "./scenarios-public.json";
import priv from "./scenarios-private.json";
import clinic from "./clinic.json";

type Private = { voiceId: string; hiddenObjection: string; showUpRisk: string; prompt: string };

export const scenarioIds = pub.map((s) => s.id);

export function getScenario(id: unknown) {
  const open = pub.find((s) => s.id === id);
  const secret = (priv as Record<string, Private>)[String(id)];
  if (!open || !secret) return null;
  return { ...open, ...secret, prompt: secret.prompt.replace("{{SITE_FACTS}}", clinic.promptFacts) };
}
