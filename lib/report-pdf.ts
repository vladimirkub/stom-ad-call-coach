// PDF reports for the owner: one clinic (team figures, skills, misses, every trainee), one trainee (figures, score
// chart, skills, misses, every call), and a clinic's legend to agree with the clinic. A4, light paper so it prints; the
// full Onest font covers Cyrillic and Latin.
import PDFDocument from "pdfkit";
import { join } from "node:path";
import { SKILLS } from "./scoring.ts";
import { clinicStats, userStats } from "./stats.ts";
import { db } from "./db.ts";
import { OFFERS_SOURCE, SECTIONS, approvedLegend, getSites, workingLegend } from "./legend.ts";
import { directionLabel, getDirections } from "./directions.ts";
import brand from "./brand.json" with { type: "json" };

type Doc = InstanceType<typeof PDFDocument>;
type Skills = Record<string, number | null>;
type Miss = { label: string; share: number };

const C = { ink: "#14201c", muted: "#5f6e69", line: "#dfe6e3", soft: "#f2f6f4", accent: "#0f8a6a", good: "#0f8a6a", mid: "#a86400", bad: "#b3303d" };
const PAGE = { w: 595.28, h: 841.89, m: 48 };
const W = PAGE.w - 2 * PAGE.m;
const FONT = { regular: join(process.cwd(), "assets/fonts/Onest-400.ttf"), bold: join(process.cwd(), "assets/fonts/Onest-600.ttf") };

const dateTime = (ms: number) => new Date(ms).toLocaleString("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const dateOnly = (ms: number) => new Date(ms).toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", year: "numeric" });
const dayMonth = (ms: number) => new Date(ms).toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow", day: "numeric", month: "short" });
const tone = (score: number | null) => (score == null ? C.muted : score >= 70 ? C.good : score >= 40 ? C.mid : C.bad);
const minutes = (s: number) => (s < 60 ? `${s} с` : `${Math.round(s / 60)} мин`);

function newDoc(title: string): Doc {
  const doc = new PDFDocument({ size: "A4", margin: PAGE.m, bufferPages: true, info: { Title: title, Author: brand.name } });
  doc.registerFont("regular", FONT.regular);
  doc.registerFont("bold", FONT.bold);
  doc.font("regular");
  return doc;
}

function toBuffer(doc: Doc, made = "отчёт сформирован"): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    // Page numbers and the brand line on every page, once the content is laid out.
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      // The footer sits below the bottom margin; without this pdfkit would push it onto a new page.
      doc.page.margins.bottom = 0;
      doc.font("regular").fontSize(8).fillColor(C.muted);
      doc.text(`${brand.name} · ${made} ${dateTime(Date.now())} (МСК)`, PAGE.m, PAGE.h - 32, { width: W - 60, lineBreak: false });
      doc.text(`${i + 1} / ${range.count}`, PAGE.w - PAGE.m - 60, PAGE.h - 32, { width: 60, align: "right", lineBreak: false });
    }
    doc.end();
  });
}

/** Moves to a new page when fewer than `need` points are left; returns the y to draw at. */
function room(doc: Doc, y: number, need: number) {
  if (y + need <= PAGE.h - PAGE.m - 20) return y;
  doc.addPage();
  return PAGE.m;
}

function header(doc: Doc, kicker: string, title: string, sub: string) {
  doc.rect(0, 0, PAGE.w, 6).fill(C.accent);
  doc.font("bold").fontSize(9).fillColor(C.accent).text(`${brand.name.toUpperCase()} · ${kicker.toUpperCase()}`, PAGE.m, PAGE.m - 8, { characterSpacing: 0.8 });
  doc.font("bold").fontSize(22).fillColor(C.ink).text(title, PAGE.m, doc.y + 6, { width: W });
  doc.font("regular").fontSize(10).fillColor(C.muted).text(sub, PAGE.m, doc.y + 4, { width: W });
  return doc.y + 18;
}

