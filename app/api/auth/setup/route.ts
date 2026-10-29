import { NextResponse } from "next/server";
import { setupOwner } from "@/lib/auth";
import { setSessionCookie } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";

// One-time owner setup through the link printed by scripts/owner-setup.mjs on the server.
export async function POST(req: Request) {
  const limited = rateLimit(req, "setup", 5);
  if (limited) return limited;
  const body = await req.json().catch(() => null);
  try {
    const token = setupOwner(String(body?.token ?? ""), String(body?.password ?? ""), {
      firstName: String(body?.firstName ?? "").slice(0, 60),
      lastName: String(body?.lastName ?? "").slice(0, 60),
    });
    await setSessionCookie(token);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Не удалось создать владельца" }, { status: 400 });
  }
}
