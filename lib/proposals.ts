// A clinic manager's proposed changes to their clinic: the directions, the legend's facts (parking, installments,
// new offers: what the site does not say) and the wishes for training (what to test the administrators on). The manager edits a full copy and sends it; the owner sees what changed and
// approves or rejects it. Approval goes the owner's own way: directions saved, facts become the next legend version.
// One pending proposal per clinic: sending again replaces it.
import { db } from "./db.ts";
import { approveDraft, approvedLegend, cleanFacts, cleanFormerDoctors, cleanWishes, compareFacts, getFormerDoctors, getWishes, saveDraft, setFormerDoctors, setWishes, workingLegend, type Fact } from "./legend.ts";
import { getDirections, setDirections, DIRECTIONS, type DirectionKey } from "./directions.ts";

export type ProposalStatus = "pending" | "approved" | "rejected";
export type Proposal = {
  id: number; status: ProposalStatus; directions: DirectionKey[]; facts: Fact[]; wishes: string; formerDoctors: string[] | null; baseVersion: number | null;
  comment: string; answer: string; author: string; createdAt: number; updatedAt: number; decidedAt: number | null;
};

type Row = {
  id: number; status: ProposalStatus; directions: string; facts: string; wishes: string | null; former_doctors: string | null; base_version: number | null; comment: string; answer: string;
  first_name: string; last_name: string; created_at: number; updated_at: number; decided_at: number | null;
};
const toProposal = (r: Row | undefined): Proposal | null =>
  r
    ? {
        id: r.id, status: r.status, directions: JSON.parse(r.directions), facts: JSON.parse(r.facts), wishes: r.wishes ?? "",
        // An older proposal without the field keeps the clinic's list as it is (null: unchanged).
        formerDoctors: r.former_doctors == null ? null : JSON.parse(r.former_doctors), baseVersion: r.base_version,
        comment: r.comment, answer: r.answer, author: `${r.first_name} ${r.last_name}`.trim(),
        createdAt: r.created_at, updatedAt: r.updated_at, decidedAt: r.decided_at,
      }
    : null;
const SELECT = "SELECT p.*, u.first_name, u.last_name FROM proposals p JOIN users u ON u.id = p.user_id";

export function pendingProposal(clinicId: number): Proposal | null {
  return toProposal(db().prepare(`${SELECT} WHERE p.clinic_id = ? AND p.status = 'pending'`).get(clinicId) as Row | undefined);
}

/** The latest decided proposal: the manager sees whether it was approved, or why not. */
export function lastDecision(clinicId: number): Proposal | null {
  return toProposal(db().prepare(`${SELECT} WHERE p.clinic_id = ? AND p.status != 'pending' ORDER BY p.decided_at DESC, p.id DESC LIMIT 1`).get(clinicId) as Row | undefined);
}

/** What the proposal changes against the clinic as it is now. */
export function proposalChanges(clinicId: number, p: Proposal) {
  const approved = approvedLegend(clinicId);
  const current = getDirections(clinicId);
  const wishesNow = getWishes(clinicId);
  const formerNow = getFormerDoctors(clinicId);
  const formerAfter = p.formerDoctors ?? formerNow;
  const label = (k: string) => DIRECTIONS.find((d) => d.key === k)?.label ?? k;
  return {
    directionsAdded: p.directions.filter((d) => !current.includes(d)).map(label),
    directionsRemoved: current.filter((d) => !p.directions.includes(d)).map(label),
    facts: compareFacts(p.facts, approved?.facts ?? []),
    // The wishes as they would become, when they differ from now; null when unchanged.
    wishes: p.wishes !== wishesNow ? { before: wishesNow, after: p.wishes } : null,
    // The former doctors as they would become, when they differ from now; null when unchanged.
    formerDoctors: formerAfter.join("\n") !== formerNow.join("\n") ? { before: formerNow, after: formerAfter } : null,
    // The owner approved another legend version since the manager started from it: their copy may undo those edits.
    stale: p.baseVersion != null && approved?.version !== p.baseVersion,
  };
}

