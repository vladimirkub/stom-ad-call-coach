import test from "node:test";
import assert from "node:assert/strict";

process.env.DB_PATH = ":memory:";
process.env.PASSWORD_KEY = "test-password-key-test-password-key-0123";
const { pickNext, attemptsOf } = await import("../lib/next-patient.ts");

test("every patient comes once before any comes round again, and never twice in a row", () => {
  const ids = ["a", "b", "c", "d"];
  const attempts = [];
  const seen = new Set();
  for (let i = 0; i < 4; i++) {
    const id = pickNext(ids, attempts);
    assert.ok(!seen.has(id), `${id} came again before the round ended`);
    seen.add(id);
    attempts.push({ id, at: i });
  }
  assert.equal(seen.size, 4);
  const fifth = pickNext(ids, attempts);
  assert.notEqual(fifth, attempts.at(-1).id);
  // A new patient with no tries comes first.
  assert.equal(pickNext([...ids, "new"], attempts), "new");
});

test("attempts count started voice calls and text trainings, not refused calls", async () => {
  const auth = await import("../lib/auth.ts");
  const { recordCall } = await import("../lib/usage.ts");
  const { db } = await import("../lib/db.ts");
  const clinic = auth.createClinic({ legalName: "ООО «Тест»", slug: "next", city: "Казань" });
  const u = auth.createTrainee({ clinicId: clinic, firstName: "Анна", lastName: "Петрова" });
  recordCall({ conversationId: "conv_00000000000000000001", userId: u.id, clinicId: clinic, kind: "patient", scenarioId: "alina", now: 1 });
  recordCall({ conversationId: "conv_00000000000000000002", userId: u.id, clinicId: clinic, kind: "patient", scenarioId: "kirill", now: 2 });
  db().prepare("UPDATE usage SET status = 'failed' WHERE conversation_id = ?").run("conv_00000000000000000002");
  assert.deepEqual(attemptsOf(u.id).map((a) => a.id), ["alina"]);
});
