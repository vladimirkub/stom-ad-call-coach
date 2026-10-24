import { RUBRIC, SKILL_KEYS, type RubricItem, type SkillKey } from "./rubric.ts";

export const SKILLS = [
  { key: "discovery", label: "Контакт и выявление потребностей", weight: 0.25, hint: "Представился, уточнил запрос, открытые вопросы, нашёл скрытую причину" },
  { key: "objectionHandling", label: "Работа с возражениями", weight: 0.3, hint: "Эмпатия, ответы по фактам сайта, без выдумок и давления" },
  { key: "booking", label: "Запись на приём", weight: 0.25, hint: "Конкретные дата и время, выбор из вариантов, чёткий следующий шаг" },
  { key: "showUp", label: "Гарантия явки", weight: 0.2, hint: "Повтор деталей, как добраться, препятствия, подтверждение, напоминание" },
] as const;

export type { SkillKey };
export type Scores = Record<SkillKey, number>;
export type ChecklistItem = RubricItem & { done: boolean; evidence?: string };

/** Skill score 0-10 = share of passed checklist items. Deterministic, never model-computed. */
export function skillScores(items: Pick<ChecklistItem, "skill" | "done">[]): Scores {
  const out = {} as Scores;
  for (const key of SKILL_KEYS) {
    const group = items.filter((i) => i.skill === key);
    out[key] = group.length ? Math.round((10 * group.filter((i) => i.done).length) / group.length) : 0;
  }
  return out;
}

/** Weighted total on a 0-100 scale from four 0-10 skill scores. */
export function totalScore(scores: Scores): number {
  const sum = SKILLS.reduce((acc, s) => acc + (scores[s.key] / 10) * s.weight, 0);
  return Math.round(sum * 100);
}

/** Rubric applicable to this evaluation (real calls have no known hidden objection). */
export function rubricFor(real: boolean): RubricItem[] {
  return RUBRIC.filter((r) => !(real && r.scenarioOnly));
}
