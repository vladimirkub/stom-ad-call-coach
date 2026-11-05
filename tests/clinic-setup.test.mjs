import test from "node:test";
import assert from "node:assert/strict";

process.env.DB_PATH = ":memory:";
process.env.PASSWORD_KEY = "test-password-key-test-password-key-0123";

const auth = await import("../lib/auth.ts");
const legend = await import("../lib/legend.ts");
const S = await import("../lib/clinic-setup.ts");
const { db } = await import("../lib/db.ts");

const clinic = auth.createClinic({ legalName: "ООО «Сам»", slug: "sam", city: "Тула" });
const fact = (text, section = "services") => ({ section, text, source: "https://sam.ru" });
const until = async (ok) => { for (let i = 0; i < 100 && !ok(); i++) await new Promise((r) => setTimeout(r, 5)); assert.ok(ok()); };
let drafted = [];
const deps = { readSites: async () => [{ url: "https://sam.ru", ok: true, title: "Сам", text: "текст" }], extractFacts: async () => drafted };
let fitted = 0;
const fit = () => { fitted++; };

test("a rebuild needs the wishes and a source", () => {
  assert.throws(() => S.startRebuild(clinic, "Анна", deps, fit), /пожелания/);
  S.saveSetup(clinic, { wishes: "Проверить возражение «дорого»" });
  assert.throws(() => S.startRebuild(clinic, "Анна", deps, fit), /сайт или текст/);
  S.saveSetup(clinic, { sites: [{ url: "https://sam.ru", label: "Сайт" }], formerDoctors: ["Иванова Мария Петровна"], ownFacts: [{ section: "location", text: "Бесплатная парковка" }] });
  assert.deepEqual(legend.getFormerDoctors(clinic), ["Иванова Мария Петровна"]);
});

test("the first rebuild waits for review; own facts are added; applying makes version 1 and refits", async () => {
  drafted = [fact("Имплант от 30 000 ₽"), fact("Работаем с 9 до 21", "contacts")];
  S.startRebuild(clinic, "Анна", deps, fit);
  await until(() => legend.workingLegend(clinic)?.status === "draft");
  const st = S.setupState(clinic);
  assert.deepEqual(st.review.changes.added, ["Имплант от 30 000 ₽"]);
  assert.ok(st.review.facts.some((f) => f.text === "Бесплатная парковка" && f.source === "own"));
  S.applyDraft(clinic, "Анна", undefined, fit);
  const v1 = legend.approvedLegend(clinic);
  assert.equal(v1.version, 1);
  assert.equal(v1.author, "Анна");
  assert.equal(fitted, 1);
});

test("a rebuild without significant changes applies by itself; one with a new price waits", async () => {
  drafted = [fact("Имплант от 30 000 ₽"), fact("Работаем с 9 до 20", "contacts")];
  S.startRebuild(clinic, "Анна", deps, fit);
  await until(() => legend.approvedLegend(clinic)?.version === 2);
  assert.equal(legend.workingLegend(clinic), null);
  assert.equal(fitted, 2);
  assert.ok(legend.approvedLegend(clinic).facts.some((f) => f.text === "Бесплатная парковка"));

  drafted = [fact("Имплант от 34 500 ₽"), fact("Работаем с 9 до 20", "contacts")];
  S.startRebuild(clinic, "Анна", deps, fit);
  await until(() => legend.workingLegend(clinic)?.status === "draft");
  const ch = S.setupState(clinic).review.changes;
  assert.deepEqual(ch.added, ["Имплант от 34 500 ₽"]);
  assert.deepEqual(ch.removed.map((f) => f.text), ["Имплант от 30 000 ₽"]);
  legend.discardDraft(clinic);
  assert.equal(legend.approvedLegend(clinic).version, 2);
});

test("returning to an older version makes it the next one; the history names who did it", () => {
  S.rollbackTo(clinic, 1, "Анна", fit);
  const now = legend.approvedLegend(clinic);
  assert.equal(now.version, 3);
  assert.equal(now.note, "Возврат к версии 1");
  assert.ok(now.facts.some((f) => f.text === "Работаем с 9 до 21"));
  assert.throws(() => S.rollbackTo(clinic, 3, "Анна", fit), /уже текущая/);
  assert.deepEqual(legend.legendHistory(clinic).map((h) => [h.version, h.author]), [[3, "Анна"], [2, "Анна"], [1, "Анна"]]);
});

test("five rebuilds a day, then the button says when", () => {
  assert.equal(S.rebuildsToday(clinic), 3);
  for (let i = 0; i < 2; i++) db().prepare("INSERT INTO rebuilds (clinic_id, started_at) VALUES (?, ?)").run(clinic, Date.now());
  assert.throws(() => S.startRebuild(clinic, "Анна", deps, fit), /уже 5 пересборок/);
  assert.equal(S.setupState(clinic).rebuildsLeft, 0);
});

test("the autonomy switch", () => {
  assert.equal(S.isAutonomous(clinic), true);
  S.setAutonomous(clinic, false);
  assert.equal(S.isAutonomous(clinic), false);
});
