import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, endSession } from "@/lib/auth";

export async function POST() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) endSession(token);
  jar.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
