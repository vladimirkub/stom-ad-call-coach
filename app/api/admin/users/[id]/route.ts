import { NextResponse } from "next/server";
import { resetPassword, setActive } from "@/lib/auth";
import { requireOwner } from "@/lib/session";

// { action: "reset" } issues a new password; "disable" / "enable" closes or reopens access (and ends open sessions).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireOwner();
  if ("denied" in gate) return gate.denied;
  const id = Number((await params).id);
  const action = (await req.json().catch(() => null))?.action;
  try {
    if (action === "reset") return NextResponse.json({ password: resetPassword(id) });
    if (action === "disable" || action === "enable") {
      setActive(id, action === "enable");
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Не удалось выполнить" }, { status: 400 });
  }
}
