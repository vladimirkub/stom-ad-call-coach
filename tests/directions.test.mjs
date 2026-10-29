import test from "node:test";
import assert from "node:assert/strict";

process.env.DB_PATH = ":memory:";
process.env.PASSWORD_KEY = "test-password-key-test-password-key-0123";

const auth = await import("../lib/auth.ts");
const L = await import("../lib/legend.ts");
const D = await import("../lib/directions.ts");
const { startPersonaFit, personaFitState } = await import("../lib/persona-fit.ts");

const KEYS = D.DIRECTIONS.map((d) => d.key);
const PATIENTS = ["elena", "nikolay", "igor", "svetlana", "marina", "dmitry", "olga", "artem", "alina", "valentina"];

test("every ticked direction gets a patient, and nobody comes for an unticked one", () => {
  for (let mask = 1; mask < 1 << KEYS.length; mask++) {
    const chosen = KEYS.filter((_, i) => mask & (1 << i));
    const plan = D.assignDirections(chosen);
    assert.deepEqual(Object.keys(plan).sort(), [...PATIENTS].sort(), chosen.join());
    for (const d of Object.values(plan)) assert.ok(chosen.includes(d), `${chosen.join()}: ${d}`);
    for (const d of chosen) assert.ok(Object.values(plan).includes(d), `${chosen.join()}: ${d} uncovered`);
  }
});

test("patients go where their story fits", () => {
  const three = D.assignDirections(["single_implant", "full_arch", "ortho"]);
  assert.equal(three.elena, "full_arch");
  assert.equal(three.dmitry, "ortho");
  assert.equal(three.olga, "ortho");
  assert.equal(three.nikolay, "single_implant");
  const all = D.assignDirections(KEYS);
  // Every patient lands on their first or second choice.
  for (const [p, d] of Object.entries(all)) assert.ok(D.PREFERENCES[p].indexOf(d) <= 1, `${p}: ${d}`);
  assert.equal(all.olga, "ortho");
  assert.equal(all.artem, "therapy");
  assert.equal(all.marina, "kids");
  assert.deepEqual(D.assignDirections([]), {});
  assert.deepEqual(D.assignDirections(["nonsense"]), {});
});

test("directions are suggested from the legend and stored per clinic", () => {
  const facts = [
    { section: "services", text: "Имплант Osstem от 32 000 ₽", source: null },
    { section: "services", text: "«Все зубы за 1 день» All-on-4 от 290 000 ₽", source: null },
    { section: "services", text: "Элайнеры Star Smile от 120 000 ₽", source: null },
    { section: "missing", text: "Нет цен на детское лечение", source: null },
  ];
  assert.deepEqual(D.suggestDirections(facts), ["single_implant", "full_arch", "ortho"]);
  const clinicId = auth.createClinic({ legalName: "ООО «Три»", slug: "tri", city: "Пермь" });
  assert.deepEqual(D.getDirections(clinicId), []);
  assert.deepEqual(D.setDirections(clinicId, ["ortho", "bogus", "single_implant"]), ["single_implant", "ortho"]);
  assert.deepEqual(D.getDirections(clinicId), ["single_implant", "ortho"]);
});

test("the fit gives each patient the direction from the plan", async () => {
  const clinicId = auth.createClinic({ legalName: "ООО «Орто»", slug: "orto", city: "Тверь" });
  L.saveDraft(clinicId, [{ section: "services", text: "Брекеты от 45 000 ₽; имплант от 32 000 ₽", source: null }]);
  L.approveDraft(clinicId);
  D.setDirections(clinicId, ["single_implant", "ortho"]);
  const seen = {};
  startPersonaFit(clinicId, async (id, _facts, direction) => {
    seen[id] = direction;
    return { lead: id, situation: id, concerns: "- ?", hiddenObjection: "-", showUpRisk: "-", direction };
  });
  for (let i = 0; i < 200 && personaFitState(clinicId).status === "pending"; i++) await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(seen, D.assignDirections(["single_implant", "ortho"]));
  assert.equal(personaFitState(clinicId).personas.dmitry.direction, "ortho");
});

test("every patient in the scenarios has direction preferences and a full persona", async () => {
  const pub = (await import("../lib/scenarios-public.json", { with: { type: "json" } })).default;
  const priv = (await import("../lib/scenarios-private.json", { with: { type: "json" } })).default;
  assert.deepEqual(pub.map((s) => s.id).sort(), [...PATIENTS].sort());
  assert.deepEqual(Object.keys(D.PREFERENCES).sort(), [...PATIENTS].sort());
  for (const id of PATIENTS) {
    assert.deepEqual([...D.PREFERENCES[id]].sort(), [...KEYS].sort(), id);
    for (const k of ["prompt", "situation", "concerns", "hiddenObjection", "showUpRisk"]) assert.ok(priv[id][k]?.length > 20, `${id}.${k}`);
    for (const v of ["{{situation}}", "{{concerns}}", "{{site_facts}}", "{{BEHAVIOR}}"]) assert.ok(priv[id].prompt.includes(v), `${id}: ${v}`);
  }
});
