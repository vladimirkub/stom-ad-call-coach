import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/ratelimit";
import { scenarioIds } from "@/lib/scenarios";
import { agentIdFor, conversationTokenFor } from "@/lib/agents";
import { personaVars } from "@/lib/clinic-context";
import { currentClinicContext } from "@/lib/session";

export async function GET(req: Request) {
  const limited = rateLimit(req, "voice", 10);
  if (limited) return limited;
  const scenario = new URL(req.url).searchParams.get("scenario") ?? "";
  if (!scenarioIds.includes(scenario)) return NextResponse.json({ error: "Неизвестный пациент" }, { status: 400 });
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = agentIdFor(scenario);
  if (!apiKey || !agentId) {
    return NextResponse.json({ error: "Голос для этого пациента не настроен. Запустите npm run create-agent или используйте текстовый режим." }, { status: 503 });
  }
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
      { headers: { "xi-api-key": apiKey }, cache: "no-store" },
    );
    if (!res.ok) return NextResponse.json({ error: `ElevenLabs вернул ошибку ${res.status}` }, { status: 502 });
    const body = (await res.json()) as { signed_url?: string };
    if (!body.signed_url) return NextResponse.json({ error: "ElevenLabs не вернул signed URL" }, { status: 502 });
    // The agent prompt keeps {{situation}}, {{concerns}} and {{site_facts}} open; the call fills them for this clinic.
    const dynamicVariables = personaVars(await currentClinicContext(), scenario);
    return NextResponse.json({ signedUrl: body.signed_url, conversationToken: await conversationTokenFor(agentId), dynamicVariables });
  } catch {
    return NextResponse.json({ error: "Не удалось связаться с ElevenLabs" }, { status: 502 });
  }
}
