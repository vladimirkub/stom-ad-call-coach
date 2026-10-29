import test from "node:test";
import assert from "node:assert/strict";

process.env.DB_PATH = ":memory:";
process.env.PASSWORD_KEY = "test-password-key-test-password-key-0123";

const auth = await import("../lib/auth.ts");
const site = await import("../lib/site-fetch.ts");
const L = await import("../lib/legend.ts");

const waitDone = async (clinicId) => {
  for (let i = 0; i < 100 && L.workingLegend(clinicId)?.status === "analyzing"; i++) await new Promise((r) => setTimeout(r, 10));
  return L.workingLegend(clinicId);
};

test("only public addresses are fetched", async () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
    assert.ok(site.isPrivateAddress(ip), ip);
  }
  for (const ip of ["8.8.8.8", "213.155.20.240", "2a00:1450:4010::8a"]) assert.ok(!site.isPrivateAddress(ip), ip);
  await assert.rejects(site.assertPublicUrl("http://127.0.0.1/admin"), /Внутренние/);
  await assert.rejects(site.assertPublicUrl("http://169.254.169.254/latest/meta-data"), /Внутренние/);
  await assert.rejects(site.assertPublicUrl("file:///etc/passwd"), /http/);
  await assert.rejects(site.assertPublicUrl("http://user:pw@example.com"), /логином/);
});

