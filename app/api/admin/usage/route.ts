import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/session";
import { syncUsage, usageReport } from "@/lib/usage";

// Owner usage view: first pulls lengths and prices of finished calls from ElevenLabs, then reports minutes and costs.
export async function GET() {
  const gate = await requireOwner();
  if ("denied" in gate) return gate.denied;
  const sync = await syncUsage();
  return NextResponse.json({ ...usageReport(), syncFailed: sync.failed });
}
