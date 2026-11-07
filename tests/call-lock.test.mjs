import test from "node:test";
import assert from "node:assert/strict";

process.env.DB_PATH = ":memory:";
process.env.PASSWORD_KEY = "test-password-key-test-password-key-0123";

const auth = await import("../lib/auth.ts");
const L = await import("../lib/call-lock.ts");

const clinic = auth.createClinic({ legalName: "Замок", slug: "zamok", city: "Тула" });
const anna = auth.createTrainee({ clinicId: clinic, firstName: "Анна", lastName: "Иванова" }).id;
const olga = auth.createTrainee({ clinicId: clinic, firstName: "Ольга", lastName: "Петрова" }).id;

test("a login runs one voice call at a time; another login is not affected", () => {
  const t0 = 1_000_000;
  const first = L.takeCallLock(anna, t0);
  assert.ok(first.ok);
  const second = L.takeCallLock(anna, t0 + 1000);
  assert.equal(second.ok, false);
  assert.ok(second.minutesLeft >= 1 && second.minutesLeft <= 7);
  assert.ok(L.takeCallLock(olga, t0 + 1000).ok, "a colleague's login calls freely");
  assert.match(L.busyMessage(second.minutesLeft), /только один звонок/);
});

test("ending the call frees the login; a stale token frees nothing", () => {
  const t0 = 2_000_000;
  L.releaseCallLock(anna, "old");
  const held = L.takeCallLock(anna, t0);
  if (!held.ok) { // still held from the test above: release it the right way
    assert.fail("lock from the previous test should have expired by t0");
  }
  assert.equal(L.releaseCallLock(anna, "someone-else"), false);
  assert.equal(L.takeCallLock(anna, t0 + 10).ok, false);
  assert.equal(L.releaseCallLock(anna, held.token), true);
  assert.ok(L.takeCallLock(anna, t0 + 20).ok);
});

test("a lock nobody gave back lapses after the longest call", () => {
  const t0 = 3_000_000 + L.HOLD_MS * 3;
  assert.ok(L.takeCallLock(olga, t0).ok);
  assert.equal(L.takeCallLock(olga, t0 + L.HOLD_MS - 1).ok, false);
  assert.ok(L.takeCallLock(olga, t0 + L.HOLD_MS + 1).ok);
});
