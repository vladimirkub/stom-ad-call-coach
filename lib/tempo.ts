// Call tempo: a real patient gives a clinic a few minutes, so a training call should book within 3. What decides
// whether the patient stays is relevance, not the clock (lib/patient-behavior.ts, rule 9): a stalling operator gets one
// warning, then loses the patient; one who answers on point keeps her. The clock only adds time notes: at 3 minutes,
// "one minute left" at 4, a polite goodbye before the 5-minute cap. These numbers also drive the call timer and the
// «Записал пациента за 3 минуты» checklist item.
export const TEMPO = {
  /** Target length of a voice call. */
  targetSeconds: 180,
  /** The timer turns amber here: time to close on a booking. */
  warnSeconds: 150,
  /** Hard cap: ElevenLabs ends the call. The patient says goodbye before it (the wrap-up note). */
  maxSeconds: 300,
  /** Text mode has no clock worth trusting (typing is slower than speech): the target is in operator replies. */
  targetTextReplies: 10,
} as const;

export type TempoStage = "target" | "lastMinute" | "wrapUp";

/** When each time note goes to the patient: seconds into a voice call, operator replies in a text one. */
export const TEMPO_NOTES: { stage: TempoStage; voiceSeconds: number; textReplies: number }[] = [
  { stage: "target", voiceSeconds: TEMPO.targetSeconds, textReplies: TEMPO.targetTextReplies },
  { stage: "lastMinute", voiceSeconds: 240, textReplies: 12 },
  { stage: "wrapUp", voiceSeconds: 275, textReplies: 14 },
];

/** The note itself: guidance the patient acts on without saying it aloud. */
export const TEMPO_NOTE_TEXT: Record<TempoStage, string> = {
  target:
    "[Служебная пометка, не произноси её] Разговор идёт уже около трёх минут. Если оператор отвечает на твои вопросы по делу, продолжай как обычно, можно мимоходом заметить, что времени у тебя немного. Если он буксует, уходит от ответов или говорит долго и не по делу, сделай предупреждение по правилу ТЕМП.",
  lastMinute:
    "[Служебная пометка, не произноси её] Прошло около четырёх минут. В следующей реплике своими словами скажи, что у тебя осталась буквально минута, и попроси коротко договориться о главном: время записи или что тебе пришлют.",
  wrapUp:
    "[Служебная пометка, не произноси её] Время разговора вышло. В следующей реплике коротко и вежливо попрощайся в своём характере (например: «мне уже бежать надо, пришлите, пожалуйста, всё в СМС» или «я сама перезвоню»). Если запись уже согласована, подтверди её одной фразой. Сразу после прощания вызови end_call.",
};

/** The latest note a text call has reached, by the operator's replies so far. */
export function textTempoStage(operatorReplies: number): TempoStage | null {
  return TEMPO_NOTES.filter((n) => operatorReplies >= n.textReplies).at(-1)?.stage ?? null;
}

/** Whether the call fit the tempo target: by duration in voice, by the operator's replies in text. */
export function onTime(mode: "voice" | "text", durationS: number, operatorReplies: number): boolean {
  return mode === "voice" ? durationS <= TEMPO.targetSeconds : operatorReplies <= TEMPO.targetTextReplies;
}
