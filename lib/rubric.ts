// Evaluation checklist: 22 criteria for a callback (23 for an inbound call), grouped by skill. Skill scores are computed
// from it in code.
import type { CallDirection } from "./direction.ts";
export const SKILL_KEYS = ["discovery", "objectionHandling", "booking", "showUp"] as const;
export type SkillKey = (typeof SKILL_KEYS)[number];

export type RubricItem = {
  id: string;
  skill: SkillKey;
  label: string;
  // Only meaningful for training scenarios with a known hidden objection (skipped for real calls).
  scenarioOnly?: boolean;
  // Decided in code from the call itself, not by the model (neither the evaluation nor the live checklist sees it).
  auto?: boolean;
  // Only for calls in this direction (lib/direction.ts); without it the item applies to both.
  only?: CallDirection;
};

export const RUBRIC: RubricItem[] = [
  { id: "introduced", skill: "discovery", label: "Представился и назвал клинику" },
  { id: "askedConvenient", skill: "discovery", label: "Спросил, удобно ли говорить", only: "outbound" },
  { id: "confirmedRequest", skill: "discovery", label: "Подтвердил заявку и что интересует пациента", only: "outbound" },
  { id: "askedName", skill: "discovery", label: "Узнал имя пациента и обращался по имени", only: "inbound" },
  { id: "clarifiedRequest", skill: "discovery", label: "Выяснил, что интересует пациента и откуда он узнал о клинике", only: "inbound" },
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
  { id: "gotContact", skill: "booking", label: "Попросил телефон и объяснил зачем: подтверждение и напоминание", only: "inbound" },
  { id: "clearNextStep", skill: "booking", label: "Закончил чётким следующим шагом, а не «я подумаю»" },
  { id: "onTime", skill: "booking", label: "Записал пациента за 3 минуты (в тексте — за 10 реплик)", scenarioOnly: true, auto: true },

  { id: "repeatedDetails", skill: "showUp", label: "Повторил дату, время и формат приёма" },
  { id: "route", skill: "showUp", label: "Объяснил, как добраться, или пообещал отправить адрес" },
  { id: "askedObstacles", skill: "showUp", label: "Спросил, что может помешать прийти" },
  { id: "gotCommitment", skill: "showUp", label: "Получил чёткое «приду», а не «постараюсь»" },
  { id: "reminderAndReschedule", skill: "showUp", label: "Договорился о напоминании и о переносе заранее" },
];
