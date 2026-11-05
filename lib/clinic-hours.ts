// When the trainee's clinic closes, from the legend's «Часы работы и контакты» facts: the late patient (Gleb) books the
// last online slot, 40 minutes before closing. "{{close}}" and "{{slot}}" in his texts become these times.
import type { ClinicContext } from "./clinic-context.ts";

/** Used when the legend gives no hours (or the clinic is open round the clock). */
const DEFAULT_CLOSE = 21 * 60;
/** The last online slot starts this long before closing. */
const SLOT_BEFORE_CLOSE = 40;

const RANGE = /(\d{1,2})[:.](\d{2})\s*(?:[–—-]|до)\s*(\d{1,2})[:.](\d{2})/g;
const UNTIL = /до\s+(\d{1,2})[:.](\d{2})/g;

const hhmm = (minutes: number) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;

/** The latest evening closing time in the text ("Пн–Пт 9:00–21:00, Сб 10:00–18:00" → 21:00), in minutes; null if none. */
export function closingMinutes(text: string): number | null {
  const ends = [...text.matchAll(RANGE)].map((m) => Number(m[3]) * 60 + Number(m[4]));
  if (!ends.length) ends.push(...[...text.matchAll(UNTIL)].map((m) => Number(m[1]) * 60 + Number(m[2])));
  const evening = ends.filter((m) => m >= 15 * 60 && m < 24 * 60);
  return evening.length ? Math.max(...evening) : null;
}

/** Lines about the phone line's hours, not the clinic's ("Колл-центр работает с 08:00 до 22:00"). */
const PHONE_LINE = /колл|call|контакт-центр|горяч|оператор/i;

/** Today's closing time and the last online slot for this clinic. */
export function clinicHours(ctx: ClinicContext): { close: string; slot: string; late: string } {
  const lines = (ctx.facts ? ctx.facts.map((f) => ({ contacts: f.section === "contacts", text: f.text })) : ctx.siteFacts.split("\n").map((text) => ({ contacts: true, text })))
    .filter((l) => !PHONE_LINE.test(l.text));
  const contacts = lines.filter((l) => l.contacts).map((l) => l.text).join("\n");
  const all = lines.map((l) => l.text).join("\n");
  const close = closingMinutes(contacts) ?? closingMinutes(all) ?? DEFAULT_CLOSE;
  return { close: hhmm(close), slot: hhmm(close - SLOT_BEFORE_CLOSE), late: hhmm(close - SLOT_BEFORE_CLOSE + 5) };
}

/** The text with "{{close}}", "{{slot}}" and "{{late}}" (the slot plus five minutes) filled in for this clinic. */
export function fillHours(text: string, ctx: ClinicContext): string {
  if (!text.includes("{{")) return text;
  const { close, slot, late } = clinicHours(ctx);
  return text.replaceAll("{{close}}", close).replaceAll("{{slot}}", slot).replaceAll("{{late}}", late);
}
