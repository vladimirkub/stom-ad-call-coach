import test from "node:test";
import assert from "node:assert/strict";

const { rubricFor, modelRubric } = await import("../lib/scoring.ts");
const { evaluationSystem } = await import("../lib/evaluation.ts");
const { getScenario } = await import("../lib/scenarios.ts");
const { INBOUND_RULE, OUTBOUND_RULE } = await import("../lib/patient-behavior.ts");
const { parseDirection } = await import("../lib/direction.ts");

const ids = (items) => items.map((r) => r.id);

test("a callback keeps its checklist; an inbound call asks for the name, the request and a phone instead", () => {
  const out = ids(rubricFor(false));
  const inb = ids(rubricFor(false, "inbound"));
  assert.equal(out.length, 22);
  assert.equal(inb.length, 23);
  for (const id of ["askedConvenient", "confirmedRequest"]) assert.ok(out.includes(id) && !inb.includes(id), id);
  for (const id of ["askedName", "clarifiedRequest", "gotContact"]) assert.ok(inb.includes(id) && !out.includes(id), id);
  assert.ok(!ids(modelRubric(false, "inbound")).includes("onTime"));
});

test("the judge and the patient know who called whom", () => {
  assert.match(evaluationSystem(false, "inbound"), /ПАЦИЕНТ сам позвонил в клинику/);
  assert.match(evaluationSystem(false), /перезванивает ПАЦИЕНТУ/);
  assert.match(getScenario("dmitry", undefined, "inbound").prompt, /ЭТОТ ЗВОНОК ДЕЛАЕШЬ ТЫ/);
  assert.doesNotMatch(getScenario("dmitry", undefined, "inbound").prompt, /Тебе ПЕРЕЗВОНИЛИ/);
  assert.match(getScenario("dmitry").prompt, /Тебе ПЕРЕЗВОНИЛИ/);
  assert.ok(!getScenario("dmitry").prompt.includes("{{call_direction}}"));
  assert.notEqual(INBOUND_RULE, OUTBOUND_RULE);
});

test("anything but inbound is a callback", () => {
  assert.equal(parseDirection("inbound"), "inbound");
  for (const x of ["outbound", undefined, null, "INBOUND", 1]) assert.equal(parseDirection(x), "outbound");
});
