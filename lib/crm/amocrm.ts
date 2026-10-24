// amoCRM API v4 client (endpoints and fields verified against the official docs:
// GET /api/v4/account, GET /api/v4/{entity}/notes with note_type call_in/call_out, params.duration/link/phone/source).
export type Conn = { subdomain: string; domain: string; token: string };

/** Each connection lives in its own sealed cookie. ~1 KB per token and the request-header limit cap this at a handful. */
export const MAX_CONNECTIONS = 6;
export const connectionId = (c: { subdomain: string; domain: string }) => `${c.subdomain}.${c.domain}`;
export const cookieNameFor = (id: string) => `crm_${id.replace(/[^a-z0-9-]/g, "_")}`;
export type Entity = "contacts" | "leads";

export class CrmError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type CallItem = {
  key: string;
  entity: Entity;
  noteId: number;
  createdAt: number; // unix seconds
  direction: "in" | "out";
  duration: number; // seconds
  phone: string; // masked
  source: string;
  responsible: string;
  hasRecording: boolean;
  uniq: string;
  // Filled in when listing across connections.
  connectionId?: string;
  account?: string;
};

/** Accepts "mycompany", "mycompany.amocrm.ru" or a full URL. Only known amoCRM/Kommo domains are allowed (no SSRF). */
export function parseAccount(input: string): { subdomain: string; domain: string } | null {
  const host = input.trim().toLowerCase().replace(/^https?:\/\//, "").split(/[/?#]/)[0];
  const m = host.match(/^([a-z0-9][a-z0-9-]{0,61}[a-z0-9])(?:\.(amocrm\.ru|amocrm\.com|kommo\.com))?$/);
  return m ? { subdomain: m[1], domain: m[2] ?? "amocrm.ru" } : null;
}

export function maskPhone(phone: unknown): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  return digits.length >= 4 ? `•••• ${digits.slice(-4)}` : "—";
}

async function amoGet(conn: Conn, path: string, params?: URLSearchParams): Promise<any> {
  const url = `https://${conn.subdomain}.${conn.domain}${path}${params ? `?${params}` : ""}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    // redirect: "manual" so the bearer token is never forwarded to another host.
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${conn.token}`, Accept: "application/json" },
      signal: ctrl.signal,
      cache: "no-store",
      redirect: "manual",
    });
    if (res.status === 204) return null; // amoCRM returns 204 for empty lists
    if (res.status >= 300 && res.status < 400) throw new CrmError("Аккаунт не найден: проверьте адрес и домен (amocrm.ru или kommo.com)", 404);
    if (res.status === 401) throw new CrmError("Токен недействителен или истёк", 401);
    if (res.status === 403) throw new CrmError("Недостаточно прав у токена или у пользователя", 403);
    if (res.status === 429) throw new CrmError("amoCRM ограничила частоту запросов, попробуйте через минуту", 429);
    if (!res.ok) throw new CrmError(`amoCRM вернула ошибку ${res.status}`, 502);
    return await res.json();
  } catch (e) {
    if (e instanceof CrmError) throw e;
    throw new CrmError(e instanceof Error && e.name === "AbortError" ? "amoCRM не ответила вовремя" : "Не удалось связаться с amoCRM", 502);
  } finally {
    clearTimeout(timer);
  }
}

export async function getAccount(conn: Conn): Promise<{ name: string }> {
  const info = await amoGet(conn, "/api/v4/account");
  return { name: String(info?.name ?? conn.subdomain) };
}

export function parseCallNotes(payload: unknown, entity: Entity): CallItem[] {
  const notes = (payload as any)?._embedded?.notes;
  if (!Array.isArray(notes)) return [];
  const out: CallItem[] = [];
  for (const n of notes) {
    if (n?.note_type !== "call_in" && n?.note_type !== "call_out") continue;
    const p = n.params ?? {};
    const duration = Number(p.duration);
    out.push({
      key: `${entity}:${n.id}`,
      entity,
      noteId: Number(n.id),
      createdAt: Number(n.created_at),
      direction: n.note_type === "call_in" ? "in" : "out",
      duration: Number.isFinite(duration) ? duration : 0,
      phone: maskPhone(p.phone),
      source: String(p.source ?? ""),
      responsible: String(p.call_responsible ?? ""),
      hasRecording: typeof p.link === "string" && p.link.startsWith("https://"),
      uniq: String(p.uniq ?? ""),
    });
  }
  return out;
}

/** Calls in [fromSec, toSec] longer than minDuration seconds, newest first. */
export async function listCalls(conn: Conn, o: { fromSec: number; toSec: number; minDuration: number }) {
  const found: CallItem[] = [];
  let truncated = false;
  let ok = 0;
  let lastError: unknown;
  for (const entity of ["contacts", "leads"] as const) {
    try {
      for (let page = 1; page <= 4; page++) {
        const p = new URLSearchParams({ limit: "250", page: String(page), "order[updated_at]": "desc", "filter[updated_at]": String(o.fromSec) });
        p.set("filter[note_type][0]", "call_in");
        p.set("filter[note_type][1]", "call_out");
        const data = await amoGet(conn, `/api/v4/${entity}/notes`, p);
        found.push(...parseCallNotes(data, entity));
        if (!data?._links?.next) break;
        if (page === 4) truncated = true;
      }
      ok++;
    } catch (e) {
      lastError = e;
    }
  }
  if (ok === 0 && lastError) throw lastError;

  const seen = new Set<string>();
  const calls = found
    .filter((c) => c.createdAt >= o.fromSec && c.createdAt <= o.toSec && c.duration > o.minDuration)
    .filter((c) => {
      const id = c.uniq || c.key;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .sort((a, b) => b.createdAt - a.createdAt);
  return { calls: calls.slice(0, 100), truncated: truncated || calls.length > 100 };
}

/** Recording URL of one call note. Fetched server-side so the client never supplies a URL (no SSRF). */
export async function getRecordingLink(conn: Conn, entity: Entity, noteId: number): Promise<string> {
  const note = await amoGet(conn, `/api/v4/${entity}/notes/${noteId}`);
  const link = note?.params?.link;
  if (typeof link !== "string") throw new CrmError("У этого звонка нет записи", 404);
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    throw new CrmError("Некорректная ссылка на запись", 422);
  }
  if (url.protocol !== "https:") throw new CrmError("Ссылка на запись небезопасна (нужен https)", 422);
  return url.toString();
}
