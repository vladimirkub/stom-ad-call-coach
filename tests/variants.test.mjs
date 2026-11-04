import test from "node:test";
import assert from "node:assert/strict";

process.env.DB_PATH = ":memory:";
const { getScenario, scenarioVars } = await import("../lib/scenarios.ts");
const { clinicContext } = await import("../lib/clinic-context.ts");
const { evaluationPrompt } = await import("../lib/evaluation.ts");
const pub = (await import("../lib/scenarios-public.json", { with: { type: "json" } })).default;
const priv = (await import("../lib/scenarios-private.json", { with: { type: "json" } })).default;

test("every variant has a record for the administrator and the truth for the patient and the judge", () => {
  for (const s of pub.filter((x) => x.variants)) {
    const ids = s.variants.map((v) => v.id).sort();
    assert.deepEqual(Object.keys(priv[s.id].variants).sort(), ids, s.id);
    for (const v of s.variants) {
      assert.ok(v.record.visits.length > 0 && v.record.rules.length > 20, `${s.id}.${v.id}`);
      assert.ok(priv[s.id].variants[v.id].patient.length > 50 && priv[s.id].variants[v.id].judge.length > 50, `${s.id}.${v.id}`);
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
  assert.match(evaluationPrompt({ scenario: match, memo: [], transcript }), /карту в базе НЕ открывал/);
});