function figures(doc: Doc, y: number, items: { label: string; value: string; color?: string; hint?: string }[]) {
  const gap = 10;
  const w = (W - gap * (items.length - 1)) / items.length;
  items.forEach((it, i) => {
    const x = PAGE.m + i * (w + gap);
    doc.roundedRect(x, y, w, 62, 6).fill(C.soft);
    doc.font("regular").fontSize(8).fillColor(C.muted).text(it.label, x + 10, y + 9, { width: w - 20 });
    doc.font("bold").fontSize(20).fillColor(it.color ?? C.ink).text(it.value, x + 10, y + 24, { width: w - 20, lineBreak: false });
    if (it.hint) doc.font("regular").fontSize(7.5).fillColor(C.muted).text(it.hint, x + 10, y + 48, { width: w - 20, lineBreak: false });
  });
  return y + 62 + 22;
}

function section(doc: Doc, y: number, title: string, note?: string) {
  y = room(doc, y, 60);
  doc.font("bold").fontSize(12).fillColor(C.ink).text(title, PAGE.m, y);
  if (note) doc.font("regular").fontSize(8.5).fillColor(C.muted).text(note, PAGE.m, doc.y + 2, { width: W });
  return doc.y + 10;
}

function skillBars(doc: Doc, y: number, skills: Skills) {
  for (const s of SKILLS) {
    y = room(doc, y, 30);
    const v = skills[s.key];
    doc.font("regular").fontSize(9.5).fillColor(C.ink).text(s.label, PAGE.m, y, { width: W - 60, lineBreak: false });
    doc.font("bold").fontSize(9.5).fillColor(tone(v == null ? null : v * 10)).text(v == null ? "—" : `${v}/10`, PAGE.m + W - 60, y, { width: 60, align: "right", lineBreak: false });
    doc.roundedRect(PAGE.m, y + 15, W, 5, 2.5).fill(C.line);
    if (v) doc.roundedRect(PAGE.m, y + 15, (W * v) / 10, 5, 2.5).fill(C.accent);
    y += 30;
  }
  return y + 8;
}

function missList(doc: Doc, y: number, misses: Miss[]) {
  if (misses.length === 0) {
    doc.font("regular").fontSize(9.5).fillColor(C.muted).text("Оценённых звонков пока нет.", PAGE.m, y);
    return doc.y + 16;
  }
  misses.forEach((m, i) => {
    y = room(doc, y, 18);
    doc.font("regular").fontSize(9.5).fillColor(C.ink).text(`${i + 1}. ${m.label}`, PAGE.m, y, { width: W - 90 });
    const next = doc.y;
    doc.font("bold").fontSize(9.5).fillColor(C.bad).text(`${m.share}% звонков`, PAGE.m + W - 90, y, { width: 90, align: "right", lineBreak: false });
    y = Math.max(next, y + 13) + 4;
  });
  return y + 10;
}

type Col = { title: string; width: number; align?: "left" | "right" };
/** A table that continues on the next page with its header repeated. Each cell: text and an optional color. */
function table(doc: Doc, y: number, cols: Col[], rows: { text: string; color?: string; bold?: boolean }[][]) {
  const head = (y0: number) => {
    let x = PAGE.m;
    doc.font("bold").fontSize(8).fillColor(C.muted);
    for (const c of cols) {
      doc.text(c.title, x + 4, y0, { width: c.width - 8, align: c.align ?? "left", lineBreak: false });
      x += c.width;
    }
    doc.moveTo(PAGE.m, y0 + 14).lineTo(PAGE.m + W, y0 + 14).lineWidth(0.6).strokeColor(C.line).stroke();
    return y0 + 20;
  };
  y = head(room(doc, y, 50));
  for (const row of rows) {
    if (y + 20 > PAGE.h - PAGE.m - 20) {
      doc.addPage();
      y = head(PAGE.m);
    }
    let x = PAGE.m;
    row.forEach((cell, i) => {
      doc.font(cell.bold ? "bold" : "regular").fontSize(9).fillColor(cell.color ?? C.ink);
      doc.text(cell.text, x + 4, y, { width: cols[i].width - 8, align: cols[i].align ?? "left", lineBreak: false, ellipsis: true });
      x += cols[i].width;
    });
    doc.moveTo(PAGE.m, y + 15).lineTo(PAGE.m + W, y + 15).lineWidth(0.4).strokeColor(C.line).stroke();
    y += 20;
  }
  return y + 14;
}

