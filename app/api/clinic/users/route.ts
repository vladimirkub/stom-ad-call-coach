import { NextResponse } from "next/server";
import { createTrainee, listTrainees } from "@/lib/auth";
import { requireManager } from "@/lib/session";

// The clinic manager's team: the administrators of their own clinic (not the manager's or technical accounts), with
// their logins and passwords to send; POST { firstName, lastName } gives a new administrator access.
export async function GET() {
  const gate = await requireManager();
  if ("denied" in gate) return gate.denied;
  return NextResponse.json({ users: listTrainees(gate.manager.clinic.id).filter((u) => !u.tech) });
}

export async function POST(req: Request) {
  const gate = await requireManager();
  if ("denied" in gate) return gate.denied;
  const body = await req.json().catch(() => null);
  try {
    const user = createTrainee({
      clinicId: gate.manager.clinic.id,
      firstName: String(body?.firstName ?? "").slice(0, 60),
      lastName: String(body?.lastName ?? "").slice(0, 60),
    });
    return NextResponse.json({ user });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Не удалось добавить администратора" }, { status: 400 });
  }
}
