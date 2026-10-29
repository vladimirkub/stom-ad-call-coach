import test from "node:test";
import assert from "node:assert/strict";

process.env.DB_PATH = ":memory:";
process.env.PASSWORD_KEY = "test-password-key-test-password-key-0123";

const auth = await import("../lib/auth.ts");
const { overview, clinicStats, userStats, trainingDetail } = await import("../lib/stats.ts");
const { db } = await import("../lib/db.ts");

const DAY = 864e5;
const NOW = Date.now();
const lux = auth.createClinic({ legalName: "ООО «Стомлюкс»", slug: "stomlux", city: "Казань" });
const idle = auth.createClinic({ legalName: "ООО «Тишина»", slug: "tishina", city: "Уфа" });
auth.createTrainee({ clinicId: idle, firstName: "Олег", lastName: "Молчанов" });
const anna = auth.createTrainee({ clinicId: lux, firstName: "Анна", lastName: "Иванова" });
const maria = auth.createTrainee({ clinicId: lux, firstName: "Мария", lastName: "Петрова" });
auth.setupOwner(auth.createSetupToken(), "a-long-owner-password", { firstName: "В", lastName: "К" });
const ownerId = db().prepare("SELECT id FROM users WHERE role = 'owner'").get().id;

let n = 0;
function call({ userId, clinicId, total, at, booked = 0, missed = [] }) {
  const id = `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
  const checklist = ["introduced", "askedNeed", "offeredSlot"].map((cid) => ({ id: cid, label: cid, done: !missed.includes(cid) }));
  db()
    .prepare(
      `INSERT INTO trainings (id, user_id, clinic_id, scenario_id, mode, started_at, duration_s, transcript, live_checklist, scores, total, booked, evaluation, evaluated_at)
       VALUES (?, ?, ?, 'elena', 'voice', ?, 240, ?, '[]', ?, ?, ?, ?, ?)`,
    )
    .run(id, userId, clinicId, at, JSON.stringify([{ role: "user", text: "Алло" }]), JSON.stringify({ discovery: total / 10, objectionHandling: 5, booking: 5, showUp: 5 }), total, booked,
      JSON.stringify({ total, summary: "ok", appointmentBooked: !!booked, checklist }), at);
  return id;
}

const first = call({ userId: anna.id, clinicId: lux, total: 40, at: NOW - 9 * DAY, missed: ["offeredSlot", "askedNeed"] });
call({ userId: anna.id, clinicId: lux, total: 80, at: NOW - 2 * DAY, booked: 1, missed: ["offeredSlot"] });
call({ userId: maria.id, clinicId: lux, total: 60, at: NOW - 1 * DAY, missed: ["offeredSlot"] });
call({ userId: maria.id, clinicId: lux, total: 20, at: NOW - 40 * DAY, missed: ["introduced"] }); // outside 30 days
call({ userId: ownerId, clinicId: null, total: 100, at: NOW - DAY }); // the owner's own test call

test("overview counts trainees only, in rolling windows", () => {
  const o = overview(NOW);
  assert.deepEqual(o.totals, { trainings7: 2, trainings30: 3, activeUsers7: 2, average30: 60 });
  const [first, second] = o.clinics;
  assert.equal(first.legalName, "ООО «Стомлюкс»", "most recently active clinic first");
  assert.equal(first.users, 2);
  assert.equal(first.active7, 2);
  assert.equal(first.avg30, 60);
  assert.equal(second.legalName, "ООО «Тишина»");
  assert.equal(second.lastAt, null);
});

test("clinic: per-trainee figures, team skills and the most frequent misses", () => {
  const c = clinicStats(lux, NOW);
  assert.equal(c.calls30, 3);
  assert.deepEqual(c.misses[0], { id: "offeredSlot", label: "offeredSlot", count: 3, share: 100 });
  assert.equal(c.misses[1].id, "askedNeed");
  assert.ok(!c.misses.some((m) => m.id === "introduced"), "the 40-day-old call is out of the window");
  assert.equal(c.skills.discovery, 6);
  const a = c.users.find((u) => u.login === "ivanova.stomlux");
  assert.deepEqual({ count: a.count, average: a.average, booked: a.booked, change7: a.change7 }, { count: 2, average: 60, booked: 1, change7: 40 });
  assert.equal(clinicStats(9999, NOW), null);
});

test("trainee card lists every call newest first, and a call opens with its dialogue", () => {
  const u = userStats(anna.id);
  assert.equal(u.count, 2);
  assert.equal(u.average, 60);
  assert.equal(u.trainings[0].total, 80);
  assert.equal(u.trainings[0].patient, "Елена Викторовна Громова");
  assert.equal(userStats(ownerId), null, "the owner has no trainee card");

  const t = trainingDetail(first);
  assert.equal(t.trainee, "Анна Иванова");
  assert.equal(t.transcript[0].text, "Алло");
  assert.equal(t.evaluation.total, 40);
  assert.equal(trainingDetail("missing"), null);
});