/** Score of each call, oldest to newest, on a fixed 0-100 scale. */
function scoreChart(doc: Doc, y: number, points: { at: number; total: number }[]) {
  if (points.length < 2) {
    doc.font("regular").fontSize(9.5).fillColor(C.muted).text("График появится после двух оценённых звонков.", PAGE.m, y);
    return doc.y + 16;
  }
  y = room(doc, y, 150);
  const H = 120, L = 26;
  const x = (i: number) => PAGE.m + L + (i * (W - L - 6)) / (points.length - 1);
  const yv = (v: number) => y + H - (v / 100) * H;
  for (const v of [0, 50, 100]) {
    doc.moveTo(PAGE.m + L, yv(v)).lineTo(PAGE.m + W, yv(v)).lineWidth(0.5).strokeColor(C.line).stroke();
    doc.font("regular").fontSize(7.5).fillColor(C.muted).text(String(v), PAGE.m, yv(v) - 4, { width: L - 6, align: "right", lineBreak: false });
  }
  doc.moveTo(x(0), yv(points[0].total));
  points.slice(1).forEach((p, i) => doc.lineTo(x(i + 1), yv(p.total)));
  doc.lineWidth(1.6).strokeColor(C.accent).stroke();
  points.forEach((p, i) => doc.circle(x(i), yv(p.total), i === points.length - 1 ? 3.2 : 2.2).fill(C.accent));
  doc.font("regular").fontSize(7.5).fillColor(C.muted);
  doc.text(dateOnly(points[0].at), PAGE.m + L, y + H + 6, { lineBreak: false });
  doc.text(dateOnly(points[points.length - 1].at), PAGE.m + W - 80, y + H + 6, { width: 80, align: "right", lineBreak: false });
  return y + H + 30;
}

export async function clinicReportPdf(clinicId: number, now = Date.now()) {
  const s = clinicStats(clinicId, now);
  if (!s) return null;
  const active = s.users.filter((u) => u.active);
  const active7 = s.users.filter((u) => u.lastAt && u.lastAt >= now - 7 * 864e5).length;
  const scored = s.users.filter((u) => u.average != null);
  const teamAvg = scored.length ? Math.round(scored.reduce((a, u) => a + (u.average ?? 0) * u.count, 0) / scored.reduce((a, u) => a + u.count, 0)) : null;

  const doc = newDoc(`Отчёт по клинике: ${s.clinic.legalName}`);
  let y = header(doc, "Отчёт по клинике", s.clinic.legalName, `${s.clinic.city} · данные на ${dateOnly(now)} · навыки и ошибки за последние 30 дней`);
  y = figures(doc, y, [
    { label: "Администраторов", value: String(active.length), hint: `${active7} тренировались за 7 дней` },
    { label: "Звонков за 30 дней", value: String(s.calls30) },
    { label: "Звонков всего", value: String(s.users.reduce((a, u) => a + u.count, 0)) },
    { label: "Средний балл", value: teamAvg == null ? "—" : `${teamAvg}`, color: tone(teamAvg), hint: "из 100, по всем звонкам" },
  ]);
  y = section(doc, y, "Навыки команды", "Средние оценки за 30 дней, из 10");
  y = skillBars(doc, y, s.skills);
  y = section(doc, y, "Частые ошибки", "Пункты чек-листа, которые команда пропускает чаще всего, за 30 дней");
  y = missList(doc, y, s.misses);
  y = section(doc, y, "Администраторы");
  table(
    doc,
    y,
    [
      { title: "Администратор", width: 150 },
      { title: "Звонков", width: 52, align: "right" },
      { title: "Средний балл", width: 72, align: "right" },
      { title: "За неделю", width: 60, align: "right" },
      { title: "Записали", width: 56, align: "right" },
      { title: "Последняя тренировка", width: W - 390 },
    ],
    s.users.map((u) => [
      { text: `${u.lastName} ${u.firstName}${u.active ? "" : " (отключён)"}`, color: u.active ? C.ink : C.muted },
      { text: String(u.count) },
      { text: u.average == null ? "—" : String(u.average), color: tone(u.average), bold: true },
      { text: u.change7 == null ? "—" : `${u.change7 > 0 ? "+" : ""}${u.change7}`, color: u.change7 == null ? C.muted : u.change7 > 0 ? C.good : u.change7 < 0 ? C.bad : C.ink },
      { text: String(u.booked) },
      { text: u.lastAt ? dateTime(u.lastAt) : "не тренировался", color: u.lastAt ? C.ink : C.bad },
    ]),
  );
  return { pdf: await toBuffer(doc), name: `${s.clinic.slug}-${new Date(now).toISOString().slice(0, 10)}.pdf` };
}

