import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { scenarioIds } from "@/lib/scenarios";
import { attemptsOf, pickNext } from "@/lib/next-patient";
import { parseDirection, servesDirection } from "@/lib/direction";

// The patient for the next call on /call: the one this administrator has tried least, across all their devices, among the
// patients who take calls in the chosen direction (?direction=outbound leaves out the inbound-only ones).
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Войдите в систему" }, { status: 401 });
  const direction = parseDirection(new URL(req.url).searchParams.get("direction"));
  const ids = scenarioIds.filter((id) => servesDirection(id, direction));
  return NextResponse.json({ id: pickNext(ids, attemptsOf(user.id).filter((a) => ids.includes(a.id))) });
}
