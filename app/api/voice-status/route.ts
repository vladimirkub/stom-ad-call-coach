import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { voiceProblem } from "@/lib/usage";

// The call page asks this when a voice call breaks off before the conversation starts: { conversationId } → { problem }.
// "quota": the ElevenLabs credits ran out, so no voice call can start until they are topped up.
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Войдите в систему" }, { status: 401 });
  const body = await req.json().catch(() => null);
  return NextResponse.json({ problem: await voiceProblem(body?.conversationId, user.id) });
}
