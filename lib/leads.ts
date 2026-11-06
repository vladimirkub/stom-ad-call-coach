// Connection requests: a clinic fills them in through the Telegram bot (five questions), the owner gets a notification
// with an automatic check of the clinic's site, and one button creates the clinic, its manager login and the first
// legend from the site, then sends the access to the applicant through the same bot.
import { randomBytes } from "node:crypto";
import { db } from "./db.ts";
import { createClinic, createTrainee, normalizeSlug, setRole } from "./auth.ts";
import { setSites, startAnalysis, workingLegend, approveDraft } from "./legend.ts";
import { startPersonaFit } from "./persona-fit.ts";
import { fetchHtml, htmlToText } from "./site-fetch.ts";
import { answerCallback, editText, send, type Keyboard, type TgUpdate } from "./telegram.ts";
import bot from "./bot.json" with { type: "json" };
import site from "./landing.json" with { type: "json" };

export type LeadStatus = "filling" | "new" | "approved" | "rejected";
type Step = "ready" | "name" | "position" | "clinic" | "city" | "site" | "done";
export type LeadChecks = {
  siteOk: boolean | null; // null: no site given
  siteError?: string;
  dental?: boolean;
  prices?: boolean;
  doctors?: boolean;
  cityFound?: boolean;
  duplicate?: string | null; // name of an existing clinic that looks like the same one
};
export type Lead = {
  id: number;
  chatId: string;
  username: string;
  step: Step;
  fullName: string;
  position: string;
  clinic: string;
  city: string;
  site: string;
  source: string;
  status: LeadStatus;
  checks: LeadChecks | null;
  clinicId: number | null;
  userId: number | null;
  createdAt: number;
  decidedAt: number | null;
};

const fill = (text: string, vars: Record<string, string>) => text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
const firstName = (full: string) => full.trim().split(/\s+/)[0] ?? "";
const clean = (s: string, max = 120) => s.replace(/\s+/g, " ").trim().slice(0, max);
const promoUntil = () => Date.parse(site.promo.until);
const promoOn = (now = Date.now()) => now <= promoUntil();

function row(r: Record<string, unknown>): Lead {
  return {
    id: Number(r.id),
    chatId: String(r.chat_id),
    username: String(r.username ?? ""),
    step: r.step as Step,
    fullName: String(r.full_name ?? ""),
    position: String(r.position ?? ""),
    clinic: String(r.clinic ?? ""),
    city: String(r.city ?? ""),
    site: String(r.site ?? ""),
    source: String(r.source ?? ""),
    status: r.status as LeadStatus,
    checks: r.checks ? (JSON.parse(String(r.checks)) as LeadChecks) : null,
    clinicId: r.clinic_id == null ? null : Number(r.clinic_id),
    userId: r.user_id == null ? null : Number(r.user_id),
    createdAt: Number(r.created_at),
    decidedAt: r.decided_at == null ? null : Number(r.decided_at),
  };
}

export function getLead(id: number): Lead | null {
  const r = db().prepare("SELECT * FROM leads WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return r ? row(r) : null;
}

/** The newest request of a chat. */
function chatLead(chatId: string): Lead | null {
  const r = db().prepare("SELECT * FROM leads WHERE chat_id = ? ORDER BY id DESC LIMIT 1").get(chatId) as Record<string, unknown> | undefined;
  return r ? row(r) : null;
}

/** Submitted requests (not the ones still being filled in), new first, then the newest decided. */
export function listLeads() {
  const leads = (db().prepare("SELECT * FROM leads WHERE status != 'filling' ORDER BY CASE status WHEN 'new' THEN 0 ELSE 1 END, created_at DESC LIMIT 200").all() as Record<string, unknown>[]).map(row);
  const access = db().prepare(
    `SELECT c.access_until, c.slug, u.login,
       (SELECT MAX(s.created_at) FROM sessions s JOIN users x ON x.id = s.user_id WHERE x.clinic_id = c.id) AS last_login,
       (SELECT COUNT(*) FROM trainings t WHERE t.clinic_id = c.id) AS trainings
     FROM clinics c LEFT JOIN users u ON u.id = ? WHERE c.id = ?`,
  );
  return leads.map((l) => {
    if (!l.clinicId) return { ...l, access: null };
    const a = access.get(l.userId, l.clinicId) as { access_until: number | null; login: string | null; last_login: number | null; trainings: number } | undefined;
    return { ...l, access: a ? { until: a.access_until, login: a.login, lastLogin: a.last_login, trainings: Number(a.trainings) } : null };
  });
}

// ---- settings: the owner's chat, and the one-time code that links it ----

const getSetting = (key: string) => (db().prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined)?.value ?? null;
const setSetting = (key: string, value: string) => db().prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);

