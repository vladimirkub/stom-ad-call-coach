import { NextResponse } from "next/server";
import { requireManager } from "@/lib/session";
import { SECTIONS, approvedLegend, getFormerDoctors, getWishes } from "@/lib/legend";
import { DIRECTIONS, getDirections } from "@/lib/directions";
import { lastDecision, pendingProposal, propose, proposalChanges, withdrawProposal } from "@/lib/proposals";

function state(clinicId: number) {
  const approved = approvedLegend(clinicId);
  const pending = pendingProposal(clinicId);
  return {
    sections: SECTIONS,
    options: DIRECTIONS.map(({ key, label, hint }) => ({ key, label, hint })),
    // The manager edits from their pending proposal if there is one, otherwise from the clinic as it is.
    directions: pending?.directions ?? getDirections(clinicId),
    facts: pending?.facts ?? approved?.facts ?? [],
    wishes: pending ? pending.wishes : getWishes(clinicId),
    formerDoctors: pending?.formerDoctors ?? getFormerDoctors(clinicId),
    version: approved?.version ?? null,
    pending: pending && { ...pending, changes: proposalChanges(clinicId, pending) },
    last: lastDecision(clinicId),
  };
}

// The clinic manager's settings: GET the clinic's directions, legend facts and wishes for training; POST { action:
// "propose", directions, facts, wishes, comment } sends them to the owner for approval, { action: "withdraw" } takes the pending proposal back.
export async function GET() {
  const gate = await requireManager();
  if ("denied" in gate) return gate.denied;
  return NextResponse.json(state(gate.manager.clinic.id));
}

export async function POST(req: Request) {
  const gate = await requireManager();
  if ("denied" in gate) return gate.denied;
  const clinicId = gate.manager.clinic.id;
  const body = await req.json().catch(() => null);
  try {
    if (body?.action === "propose") propose(clinicId, gate.manager.id, body);
    else if (body?.action === "withdraw") withdrawProposal(clinicId);
    else return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
    return NextResponse.json(state(clinicId));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Не удалось выполнить" }, { status: 400 });
  }
}
