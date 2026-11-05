// Which way the training call goes. Outbound: the clinic calls back a patient who left a request after an ad.
// Inbound: the patient saw the ad or the site and calls the clinic; the administrator picks up and speaks first.
// The patients, the clinic legend and the scoring are the same; the patient's rule 1, a few checklist items and the
// call screen differ. Patients whose story is their own call to the clinic ("inboundOnly" in scenarios-public.json:
// a warranty claim, a wrong number, a symptom) are never called back, so their calls are always inbound.
import pub from "./scenarios-public.json" with { type: "json" };

export type CallDirection = "outbound" | "inbound";

/** Patients who only ever call the clinic themselves. */
export const INBOUND_ONLY: ReadonlySet<string> = new Set(pub.filter((s) => "inboundOnly" in s && s.inboundOnly).map((s) => s.id));

export const DIRECTIONS: { key: CallDirection; label: string; hint: string }[] = [
  { key: "outbound", label: "Исходящий", hint: "Перезваниваете по заявке" },
  { key: "inbound", label: "Входящий", hint: "Пациент звонит сам" },
];

export function parseDirection(raw: unknown): CallDirection {
  return raw === "inbound" ? "inbound" : "outbound";
}

/** The direction of a call with this patient: the one asked for, except that inbound-only patients always call in. */
export function callDirection(scenarioId: unknown, raw: unknown): CallDirection {
  return typeof scenarioId === "string" && INBOUND_ONLY.has(scenarioId) ? "inbound" : parseDirection(raw);
}

/** Whether this patient takes calls in this direction (the grid and /call leave the others out). */
export function servesDirection(scenarioId: string, direction: CallDirection): boolean {
  return direction === "inbound" || !INBOUND_ONLY.has(scenarioId);
}

/**
 * Sent to the voice patient right after an inbound call connects, before the administrator says anything. Without it
 * the model, holding no line of its own yet, sometimes took an opening like "алло?" or "кто это?" as a call to it and
 * answered as the clinic. A contextual update anchors the role; the rule in the prompt alone did not.
 */
export const INBOUND_START_NOTE =
  "Служебная пометка, не произноси: ты ПАЦИЕНТ и сейчас сам звонишь в стоматологическую клинику. Идут гудки, сейчас трубку возьмёт администратор клиники. Всё, что он скажет, говорит клиника; ты отвечаешь как звонящий пациент и никогда не говоришь от имени клиники.";
