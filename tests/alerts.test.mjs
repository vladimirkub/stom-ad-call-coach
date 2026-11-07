import test from "node:test";
import assert from "node:assert/strict";

process.env.DB_PATH = ":memory:";
process.env.PASSWORD_KEY = "test-password-key-test-password-key-0123";

const auth = await import("../lib/auth.ts");
const A = await import("../lib/alerts.ts");
const { db } = await import("../lib/db.ts");

const clinic = auth.createClinic({ legalName: "Сигнал", slug: "signal", city: "Тула" });
const anna = auth.createTrainee({ clinicId: clinic, firstName: "Анна", lastName: "Иванова" });
const sent = [];
const deliver = async (chat, text) => { sent.push({ chat, text }); };

test("nothing is sent until the owner links a chat", async () => {
  assert.equal(await A.alertDoubleCall(anna.id, { ip: "1.1.1.1", heldFromIp: "2.2.2.2", heldSince: 0 }, 1e9, deliver), null);
  db().prepare("INSERT INTO settings (key, value) VALUES ('owner_chat_id', '777')").run();
});

test("a second call from one login alerts once per 6 hours", async () => {
  const t = 2e9;
  const text = await A.alertDoubleCall(anna.id, { ip: "1.1.1.1", heldFromIp: "2.2.2.2", heldSince: t - 60_000 }, t, deliver);
  assert.match(text, /Два звонка с одного логина/);
  assert.match(text, /ivanova\.signal \(Анна Иванова, Сигнал\)/);
  assert.match(text, /2\.2\.2\.2.*1\.1\.1\.1/s);
  assert.equal(sent.at(-1).chat, "777");
  assert.equal(await A.alertDoubleCall(anna.id, { ip: "1.1.1.1", heldFromIp: "2.2.2.2", heldSince: t }, t + 3600_000, deliver), null);
  assert.ok(await A.alertDoubleCall(anna.id, { ip: "1.1.1.1", heldFromIp: "2.2.2.2", heldSince: t }, t + A.ALERT_EVERY_MS + 1, deliver));
});

test("sign-ins from many addresses in a day alert; a few do not", async () => {
  const now = Date.now();
  for (const ip of ["10.0.0.1", "10.0.0.2", "10.0.0.3"]) auth.createSession(anna.id, ip);
  assert.equal(await A.alertManyAddresses(anna.id, now, deliver), null);
  auth.createSession(anna.id, "10.0.0.4");
  const text = await A.alertManyAddresses(anna.id, Date.now(), deliver);
  assert.match(text, /с 4 разных адресов/);
});

test("password guessing alerts only for a real login", async () => {
  assert.equal(await A.alertPasswordGuessing("nobody.here", "5.5.5.5", Date.now(), deliver), null);
  const text = await A.alertPasswordGuessing("IVANOVA.signal", "5.5.5.5", Date.now(), deliver);
  assert.match(text, /Подбор пароля[\s\S]*5\.5\.5\.5/);
});
