import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/session";
import {
  OFFERS_SOURCE, SECTIONS, approveDraft, approvedLegend, compareFacts, discardDraft, expireStaleAnalyses, getOffers, getSites, getWishes, getFormerDoctors, legendHistory, saveDraft, setOffers,
  setSites, setWishes, setFormerDoctors, startAnalysis, workingLegend,
} from "@/lib/legend";
import { ensurePersonaFit, personaFitState, startPersonaFit } from "@/lib/persona-fit";
import { DIRECTIONS, assignDirections, getDirections, setDirections, suggestDirections } from "@/lib/directions";
import { approveProposal, pendingProposal, proposalChanges, rejectProposal } from "@/lib/proposals";
import { isAutonomous, rollbackTo, setAutonomous } from "@/lib/clinic-setup";

function state(clinicId: number) {
  expireStaleAnalyses();
  ensurePersonaFit(clinicId);
  const approved = approvedLegend(clinicId);
  const working = workingLegend(clinicId);
  const proposal = pendingProposal(clinicId);
  return {
    sections: SECTIONS,
    // The clinic manager's changes waiting for the owner (lib/proposals.ts).
    proposal: proposal && { ...proposal, changes: proposalChanges(clinicId, proposal) },
    offersSource: OFFERS_SOURCE,
    sites: getSites(clinicId),
    offers: getOffers(clinicId),
    wishes: getWishes(clinicId),
    formerDoctors: getFormerDoctors(clinicId),
    // The manager sets the clinic up alone (lib/clinic-setup.ts), or proposes changes for approval.
    autonomous: isAutonomous(clinicId),
    approved,
    working,
    history: legendHistory(clinicId),
    changes: approved && working?.status === "draft" ? compareFacts(working.facts, approved.facts) : null,
    patients: personaFitState(clinicId),
    directions: {
      options: DIRECTIONS.map(({ key, label, hint }) => ({ key, label, hint })),
      selected: getDirections(clinicId),
      suggested: suggestDirections((working?.status === "draft" ? working : approved)?.facts ?? []),
      plan: assignDirections(getDirections(clinicId)),
    },
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
        approveDraft(clinicId, body.facts, { author: "Stom AD" });
        // All patients are refitted to every new version in the background.
        startPersonaFit(clinicId);
        break;
      case "refit":
        startPersonaFit(clinicId);
        break;
      case "directions":
        setDirections(clinicId, body.directions);
        // New directions change who comes for what: refit right away if the clinic already has an approved legend.
        if (approvedLegend(clinicId)) startPersonaFit(clinicId);
        break;
      case "wishes":
        setWishes(clinicId, body.wishes);
        // The patients raise the wished topics: refit them to the new wishes.
        if (approvedLegend(clinicId)) startPersonaFit(clinicId);
        break;
      case "formerDoctors":
        // Filled into the calls of the patient who asks for a former doctor; nothing to refit.
        setFormerDoctors(clinicId, body.formerDoctors);
        break;
      case "autonomous":
        setAutonomous(clinicId, !!body.on);
        break;
      case "rollback":
        rollbackTo(clinicId, Number(body.version), "Stom AD");
        break;
      case "discard":
        discardDraft(clinicId);
        break;
      case "approveProposal":
        approveProposal(clinicId, body.answer);
        startPersonaFit(clinicId);
        break;
      case "rejectProposal":
        rejectProposal(clinicId, body.answer);
        break;
      default:
        return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
    }
    return NextResponse.json(state(clinicId));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Не удалось выполнить" }, { status: 400 });
  }
}
