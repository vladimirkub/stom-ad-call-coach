import { RUBRIC, SKILL_KEYS, type RubricItem, type SkillKey } from "./rubric.ts";
import type { CallDirection } from "./direction.ts";

export const SKILLS = [
  { key: "discovery", label: "Контакт и выявление потребностей", weight: 0.25, hint: "Представился, уточнил запрос, открытые вопросы, нашёл скрытую причину" },
  { key: "objectionHandling", label: "Работа с возражениями", weight: 0.3, hint: "Эмпатия, ответы по фактам сайта, без выдумок и давления" },
  { key: "booking", label: "Запись на приём", weight: 0.25, hint: "Конкретные дата и время, выбор из вариантов, чёткий следующий шаг" },
  { key: "showUp", label: "Гарантия явки", weight: 0.2, hint: "Повтор деталей, как добраться, препятствия, подтверждение, напоминание" },
] as const;

export type { SkillKey };
/** null: nothing in this skill could be judged (every item was cut off, see ChecklistItem.cutOff). */
export type Scores = Record<SkillKey, number | null>;
/** cutOff: the patient agreed to a time and hung up before the operator could answer, so this item is not counted. */
export type ChecklistItem = RubricItem & { done: boolean; evidence?: string; cutOff?: boolean };

/** Closing items the operator can only do after the patient's agreement: not counted when the patient hangs up at once. */
export const CUT_OFF_IDS = ["clearNextStep", "gotContact", "repeatedDetails", "route", "askedObstacles", "gotCommitment", "reminderAndReschedule"];

/** Skill score 0-10 = share of passed checklist items, cut-off items left out. Deterministic, never model-computed. */
export function skillScores(items: Pick<ChecklistItem, "skill" | "done" | "cutOff">[]): Scores {
  const out = {} as Scores;
  for (const key of SKILL_KEYS) {
    const group = items.filter((i) => i.skill === key && !i.cutOff);
    out[key] = group.length ? Math.round((10 * group.filter((i) => i.done).length) / group.length) : null;
  }
  return out;
}

/** Weighted total on a 0-100 scale from four 0-10 skill scores; a skill that could not be judged gives its weight to the rest. */
export function totalScore(scores: Scores): number {
  const judged = SKILLS.filter((s) => scores[s.key] !== null);
  const weight = judged.reduce((acc, s) => acc + s.weight, 0);
  if (!weight) return 0;
  const sum = judged.reduce((acc, s) => acc + ((scores[s.key] ?? 0) / 10) * s.weight, 0);
  return Math.round((sum / weight) * 100);
}

/** Rubric applicable to this evaluation (real calls have no known hidden objection) and call direction. */
export function rubricFor(real: boolean, direction: CallDirection = "outbound"): RubricItem[] {
  return RUBRIC.filter((r) => !(real && r.scenarioOnly) && (!r.only || r.only === direction));
}

/** The part of the rubric the model judges from the transcript; `auto` items are decided in code. */
export function modelRubric(real: boolean, direction: CallDirection = "outbound"): RubricItem[] {
  return rubricFor(real, direction).filter((r) => !r.auto);
}
