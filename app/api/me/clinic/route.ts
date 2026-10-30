import { NextResponse } from "next/server";
import { currentClinicContext } from "@/lib/session";
import { ensurePersonaFit } from "@/lib/persona-fit";

// What the trainee's pages show about their clinic: the operator memo and the patient cards. Hidden reasons stay on the server.
// A clinic's trainees see only cards fitted to their own legend (empty until then); the owner, with no clinic, sees the demo.
export async function GET() {
  const ctx = await currentClinicContext();
  if (ctx.clinicId != null) ensurePersonaFit(ctx.clinicId);
  const shown = ctx.clinicId == null ? Object.keys(ctx.personas) : ctx.fittedIds;
  return NextResponse.json({
    legendVersion: ctx.legendVersion,
    memo: ctx.memo,
    leads: Object.fromEntries(Object.entries(ctx.personas).map(([id, p]) => [id, shown.includes(id) ? p.lead : ""])),
  });
}
