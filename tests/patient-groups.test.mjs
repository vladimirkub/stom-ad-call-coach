import test from "node:test";
import assert from "node:assert/strict";

const { PATIENT_GROUPS, parseGroupTab } = await import("../lib/patient-groups.ts");
const pub = (await import("../lib/scenarios-public.json", { with: { type: "json" } })).default;

test("every patient sits in one known group, and every group has patients", () => {
  const keys = PATIENT_GROUPS.map((g) => g.key);
  for (const s of pub) assert.ok(keys.includes(s.group), `${s.id}: ${s.group}`);
  for (const k of keys) assert.ok(pub.some((s) => s.group === k), `${k} is empty`);
  // A tab holds at most one screen of cards (5 x 3).
  for (const k of keys) assert.ok(pub.filter((s) => s.group === k).length <= 15, k);
});

test("an unknown remembered tab falls back to all patients", () => {
  assert.equal(parseGroupTab("time"), "time");
  assert.equal(parseGroupTab("nonsense"), "all");
  assert.equal(parseGroupTab(null), "all");
});
