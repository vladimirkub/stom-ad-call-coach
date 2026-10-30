import test from "node:test";
import assert from "node:assert/strict";

process.env.DB_PATH = ":memory:";
process.env.PASSWORD_KEY = "test-password-key-test-password-key-0123";

const auth = await import("../lib/auth.ts");
const L = await import("../lib/legend.ts");
const C = await import("../lib/clinic-context.ts");
const { getScenario, scenarioIds } = await import("../lib/scenarios.ts");
const { startPersonaFit, personaFitState } = await import("../lib/persona-fit.ts");
const clinic = (await import("../lib/clinic.json", { with: { type: "json" } })).default;

const until = async (cond) => {
  for (let i = 0; i < 200 && !cond(); i++) await new Promise((r) => setTimeout(r, 10));
};

test("without a legend every patient is the shared demo, with no placeholder left in the prompt", () => {
  const ctx = C.clinicContext(null);
  assert.deepEqual(ctx.memo, clinic.memo);
  for (const id of scenarioIds) {
    const s = getScenario(id, ctx);
    assert.doesNotMatch(s.prompt, /\{\{\w+\}\}/, id);
    assert.ok(s.prompt.includes(ctx.personas[id].situation), id);
    assert.ok(s.prompt.includes(clinic.promptFacts), id);
  }
  assert.match(getScenario("elena").prompt, /Все зубы за 1 день от 91 000/);
});

const facts = [
  { section: "services", text: "Лечение кариеса молочных зубов от 6 500 ₽.", source: "https://kids.ru/price" },
  { section: "promotions", text: "Первичный осмотр 0 ₽ до 30 ноября", source: "offers" },
  { section: "contacts", text: "Ежедневно 9–21", source: "https://kids.ru/" },
  { section: "missing", text: "Нет условий рассрочки.", source: null },
];

test("a clinic legend becomes the operator memo and what the patients have read", () => {
  const memo = C.memoFromFacts(facts);
  assert.deepEqual(memo, [
    "Услуги и цены: Лечение кариеса молочных зубов от 6 500 ₽.",
    "Акции и сроки: Первичный осмотр 0 ₽ до 30 ноября.",
    "Часы работы и контакты: Ежедневно 9–21.",
    "Чего на сайте НЕТ: Нет условий рассрочки. Не выдумывайте: уточните у врача на консультации или пришлите в СМС после записи.",
  ]);
  const read = C.siteFactsFromFacts(facts);
  assert.match(read, /- Услуги и цены: Лечение кариеса молочных зубов от 6 500 ₽\./);
  assert.match(read, /НЕ нашёл\(ла\): Нет условий рассрочки\./);
});

test("fitted patients are used only once ready; until then the shared ones", async () => {
  const clinicId = auth.createClinic({ legalName: "ООО «Детская»", slug: "kids", city: "Самара" });
  L.saveDraft(clinicId, facts);
  L.approveDraft(clinicId);

  let ctx = C.clinicContext(clinicId);
  assert.equal(ctx.legendVersion, 1);
  assert.equal(ctx.memo[0], "Услуги и цены: Лечение кариеса молочных зубов от 6 500 ₽.");
  assert.equal(ctx.personas.elena.situation, C.defaultPersonas().elena.situation, "not fitted yet");

  let release;
  const gate = new Promise((r) => (release = r));
  startPersonaFit(clinicId, async (id) => {
    await gate;
    return { lead: `${id}: заявка на лечение кариеса у внука`, situation: `${id} видела рекламу осмотра за 0 ₽`, concerns: "- Правда ли осмотр 0 ₽?", hiddenObjection: "как была", showUpRisk: "как был" };
  });
  assert.equal(personaFitState(clinicId).status, "pending");
  assert.equal(C.clinicContext(clinicId).personas.elena.situation, C.defaultPersonas().elena.situation);

  release();
  await until(() => personaFitState(clinicId).status !== "pending");
  assert.equal(personaFitState(clinicId).status, "ready");
  ctx = C.clinicContext(clinicId);
  const elena = getScenario("elena", ctx);
  assert.equal(elena.lead, "elena: заявка на лечение кариеса у внука");
  assert.match(elena.prompt, /ТВОЯ СИТУАЦИЯ: elena видела рекламу осмотра за 0 ₽/);
  assert.match(elena.prompt, /Лечение кариеса молочных зубов от 6 500 ₽/);
  assert.doesNotMatch(elena.prompt, /91 000/);
  assert.deepEqual(Object.keys(C.personaVars(ctx, "elena")).sort(), ["concerns", "site_facts", "situation"]);
});

test("a failed fit is reported and keeps the shared patients", async () => {
  const clinicId = auth.createClinic({ legalName: "ООО «Сбой»", slug: "fail", city: "Уфа" });
  L.saveDraft(clinicId, facts);
  L.approveDraft(clinicId);
  startPersonaFit(clinicId, async () => {
    throw new Error("Gemini недоступен");
  });
  await until(() => personaFitState(clinicId).status !== "pending");
  assert.deepEqual({ status: personaFitState(clinicId).status, error: personaFitState(clinicId).error }, { status: "failed", error: "Не подстроено пациентов: 10. Gemini недоступен" });
  assert.equal(C.clinicContext(clinicId).personas.igor.situation, C.defaultPersonas().igor.situation);
});