export const ownerChat = () => getSetting("owner_chat_id");

/** A deep link that binds whoever opens it in Telegram (the owner, from the cabinet) as the receiver of notifications. 15 minutes. */
export function ownerLinkUrl(now = Date.now()): string {
  const code = randomBytes(12).toString("base64url");
  setSetting("owner_link", JSON.stringify({ code, expires: now + 15 * 60_000 }));
  return `https://t.me/${bot.username}?start=link_${code}`;
}

function tryLinkOwner(chatId: string, code: string, now = Date.now()): boolean {
  const saved = getSetting("owner_link");
  if (!saved) return false;
  const { code: expected, expires } = JSON.parse(saved) as { code: string; expires: number };
  if (code !== expected || now > expires) return false;
  setSetting("owner_chat_id", chatId);
  db().prepare("DELETE FROM settings WHERE key = 'owner_link'").run();
  return true;
}

// ---- the dialog ----

/** Two rows of position buttons; a different position can still be typed. */
const positionKeyboard = (): Keyboard => {
  const buttons = bot.texts.positions.map((text, i) => ({ text, callback_data: `pos:${i}` }));
  return [buttons.slice(0, 2), buttons.slice(2)];
};

function update(id: number, fields: Partial<Record<"step" | "full_name" | "position" | "clinic" | "city" | "site" | "status" | "username", string>>) {
  const keys = Object.keys(fields);
  db().prepare(`UPDATE leads SET ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = ? WHERE id = ?`).run(...keys.map((k) => fields[k as keyof typeof fields]!), Date.now(), id);
}

async function greet(chatId: string, username: string, source: string) {
  const now = Date.now();
  db().prepare("DELETE FROM leads WHERE chat_id = ? AND status = 'filling'").run(chatId);
  db().prepare("INSERT INTO leads (chat_id, username, step, source, status, created_at, updated_at) VALUES (?, ?, 'ready', ?, 'filling', ?, ?)").run(chatId, username, source.slice(0, 40), now, now);
  await send(chatId, promoOn() ? bot.texts.greeting : bot.texts.greetingAfterPromo, [[{ text: bot.texts.ready, callback_data: "ready" }]]);
}

const ASK: Record<Exclude<Step, "ready" | "done">, () => [string, Keyboard?]> = {
  name: () => [bot.texts.askName],
  position: () => [bot.texts.askPosition, positionKeyboard()],
  clinic: () => [bot.texts.askClinic],
  city: () => [bot.texts.askCity],
  site: () => [bot.texts.askSite],
};
const NEXT: Record<Exclude<Step, "ready" | "done">, Step> = { name: "position", position: "clinic", clinic: "city", city: "site", site: "done" };
const COLUMN = { name: "full_name", position: "position", clinic: "clinic", city: "city", site: "site" } as const;

async function ask(chatId: string, step: Step) {
  if (step === "ready" || step === "done") return;
  const [text, kb] = ASK[step]();
  await send(chatId, text, kb);
}

