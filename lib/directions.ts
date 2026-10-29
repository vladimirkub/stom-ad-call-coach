// Treatment directions a clinic works in, and which patient comes for which. The owner ticks the clinic's
// directions in the legend tab; every ticked direction gets at least one patient whose age and story suit it, the rest
// go where they fit best. No ticks: patients keep their own problem (the behaviour before directions existed).
import { db } from "./db.ts";
import type { Fact } from "./legend.ts";

export const DIRECTIONS = [
  { key: "single_implant", label: "Одиночная имплантация", hint: "один-два зуба на имплантах", match: /имплант|osstem|straumann|megagen|nobel|зуб под ключ/i },
  { key: "full_arch", label: "Тотальная реабилитация", hint: "все зубы, All-on-4/6, «зубы за 1 день»", match: /all[- ]?on|все зубы|за 1 день|за один день|тотальн|полн\w* (челюст|протез|восстановл)/i },
  { key: "ortho", label: "Ортодонтия", hint: "брекеты, элайнеры, исправление прикуса", match: /брекет|элайнер|ортодонт|прикус|капп/i },
  { key: "prosthetics", label: "Протезирование", hint: "коронки, виниры, мосты, съёмные протезы", match: /коронк|винир|протез|мост/i },
  { key: "therapy", label: "Лечение зубов", hint: "кариес, пульпит, пломбы, гигиена", match: /кариес|пульпит|пломб|гигиен|лечени\w* (зуб|канал)/i },
  { key: "kids", label: "Детская стоматология", hint: "лечение зубов у детей", match: /детск|молочн|ребён|ребен/i },
] as const;
export type DirectionKey = (typeof DIRECTIONS)[number]["key"];
const KEYS = DIRECTIONS.map((d) => d.key) as DirectionKey[];

/** How naturally each patient fits each direction, most natural first (age, family, story, hidden reason). */
export const PREFERENCES: Record<string, DirectionKey[]> = {
  elena: ["full_arch", "prosthetics", "single_implant", "therapy", "ortho", "kids"], // 58, almost no lower teeth, removable denture
  nikolay: ["single_implant", "prosthetics", "full_arch", "therapy", "ortho", "kids"], // 63, one tooth, the daughter applied
  igor: ["single_implant", "full_arch", "prosthetics", "therapy", "ortho", "kids"], // 52, compares prices across clinics
  svetlana: ["single_implant", "prosthetics", "therapy", "ortho", "full_arch", "kids"], // 47, two teeth, hides it from her husband
  marina: ["single_implant", "kids", "ortho", "therapy", "prosthetics", "full_arch"], // 41, works, two children
  dmitry: ["single_implant", "ortho", "therapy", "prosthetics", "full_arch", "kids"], // 36, busy, afraid of pain
  olga: ["ortho", "kids", "therapy", "prosthetics", "single_implant", "full_arch"], // 39, braces for her 14-year-old son
  artem: ["therapy", "single_implant", "prosthetics", "ortho", "full_arch", "kids"], // 29, acute pain, short of money
  alina: ["prosthetics", "ortho", "therapy", "single_implant", "kids", "full_arch"], // 28, veneers before her wedding
  valentina: ["prosthetics", "full_arch", "single_implant", "therapy", "ortho", "kids"], // 71, loose removable denture
};

export const directionLabel = (key: string) => DIRECTIONS.find((d) => d.key === key)?.label ?? key;

/**
 * Which patient comes for which of the clinic's directions: the split where every direction has a patient, patients
 * stay close to their natural story (cost grows with the square of the rank, so one odd fit costs more than two slight
 * ones) and no direction gets far more than its share. Exact, by dynamic programming over how many patients each
 * direction has so far (a few thousand states instead of 6^10 splits).
 */
export function assignDirections(selected: string[]): Record<string, DirectionKey> {
  const chosen = KEYS.filter((k) => selected.includes(k));
  if (chosen.length === 0) return {};
  const patients = Object.keys(PREFERENCES);
  const share = Math.ceil(patients.length / chosen.length);
  const need = Math.min(chosen.length, patients.length);
  type State = { counts: number[]; cost: number; pick: DirectionKey[] };
  let states = new Map<string, State>([["", { counts: chosen.map(() => 0), cost: 0, pick: [] }]]);
  for (const p of patients) {
    const next = new Map<string, State>();
    for (const s of states.values()) {
      chosen.forEach((d, i) => {
        const counts = s.counts.map((n, j) => (j === i ? n + 1 : n));
        const cost = s.cost + PREFERENCES[p].indexOf(d) ** 2;
        const key = counts.join();
        if (!next.has(key) || cost < next.get(key)!.cost) next.set(key, { counts, cost, pick: [...s.pick, d] });
      });
    }
    states = next;
  }
  let best: State | undefined;
  let bestCost = Infinity;
  for (const s of states.values()) {
    if (s.counts.filter((n) => n > 0).length < need) continue;
    const cost = s.cost + 2 * s.counts.reduce((sum, n) => sum + Math.max(0, n - share) ** 2, 0);
    if (cost < bestCost) [bestCost, best] = [cost, s];
  }
  return Object.fromEntries(patients.map((p, j) => [p, best!.pick[j]]));
}

/** Directions the legend's facts mention, as a starting point for the owner's ticks. */
export function suggestDirections(facts: Fact[]): DirectionKey[] {
  const text = facts.filter((f) => f.section !== "missing").map((f) => f.text).join("\n");
  return DIRECTIONS.filter((d) => d.match.test(text)).map((d) => d.key);
}

export function getDirections(clinicId: number): DirectionKey[] {
  const row = db().prepare("SELECT directions FROM clinics WHERE id = ?").get(clinicId) as { directions: string } | undefined;
  if (!row) throw new Error("Клиника не найдена");
  return JSON.parse(row.directions) as DirectionKey[];
}

export function setDirections(clinicId: number, raw: unknown): DirectionKey[] {
  if (!Array.isArray(raw)) throw new Error("Направления должны быть списком");
  const keys = KEYS.filter((k) => raw.includes(k));
  const r = db().prepare("UPDATE clinics SET directions = ? WHERE id = ?").run(JSON.stringify(keys), clinicId);
  if (!r.changes) throw new Error("Клиника не найдена");
  return keys;
}