export function propose(clinicId: number, userId: number, raw: { directions?: unknown; facts?: unknown; wishes?: unknown; formerDoctors?: unknown; comment?: unknown }) {
  const approved = approvedLegend(clinicId);
  if (!approved) throw new Error("У клиники ещё нет утверждённой легенды: изменения можно будет предложить после неё");
  if (!Array.isArray(raw.directions)) throw new Error("Направления должны быть списком");
  const directions = DIRECTIONS.map((d) => d.key).filter((k) => (raw.directions as unknown[]).includes(k));
  const facts = cleanFacts(raw.facts);
  if (facts.filter((f) => f.section !== "missing").length === 0) throw new Error("В легенде не осталось фактов");
  const wishes = raw.wishes === undefined ? getWishes(clinicId) : cleanWishes(raw.wishes);
  const formerDoctors = raw.formerDoctors === undefined ? getFormerDoctors(clinicId) : cleanFormerDoctors(raw.formerDoctors);
  const comment = String(raw.comment ?? "").trim().slice(0, 1000);
  const changes = proposalChanges(clinicId, { directions, facts, wishes, formerDoctors, baseVersion: approved.version } as Proposal);
  if (!changes.directionsAdded.length && !changes.directionsRemoved.length && !changes.facts.added.length && !changes.facts.removed.length && !changes.wishes && !changes.formerDoctors) {
    throw new Error("Изменений нет: всё совпадает с текущей легендой");
  }
  const now = Date.now();
  const pending = pendingProposal(clinicId);
  if (pending) {
    db()
      .prepare("UPDATE proposals SET user_id = ?, directions = ?, facts = ?, wishes = ?, former_doctors = ?, base_version = ?, comment = ?, updated_at = ? WHERE id = ?")
      .run(userId, JSON.stringify(directions), JSON.stringify(facts), wishes, JSON.stringify(formerDoctors), approved.version, comment, now, pending.id);
  } else {
    db()
      .prepare("INSERT INTO proposals (clinic_id, user_id, status, directions, facts, wishes, former_doctors, base_version, comment, created_at, updated_at) VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(clinicId, userId, JSON.stringify(directions), JSON.stringify(facts), wishes, JSON.stringify(formerDoctors), approved.version, comment, now, now);
  }
  return pendingProposal(clinicId)!;
}

export function withdrawProposal(clinicId: number) {
  db().prepare("DELETE FROM proposals WHERE clinic_id = ? AND status = 'pending'").run(clinicId);
}

/**
 * Applies the pending proposal. Facts go through the owner's own draft-and-approve, so they become the next legend
 * version; the caller then refits the patients. Refused while the owner has an unfinished draft of their own.
 */
export function approveProposal(clinicId: number, answer = "") {
  const p = pendingProposal(clinicId);
  if (!p) throw new Error("Нет предложения для утверждения");
  const changes = proposalChanges(clinicId, p);
  if (changes.facts.added.length || changes.facts.removed.length) {
    const working = workingLegend(clinicId);
    if (working) throw new Error("Сначала утвердите или отмените свой черновик легенды: предложение руководителя заменило бы его");
    saveDraft(clinicId, p.facts);
    approveDraft(clinicId);
  }
  setDirections(clinicId, p.directions);
  if (changes.wishes) setWishes(clinicId, p.wishes);
  if (changes.formerDoctors) setFormerDoctors(clinicId, changes.formerDoctors.after);
  decide(p.id, "approved", answer);
}

export function rejectProposal(clinicId: number, answer = "") {
  const p = pendingProposal(clinicId);
  if (!p) throw new Error("Нет предложения");
  decide(p.id, "rejected", answer);
}

function decide(id: number, status: "approved" | "rejected", answer: string) {
  db().prepare("UPDATE proposals SET status = ?, answer = ?, decided_at = ? WHERE id = ?").run(status, String(answer).trim().slice(0, 1000), Date.now(), id);
}

/** Clinics with a proposal waiting for the owner. */
export function clinicsWithProposals(): Set<number> {
  return new Set((db().prepare("SELECT clinic_id FROM proposals WHERE status = 'pending'").all() as { clinic_id: number }[]).map((r) => r.clinic_id));
}
