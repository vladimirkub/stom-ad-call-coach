import test from "node:test";
import assert from "node:assert/strict";

process.env.DB_PATH = ":memory:";
const { balanceView } = await import("../lib/voice-balance.ts");

test("the balance is shown in minutes of voice and days at the recent pace", () => {
  const b = balanceView({ tier: "creator", character_count: 132_963, character_limit: 406_000, next_character_count_reset_unix: 1_795_518_413 }, 70);
  assert.equal(b.left, 273_037);
  assert.equal(b.minutesLeft, 584);
  assert.equal(b.perDay, 4670); // 10 min a day
  assert.equal(b.daysLeft, 58);
  assert.equal(b.low, false);
  assert.equal(b.resetAt, 1_795_518_413_000);
});

test("a short balance warns; no recent calls means no day estimate; a broken answer gives nothing", () => {
  assert.equal(balanceView({ character_count: 390_000, character_limit: 406_000 }, 70).low, true); // 34 min left
  assert.equal(balanceView({ character_count: 100_000, character_limit: 406_000 }, 700).low, false); // 100 min a day: 6 days
  assert.equal(balanceView({ character_count: 100_000, character_limit: 406_000 }, 1000).low, true); // 4 days
  const quiet = balanceView({ character_count: 0, character_limit: 100_000 }, 0);
  assert.equal(quiet.daysLeft, null);
  assert.equal(quiet.low, false);
  assert.equal(balanceView({}, 10), null);
});
