// Request-side helpers around lib/auth: read the session cookie, gate the owner-only admin API, throttle logins.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_DAYS, sessionUser, type SessionUser } from "./auth.ts";
import { clinicContext } from "./clinic-context.ts";

export async function currentUser(): Promise<SessionUser | null> {
  return sessionUser((await cookies()).get(SESSION_COOKIE)?.value);
}

/** The signed-in user's clinic as trainings see it (legend, memo, fitted patients). */
export async function currentClinicContext() {
  return clinicContext((await currentUser())?.clinic?.id ?? null);
}

/** For admin routes: the owner, or a ready 401/403 response to return. */
export async function requireOwner(): Promise<{ owner: SessionUser } | { denied: NextResponse }> {
  const user = await currentUser();
  if (!user) return { denied: NextResponse.json({ error: "Войдите в систему" }, { status: 401 }) };
  if (user.role !== "owner") return { denied: NextResponse.json({ error: "Нет доступа" }, { status: 403 }) };
  return { owner: user };
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

// 10 wrong passwords in a row from one address lock logins from it for 15 minutes.
const FAIL_LIMIT = 10;
const LOCK_MS = 15 * 60_000;
const fails = new Map<string, { count: number; lockedUntil: number }>();

export function clientIp(req: Request) {
  return (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
}

export function loginLocked(ip: string): number {
  const f = fails.get(ip);
  return f && f.lockedUntil > Date.now() ? Math.ceil((f.lockedUntil - Date.now()) / 60_000) : 0;
}

export function recordLoginFailure(ip: string) {
  const f = fails.get(ip) ?? { count: 0, lockedUntil: 0 };
  f.count += 1;
  if (f.count >= FAIL_LIMIT) {
    f.lockedUntil = Date.now() + LOCK_MS;
    f.count = 0;
  }
  fails.set(ip, f);
}

export function clearLoginFailures(ip: string) {
  fails.delete(ip);
}
