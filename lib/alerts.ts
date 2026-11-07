// Telegram alerts to the owner (the chat linked in the «Заявки» tab, lib/leads.ts) about signs of a shared login:
// a second voice call from one login while the first is running, one login signing in from many addresses in a day,
// and passwords being guessed for a real login. Each kind of alert about one login is sent at most once in 6 hours,
// so a busy afternoon does not turn into a flood.
import { db } from "./db.ts";
import { send } from "./telegram.ts";

export const ALERT_EVERY_MS = 6 * 3600_000;
/** Distinct addresses one login may sign in from within 24 hours before it looks shared. */
export const IP_LIMIT = 4;

type Who = { login: string; name: string; clinic: string | null };

function who(userId: number): Who | null {
  const r = db()
    .prepare("SELECT u.login, u.first_name, u.last_name, c.legal_name FROM users u LEFT JOIN clinics c ON c.id = u.clinic_id WHERE u.id = ?")
    .get(userId) as { login: string; first_name: string; last_name: string; legal_name: string | null } | undefined;
  return r ? { login: r.login, name: `${r.first_name} ${r.last_name}`.trim(), clinic: r.legal_name } : null;
}

const label = (w: Who) => `${w.login} (${[w.name, w.clinic].filter(Boolean).join(", ")})`;
const time = (t: number) => new Date(t).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });

/** True when this alert may go out now; remembers it. */
function due(key: string, now: number): boolean {
  const last = db().prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  if (last && now - Number(last.value) < ALERT_EVERY_MS) return false;
  db().prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, String(now));
  return true;
}

function ownerChat(): string | null {
  return (db().prepare("SELECT value FROM settings WHERE key = 'owner_chat_id'").get() as { value: string } | undefined)?.value ?? null;
}

/** Sends one alert, if the owner's chat is linked and the same alert did not go out lately. Returns the text (for tests). */
async function alert(key: string, text: string, now: number, deliver = send): Promise<string | null> {
  const chat = ownerChat();
  if (!chat || !due(key, now)) return null;
  await deliver(chat, text).catch((e) => console.error("[alerts]", e));
  return text;
}

export function alertDoubleCall(userId: number, attempt: { ip: string; heldFromIp: string; heldSince: number }, now = Date.now(), deliver = send) {
  const w = who(userId);
  if (!w) return Promise.resolve(null);
  const where = attempt.ip && attempt.heldFromIp && attempt.ip !== attempt.heldFromIp
    ? `Звонок идёт с адреса ${attempt.heldFromIp} (с ${time(attempt.heldSince)}), второй пытались начать с ${attempt.ip}.`
    : `Звонок идёт с ${time(attempt.heldSince)}, второй пытались начать с того же адреса (другая вкладка или устройство в той же сети).`;
  return alert(`alert:double:${userId}`, `Два звонка с одного логина\n${label(w)}\n\n${where}\nВторой звонок отклонён.`, now, deliver);
}

/** After a sign-in: alerts when the login has signed in from IP_LIMIT or more addresses in the last 24 hours. */
export function alertManyAddresses(userId: number, now = Date.now(), deliver = send) {
  const rows = db().prepare("SELECT DISTINCT ip FROM sessions WHERE user_id = ? AND created_at > ? AND ip != ''").all(userId, now - 864e5) as { ip: string }[];
  if (rows.length < IP_LIMIT) return Promise.resolve(null);
  const w = who(userId);
  if (!w) return Promise.resolve(null);
  return alert(
    `alert:ips:${userId}`,
    `Логин входит с разных адресов\n${label(w)}\n\nЗа сутки входов с ${rows.length} разных адресов: ${rows.map((r) => r.ip).join(", ")}.\nВозможно, логином пользуются несколько человек.`,
    now,
    deliver,
  );
}

/** After an address was locked for wrong passwords: alerts if it was guessing a real login (the owner's included). */
export function alertPasswordGuessing(loginName: string, ip: string, now = Date.now(), deliver = send) {
  const u = db().prepare("SELECT id FROM users WHERE login = ?").get(loginName.trim().toLowerCase()) as { id: number } | undefined;
  if (!u) return Promise.resolve(null);
  const w = who(u.id)!;
  return alert(
    `alert:guess:${u.id}`,
    `Подбор пароля\n${label(w)}\n\n10 неверных паролей подряд с адреса ${ip}. Вход с этого адреса закрыт на 15 минут.`,
    now,
    deliver,
  );
}