export async function userReportPdf(userId: number, now = Date.now()) {
  const s = userStats(userId);
  if (!s) return null;
  const doc = newDoc(`Отчёт по администратору: ${s.user.lastName} ${s.user.firstName}`);
  let y = header(doc, "Отчёт по администратору", `${s.user.lastName} ${s.user.firstName}`, `${s.user.clinicName} · данные на ${dateOnly(now)} · по всем оценённым звонкам`);
  y = figures(doc, y, [
    { label: "Звонков", value: String(s.count) },
    { label: "Средний балл", value: s.average == null ? "—" : String(s.average), color: tone(s.average), hint: "из 100" },
    { label: "Записали пациента", value: String(s.booked), hint: s.count ? `${Math.round((100 * s.booked) / s.count)}% звонков` : undefined },
    { label: "Последний звонок", value: s.trainings[0] ? dayMonth(s.trainings[0].startedAt) : "—", hint: s.trainings[0] ? dateOnly(s.trainings[0].startedAt) : undefined },
  ]);
  y = section(doc, y, "Балл по звонкам");
  y = scoreChart(doc, y, [...s.trainings].reverse().map((t) => ({ at: t.startedAt, total: t.total })));
  y = section(doc, y, "Навыки", "Средние оценки по всем звонкам, из 10");
  y = skillBars(doc, y, s.skills);
  y = section(doc, y, "Над чем работать", "Пункты чек-листа, которые администратор пропускает чаще всего");
  y = missList(doc, y, s.misses);
  y = section(doc, y, "Все звонки");
  table(
    doc,
    y,
    [
      { title: "Когда", width: 98 },
      { title: "Пациент", width: 150 },
      { title: "Режим", width: 52 },
      { title: "Длительность", width: 72, align: "right" },
      { title: "Балл", width: 46, align: "right" },
      { title: "Запись", width: W - 418 },
    ],
    s.trainings.map((t) => [
      { text: dateTime(t.startedAt) },
      { text: t.patient },
      { text: t.mode === "voice" ? "голос" : "текст", color: C.muted },
      { text: minutes(t.duration), color: C.muted },
      { text: String(t.total), color: tone(t.total), bold: true },
      { text: t.booked ? "записан" : "нет", color: t.booked ? C.good : C.muted },
    ]),
  );
  return { pdf: await toBuffer(doc), name: `${s.user.login}-${new Date(now).toISOString().slice(0, 10)}.pdf` };
}

const shortSource = (src: string) => {
  if (src === OFFERS_SOURCE) return "из текста рекламных офферов";
  try {
    const u = new URL(src);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    return src;
  }
};

/**
 * The clinic's legend as a document to agree with the clinic: every fact by section with its source, the clinic's
 * directions, the sites it was read from, and a sign-off block. `version`: the draft or the approved version
 * (default: the draft if there is one).
 */
