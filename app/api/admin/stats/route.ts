import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/session";
import { clinicStats, overview, trainingDetail, userStats } from "@/lib/stats";

// Owner statistics: ?view=overview | clinic&id= | user&id= | training&id=
export async function GET(req: Request) {
  const gate = await requireOwner();
  if ("denied" in gate) return gate.denied;
  const q = new URL(req.url).searchParams;
  const view = q.get("view") ?? "overview";
  const id = q.get("id") ?? "";
  const data =
    view === "overview" ? overview()
    : view === "clinic" ? clinicStats(Number(id))
    : view === "user" ? userStats(Number(id))
    : view === "training" ? trainingDetail(id)
    : undefined;
  if (data === undefined) return NextResponse.json({ error: "Неизвестный раздел" }, { status: 400 });
  if (data === null) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  return NextResponse.json(data);
}
