import test from "node:test";
import assert from "node:assert/strict";

const { TEMPO, onTime } = await import("../lib/tempo.ts");
const { PATIENT_CONVERSATION, PATIENT_TURN } = await import("../lib/voice-config.ts");
const { modelRubric, rubricFor } = await import("../lib/scoring.ts");
const priv = (await import("../lib/scenarios-private.json", { with: { type: "json" } })).default;

test("a call is on time within 2.5 minutes in voice and 8 operator replies in text", () => {
  assert.equal(onTime("voice", 150, 20), true);
  assert.equal(onTime("voice", 151, 3), false);
  assert.equal(onTime("text", 9999, 8), true);
  assert.equal(onTime("text", 30, 9), false);
});

test("the agents end a call at the tempo cap and after 15 s of silence", () => {
  assert.equal(PATIENT_CONVERSATION.max_duration_seconds, TEMPO.maxSeconds);
  assert.equal(PATIENT_TURN.silence_end_call_timeout, 15);
});

test("the tempo item is decided in code: the model and the live checklist never see it", () => {
  assert.ok(rubricFor(false).some((r) => r.id === "onTime"));
  assert.ok(!modelRubric(false).some((r) => r.id === "onTime"));
  assert.ok(!rubricFor(true).some((r) => r.id === "onTime"), "real calls have no tempo target");
});

test("every patient has their own patience", () => {
  for (const [id, p] of Object.entries(priv)) assert.match(p.prompt, /ТВОЁ ТЕРПЕНИЕ: /, id);
});
