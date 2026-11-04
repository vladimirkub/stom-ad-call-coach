import test from "node:test";
import assert from "node:assert/strict";

const { evaluationSystem, evaluationPrompt } = await import("../lib/evaluation.ts");
const { PATIENT_BEHAVIOR } = await import("../lib/patient-behavior.ts");

test("what the site does not mention is not a false claim, and installments are not advised unasked", () => {
  const s = evaluationSystem(false);
  assert.match(s, /ЧЕГО НЕТ НА САЙТЕ/);
  assert.match(s, /То, чего на сайте нет, сюда не попадает/);
  assert.match(s, /Не советуй предлагать рассрочку/);
  assert.match(s, /Никогда не приписывай пациенту/);
  assert.doesNotMatch(evaluationSystem(true), /objectionUncovered = true/);
});

test("the prompt carries the hidden reason only for a virtual patient", () => {
  const transcript = [{ role: "user", text: "Добрый день" }];
  const scenario = { name: "Дмитрий", age: 36, lead: "Заявка", hiddenObjection: "боится боли", showUpRisk: "не придёт" };
  assert.match(evaluationPrompt({ scenario, memo: ["Цены: 1 ₽."], transcript }), /боится боли[\s\S]*Цены: 1 ₽[\s\S]*\[1\] ОПЕРАТОР: Добрый день/);
  assert.match(evaluationPrompt({ scenario: null, memo: [], transcript }), /реального звонка/);
});

test("patients hint at the hidden reason early and ask about installments only when money is tight", () => {
  assert.match(PATIENT_BEHAVIOR, /Сначала намёк: уже во второй-третьей/);
  assert.match(PATIENT_BEHAVIOR, /Про рассрочку и кредит спрашивай, только если деньги для тебя правда проблема/);
});

test("the clinic's wishes reach the judge only when there are some", () => {
  const transcript = [{ role: "user", text: "Добрый день" }];
  assert.match(evaluationSystem(false, "outbound", true), /ПОЖЕЛАНИЯ КЛИНИКИ[\s\S]*"wishes":\[/);
  assert.doesNotMatch(evaluationSystem(false), /ПОЖЕЛАНИЯ КЛИНИКИ|"wishes"/);
  assert.match(evaluationPrompt({ scenario: null, memo: [], transcript, wishes: "Проверить наркоз" }), /Пожелания клиники к тренировке[\s\S]*Проверить наркоз/);
  assert.doesNotMatch(evaluationPrompt({ scenario: null, memo: [], transcript }), /Пожелания/);
});

test("the judge counts a named day and time as a booking and knows when the patient hung up", () => {
  assert.match(evaluationSystem(false), /даже если оператор уже не успел это подтвердить/);
  assert.match(evaluationSystem(false), /"agreedTurn":0/);
  assert.doesNotMatch(evaluationSystem(false), /ЗВОНОК ЗАКОНЧИЛ ПАЦИЕНТ/);
  assert.match(evaluationSystem(false, "outbound", false, true), /ЗВОНОК ЗАКОНЧИЛ ПАЦИЕНТ/);
});

test("a patient's condition of the day reaches the judge", () => {
  const scenario = { name: "Кирилл", age: 44, lead: "-", hiddenObjection: "-", showUpRisk: "-", condition: "На сегодня свободных окон нет." };
  assert.match(evaluationPrompt({ scenario, memo: [], transcript: [{ role: "user", text: "Здравствуйте" }] }), /УСЛОВИЕ ТРЕНИРОВКИ \(оператор его знал\): На сегодня свободных окон нет\./);
  assert.doesNotMatch(evaluationPrompt({ scenario: { ...scenario, condition: undefined }, memo: [], transcript: [{ role: "user", text: "Здравствуйте" }] }), /УСЛОВИЕ ТРЕНИРОВКИ/);
});
