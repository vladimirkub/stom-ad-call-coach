// Call tempo: a real patient gives a clinic about two minutes, so a training call should book within 2.5. The patient
// prompt makes slow operators lose the patient (lib/patient-behavior.ts, rule 9); these numbers drive the agents' limits,
// the call timer and the «Уложился в 2,5 минуты» checklist item.
export const TEMPO = {
  /** Target length of a voice call. */
  targetSeconds: 150,
  /** The timer turns amber here: time to close on a booking. */
  warnSeconds: 120,
  /** Hard cap: ElevenLabs ends the call. */
  maxSeconds: 240,
  /** Text mode has no clock worth trusting (typing is slower than speech): the target is in operator replies. */
  targetTextReplies: 8,
} as const;

/** Whether the call fit the tempo target: by duration in voice, by the operator's replies in text. */
export function onTime(mode: "voice" | "text", durationS: number, operatorReplies: number): boolean {
  return mode === "voice" ? durationS <= TEMPO.targetSeconds : operatorReplies <= TEMPO.targetTextReplies;
}
