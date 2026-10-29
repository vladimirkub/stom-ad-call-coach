import { NextResponse } from "next/server";
import { createTrainee, listTrainees } from "@/lib/auth";
import { requireOwner } from "@/lib/session";

export async function GET(req: Request) {
  const gate = await requireOwner();
  if ("denied" in gate) return gate.denied;
  const clinicId = Number(new URL(req.url).searchParams.get("clinicId"));
  if (!Number.isInteger(clinicId)) return NextResponse.json({ error: "Не указана клиника" }, { status: 400 });
  return NextResponse.json({ users: listTrainees(clinicId) });
}

export async function POST(req: Request) {
  const gate = await requireOwner();
  if ("denied" in gate) return gate.denied;
  const body = await req.json().catch(() => null);
  try {
    const user = createTrainee({
      clinicId: Number(body?.clinicId),
      firstName: String(body?.firstName ?? "").slice(0, 60),
      lastName: String(body?.lastName ?? "").slice(0, 60),
    });
    return NextResponse.json({ user });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Не удалось создать пользователя" }, { status: 400 });
  }
}
