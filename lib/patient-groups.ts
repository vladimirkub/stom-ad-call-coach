// Patients grouped by the kind of objection they train, for the tabs above the patient grid. Each patient in
// scenarios-public.json names its group; a tab shows that group's patients, "Все" shows everyone.

export const PATIENT_GROUPS = [
  { key: "price", label: "Цена", hint: "сомневаются в цене и выгоде" },
  { key: "time", label: "Время", hint: "некогда, срочно, к сроку" },
  { key: "family", label: "Семья", hint: "решают не одни" },
  { key: "trust", label: "Недоверие", hint: "боятся, что обманут" },
  { key: "claim", label: "Претензии", hint: "недовольны прошлым лечением" },
  // The label hides the twist (a call to the wrong clinic) so the administrator meets it in the call.
  { key: "wrong", label: "Нестандартные", hint: "необычные звонки" },
  { key: "expert", label: "Знание услуг", hint: "проверяют, знает ли администратор услугу" },
] as const;
export type PatientGroup = (typeof PATIENT_GROUPS)[number]["key"];

/** The tab shown: one group, or every patient. */
export type GroupTab = PatientGroup | "all";

export function parseGroupTab(v: unknown): GroupTab {
  return PATIENT_GROUPS.some((g) => g.key === v) ? (v as PatientGroup) : "all";
}
