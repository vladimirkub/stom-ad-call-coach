import test from "node:test";
import assert from "node:assert/strict";

process.env.DB_PATH = ":memory:";
process.env.PASSWORD_KEY = "test-password-key-test-password-key-0123";

const auth = await import("../lib/auth.ts");
const L = await import("../lib/legend.ts");
const { db } = await import("../lib/db.ts");
const { ensurePersonaFit, personaFitState } = await import("../lib/persona-fit.ts");
const { clinicContext } = await import("../lib/clinic-context.ts");
const pub = (await import("../lib/scenarios-public.json", { with: { type: "json" } })).default;

const ids = pub.map((s) => s.id);
const fake = (fail = []) => async (id) => {
  if (fail.includes(id)) throw new Error(`no fit for ${id}`);
  return { lead: `${id}: заявка по акции клиники`, situation: `${id} situation text long enough`, concerns: "- вопрос по цене клиники", hiddenObjection: "скрытая причина пациента", showUpRisk: "риск неявки пациента" };
};
const settle = async (clinicId) => {
  for (let i = 0; i < 200 && personaFitState(clinicId)?.status === "pending"; i++) await new Promise((r) => setTimeout(r, 5));
};
const approve = (slug) => {
  const clinicId = auth.createClinic({ legalName: `ООО «${slug}»`, slug, city: "Тверь" });
  L.saveDraft(clinicId, [{ section: "services", text: "Имплант от 30 000 ₽", source: null }]);
  L.approveDraft(clinicId);
  return clinicId;
};

test("a legend approved before fitting existed gets its patients fitted on first look", async () => {
  const clinicId = approve("old");
  assert.equal(personaFitState(clinicId).status, null);
  assert.deepEqual(clinicContext(clinicId).fittedIds, [], "nothing fitted: the clinic's cards stay empty");
  assert.equal(ensurePersonaFit(clinicId, Date.now(), fake()), true);
  assert.equal(ensurePersonaFit(clinicId, Date.now(), fake()), false, "not twice while it runs");
  await settle(clinicId);
  assert.equal(personaFitState(clinicId).status, "ready");
  assert.deepEqual(clinicContext(clinicId).fittedIds.sort(), [...ids].sort());
  assert.equal(ensurePersonaFit(clinicId, Date.now(), fake()), false, "complete: nothing to do");
});

test("one failed patient keeps the others; the failure is retried after 15 minutes", async () => {
  const clinicId = approve("part");
  const t0 = Date.now();
  ensurePersonaFit(clinicId, t0, fake(["igor"]));
  await settle(clinicId);
  const st = personaFitState(clinicId);
  assert.equal(st.status, "failed");
  assert.match(st.error, /Не подстроено пациентов: 1/);
  assert.ok(!clinicContext(clinicId).fittedIds.includes("igor"));
  assert.equal(clinicContext(clinicId).fittedIds.length, ids.length - 1);
  assert.equal(ensurePersonaFit(clinicId, t0 + 60_000, fake()), false, "too soon");
  assert.equal(ensurePersonaFit(clinicId, t0 + 16 * 60_000, fake()), true);
  await settle(clinicId);
  assert.equal(personaFitState(clinicId).status, "ready");
});

test("a fit cut short by a restart, or a patient added later, is fitted again", async () => {
  const clinicId = approve("cut");
  db().prepare("UPDATE legends SET personas_status = 'pending' WHERE clinic_id = ? AND status = 'approved'").run(clinicId);
  assert.equal(ensurePersonaFit(clinicId, Date.now(), fake()), true, "pending but nothing running in this process");
  await settle(clinicId);
  const partial = Object.fromEntries(Object.entries(personaFitState(clinicId).personas).filter(([id]) => id !== "valentina"));
  db().prepare("UPDATE legends SET personas = ? WHERE clinic_id = ? AND status = 'approved'").run(JSON.stringify(partial), clinicId);
  assert.equal(ensurePersonaFit(clinicId, Date.now(), fake()), true, "valentina is missing");
  await settle(clinicId);
});
