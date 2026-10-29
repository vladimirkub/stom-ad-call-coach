import { NextResponse } from "next/server";
import { currentClinicContext } from "@/lib/session";

// What the trainee's pages show about their clinic: the operator memo and the patient cards. Hidden reasons stay on the server.
export async function GET() {
  const ctx = await currentClinicContext();
  return NextResponse.json({
    legendVersion: ctx.legendVersion,
    memo: ctx.memo,
    leads: Object.fromEntries(Object.entries(ctx.personas).map(([id, p]) => [id, p.lead])),
  });
}
