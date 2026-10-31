import test from "node:test";
import assert from "node:assert/strict";

const { TEMPO, TEMPO_NOTES, TEMPO_NOTE_TEXT, onTime, textTempoStage } = await import("../lib/tempo.ts");
const { PATIENT_CONVERSATION, PATIENT_TURN } = await import("../lib/voice-config.ts");
const { modelRubric, rubricFor } = await import("../lib/scoring.ts");
const priv = (await import("../lib/scenarios-private.json", { with: { type: "json" } })).default;

test("a call is on time within 3 minutes in voice and 10 operator replies in text", () => {
  assert.equal(onTime("voice", 180, 20), true);
  assert.equal(onTime("voice", 181, 3), false);
  assert.equal(onTime("text", 9999, 10), true);
  assert.equal(onTime("text", 30, 11), false);
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

test("time notes come in order, the goodbye well before the hard cap", () => {
  const at = TEMPO_NOTES.map((n) => n.voiceSeconds);
  assert.deepEqual([...at].sort((a, b) => a - b), at);
  assert.ok(at.at(-1) <= TEMPO.maxSeconds - 20, "time to say goodbye before ElevenLabs ends the call");
  for (const n of TEMPO_NOTES) assert.match(TEMPO_NOTE_TEXT[n.stage], /не произноси/);
});

test("a text call reaches the notes by the operator's replies", () => {
  assert.equal(textTempoStage(9), null);
  assert.equal(textTempoStage(10), "target");
  assert.equal(textTempoStage(13), "lastMinute");
  assert.equal(textTempoStage(20), "wrapUp");
});
