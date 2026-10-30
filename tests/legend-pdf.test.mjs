import test from "node:test";
import assert from "node:assert/strict";

process.env.DB_PATH = ":memory:";
process.env.PASSWORD_KEY = "test-password-key-test-password-key-0123";

const auth = await import("../lib/auth.ts");
const L = await import("../lib/legend.ts");
const D = await import("../lib/directions.ts");
const { legendPdf } = await import("../lib/report-pdf.ts");

const clinicId = auth.createClinic({ legalName: "ООО «Улыбка»", slug: "ulybka", city: "Казань" });

test("no legend, no PDF; an unknown clinic, no PDF", async () => {
  assert.equal(await legendPdf(clinicId), null);
  assert.equal(await legendPdf(9999), null);
});

test("the draft and the approved version each download as a PDF", async () => {
  L.setSites(clinicId, [{ url: "https://ulybka.example/", label: "Сайт" }]);
  D.setDirections(clinicId, ["single_implant", "ortho"]);
  L.saveDraft(clinicId, [
    { section: "services", text: "Имплант Osstem от 32 000 ₽ с установкой", source: "https://ulybka.example/implant" },
    { section: "promotions", text: "Консультация и КТ бесплатно до 30 ноября", source: "offers" },
    { section: "missing", text: "Нет условий гарантии", source: null },
  ]);
  const draft = await legendPdf(clinicId);
  assert.ok(draft.pdf.subarray(0, 5).toString() === "%PDF-");
  assert.match(draft.name, /^legend-ulybka-draft-\d{4}-\d{2}-\d{2}\.pdf$/);
  assert.equal(await legendPdf(clinicId, "approved"), null, "nothing approved yet");

  L.approveDraft(clinicId);
  const approved = await legendPdf(clinicId);
  assert.match(approved.name, /^legend-ulybka-v1-/, "with no draft the approved version is the default");
  assert.equal(await legendPdf(clinicId, "draft"), null);

  // Many facts flow onto further pages without errors.
  L.saveDraft(clinicId, Array.from({ length: 80 }, (_, i) => ({ section: "services", text: `Услуга ${i + 1}: описание услуги, что входит, сроки и цена от ${1000 + i} ₽`, source: null })));
  const long = await legendPdf(clinicId, "draft");
  assert.ok(long.pdf.length > draft.pdf.length);
});
