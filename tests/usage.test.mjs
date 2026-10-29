import test from "node:test";
import assert from "node:assert/strict";

process.env.DB_PATH = ":memory:";
process.env.PASSWORD_KEY = "test-password-key-test-password-key-0123";

const auth = await import("../lib/auth.ts");
const { recordCall, syncUsage, usageReport } = await import("../lib/usage.ts");
const { recommendPlan, USD_RUB } = await import("../lib/plans.ts");
const { saveTraining, parseAttempt } = await import("../lib/trainings.ts");

const DAY = 864e5;
const NOW = Date.UTC(2026, 9, 30, 12);
const lux = auth.createClinic({ legalName: "ООО «Люкс»", slug: "lux", city: "Пермь" });
const quiet = auth.createClinic({ legalName: "ООО «Тихая»", slug: "quiet", city: "Омск" });
const anna = auth.createTrainee({ clinicId: lux, firstName: "Анна", lastName: "Иванова" });
const maria = auth.createTrainee({ clinicId: lux, firstName: "Мария", lastName: "Петрова" });
auth.createTrainee({ clinicId: quiet, firstName: "Олег", lastName: "Молчанов" });

const conv = (n) => `conv_${String(n).padStart(20, "0")}`;
const call = (n, userId, kind, ago) => recordCall({ conversationId: conv(n), userId, clinicId: lux, kind, scenarioId: kind === "patient" ? "elena" : null, now: NOW - ago });

test("only ElevenLabs-looking conversation ids are recorded, once", () => {
  assert.equal(recordCall({ conversationId: "'; DROP TABLE usage", userId: anna.id, clinicId: lux, kind: "patient", scenarioId: "elena" }), false);
  assert.equal(recordCall({ conversationId: 42, userId: anna.id, clinicId: lux, kind: "patient", scenarioId: "elena" }), false);
  assert.equal(call(1, anna.id, "patient", 2 * DAY), true);
  assert.equal(call(1, maria.id, "patient", DAY), true, "a repeat report is ignored, the first author stays");
});

test("lengths and prices come from ElevenLabs; unknown calls are retried, then given up after a day", async () => {
  call(2, anna.id, "operator", DAY);
  call(3, maria.id, "patient", 3 * DAY);
  call(4, maria.id, "patient", 40 * DAY); // outside the 30-day window
  call(5, anna.id, "patient", 60_000); // ElevenLabs still processing
  call(6, anna.id, "patient", 2 * DAY); // never reached ElevenLabs
  call(7, maria.id, "patient", 10_000); // too fresh to ask about
  const answers = {
    [conv(1)]: { status: "done", metadata: { call_duration_secs: 300, charging: { platform_price: 0.4, llm_price: 0.06 } } },
    [conv(2)]: { status: "done", metadata: { call_duration_secs: 120, charging: { platform_price: 0.16, llm_price: 0.04 } } },
    [conv(3)]: { status: "done", metadata: { call_duration_secs: 180, charging: { platform_price: 0.24, llm_price: 0.01 } } },
    [conv(4)]: { status: "done", metadata: { call_duration_secs: 600, charging: { platform_price: 0.8, llm_price: 0 } } },
    [conv(5)]: { status: "processing", metadata: {} },
  };
  const asked = [];
  const r = await syncUsage(async (id) => (asked.push(id), answers[id] ?? null), NOW);
  assert.equal(r.failed, 0);
  assert.ok(!asked.includes(conv(7)));
  const again = [];
  await syncUsage(async (id) => (again.push(id), answers[id] ?? null), NOW);
  assert.deepEqual(again.sort(), [conv(5)], "finished and missing calls are not asked again");
});

test("the report sums minutes and cost per administrator and clinic, and suggests a plan", () => {
  saveTraining({
    attempt: parseAttempt({ id: "00000000-0000-4000-8000-000000000001", mode: "text", startedAt: NOW - DAY, live: [] }, NOW),
    userId: maria.id, clinicId: lux, scenarioId: "igor", transcript: [{ role: "user", text: "Алло" }],
    result: { total: 60, scores: {}, appointmentBooked: false }, now: NOW,
  });
  const rep = usageReport(NOW);
  const c = rep.clinics.find((x) => x.id === lux);
  const a = c.users.find((u) => u.id === anna.id);
  const m = c.users.find((u) => u.id === maria.id);
  assert.equal(a.minutes30, 7, "5 min with a patient + 2 with the operator");
  assert.equal(a.patientMinutes30, 5);
  assert.equal(a.operatorMinutes30, 2);
  assert.equal(a.calls30, 4, "the processing and missing calls count as calls, with no minutes yet");
  assert.equal(a.pending30, 1);
  assert.equal(a.costRub30, Math.round((0.46 + 0.2) * USD_RUB));
  assert.equal(m.minutes30, 3, "the call 40 days ago is outside the window");
  assert.equal(m.minutesAll, 13);
  assert.equal(m.text30, 1);
  assert.equal(m.costRub30, Math.round((0.25 + 0.03) * USD_RUB), "an evaluated training adds the Gemini estimate");
  assert.equal(c.minutes30, 10);
  assert.equal(c.seats, 2);
  assert.equal(c.active30, 2);
  assert.equal(c.plan.label, "Старт");
  const q = rep.clinics.find((x) => x.id === quiet);
  assert.equal(q.minutes30, 0);
  assert.equal(q.active30, 0);
  assert.equal(rep.clinics[0].id, lux, "busiest clinic first");
});

test("the plan covers both seats and minutes; past the largest plan minutes become overage", () => {
  assert.equal(recommendPlan(1, 0).label, "Старт");
  assert.equal(recommendPlan(3, 150).label, "Старт");
  assert.equal(recommendPlan(2, 151).label, "Клиника", "minutes push it up");
  assert.equal(recommendPlan(4, 10).label, "Клиника", "seats push it up");
  assert.equal(recommendPlan(9, 10).label, "Сеть");
  assert.deepEqual(recommendPlan(12, 1100.5), { key: "network", label: "Сеть", priceRub: 29900 + 101 * 15, extraMinutes: 101 });
});
