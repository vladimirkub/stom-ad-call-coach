import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/session";
import {
  OFFERS_SOURCE, SECTIONS, approveDraft, approvedLegend, compareFacts, discardDraft, expireStaleAnalyses, getOffers, getSites, legendHistory, saveDraft, setOffers,
  setSites, startAnalysis, workingLegend,
} from "@/lib/legend";

function state(clinicId: number) {
  expireStaleAnalyses();
  const approved = approvedLegend(clinicId);
  const working = workingLegend(clinicId);
  return {
    sections: SECTIONS,
    offersSource: OFFERS_SOURCE,
    sites: getSites(clinicId),
    offers: getOffers(clinicId),
    approved,
    working,
    history: legendHistory(clinicId),
    changes: approved && working?.status === "draft" ? compareFacts(working.facts, approved.facts) : null,
  };
}

// The owner's clinic legend: GET ?clinicId= for everything; POST { clinicId, action, sites?, offers?, facts? }.
export async function GET(req: Request) {
  const gate = await requireOwner();
  if ("denied" in gate) return gate.denied;
  const clinicId = Number(new URL(req.url).searchParams.get("clinicId"));
  try {
    return NextResponse.json(state(clinicId));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Ошибка" }, { status: 404 });
  }
}

export async function POST(req: Request) {
  const gate = await requireOwner();
  if ("denied" in gate) return gate.denied;
  const body = await req.json().catch(() => null);
  const clinicId = Number(body?.clinicId);
  try {
    switch (body?.action) {
      case "sites":
        setSites(clinicId, body.sites);
        break;
      case "offers":
        setOffers(clinicId, body.offers);
        break;
      case "analyze":
        startAnalysis(clinicId);
        break;
      case "save":
        saveDraft(clinicId, body.facts);
        break;
      case "approve":
        approveDraft(clinicId, body.facts);
        break;
      case "discard":
        discardDraft(clinicId);
        break;
      default:
        return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
    }
    return NextResponse.json(state(clinicId));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Не удалось выполнить" }, { status: 400 });
  }
}