export async function legendPdf(clinicId: number, version?: "draft" | "approved", now = Date.now()) {
  const clinic = db().prepare("SELECT legal_name AS legalName, slug, city FROM clinics WHERE id = ?").get(clinicId) as { legalName: string; slug: string; city: string } | undefined;
  if (!clinic) return null;
  const working = workingLegend(clinicId);
  const draft = working?.status === "draft" ? working : null;
  const legend = version === "approved" ? approvedLegend(clinicId) : version === "draft" ? draft : draft ?? approvedLegend(clinicId);
  if (!legend) return null;
  const isDraft = legend.status === "draft";

  const doc = newDoc(`Легенда клиники: ${clinic.legalName}`);
  const state = isDraft ? `черновик от ${dateOnly(legend.updatedAt)}` : `версия ${legend.version}, утверждена ${dateOnly(legend.approvedAt ?? legend.updatedAt)}`;
  let y = header(doc, "Легенда клиники · на согласование", clinic.legalName, `${clinic.city} · ${state}`);

  doc.font("regular").fontSize(9.5).fillColor(C.ink).text(
    "Это сведения о клинике, на которых построены тренировки администраторов: виртуальные пациенты видели рекламу и сайт клиники и спрашивают именно об этом, а оценка звонка проверяет, не выдумал ли администратор лишнего. Проверьте, пожалуйста, что всё верно: услуги, цены, акции и сроки, рассрочка, гарантии, адрес и часы работы. Исправления можно отметить прямо в документе или написать нам.",
    PAGE.m, y, { width: W, lineGap: 2 },
  );
  y = doc.y + 14;

  const directions = getDirections(clinicId);
  if (directions.length) {
    doc.font("bold").fontSize(9.5).fillColor(C.ink).text("Направления клиники: ", PAGE.m, y, { continued: true });
    doc.font("regular").text(directions.map(directionLabel).join(", "));
    y = doc.y + 14;
  }

  let n = 0;
  for (const sec of SECTIONS) {
    const items = legend.facts.filter((f) => f.section === sec.key);
    if (items.length === 0) continue;
    y = section(doc, y, sec.label, sec.key === "missing" ? "Этого на сайте нет: администратор не должен это выдумывать. Если сведения есть, допишите их." : undefined);
    for (const f of items) {
      n++;
      const textH = doc.font("regular").fontSize(10).heightOfString(f.text, { width: W - 24 });
      y = room(doc, y, textH + 16);
      doc.font("bold").fontSize(9).fillColor(C.accent).text(String(n), PAGE.m, y + 1, { width: 18, align: "right" });
      doc.font("regular").fontSize(10).fillColor(C.ink).text(f.text, PAGE.m + 24, y, { width: W - 24 });
      if (f.source) doc.font("regular").fontSize(7.5).fillColor(C.muted).text(shortSource(f.source), PAGE.m + 24, doc.y + 1, { width: W - 24 });
      y = doc.y + 7;
    }
    y += 8;
  }

  const sites = getSites(clinicId);
  if (sites.length) {
    y = section(doc, y, "Откуда взяты сведения");
    for (const s of sites) {
      y = room(doc, y, 16);
      doc.font("regular").fontSize(9).fillColor(C.ink).text(`${s.label ? `${s.label}: ` : ""}${s.url}`, PAGE.m, y, { width: W });
      y = doc.y + 4;
    }
    y += 10;
  }

  y = room(doc, y, 150);
  y = section(doc, y, "Согласовано со стороны клиники");
  for (const label of ["ФИО", "Должность", "Подпись", "Дата"]) {
    doc.font("regular").fontSize(9.5).fillColor(C.muted).text(label, PAGE.m, y + 6, { width: 90, lineBreak: false });
    doc.moveTo(PAGE.m + 90, y + 18).lineTo(PAGE.m + W, y + 18).lineWidth(0.6).strokeColor(C.line).stroke();
    y += 28;
  }

  const tag = isDraft ? "draft" : `v${legend.version}`;
  return { pdf: await toBuffer(doc, "документ сформирован"), name: `legend-${clinic.slug}-${tag}-${new Date(now).toISOString().slice(0, 10)}.pdf` };
}
