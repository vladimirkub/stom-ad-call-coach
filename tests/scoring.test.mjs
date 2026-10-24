import test from "node:test";
import assert from "node:assert/strict";
import { totalScore, skillScores, rubricFor } from "../lib/scoring.ts";
import { RUBRIC } from "../lib/rubric.ts";
import { EvaluationSchema } from "../lib/schemas.ts";
import { extractJson } from "../lib/gemma.ts";

test("weighted total is deterministic", () => {
  assert.equal(totalScore({ discovery: 10, objectionHandling: 10, booking: 10, showUp: 10 }), 100);
  assert.equal(totalScore({ discovery: 0, objectionHandling: 0, booking: 0, showUp: 0 }), 0);
  // 8*.25 + 6*.3 + 4*.25 + 2*.2 = 5.2 -> 52
  assert.equal(totalScore({ discovery: 8, objectionHandling: 6, booking: 4, showUp: 2 }), 52);
});

test("rubric has 20+ unique items across all four skills", () => {
  assert.ok(RUBRIC.length >= 20);
  assert.equal(new Set(RUBRIC.map((r) => r.id)).size, RUBRIC.length);
  assert.equal(new Set(RUBRIC.map((r) => r.skill)).size, 4);
});

test("skill scores come from the share of passed items", () => {
  const all = RUBRIC.map((r) => ({ ...r, done: true }));
  assert.deepEqual(skillScores(all), { discovery: 10, objectionHandling: 10, booking: 10, showUp: 10 });
  assert.deepEqual(skillScores(all.map((r) => ({ ...r, done: false }))), { discovery: 0, objectionHandling: 0, booking: 0, showUp: 0 });
  const half = RUBRIC.filter((r) => r.skill === "showUp").map((r, i) => ({ ...r, done: i < 3 })); // 3 of 5
  assert.equal(skillScores(half).showUp, 6);
});

test("real-call rubric skips scenario-only items", () => {
  assert.ok(rubricFor(false).some((r) => r.id === "uncoveredHidden"));
  assert.ok(!rubricFor(true).some((r) => r.id === "uncoveredHidden"));
});

test("extractJson handles fenced and padded output", () => {
  assert.deepEqual(extractJson('Sure!\n```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extractJson('text {"a":2} tail'), { a: 2 });
  assert.throws(() => extractJson("no json here"));
});

test("schema rejects malformed evaluations and defaults optional lists", () => {
  const ok = {
    passed: ["introduced"],
    appointmentBooked: false, objectionUncovered: false, objectionEvidence: "x", summary: "y", strengths: ["a"], improvements: ["b"],
  };
  const parsed = EvaluationSchema.safeParse(ok);
  assert.ok(parsed.success);
  assert.deepEqual(parsed.data.unsupportedClaims, []);
  assert.deepEqual(parsed.data.moments, []);
  assert.deepEqual(parsed.data.missed, []);
  assert.ok(!EvaluationSchema.safeParse({ ...ok, passed: "introduced" }).success);
  assert.ok(!EvaluationSchema.safeParse({ ...ok, improvements: [] }).success);
});

import { parseTranscript } from "../lib/parse.ts";

test("parseTranscript maps roles and joins continuation lines", () => {
  const t = parseTranscript("Оператор: Добрый день\nэто Анна\nПациент - Слушаю\n\nКлиент: Да\nМусор: игнор");
  assert.deepEqual(t, [
    { role: "user", text: "Добрый день это Анна" },
    { role: "agent", text: "Слушаю" },
    { role: "agent", text: "Да Мусор: игнор" },
  ]);
});
