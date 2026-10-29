import test from "node:test";
import assert from "node:assert/strict";

process.env.DB_PATH = ":memory:";
process.env.PASSWORD_KEY = "test-password-key-test-password-key-0123";

const auth = await import("../lib/auth.ts");

test("logins are transliterated, latin-only and unique", () => {
  assert.equal(auth.translit("Кублашвили"), "kublashvili");
  assert.equal(auth.translit("Щукина-Юрьева"), "shchukinayureva");
  const taken = new Set(["ivanova.stomlux"]);
  assert.equal(auth.makeLogin("Иванова", "stomlux", (l) => taken.has(l)), "ivanova2.stomlux");
  assert.equal(auth.normalizeSlug("Стом Люкс!"), "stomlyuks");
});

test("generated passwords avoid look-alike characters", () => {
  for (let i = 0; i < 200; i++) {
    const p = auth.makePassword();
    assert.equal(p.length, 12);
    assert.doesNotMatch(p, /[0O1lI]/);
  }
});

test("password hash verifies only the right password", () => {
  const h = auth.hashPassword("correct horse");
  assert.ok(auth.verifyPassword("correct horse", h));
  assert.ok(!auth.verifyPassword("wrong horse", h));
});

test("stored password decrypts with the key and not without it", () => {
  const sealed = auth.encryptSecret("Abc23456789x");
  assert.equal(auth.decryptSecret(sealed), "Abc23456789x");
  assert.equal(auth.decryptSecret(sealed.slice(0, -2) + "AA"), null);
});

test("owner creates a clinic and a trainee who can sign in; disabling ends access", () => {
  const clinicId = auth.createClinic({ legalName: "ООО «Стомлюкс»", slug: "stomlux", city: "Казань" });
  assert.throws(() => auth.createClinic({ legalName: "Другая", slug: "StomLux", city: "Уфа" }), /занято/);

  const { id, login, password } = auth.createTrainee({ clinicId, firstName: "Анна", lastName: "Иванова" });
  assert.equal(login, "ivanova.stomlux");
  assert.equal(auth.listTrainees(clinicId)[0].password, password, "owner sees the generated password");

  assert.deepEqual(auth.login(login, "nope"), { ok: false, reason: "invalid" });
  const ok = auth.login(login.toUpperCase(), password);
  assert.ok(ok.ok);
  const me = auth.sessionUser(ok.token);
  assert.equal(me.login, login);
  assert.equal(me.clinic.slug, "stomlux");

  auth.setActive(id, false);
  assert.equal(auth.sessionUser(ok.token), null, "disabling drops open sessions");
  assert.deepEqual(auth.login(login, password), { ok: false, reason: "disabled" });

  auth.setActive(id, true);
  const fresh = auth.resetPassword(id);
  assert.notEqual(fresh, password);
  assert.deepEqual(auth.login(login, password), { ok: false, reason: "invalid" });
  assert.ok(auth.login(login, fresh).ok);
});

test("owner setup link works once", () => {
  const token = auth.createSetupToken();
  assert.ok(token);
  assert.throws(() => auth.setupOwner(token, "short", { firstName: "В", lastName: "К" }), /12/);
  const session = auth.setupOwner(token, "a-long-owner-password", { firstName: "Владимир", lastName: "К" });
  assert.equal(auth.sessionUser(session).role, "owner");
  assert.equal(auth.createSetupToken(), null);
  assert.throws(() => auth.setupOwner(token, "a-long-owner-password", { firstName: "X", lastName: "Y" }), /недействительна/);
});
