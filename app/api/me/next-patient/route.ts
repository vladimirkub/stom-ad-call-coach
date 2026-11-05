import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { scenarioIds } from "@/lib/scenarios";
import { attemptsOf, pickNext } from "@/lib/next-patient";

// The patient for the next call on /call: the one this administrator has tried least, across all their devices.
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Войдите в систему" }, { status: 401 });
  return NextResponse.json({ id: pickNext(scenarioIds, attemptsOf(user.id)) });
}
