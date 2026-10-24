import { NextResponse } from "next/server";
import { clearConn } from "@/lib/crm/session";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (typeof body?.id !== "string" || !body.id) return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  await clearConn(body.id);
  return NextResponse.json({ ok: true });
}