test("html becomes readable text; scripts and markup are dropped", () => {
  const { title, text } = site.htmlToText(`<html><head><title>Стомлюкс &mdash; клиника</title><meta name="description" content="Имплантация под ключ"></head>
    <body><script>var price = 1;</script><style>.a{}</style><h1>Цены</h1><table><tr><td>Имплант</td><td>от&nbsp;29&#160;900 &#8381;</td></tr></table><p>Акция до 31&nbsp;октября</p></body></html>`);
  assert.equal(title, "Стомлюкс — клиника");
  assert.match(text, /Имплантация под ключ/);
  assert.match(text, /Имплант от 29 900 ₽/);
  assert.match(text, /Акция до 31 октября/);
  assert.doesNotMatch(text, /var price|\.a\{/);
});

test("relevant internal pages are found, shallow and price pages first", () => {
  const html = `<a href="/blog/2021/novosti-o-cenah">Новости</a><a href="/ceny/">Цены</a><a href="https://other.ru/akcii">Чужие акции</a>
    <a href="/price.pdf">Прайс PDF</a><a href="/vrachi">Наши врачи</a><a href="#top">Наверх</a><a href="/kontakty">Контакты</a><a href="/about-photo">Фото</a>`;
  const links = site.relevantLinks(html, "https://clinic.ru/");
  assert.deepEqual(links.slice(0, 3).sort(), ["https://clinic.ru/ceny/", "https://clinic.ru/kontakty", "https://clinic.ru/vrachi"].sort());
  assert.ok(!links.some((l) => l.includes("other.ru") || l.endsWith(".pdf")));
});

test("reading sites follows at most 8 extra pages and records failures", async () => {
  const many = Array.from({ length: 12 }, (_, i) => `<a href="/ceny-${i}">Цены ${i}</a>`).join("");
  const pages = await site.readSites(["https://a.ru/", "https://down.ru/"], async (u) => {
    if (u.includes("down.ru")) throw new Error("Сайт ответил ошибкой 503");
    return { url: u, html: u === "https://a.ru/" ? `<title>A</title>${many}` : `<p>Страница ${u}</p>` };
  });
  assert.equal(pages.filter((p) => p.extra).length, site.MAX_EXTRA_PAGES);
  assert.deepEqual(pages.find((p) => p.url === "https://down.ru/"), { url: "https://down.ru/", ok: false, error: "Сайт ответил ошибкой 503" });
});

test("sites are normalized; bad links are refused", () => {
  assert.deepEqual(L.normalizeSites([{ url: "clinic.ru", label: " Сайт " }, { url: "https://clinic.ru/" }, { url: "" }]), [{ url: "https://clinic.ru/", label: "Сайт" }]);
  assert.throws(() => L.normalizeSites([{ url: "ftp://clinic.ru" }]), /http/);
});

test("legend lifecycle: analyze, edit, approve, re-analyze, compare, version 2", async () => {
  const clinicId = auth.createClinic({ legalName: "ООО «Стомлюкс»", slug: "stomlux", city: "Казань" });
  assert.throws(() => L.startAnalysis(clinicId), /сайты или текст/);
  L.setSites(clinicId, [{ url: "https://clinic.ru", label: "Сайт" }]);

  let facts = [
    { section: "services", text: "Имплант Osstem от 29 900 ₽", source: "https://clinic.ru/" },
    { section: "promotions", text: "Акция до 31 октября", source: "https://invented.ru/" },
    { section: "missing", text: "Нет адреса", source: null },
  ];
  const deps = { readSites: async (urls) => urls.map((url) => ({ url, ok: true, text: "…" })), extractFacts: async () => L.cleanFacts(facts) };
  L.startAnalysis(clinicId, deps);
  let w = await waitDone(clinicId);
  assert.equal(w.status, "draft");
  assert.equal(w.facts.length, 3);
  assert.equal(w.pages[0].text, undefined, "page text is not stored");

  L.saveDraft(clinicId, [...w.facts, { section: "contacts", text: "  Ежедневно 10–20  ", source: "javascript:alert(1)" }, { section: "nope", text: "x" }]);
  w = L.workingLegend(clinicId);
  assert.deepEqual(w.facts.at(-1), { section: "contacts", text: "Ежедневно 10–20", source: null });

  const v1 = L.approveDraft(clinicId);
  assert.equal(v1.version, 1);
  assert.equal(L.workingLegend(clinicId), null);

  facts = [{ section: "services", text: "Имплант Osstem от 34 900 ₽", source: "https://clinic.ru/" }, { section: "services", text: "Консультация бесплатно", source: "https://clinic.ru/" }];
  L.startAnalysis(clinicId, deps);
  await waitDone(clinicId);
  const changes = L.compareFacts(L.workingLegend(clinicId).facts, L.approvedLegend(clinicId).facts);
  assert.deepEqual(changes.added, ["Имплант Osstem от 34 900 ₽", "Консультация бесплатно"]);
  assert.equal(changes.removed.length, 4);

  const v2 = L.approveDraft(clinicId);
  assert.equal(v2.version, 2);
  assert.deepEqual(L.legendHistory(clinicId).map((h) => [h.version, h.status]), [[2, "approved"], [1, "archived"]]);
});

test("a failed analysis is kept with its reason; a stale one expires", async () => {
  const clinicId = auth.createClinic({ legalName: "ООО «Сбой»", slug: "sboy", city: "Уфа" });
  L.setSites(clinicId, [{ url: "https://down.ru" }]);
  L.startAnalysis(clinicId, { readSites: async () => [{ url: "https://down.ru/", ok: false, error: "503" }], extractFacts: L.extractFacts });
  const w = await waitDone(clinicId);
  assert.equal(w.status, "failed");
  assert.match(w.error, /ни одной страницы/);
  assert.equal(w.pages[0].error, "503");

  L.discardDraft(clinicId);
  L.startAnalysis(clinicId, { readSites: () => new Promise(() => {}), extractFacts: L.extractFacts });
  L.expireStaleAnalyses(Date.now() + 11 * 60_000);
  assert.equal(L.workingLegend(clinicId).status, "failed");
});

test("ad offers alone are enough, and facts keep them as their source", async () => {
  const clinicId = auth.createClinic({ legalName: "ООО «Без сайта»", slug: "nosite", city: "Тула" });
  assert.throws(() => L.setOffers(clinicId, "x".repeat(20_001)), /слишком длинный/);
  L.setOffers(clinicId, "Имплант под ключ 39 900 ₽ до 30 ноября.\r\n\r\n\r\nРассрочка 0%.");
  assert.equal(L.getOffers(clinicId), "Имплант под ключ 39 900 ₽ до 30 ноября.\n\nРассрочка 0%.");

  let seen;
  L.startAnalysis(clinicId, {
    readSites: async () => assert.fail("no sites, nothing to read"),
    extractFacts: async (pages) => {
      seen = pages;
      return L.cleanFacts([{ section: "promotions", text: "Имплант под ключ 39 900 ₽ до 30 ноября", source: L.OFFERS_SOURCE }]);
    },
  });
  const w = await waitDone(clinicId);
  assert.equal(w.status, "draft");
  assert.deepEqual(seen.map((p) => p.url), [L.OFFERS_SOURCE]);
  assert.match(seen[0].text, /Рассрочка 0%/);
  assert.equal(w.facts[0].source, L.OFFERS_SOURCE);
});
