import test from "node:test";
import assert from "node:assert/strict";

process.env.DB_PATH = ":memory:";
process.env.PASSWORD_KEY = "test-password-key-test-password-key-0123";

const auth = await import("../lib/auth.ts");
const legend = await import("../lib/legend.ts");
const { getDirections, setDirections } = await import("../lib/directions.ts");
const P = await import("../lib/proposals.ts");

const clinic = auth.createClinic({ legalName: "ООО «Люкс»", slug: "lux", city: "Пермь" });
const manager = auth.createTrainee({ clinicId: clinic, firstName: "Клиника", lastName: "Админ" });
auth.setRole(manager.id, "manager");
const fact = (text, section = "services") => ({ section, text, source: null });
const base = [fact("Консультация бесплатно"), fact("Рассрочка: нет условий на сайте", "missing")];

test("without an approved legend there is nothing to propose", () => {
  assert.throws(() => P.propose(clinic, manager.id, { directions: [], facts: base }), /нет утверждённой легенды/);
});

test("the manager proposes facts and directions; the owner sees what changes; approval makes the next legend version", () => {
  legend.approveDraft(clinic, base);
  setDirections(clinic, ["therapy"]);
  assert.throws(() => P.propose(clinic, manager.id, { directions: ["therapy"], facts: base }), /Изменений нет/);

  const facts = [fact("Консультация бесплатно"), fact("Бесплатная парковка во дворе", "location")];
  const p = P.propose(clinic, manager.id, { directions: ["therapy", "kids"], facts, comment: "Парковка есть" });
  assert.equal(p.author, "Клиника Админ");
  const ch = P.proposalChanges(clinic, p);
  assert.deepEqual(ch.directionsAdded, ["Детская стоматология"]);
  assert.deepEqual(ch.facts.added, ["Бесплатная парковка во дворе"]);
  assert.deepEqual(ch.facts.removed.map((f) => f.text), ["Рассрочка: нет условий на сайте"]);
  assert.equal(ch.stale, false);
  assert.ok(P.clinicsWithProposals().has(clinic));

  // Sending again replaces the pending proposal, it does not stack up.
  P.propose(clinic, manager.id, { directions: ["therapy", "kids"], facts, comment: "Парковка и детская" });
  assert.equal(P.pendingProposal(clinic).comment, "Парковка и детская");

  P.approveProposal(clinic, "Спасибо");
  const now = legend.approvedLegend(clinic);
  assert.equal(now.version, 2);
  assert.deepEqual(now.facts.map((f) => f.text), ["Консультация бесплатно", "Бесплатная парковка во дворе"]);
  assert.deepEqual(getDirections(clinic), ["therapy", "kids"]);
  assert.equal(P.pendingProposal(clinic), null);
  assert.equal(P.lastDecision(clinic).status, "approved");
  assert.equal(P.lastDecision(clinic).answer, "Спасибо");
});

test("approval waits for the owner's own unfinished draft; rejection keeps the legend and tells why; withdrawal removes it", () => {
  const current = legend.approvedLegend(clinic).facts;
  P.propose(clinic, manager.id, { directions: ["therapy", "kids"], facts: [...current, fact("Акция: гигиена 3 900 ₽ до 30 ноября", "promotions")] });
  legend.saveDraft(clinic, current);
  assert.throws(() => P.approveProposal(clinic), /своё?й? черновик|черновик легенды/);
  legend.discardDraft(clinic);

  P.rejectProposal(clinic, "Акция уже закончилась");
  assert.equal(legend.approvedLegend(clinic).version, 2);
  assert.equal(P.lastDecision(clinic).status, "rejected");
  assert.equal(P.lastDecision(clinic).answer, "Акция уже закончилась");

  P.propose(clinic, manager.id, { directions: ["therapy"], facts: current });
  P.withdrawProposal(clinic);
  assert.equal(P.pendingProposal(clinic), null);
});

test("a proposal started on an older legend version is flagged for the owner", () => {
  const current = legend.approvedLegend(clinic).facts;
  const p = P.propose(clinic, manager.id, { directions: ["therapy", "kids"], facts: [...current, fact("Работаем без выходных", "contacts")] });
  legend.approveDraft(clinic, [...current, fact("Новый врач-ортодонт", "doctors")]);
  assert.equal(P.proposalChanges(clinic, P.pendingProposal(clinic)).stale, true);
  assert.equal(p.baseVersion, 2);
});

test("the manager can propose only new wishes for training; approval saves them", () => {
  const current = legend.approvedLegend(clinic).facts;
  P.withdrawProposal(clinic);
  const p = P.propose(clinic, manager.id, { directions: getDirections(clinic), facts: current, wishes: "Проверить страх наркоза у детей и опыт врачей" });
  const ch = P.proposalChanges(clinic, p);
  assert.deepEqual(ch.wishes, { before: "", after: "Проверить страх наркоза у детей и опыт врачей" });
  assert.equal(ch.facts.added.length + ch.facts.removed.length, 0);
  const before = legend.approvedLegend(clinic).version;
  P.approveProposal(clinic);
  assert.equal(legend.getWishes(clinic), "Проверить страх наркоза у детей и опыт врачей");
  assert.equal(legend.approvedLegend(clinic).version, before, "no facts changed: no new legend version");
});

test("the manager names the doctors who have left: a change on its own, applied on approval without a new legend version", () => {
  const current = legend.approvedLegend(clinic);
  const p = P.propose(clinic, manager.id, { directions: getDirections(clinic), facts: current.facts, formerDoctors: ["Иванова Мария Петровна", "", "Орлов Игорь Петрович"] });
  assert.deepEqual(P.proposalChanges(clinic, p).formerDoctors, { before: [], after: ["Иванова Мария Петровна", "Орлов Игорь Петрович"] });
  P.approveProposal(clinic);
  assert.deepEqual(legend.getFormerDoctors(clinic), ["Иванова Мария Петровна", "Орлов Игорь Петрович"]);
  assert.equal(legend.approvedLegend(clinic).version, current.version);
  // Sending the same names again is not a change.
  assert.throws(() => P.propose(clinic, manager.id, { directions: getDirections(clinic), facts: current.facts, formerDoctors: ["Иванова Мария Петровна", "Орлов Игорь Петрович"] }), /Изменений нет/);
});
