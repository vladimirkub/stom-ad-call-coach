import { NextResponse } from "next/server";
import { login } from "@/lib/auth";
import { clearLoginFailures, clientIp, loginLocked, recordLoginFailure, setSessionCookie } from "@/lib/session";

export async function POST(req: Request) {
  const ip = clientIp(req);
  const locked = loginLocked(ip);
  if (locked) return NextResponse.json({ error: `Слишком много неверных попыток. Попробуйте через ${locked} мин.` }, { status: 429 });

  const body = await req.json().catch(() => null);
  const name = String(body?.login ?? "").slice(0, 80);
  const password = String(body?.password ?? "").slice(0, 200);
  if (!name || !password) return NextResponse.json({ error: "Введите логин и пароль" }, { status: 400 });

  const r = login(name, password);
  if (!r.ok) {
    if (r.reason === "disabled") return NextResponse.json({ error: "Доступ закрыт. Обратитесь в Stom AD." }, { status: 403 });
    recordLoginFailure(ip);
    return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
  }
  clearLoginFailures(ip);
  await setSessionCookie(r.token);
  return NextResponse.json({ ok: true });
}
