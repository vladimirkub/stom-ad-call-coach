import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Agent ids written by `npm run create-agent` into .agents.json ({ [scenarioId | "operator"]: agentId }). */
export function agentIdFor(key: string): string | undefined {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), ".agents.json"), "utf8"))[key];
  } catch {
    return undefined;
  }
}

export async function signedUrlFor(agentId: string): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY не настроен на сервере");
  const res = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`, {
    headers: { "xi-api-key": apiKey },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ElevenLabs вернул ошибку ${res.status}`);
  const body = (await res.json()) as { signed_url?: string };
  if (!body.signed_url) throw new Error("ElevenLabs не вернул signed URL");
  return body.signed_url;
}
