import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/ratelimit";
import { agentIdFor, conversationTokenFor, signedUrlFor } from "@/lib/agents";
import { FAST_TURN } from "@/lib/voice-config";
import { loadKb, selectPractices } from "@/lib/kb";
import { operatorFirstMessage, operatorPromptConfig } from "@/lib/operator";
import { currentClinicContext } from "@/lib/session";

/**
 * Starts a call from the virtual operator. Before every call the agent's instructions are rebuilt from the
 * clinic facts plus the current knowledge base, so each new dialogue uses what earlier calls taught us.
 * The patient is a live person improvising: there is no scenario and the operator knows nothing about them.
 */
export async function POST(req: Request) {
  const limited = rateLimit(req, "voice", 10);
  if (limited) return limited;
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = agentIdFor("operator");
  if (!apiKey || !agentId) {
    return NextResponse.json({ error: "Виртуальный оператор не настроен: запустите npm run create-agent" }, { status: 503 });
  }

  try {
    const practices = selectPractices(await loadKb());
    const { memo } = await currentClinicContext();
    const res = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
      method: "PATCH",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_config: {
          turn: FAST_TURN,
          agent: {
            first_message: operatorFirstMessage(),
            language: "ru",
            prompt: operatorPromptConfig({ memo, practices }),
          },
        },
      }),
    });
    if (!res.ok) {
      console.error("[operator/start] PATCH", res.status, await res.text().catch(() => ""));
      return NextResponse.json({ error: `Не удалось подготовить оператора (ElevenLabs ${res.status})` }, { status: 502 });
    }
    const [signedUrl, conversationToken] = await Promise.all([signedUrlFor(agentId), conversationTokenFor(agentId)]);
    return NextResponse.json({ signedUrl, conversationToken, practicesApplied: practices.dos.length + practices.avoids.length });
  } catch (e) {
    console.error("[operator/start]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Не удалось начать звонок" }, { status: 502 });
  }
}
