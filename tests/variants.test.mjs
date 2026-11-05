import test from "node:test";
import assert from "node:assert/strict";

process.env.DB_PATH = ":memory:";
const { getScenario, scenarioVars } = await import("../lib/scenarios.ts");
const { clinicContext } = await import("../lib/clinic-context.ts");
const { evaluationPrompt } = await import("../lib/evaluation.ts");
const pub = (await import("../lib/scenarios-public.json", { with: { type: "json" } })).default;
const priv = (await import("../lib/scenarios-private.json", { with: { type: "json" } })).default;

test("every variant has the truth for the patient and the judge, and a record when the patient has one", () => {
  for (const s of pub.filter((x) => x.variants)) {
    const ids = s.variants.map((v) => v.id).sort();
    assert.deepEqual(Object.keys(priv[s.id].variants).sort(), ids, s.id);
    for (const v of s.variants) {
      // Patients either have a record in every variant (a claim checked in the base) or in none (Natalia's openers).
      assert.equal(!!v.record, !!s.variants[0].record, `${s.id}.${v.id}`);
      // A panel of its own (Gleb asks the staff) holds just their answer, which the patient does not know.
      if (v.record) assert.ok((s.recordPanel || v.record.visits.length > 0) && v.record.rules.length > 20, `${s.id}.${v.id}`);
      if (!s.recordPanel) assert.ok(priv[s.id].variants[v.id].patient.length > 50, `${s.id}.${v.id}`);
      assert.ok(priv[s.id].variants[v.id].judge.length > 50, `${s.id}.${v.id}`);
    }
  }
});

test("the call variant reaches the patient's situation and the judge; an unknown one falls back to the first", () => {
  const ctx = clinicContext(null);
  const match = getScenario("viktor", ctx, "inbound", "match");
  assert.equal(match.variant.id, "match");
  assert.match(match.prompt, /слетела коронка внизу слева/);
  assert.match(scenarioVars(ctx, "viktor", "inbound", "mismatch").situation, /выпала пломба внизу слева/);
  assert.equal(getScenario("viktor", ctx, "inbound", "nonsense").variant.id, pub.find((s) => s.id === "viktor").variants[0].id);
  assert.equal(getScenario("alina", ctx).variant, null);

  const transcript = [{ role: "user", text: "Здравствуйте" }];
  const opened = evaluationPrompt({ scenario: match, memo: [], transcript, recordOpenedAfter: 2 });
  assert.match(opened, /ВАРИАНТ ЗВОНКА: жалоба совпадает/);
  assert.match(opened, /Зуб 36: нижняя челюсть, слева/);
  assert.match(opened, /после своей реплики номер 2/);
  assert.match(evaluationPrompt({ scenario: match, memo: [], transcript }), /панель НЕ открывал/);
});

test("the treating doctor comes from the clinic's legend, by the complaint's specialty", async () => {
  const { clinicDoctor } = await import("../lib/clinic-context.ts");
  const { scenarioRecord } = await import("../lib/scenarios.ts");
  const doctors = [
    { section: "doctors", text: "Манин Андрей Викторович — директор клиники.", source: null },
    { section: "doctors", text: "Ли Марк — терапевт-эндодонтист со стажем 9 лет, лечит каналы.", source: null },
    { section: "doctors", text: "Колесников Евгений Игоревич — стоматолог-хирург, удаление зубов и имплантация.", source: null },
  ];
  const ctx = { ...clinicContext(null), facts: doctors };
  assert.equal(clinicDoctor(ctx, "хирург|удален"), "Колесников Евгений Игоревич");
  assert.equal(clinicDoctor(ctx, "эндодонт|канал|терапевт"), "Ли Марк");
  assert.equal(clinicDoctor(ctx), "Ли Марк", "the director is not a treating doctor");
  assert.equal(clinicDoctor(clinicContext(null)), "Петрова Снежана Денисовна");
  const record = scenarioRecord(ctx, "sergey", "extraction_swelling");
  assert.equal(record.visits[0].doctor, "Колесников Евгений Игоревич");
  assert.match(record.rules, /Колесников Евгений Игоревич сегодня не принимает/);
  assert.match(getScenario("sergey", ctx, "inbound", "root_canal").prompt, /Ли Марк лечил\(а\) тебе каналы/);
});

test("the late patient's slot, panel answer and judge note follow the clinic's closing time", () => {
  const ctx = { ...clinicContext(null), facts: [{ section: "contacts", text: "Пн–Пт 9:00–21:00, Сб–Вс 10:00–18:00" }] };
  const s = getScenario("gleb", ctx, "outbound", "cannot");
  assert.match(s.firstMessage, /свободное время на 20:20/);
  assert.match(s.firstMessage, /работаете до 21:00/);
  assert.match(s.prompt, /закрывается в 21:00; последнее свободное окно в онлайн-записи — 20:20/);
  assert.match(s.variant.record.rules, /после закрытия \(21:00\)/);
  assert.match(s.judgeNote, /\(20:20, клиника закрывается в 21:00\)/);
  assert.doesNotMatch(JSON.stringify([s.firstMessage, s.prompt, s.judgeNote, s.variant]), /\{\{(slot|close|late)\}\}/);
});
