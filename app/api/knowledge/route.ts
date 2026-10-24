import { NextResponse } from "next/server";
import { loadKb } from "@/lib/kb";

export async function GET() {
  const kb = await loadKb();
  return NextResponse.json({ entries: [...kb.entries].sort((a, b) => b.confirmations - a.confirmations || b.lastSeenAt - a.lastSeenAt) });
}
