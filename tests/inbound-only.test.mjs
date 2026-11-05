import test from "node:test";
import assert from "node:assert/strict";
import { INBOUND_ONLY, callDirection, servesDirection } from "../lib/direction.ts";

test("patients 14–23 call the clinic themselves: never an outbound call", () => {
  assert.deepEqual([...INBOUND_ONLY].sort(), ["andrey", "denis", "gleb", "irina", "mikhail", "natalia", "pavel", "roman", "sergey", "stanislav", "viktor", "yuri"]);
  assert.equal(callDirection("gleb", "outbound"), "inbound");
  assert.equal(callDirection("viktor", undefined), "inbound");
  assert.equal(callDirection("marina", "outbound"), "outbound");
  assert.equal(callDirection("marina", "inbound"), "inbound");
  assert.equal(servesDirection("gleb", "outbound"), false);
  assert.equal(servesDirection("gleb", "inbound"), true);
  assert.equal(servesDirection("kirill", "outbound"), true);
});

test("the patient with three cancellations is only ever called back", async () => {
  const { OUTBOUND_ONLY, fixedDirection } = await import("../lib/direction.ts");
  assert.deepEqual([...OUTBOUND_ONLY], ["konstantin", "artur"]);
  assert.equal(fixedDirection("konstantin"), "outbound");
  assert.equal(callDirection("konstantin", "inbound"), "outbound");
  assert.equal(servesDirection("konstantin", "inbound"), false);
  assert.equal(servesDirection("konstantin", "outbound"), true);
  assert.equal(fixedDirection("marina"), null);
});
