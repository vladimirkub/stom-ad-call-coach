// One voice call at a time per login, a fixed rule: a login shared between several people cannot run two calls at once.
// Starting a call takes the login's lock; the browser gives it back when the call ends (or the page closes). If it never
// does (a crashed browser), the lock lapses a little after the longest possible call, so nobody stays locked out.
import { randomBytes } from "node:crypto";
import { db } from "./db.ts";
import { TEMPO } from "./tempo.ts";

export const HOLD_MS = (TEMPO.maxSeconds + 90) * 1000;

export type LockResult = { ok: true; token: string } | { ok: false; minutesLeft: number; heldFromIp: string; heldSince: number };

export function takeCallLock(userId: number, now = Date.now(), ip = ""): LockResult {
  const held = db().prepare("SELECT expires_at, started_at, ip FROM call_locks WHERE user_id = ?").get(userId) as { expires_at: number; started_at: number; ip: string } | undefined;
  if (held && held.expires_at > now) {
    return { ok: false, minutesLeft: Math.max(1, Math.ceil((held.expires_at - now) / 60_000)), heldFromIp: held.ip, heldSince: held.started_at };
  }
  const token = randomBytes(16).toString("base64url");
  db()
    .prepare("INSERT INTO call_locks (user_id, token, started_at, expires_at, ip) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET token = excluded.token, started_at = excluded.started_at, expires_at = excluded.expires_at, ip = excluded.ip")
    .run(userId, token, now, now + HOLD_MS, ip.slice(0, 64));
  return { ok: true, token };
}

/** Ends the lock of this call only: a stale token from an earlier call cannot free a newer one. */
export function releaseCallLock(userId: number, token: unknown) {
  if (typeof token !== "string" || !token) return false;
  return db().prepare("DELETE FROM call_locks WHERE user_id = ? AND token = ?").run(userId, token).changes > 0;
}

export const busyMessage = (minutesLeft: number) =>
  `По этому логину уже идёт голосовой звонок. Одновременно с одного логина можно вести только один звонок: у каждого администратора должен быть свой логин. Если звонок уже закончился, попробуйте снова через ${minutesLeft} мин.`;
