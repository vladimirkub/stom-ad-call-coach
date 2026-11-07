import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { releaseCallLock } from "@/lib/call-lock";

// The browser gives back the login's call lock when a voice call ends: { token }. Sent with fetch or sendBeacon
// (a closing page), so the body may arrive as plain text.
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Войдите в систему" }, { status: 401 });
  const body = await req.text().then((t) => JSON.parse(t)).catch(() => null);
  releaseCallLock(user.id, body?.token);
  return NextResponse.json({ ok: true });
}