/** Saves one answer and moves the dialog on; the last answer submits the request. */
async function answer(lead: Lead, raw: string) {
  const step = lead.step;
  if (step === "ready" || step === "done") return;
  const value = clean(raw, step === "site" ? 200 : 120);
  if (value.length < 2) return send(lead.chatId, bot.texts.tooShort);
  const next = NEXT[step];
  update(lead.id, { [COLUMN[step]]: value, step: next });
  if (next !== "done") return ask(lead.chatId, next);
  update(lead.id, { status: "new" });
  const done = getLead(lead.id)!;
  await send(lead.chatId, fill(bot.texts.thanks, { first: firstName(done.fullName), founder: bot.founder }));
  void checkAndNotify(done.id);
}

/** Handles one webhook update from Telegram. Errors are logged; Telegram must always get a 200 back. */
export async function handleUpdate(u: TgUpdate) {
  if (u.callback_query) return handleCallback(u.callback_query);
  const m = u.message;
  if (!m?.text || m.chat.type !== "private") return;
  const chatId = String(m.chat.id);
  const username = m.from?.username ?? "";
  const text = m.text.trim();

  if (text.startsWith("/start")) {
    const arg = text.split(/\s+/)[1] ?? "";
    if (arg.startsWith("link_")) return send(chatId, tryLinkOwner(chatId, arg.slice(5)) ? bot.texts.linked : bot.texts.linkExpired);
    const last = chatLead(chatId);
    if (last?.status === "new") return send(chatId, fill(bot.texts.already, { founder: bot.founder }));
    if (last?.status === "approved") return send(chatId, fill(bot.texts.alreadyApproved, { clinic: last.clinic, founder: bot.founder }));
    return greet(chatId, username, arg);
  }
  const lead = chatLead(chatId);
  if (!lead || lead.status === "rejected") return greet(chatId, username, "");
  if (lead.status === "new") return send(chatId, fill(bot.texts.already, { founder: bot.founder }));
  if (lead.status === "approved") return send(chatId, fill(bot.texts.alreadyApproved, { clinic: lead.clinic, founder: bot.founder }));
  if (lead.step === "ready") return send(chatId, promoOn() ? bot.texts.greeting : bot.texts.greetingAfterPromo, [[{ text: bot.texts.ready, callback_data: "ready" }]]);
  if (username && username !== lead.username) update(lead.id, { username });
  return answer(lead, text);
}

async function handleCallback(q: NonNullable<TgUpdate["callback_query"]>) {
  const chatId = String(q.message?.chat.id ?? q.from.id);
  const data = q.data ?? "";
  await answerCallback(q.id);

  // The owner's buttons under a notification.
  const decision = data.match(/^lead:(approve|reject):(\d+)$/);
  if (decision) {
    if (chatId !== ownerChat()) return;
    const id = Number(decision[2]);
    try {
      const done = decision[1] === "approve" ? await approveLead(id) : await rejectLead(id);
      if (q.message) await editText(chatId, q.message.message_id, `${notificationText(done)}\n\n${decision[1] === "approve" ? `Доступ выдан: ${done.access?.login ?? ""}` : "Отклонена"}`);
    } catch (e) {
      await send(chatId, e instanceof Error ? e.message : "Не получилось");
    }
    return;
  }

  const lead = chatLead(chatId);
  if (!lead || lead.status !== "filling") return;
  if (data === "ready" && lead.step === "ready") {
    update(lead.id, { step: "name", username: q.from.username ?? lead.username });
    return ask(chatId, "name");
  }
  const pos = data.match(/^pos:(\d)$/);
  if (pos && lead.step === "position") return answer(lead, bot.texts.positions[Number(pos[1])] ?? "");
}

// ---- the automatic check and the owner's notification ----

export const looksLikeSite = (s: string) => /^(https?:\/\/)?[a-zа-яё0-9-]+(\.[a-zа-яё0-9-]+)+(\/\S*)?$/i.test(s.trim());

