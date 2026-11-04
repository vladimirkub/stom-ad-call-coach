import { NextResponse } from "next/server";
import { scenarioRecord } from "@/lib/scenarios";
import { currentClinicContext, currentUser } from "@/lib/session";

// The clinic's record of a patient with call variants, as the administrator finds it during the call:
// GET ?scenario=&variant= → { record }, with the treating doctor from this clinic's legend.
export async function GET(req: Request) {
  if (!(await currentUser())) return NextResponse.json({ error: "Войдите в систему" }, { status: 401 });
  const q = new URL(req.url).searchParams;
  const record = scenarioRecord(await currentClinicContext(), q.get("scenario") ?? "", q.get("variant"));
  if (!record) return NextResponse.json({ error: "Нет записи" }, { status: 404 });
  return NextResponse.json({ record });
}
