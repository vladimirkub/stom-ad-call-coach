import test from "node:test";
import assert from "node:assert/strict";

process.env.DB_PATH = ":memory:";
process.env.PASSWORD_KEY = "test-password-key-test-password-key-0123";

const auth = await import("../lib/auth.ts");
const { parseAttempt, saveTraining, userProgress } = await import("../lib/trainings.ts");
const { db } = await import("../lib/db.ts");

const DAY = 864e5;
const NOW = Date.UTC(2026, 9, 29, 12);
const clinicId = auth.createClinic({ legalName: "ООО «Тест»", slug: "testclinic", city: "Казань" });
const anna = auth.createTrainee({ clinicId, firstName: "Анна", lastName: "Иванова" });
const olga = auth.createTrainee({ clinicId, firstName: "Ольга", lastName: "Петрова" });

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const result = (total, booked = true) => ({ total, scores: { contact: 5, needs: 5, objection: 5, closing: 5 }, appointmentBooked: booked });
const save = (userId, n, total, startedAt) =>
  saveTraining({
    attempt: parseAttempt({ id: id(n), mode: "voice", startedAt, endedBy: "operator", live: ["introduced"] }, startedAt + 300_000),
    userId,
    clinicId,
    scenarioId: "elena",
    transcript: [{ role: "user", text: "Здравствуйте" }],
    result: result(total),
    now: startedAt + 300_000,
  });

test("the client's call description is validated", () => {
  const ok = parseAttempt({ id: id(1), mode: "text", startedAt: NOW - 60_000, endedBy: "patient", live: ["a", 5, "b"] }, NOW);
  assert.deepEqual(ok, { id: id(1), mode: "text", startedAt: NOW - 60_000, endedBy: "patient", durationS: null, live: ["a", "b"] });
  const timed = (durationS) => parseAttempt({ id: id(1), mode: "voice", startedAt: NOW - 60_000, durationS }, NOW).durationS;
  assert.equal(timed(42.4), 42, "the call's own length, reported by the page");
  assert.equal(timed(999), 60, "never longer than the time since the call started");
  assert.equal(timed(-5), null);
  assert.equal(parseAttempt({ id: "not-a-uuid", mode: "voice", startedAt: NOW }, NOW), null);
  assert.equal(parseAttempt({ id: id(1), mode: "video", startedAt: NOW }, NOW), null);
  assert.equal(parseAttempt({ id: id(1), mode: "voice", startedAt: NOW + 3_600_000 }, NOW), null, "not in the future");
  assert.equal(parseAttempt({ id: id(1), mode: "voice", startedAt: NOW - 2 * DAY }, NOW), null, "not older than a day");
  assert.equal(parseAttempt(null, NOW), null);
});

test("re-evaluating a call updates it; another user cannot overwrite it", () => {
  save(anna.id, 10, 40, NOW - DAY);
  save(anna.id, 10, 70, NOW - DAY);
  let rows = db().prepare("SELECT total, duration_s, user_id FROM trainings WHERE id = ?").all(id(10));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].total, 70);
  assert.equal(rows[0].duration_s, 300);

  save(olga.id, 10, 5, NOW - DAY);
  rows = db().prepare("SELECT total, user_id FROM trainings WHERE id = ?").all(id(10));
  assert.deepEqual({ ...rows[0] }, { total: 70, user_id: anna.id });
});

test("progress of a trainee without calls is empty", () => {
  assert.deepEqual(userProgress(olga.id, NOW), { count: 0, average: null, last7: { count: 0, average: null }, change7: null });
});

test("progress: count, average and the change of the last 7 days against the 7 before", () => {
  const ins = db().prepare(
    `INSERT INTO trainings (id, user_id, clinic_id, scenario_id, mode, started_at, duration_s, transcript, live_checklist, scores, total, booked, evaluation, evaluated_at)
     VALUES (?, ?, ?, 'elena', 'text', ?, 60, '[]', '[]', '{}', ?, 0, '{}', ?)`,
  );
  const user = auth.createTrainee({ clinicId, firstName: "Мария", lastName: "Сидорова" });
  ins.run(id(21), user.id, clinicId, NOW - 10 * DAY, 40, NOW - 10 * DAY);
  ins.run(id(22), user.id, clinicId, NOW - 9 * DAY, 50, NOW - 9 * DAY);
  ins.run(id(23), user.id, clinicId, NOW - 2 * DAY, 70, NOW - 2 * DAY);
  ins.run(id(24), user.id, clinicId, NOW - 1 * DAY, 80, NOW - 1 * DAY);
  assert.deepEqual(userProgress(user.id, NOW), { count: 4, average: 60, last7: { count: 2, average: 75 }, change7: 30 });
});
