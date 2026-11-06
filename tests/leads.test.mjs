import test from "node:test";
import assert from "node:assert/strict";

process.env.DB_PATH = ":memory:";
process.env.PASSWORD_KEY = "test-password-key-test-password-key-0123";
process.env.TELEGRAM_BOT_TOKEN = "123:test";
delete process.env.TELEGRAM_LIVE;

const L = await import("../lib/leads.ts");
const T = await import("../lib/telegram.ts");
const auth = await import("../lib/auth.ts");
const { db } = await import("../lib/db.ts");

const quiet = console.log;
console.log = () => {};
const msg = (chat, text, username = "ivan_dp") => L.handleUpdate({ update_id: 1, message: { message_id: 1, chat: { id: chat, type: "private" }, from: { id: chat, username }, text } });
const tap = (chat, data) => L.handleUpdate({ update_id: 2, callback_query: { id: "q", from: { id: chat }, data, message: { message_id: 5, chat: { id: chat } } } });
const lead = (chat) => db().prepare("SELECT * FROM leads WHERE chat_id = ? ORDER BY id DESC").get(String(chat));

test("the bot asks five questions after «Готов» and submits the request", async () => {
  await msg(100, "/start site");
  assert.equal(lead(100).step, "ready");
  await msg(100, "Иван Петров"); // before «Готов»: the greeting again, nothing saved
  assert.equal(lead(100).full_name, "");
  await tap(100, "ready");
  await msg(100, "Иван Петров");
  await tap(100, "pos:0");
  await msg(100, "Дента Плюс");
  await msg(100, "Брянск");
  await msg(100, "нет");
  const l = lead(100);
  assert.equal(l.status, "new");
  assert.deepEqual([l.full_name, l.position, l.clinic, l.city, l.site, l.username, l.source], ["Иван Петров", "Главный врач", "Дента Плюс", "Брянск", "нет", "ivan_dp", "site"]);
  await msg(100, "/start");
  assert.equal(db().prepare("SELECT COUNT(*) AS n FROM leads WHERE chat_id = '100'").get().n, 1, "a submitted request is not restarted");
});

test("the check notes a missing site and an existing clinic", async () => {
  auth.createClinic({ legalName: "Улыбка", slug: "ulybka", city: "Тула" });
  const checks = await L.runChecks({ clinic: "улыбка", site: "нет", city: "Тула" });
  assert.equal(checks.siteOk, null);
  assert.equal(checks.duplicate, "Улыбка");
  const site = await L.runChecks({ clinic: "Новая", site: "nova-dent.ru", city: "Тула" }, async () => ({ url: "https://nova-dent.ru", html: "<title>Стоматология Нова</title><p>Имплант 45 000 ₽, врач-ортопед, г. Тула</p>" }));
  assert.deepEqual([site.siteOk, site.dental, site.prices, site.doctors, site.cityFound, site.duplicate], [true, true, true, true, true, null]);
});

test("only the linked owner chat can decide, through a one-time link", async () => {
  await tap(999, `lead:approve:${lead(100).id}`);
  assert.equal(lead(100).status, "new");
  const url = L.ownerLinkUrl();
  const code = url.split("start=link_")[1];
  await msg(999, "/start link_wrong");
  assert.equal(L.ownerChat(), null);
  await msg(999, `/start link_${code}`);
  assert.equal(L.ownerChat(), "999");
});

test("approving creates the clinic with a trial, the manager login, and starts the legend from the site", async () => {
  await msg(200, "/start");
  await tap(200, "ready");
  for (const a of ["Ольга Смирнова", "Управляющий", "Нова Дент", "Тула", "nova-dent.ru"]) await msg(200, a, "olga");
  db().prepare("UPDATE leads SET checks = ? WHERE chat_id = '200'").run(JSON.stringify({ siteOk: true, duplicate: null }));
  let analysed = 0;
  const done = await L.approveLead(lead(200).id, { startAnalysis: () => { analysed++; }, fit: () => {} });
  const c = db().prepare("SELECT * FROM clinics WHERE id = ?").get(done.clinicId);
  assert.equal(c.legal_name, "Нова Дент");
  assert.equal(c.city, "Тула");
  assert.match(c.sites, /nova-dent\.ru/);
  const u = db().prepare("SELECT role, first_name, last_name, login FROM users WHERE id = ?").get(done.userId);
  assert.deepEqual([u.role, u.first_name, u.last_name], ["manager", "Ольга", "Смирнова"]);
  assert.equal(u.login, done.access.login);
  assert.ok(auth.login(u.login, done.access.password).ok);
  assert.equal(analysed, 1);
  await assert.rejects(L.approveLead(lead(200).id), /уже выдан/);
});

test("a trial clinic loses access when its date passes", () => {
  const id = db().prepare("SELECT clinic_id, user_id FROM leads WHERE chat_id = '200'").get();
  const login = db().prepare("SELECT login FROM users WHERE id = ?").get(id.user_id).login;
  const pass = auth.resetPassword(id.user_id);
  const ok = auth.login(login, pass);
  assert.ok(ok.ok);
  assert.ok(auth.sessionUser(ok.token));
  db().prepare("UPDATE clinics SET access_until = ? WHERE id = ?").run(Date.now() - 1000, id.clinic_id);
  assert.equal(auth.sessionUser(ok.token), null);
  assert.deepEqual(auth.login(login, pass), { ok: false, reason: "disabled" });
});

test("rejecting closes the request; the webhook secret is checked", async () => {
  await L.rejectLead(lead(100).id);
  assert.equal(lead(100).status, "rejected");
  L.deleteLead(lead(100).id);
  assert.equal(lead(100), undefined, "a decided request can be removed");
  await msg(300, "/start");
  assert.throws(() => L.deleteLead(lead(300).id), /только решённую/);
  assert.ok(T.validWebhookSecret(T.webhookSecret()));
  assert.equal(T.validWebhookSecret("nope"), false);
  assert.equal(T.validWebhookSecret(null), false);
  console.log = quiet;
});
