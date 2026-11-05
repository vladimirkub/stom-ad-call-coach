import { NextResponse } from "next/server";
import { listTrainees, resetPassword, setActive } from "@/lib/auth";
import { requireManager } from "@/lib/session";

// The manager acts on one administrator of their own clinic: { action: "reset" } issues a new password, "remove" closes
// access (the person leaves the lists; past calls stay in the clinic's figures), "restore" gives it back.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireManager();
  if ("denied" in gate) return gate.denied;
  const id = Number((await params).id);
  // Only the clinic's ordinary administrators: never another clinic's account, the manager or a technical one.
  const user = listTrainees(gate.manager.clinic.id).find((u) => u.id === id && !u.tech);
  if (!user) return NextResponse.json({ error: "Администратор не найден" }, { status: 404 });
  const action = (await req.json().catch(() => null))?.action;
  try {
    if (action === "reset") return NextResponse.json({ password: resetPassword(id) });
    if (action === "remove" || action === "restore") {
      setActive(id, action === "restore");
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Не удалось выполнить" }, { status: 400 });
  }
}
