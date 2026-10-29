import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { scenarioIds } from "@/lib/scenarios";
import { recordCall } from "@/lib/usage";

// The browser reports each voice call once it connects: { conversationId, kind: "patient" | "operator", scenarioId? }.
// Minutes and price are filled in later from ElevenLabs, so nothing here is trusted beyond who started which call.
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Войдите в систему" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const kind = body?.kind === "operator" ? "operator" : body?.kind === "patient" ? "patient" : null;
  const scenarioId = kind === "patient" && scenarioIds.includes(body?.scenarioId) ? (body.scenarioId as string) : null;
  if (!kind || (kind === "patient" && !scenarioId)) return NextResponse.json({ error: "Неверный звонок" }, { status: 400 });
  if (!recordCall({ conversationId: body?.conversationId, userId: user.id, clinicId: user.clinic?.id ?? null, kind, scenarioId })) {
    return NextResponse.json({ error: "Неверный звонок" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
