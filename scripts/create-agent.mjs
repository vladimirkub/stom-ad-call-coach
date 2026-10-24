// Setup: creates or updates one ElevenLabs agent per patient scenario; ids are stored in .agents.json.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { OPERATOR_VOICE_ID, operatorFirstMessage, operatorPrompt } from "../lib/operator.ts";

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
      agent: {
        first_message: s.firstMessage,
        language: "ru",
        prompt: { prompt: p.prompt.replace("{{SITE_FACTS}}", clinic.promptFacts), llm: process.env.ELEVENLABS_LLM || "gemini-2.5-flash" },
      },
      tts: { voice_id: p.voiceId, model_id: "eleven_flash_v2_5" },
    },
  };
});

// The virtual operator: its prompt and first message are rebuilt before every call (lead card + knowledge base);
// this is only the initial version.
jobs.push({
  key: "operator",
  name: `${brand.name} - Виртуальный оператор`,
  conversation_config: {
    agent: {
      first_message: operatorFirstMessage(),
      language: "ru",
      prompt: { prompt: operatorPrompt({ memo: clinic.memo }), llm: process.env.ELEVENLABS_LLM || "gemini-2.5-flash" },
    },
    tts: { voice_id: OPERATOR_VOICE_ID, model_id: "eleven_flash_v2_5" },
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
