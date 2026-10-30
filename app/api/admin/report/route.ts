import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/session";
import { clinicReportPdf, legendPdf, userReportPdf } from "@/lib/report-pdf";

// PDF download for the owner: ?type=clinic&id=, ?type=user&id=, or ?type=legend&id=<clinic>&version=draft|approved
export async function GET(req: Request) {
  const gate = await requireOwner();
  if ("denied" in gate) return gate.denied;
  const q = new URL(req.url).searchParams;
  const id = Number(q.get("id"));
  const type = q.get("type");
  const version = q.get("version") === "draft" ? "draft" : q.get("version") === "approved" ? "approved" : undefined;
  const report =
    type === "clinic" ? await clinicReportPdf(id)
    : type === "user" ? await userReportPdf(id)
    : type === "legend" ? await legendPdf(id, version)
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
