import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/ratelimit";
import { firstLine, scenarioIds, scenarioVars } from "@/lib/scenarios";
import { agentIdFor, conversationTokenFor } from "@/lib/agents";
import { currentClinicContext } from "@/lib/session";
import { callDirection } from "@/lib/direction";

export async function GET(req: Request) {
  const limited = rateLimit(req, "voice", 10);
  if (limited) return limited;
  const q = new URL(req.url).searchParams;
  const scenario = q.get("scenario") ?? "";
  const direction = callDirection(scenario, q.get("direction"));
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
    // The agent prompt keeps {{situation}}, {{concerns}}, {{site_facts}} and {{call_direction}} open; the call fills them
    // for this clinic and direction. On an inbound call the first line is empty: the patient waits for the administrator.
    const ctx = await currentClinicContext();
    const dynamicVariables = {
      ...scenarioVars(ctx, scenario, direction, q.get("variant")),
      first_line: direction === "inbound" ? "" : firstLine(ctx, scenario, q.get("variant") ?? undefined),
    };
    return NextResponse.json({ signedUrl: body.signed_url, conversationToken: await conversationTokenFor(agentId), dynamicVariables });
  } catch {
    return NextResponse.json({ error: "Не удалось связаться с ElevenLabs" }, { status: 502 });
  }
}
