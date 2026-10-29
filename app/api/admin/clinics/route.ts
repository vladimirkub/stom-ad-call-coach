import { NextResponse } from "next/server";
import { createClinic, listClinics } from "@/lib/auth";
import { requireOwner } from "@/lib/session";

export async function GET() {
  const gate = await requireOwner();
  if ("denied" in gate) return gate.denied;
  return NextResponse.json({ clinics: listClinics() });
}

export async function POST(req: Request) {
  const gate = await requireOwner();
  if ("denied" in gate) return gate.denied;
  const body = await req.json().catch(() => null);
  try {
    const id = createClinic({
      legalName: String(body?.legalName ?? "").slice(0, 200),
      slug: String(body?.slug ?? ""),
      city: String(body?.city ?? "").slice(0, 80),
    });
    return NextResponse.json({ id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Не удалось создать клинику" }, { status: 400 });
  }
}
