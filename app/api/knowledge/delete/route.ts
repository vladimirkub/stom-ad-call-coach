import { NextResponse } from "next/server";
import { updateKb } from "@/lib/kb";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (typeof body?.id !== "string" || !body.id) return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  const left = await updateKb((kb) => ({ kb: { ...kb, entries: kb.entries.filter((e) => e.id !== body.id) }, value: kb.entries.length }));
  return NextResponse.json({ ok: true, total: left });
}
