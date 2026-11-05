import test from "node:test";
import assert from "node:assert/strict";

process.env.DB_PATH = ":memory:";
process.env.PASSWORD_KEY = "test-password-key-test-password-key-0123";

const auth = await import("../lib/auth.ts");
const { db } = await import("../lib/db.ts");
const { monthBoard, monthStart } = await import("../lib/leaderboard.ts");

const clinic = auth.createClinic({ legalName: "ООО «Топ»", slug: "top", city: "Омск" });
const other = auth.createClinic({ legalName: "ООО «Другая»", slug: "drug", city: "Омск" });
const add = (clinicId, first, last) => auth.createTrainee({ clinicId, firstName: first, lastName: last }).id;
const now = Date.UTC(2026, 10, 20, 12);
let n = 0;
const call = (userId, clinicId, total, at = now - 3600_000) =>
  db().prepare("INSERT INTO trainings (id, user_id, clinic_id, scenario_id, mode, started_at, duration_s, transcript, live_checklist, scores, total, booked, evaluation, evaluated_at) VALUES (?, ?, ?, 'marina', 'voice', ?, 120, '[]', '[]', '{}', ?, 1, '{}', ?)")
    .run(`t${n++}`, userId, clinicId, at, total, at);

test("the month starts on the 1st in Moscow and is named in the genitive", () => {
  assert.deepEqual(monthStart(Date.UTC(2026, 10, 30, 22)), { start: Date.UTC(2026, 11, 1) - 3 * 3600_000, name: "декабря" });
  assert.equal(monthStart(now).name, "ноября");
});

test("top three of the clinic by average score this month, at least three calls; ties go to more calls", () => {
  const a = add(clinic, "Анна", "Абрамова"), b = add(clinic, "Вера", "Белова"), c = add(clinic, "Галя", "Гусева"), d = add(clinic, "Дина", "Дёмина"), e = add(clinic, "Ева", "Ершова");
  const x = add(other, "Икс", "Чужая");
  for (const t of [90, 80, 70]) call(a, clinic, t);
  for (const t of [80, 80, 80, 80]) call(b, clinic, t);
  for (const t of [60, 70, 80]) call(c, clinic, t);
  for (const t of [100, 100]) call(d, clinic, t); // two calls: not yet in the board
  for (const t of [95, 95, 95]) call(e, clinic, t, Date.UTC(2026, 9, 30)); // last month
  for (const t of [99, 99, 99]) call(x, other, t);
  const board = monthBoard(clinic, d, now);
  assert.equal(board.month, "ноября");
  assert.deepEqual(board.top.map((t) => [t.name, t.average]), [["Белова Вера", 80], ["Абрамова Анна", 80], ["Гусева Галя", 70]]);
  assert.deepEqual(board.me, { counted: true, calls: 2, average: 100, place: null, of: 3 });
  assert.deepEqual(monthBoard(clinic, c, now).me.place, 3);

  auth.setActive(b, false);
  assert.equal(monthBoard(clinic, a, now).top[0].name, "Абрамова Анна");
});
