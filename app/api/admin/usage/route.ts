import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/session";
import { syncUsage, usageReport } from "@/lib/usage";
import { voiceBalance } from "@/lib/voice-balance";

// Owner usage view: first pulls lengths and prices of finished calls from ElevenLabs, then reports minutes and costs.
export async function GET() {
  const gate = await requireOwner();
  if ("denied" in gate) return gate.denied;
  const [sync, balance] = await Promise.all([syncUsage(), voiceBalance()]);
  return NextResponse.json({ ...usageReport(), syncFailed: sync.failed, balance });
}
