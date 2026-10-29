// Setup: creates or updates one ElevenLabs agent per patient scenario; ids are stored in .agents.json.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { FAST_PROMPT, FAST_TURN, OPERATOR_TTS, PATIENT_LLM_OVERRIDES, PATIENT_TTS_OVERRIDES } from "../lib/voice-config.ts";
import { OPERATOR_VOICE_ID, operatorFirstMessage, operatorPromptConfig } from "../lib/operator.ts";
import { END_CALL_TOOL, agentPrompt } from "../lib/patient-behavior.ts";

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  console.error("Set ELEVENLABS_API_KEY in .env.local first.");
  process.exit(1);
}
const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const pub = read("../lib/scenarios-public.json");
const priv = read("../lib/scenarios-private.json");
const clinic = read("../lib/clinic.json");
const brand = read("../lib/brand.json");
const idsFile = new URL("../.agents.json", import.meta.url);
const ids = existsSync(idsFile) ? JSON.parse(readFileSync(idsFile, "utf8")) : {};
const headers = { "xi-api-key": apiKey, "Content-Type": "application/json" };
let failed = false;

const jobs = pub.map((s) => {
  const p = priv[s.id];
  return {
    key: s.id,
    name: `${brand.name} - ${s.name}`,
    conversation_config: {
      turn: FAST_TURN,
      agent: {
        first_message: s.firstMessage,
        language: "ru",
        // {{situation}}, {{concerns}} and {{site_facts}} are filled per call for the trainee's clinic (/api/signed-url);
        // these defaults are the shared demo clinic, used when a call passes nothing.
        dynamic_variables: { dynamic_variable_placeholders: { situation: p.situation, concerns: p.concerns, site_facts: clinic.promptFacts } },
        prompt: {
          prompt: agentPrompt(p.prompt),
          llm: process.env.ELEVENLABS_LLM || "gemini-2.5-flash",
          ...FAST_PROMPT,
          ...PATIENT_LLM_OVERRIDES[s.id],
          // Lets the patient hang up on a rude or dishonest operator, like a real person would.
          built_in_tools: { end_call: END_CALL_TOOL },
        },
      },
      tts: { voice_id: p.voiceId, model_id: "eleven_flash_v2_5", ...PATIENT_TTS_OVERRIDES[s.id] },
    },
  };
});

// The virtual operator: its prompt and first message are rebuilt before every call (lead card + knowledge base);
// this is only the initial version.
jobs.push({
  key: "operator",
  name: `${brand.name} - Виртуальный оператор`,
  conversation_config: {
    turn: FAST_TURN,
    agent: {
      first_message: operatorFirstMessage(),
      language: "ru",
      prompt: operatorPromptConfig({ memo: clinic.memo }),
    },
    tts: { voice_id: OPERATOR_VOICE_ID, ...OPERATOR_TTS },
  },
});

for (const job of jobs) {
  const { key, name, conversation_config } = job;
  if (ids[key]) {
    const res = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${ids[key]}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ conversation_config, name }),
    });
    if (res.ok) {
      console.log(`✓ ${key}: updated ${ids[key]}`);
      continue;
    }
    console.error(`  ${key}: update failed (${res.status}) ${JSON.stringify(await res.json().catch(() => ({})))}; creating a new agent`);
  }

  const res = await fetch("https://api.elevenlabs.io/v1/convai/agents/create", {
    method: "POST",
    headers,
    body: JSON.stringify({ name, conversation_config, platform_settings: { auth: { enable_auth: true } } }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`✗ ${key}: failed (${res.status}) ${JSON.stringify(body)}`);
    failed = true;
    continue;
  }
  ids[key] = body.agent_id;
  console.log(`✓ ${key}: created ${body.agent_id}`);
}

writeFileSync(idsFile, JSON.stringify(ids, null, 2) + "\n");
process.exit(failed ? 1 : 0);
