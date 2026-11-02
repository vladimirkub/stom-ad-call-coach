import { NextResponse } from "next/server";
import { requireManager } from "@/lib/session";
import { clinicReportPdf, userReportPdf } from "@/lib/report-pdf";
import { userStats } from "@/lib/stats";

// PDF reports for the clinic manager: ?type=clinic (their clinic) or ?type=user&id= (an administrator of their clinic).
export async function GET(req: Request) {
  const gate = await requireManager();
  if ("denied" in gate) return gate.denied;
  const clinicId = gate.manager.clinic.id;
  const q = new URL(req.url).searchParams;
  const type = q.get("type");
  const id = Number(q.get("id"));
  const report =
    type === "clinic" ? await clinicReportPdf(clinicId)
    : type === "user" ? (userStats(id)?.user.clinicId === clinicId ? await userReportPdf(id) : null)
    : undefined;
  if (report === undefined) return NextResponse.json({ error: "Неизвестный отчёт" }, { status: 400 });
  if (report === null) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  return new Response(new Uint8Array(report.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${report.name}"`,
      "Cache-Control": "no-store",
    },
  });
}
