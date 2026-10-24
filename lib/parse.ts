import type { Turn } from "./schemas.ts";

const OPERATOR = /^(оператор|админ|администратор|менеджер|сотрудник|о)$/i;
const PATIENT = /^(пациент|клиент|п)$/i;

/** Parses "Оператор: ..." / "Пациент: ..." lines; continuation lines are appended to the previous turn. */
export function parseTranscript(text: string): Turn[] {
  const turns: Turn[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([А-Яа-яЁё]+)\s*[:\-–—]\s*(.*)$/);
    const role = m ? (OPERATOR.test(m[1]) ? "user" : PATIENT.test(m[1]) ? "agent" : null) : null;
    if (m && role) {
      if (m[2].trim()) turns.push({ role, text: m[2].trim().slice(0, 2000) });
    } else if (line.trim() && turns.length) {
      const last = turns[turns.length - 1];
      last.text = `${last.text} ${line.trim()}`.slice(0, 2000);
    }
  }
  return turns.slice(0, 100);
}

export type SpokenTurn = { speaker: string; text: string };
type Word = { text?: string; type?: string; speaker_id?: string };

/** Groups diarized words (ElevenLabs Scribe response) into speaker turns, in order of speaking. */
export function groupBySpeaker(words: Word[] | undefined, fallbackText = ""): SpokenTurn[] {
  const turns: SpokenTurn[] = [];
  for (const w of words ?? []) {
    if (w.type !== "word" || !w.text) continue;
    const speaker = w.speaker_id ?? "speaker_0";
    const last = turns[turns.length - 1];
    if (last && last.speaker === speaker) last.text += ` ${w.text}`;
    else turns.push({ speaker, text: w.text });
  }
  if (!turns.length && fallbackText.trim()) turns.push({ speaker: "speaker_0", text: fallbackText.trim() });
  return turns;
}

/** Renders speaker turns as "Оператор:/Пациент:" lines given which speaker is the operator. */
export function formatTurns(turns: SpokenTurn[], operator: string): string {
  return turns.map((t) => `${t.speaker === operator ? "Оператор" : "Пациент"}: ${t.text}`).join("\n");
}