export async function runChecks(lead: Lead, fetchPage = fetchHtml): Promise<LeadChecks> {
  // Compared in JS: SQLite's lower() leaves Cyrillic letters as they are.
  const domain = looksLikeSite(lead.site) ? lead.site.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase() : "";
  const name = lead.clinic.trim().toLowerCase();
  const dup = (db().prepare("SELECT legal_name, sites FROM clinics").all() as { legal_name: string; sites: string }[]).find(
    (c) => c.legal_name.trim().toLowerCase() === name || (domain && c.sites.toLowerCase().includes(domain)),
  );
  const checks: LeadChecks = { siteOk: null, duplicate: dup?.legal_name ?? null };
  if (!looksLikeSite(lead.site)) return checks;
  try {
    const { html } = await fetchPage(/^https?:\/\//i.test(lead.site) ? lead.site : `https://${lead.site}`);
    const { title, text } = htmlToText(html);
    const all = `${title} ${text}`;
    checks.siteOk = true;
    checks.dental = /стоматолог|зуб|дент|имплант|ортодонт/i.test(all);
    checks.prices = /\d[\d\s]{2,}\s?(₽|руб)/i.test(all);
    checks.doctors = /врач|доктор|ортопед|хирург|терапевт/i.test(all);
    checks.cityFound = lead.city.length >= 3 && all.toLowerCase().includes(lead.city.toLowerCase().slice(0, Math.max(4, lead.city.length - 2)));
  } catch (e) {
    checks.siteOk = false;
    checks.siteError = e instanceof Error ? e.message.slice(0, 120) : "не открылся";
  }
  return checks;
}

export function checkLines(c: LeadChecks | null): { ok: boolean; text: string }[] {
  if (!c) return [{ ok: false, text: "Проверка ещё идёт" }];
  const lines: { ok: boolean; text: string }[] = [];
  if (c.siteOk === null) lines.push({ ok: false, text: "Сайта нет: пациенты будут без цен клиники" });
  else if (!c.siteOk) lines.push({ ok: false, text: `Сайт не открылся${c.siteError ? ` (${c.siteError})` : ""}` });
  else {
    lines.push({ ok: !!c.dental, text: c.dental ? "Сайт открывается, это стоматология" : "Сайт открывается, но на стоматологию не похож" });
    const found = [c.prices && "цены", c.doctors && "врачи", c.cityFound && "город"].filter(Boolean);
    lines.push({ ok: found.length >= 2, text: found.length ? `Найдены: ${found.join(", ")}` : "Цен и врачей на главной странице не видно" });
  }
  lines.push(c.duplicate ? { ok: false, text: `Похоже на клинику, которая уже есть: «${c.duplicate}»` } : { ok: true, text: "В базе такой клиники нет" });
  return lines;
}

function notificationText(l: Lead) {
  const who = [l.fullName, l.position.toLowerCase()].filter(Boolean).join(", ");
  const contact = [l.site || "сайта нет", l.username ? `@${l.username}` : ""].filter(Boolean).join(" · ");
  const checks = checkLines(l.checks).map((x) => `${x.ok ? "✓" : "!"} ${x.text}`).join("\n");
  return `Новая заявка\n${l.clinic}, ${l.city}\n${who}\n${contact}\n\n${checks}`;
}

async function checkAndNotify(id: number) {
  const lead = getLead(id);
  if (!lead) return;
  const checks = await runChecks(lead).catch(() => ({ siteOk: false, siteError: "проверка не удалась", duplicate: null }) as LeadChecks);
  db().prepare("UPDATE leads SET checks = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(checks), Date.now(), id);
  const owner = ownerChat();
  if (!owner) return;
  await send(owner, notificationText(getLead(id)!), [[
    { text: "Выдать доступ", callback_data: `lead:approve:${id}` },
    { text: "Отклонить", callback_data: `lead:reject:${id}` },
  ]]).catch((e) => console.error("[leads] notify", e));
}

// ---- decisions ----

function uniqueSlug(name: string, id: number) {
  const base = normalizeSlug(name).slice(0, 16) || `clinic${id}`;
  const taken = db().prepare("SELECT 1 FROM clinics WHERE slug = ?");
  for (let n = 1; ; n++) {
    const slug = n === 1 ? (base.length >= 2 ? base : `clinic${id}`) : `${base}${n}`;
    if (!taken.get(slug)) return slug;
  }
}

const untilText = (until: number | null) =>
  until ? ` до ${new Date(until).toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "Europe/Moscow" })}` : "";

/**
 * The one button: creates the clinic (trial until the end of the promo, if one runs), the applicant's manager login,
 * reads the clinic's site into the first legend (approved as soon as it is ready, then the patients are fitted) and
 * sends the login and password to the applicant in Telegram.
 */
export async function approveLead(id: number, deps = { startAnalysis, fit: startPersonaFit }) {
  const lead = getLead(id);
  if (!lead) throw new Error("Заявка не найдена");
  if (lead.status !== "new") throw new Error(lead.status === "approved" ? "Доступ по этой заявке уже выдан" : "Заявка уже закрыта");

  const conn = db();
  let clinicId = 0, user = { id: 0, login: "", password: "" };
  const until = promoOn() ? promoUntil() : null;
  conn.exec("BEGIN");
  try {
    clinicId = createClinic({ legalName: lead.clinic, slug: uniqueSlug(lead.clinic, id), city: lead.city || "—" });
    conn.prepare("UPDATE clinics SET access_until = ? WHERE id = ?").run(until, clinicId);
    const [first, ...rest] = lead.fullName.split(/\s+/);
    user = createTrainee({ clinicId, firstName: first || "Руководитель", lastName: rest.join(" ") || first || "Клиники" });
    setRole(user.id, "manager");
    conn.prepare("UPDATE leads SET status = 'approved', clinic_id = ?, user_id = ?, decided_at = ?, updated_at = ? WHERE id = ?").run(clinicId, user.id, Date.now(), Date.now(), id);
    conn.exec("COMMIT");
  } catch (e) {
    conn.exec("ROLLBACK");
    throw e;
  }

  const hasSite = looksLikeSite(lead.site) && lead.checks?.siteOk !== false;
  if (hasSite) {
    try {
      setSites(clinicId, [{ url: /^https?:\/\//i.test(lead.site) ? lead.site : `https://${lead.site}`, label: "Сайт клиники" }]);
      deps.startAnalysis(clinicId, undefined, {
        origin: "owner",
        author: "Stom AD",
        onDraft: () => {
          if (workingLegend(clinicId)?.status !== "draft") return;
          try {
            approveDraft(clinicId, undefined, { author: "Stom AD", note: "Первая сборка по заявке" });
            deps.fit(clinicId);
          } catch (e) {
            console.error("[leads] first legend", e);
          }
        },
      });
    } catch (e) {
      console.error("[leads] analysis", e);
    }
  }

  const vars = {
    first: firstName(lead.fullName),
    clinic: lead.clinic,
    until: untilText(until),
    cabinet: bot.cabinetUrl,
    call: bot.callUrl,
    login: user.login,
    password: user.password,
  };
  await send(lead.chatId, fill(hasSite ? bot.texts.access : bot.texts.accessNoSite, vars)).catch((e) => console.error("[leads] access message", e));
  return { ...getLead(id)!, access: { login: user.login, password: user.password, until } };
}

/** Removes a decided request from the list. The clinic and logins an approved one created stay as they are. */
export function deleteLead(id: number) {
  const lead = getLead(id);
  if (!lead) throw new Error("Заявка не найдена");
  if (lead.status !== "approved" && lead.status !== "rejected") throw new Error("Удалить можно только решённую заявку");
  db().prepare("DELETE FROM leads WHERE id = ?").run(id);
}

export async function rejectLead(id: number) {
  const lead = getLead(id);
  if (!lead) throw new Error("Заявка не найдена");
  if (lead.status !== "new") throw new Error("Заявка уже закрыта");
  db().prepare("UPDATE leads SET status = 'rejected', decided_at = ?, updated_at = ? WHERE id = ?").run(Date.now(), Date.now(), id);
  await send(lead.chatId, fill(bot.texts.rejected, { founder: bot.founder })).catch((e) => console.error("[leads] reject message", e));
  return { ...getLead(id)!, access: null };
}
