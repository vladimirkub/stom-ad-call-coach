// Evaluation checklist: 21 criteria, grouped by skill. Skill scores are computed from it in code.
export const SKILL_KEYS = ["discovery", "objectionHandling", "booking", "showUp"] as const;
export type SkillKey = (typeof SKILL_KEYS)[number];

export type RubricItem = {
  id: string;
  skill: SkillKey;
  label: string;
  // Only meaningful for training scenarios with a known hidden objection (skipped for real calls).
  scenarioOnly?: boolean;
};

export const RUBRIC: RubricItem[] = [
  { id: "introduced", skill: "discovery", label: "Представился и назвал клинику" },
  { id: "askedConvenient", skill: "discovery", label: "Спросил, удобно ли говорить" },
  { id: "confirmedRequest", skill: "discovery", label: "Подтвердил заявку и что интересует пациента" },
  { id: "openQuestions", skill: "discovery", label: "Задал открытые вопросы о причинах и переживаниях" },
  { id: "empathy", skill: "discovery", label: "Проявил сочувствие и не перебивал" },
  { id: "uncoveredHidden", skill: "discovery", label: "Вывел пациента на настоящую причину сомнений", scenarioOnly: true },

  { id: "acknowledgedObjection", skill: "objectionHandling", label: "Признал возражение, прежде чем отвечать" },
  { id: "answeredByFacts", skill: "objectionHandling", label: "Ответил по фактам, а не общими словами" },
  { id: "honestUnknown", skill: "objectionHandling", label: "Честно сказал «уточню», когда не знал ответа" },
  { id: "noPressure", skill: "objectionHandling", label: "Не давил и не торопил" },
  { id: "noFalsePromises", skill: "objectionHandling", label: "Не обещал недостоверного и не выдумывал фактов" },

  { id: "offeredSlots", skill: "booking", label: "Предложил конкретные варианты времени (лучше два)" },
  { id: "respectedConstraints", skill: "booking", label: "Учёл ограничения пациента по времени и месту" },
  { id: "explainedFormat", skill: "booking", label: "Объяснил, что будет на приёме (формат, бесплатная диагностика)" },
  { id: "gotAgreement", skill: "booking", label: "Получил явное согласие на конкретную запись" },
  { id: "clearNextStep", skill: "booking", label: "Закончил чётким следующим шагом, а не «я подумаю»" },

  { id: "repeatedDetails", skill: "showUp", label: "Повторил дату, время и формат приёма" },
  { id: "route", skill: "showUp", label: "Объяснил, как добраться, или пообещал отправить адрес" },
  { id: "askedObstacles", skill: "showUp", label: "Спросил, что может помешать прийти" },
  { id: "gotCommitment", skill: "showUp", label: "Получил чёткое «приду», а не «постараюсь»" },
  { id: "reminderAndReschedule", skill: "showUp", label: "Договорился о напоминании и о переносе заранее" },
];
