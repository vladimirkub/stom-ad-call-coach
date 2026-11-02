import { NextResponse } from "next/server";
import { requireManager } from "@/lib/session";
import { clinicStats, trainingDetail, userStats } from "@/lib/stats";

// The clinic cabinet's statistics: the same views as the owner's, but only the manager's own clinic.
// ?view=clinic | user&id= | training&id=. An administrator or a call of another clinic is "not found".
export async function GET(req: Request) {
  const gate = await requireManager();
  if ("denied" in gate) return gate.denied;
  const clinicId = gate.manager.clinic.id;
  const q = new URL(req.url).searchParams;
  const view = q.get("view") ?? "clinic";
  const id = q.get("id") ?? "";
  let data: unknown;
  if (view === "clinic") data = clinicStats(clinicId);
  else if (view === "user") {
    const s = userStats(Number(id));
    data = s && s.user.clinicId === clinicId ? s : null;
  } else if (view === "training") {
    const t = trainingDetail(id);
    data = t && t.clinicId === clinicId ? t : null;
  } else return NextResponse.json({ error: "Неизвестный раздел" }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  return NextResponse.json(data);
}
