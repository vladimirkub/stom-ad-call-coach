// Which way the training call goes. Outbound: the clinic calls back a patient who left a request after an ad.
// Inbound: the patient saw the ad or the site and calls the clinic; the administrator picks up and speaks first.
// The patients, the clinic legend and the scoring are the same; the patient's rule 1, a few checklist items and the
// call screen differ.
export type CallDirection = "outbound" | "inbound";

export const DIRECTIONS: { key: CallDirection; label: string; hint: string }[] = [
  { key: "outbound", label: "Исходящий", hint: "Перезваниваете по заявке" },
  { key: "inbound", label: "Входящий", hint: "Пациент звонит сам" },
];

export function parseDirection(raw: unknown): CallDirection {
  return raw === "inbound" ? "inbound" : "outbound";
}
