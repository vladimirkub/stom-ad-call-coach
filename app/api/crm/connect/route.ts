import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/ratelimit";
import { CrmError, getAccount, parseAccount } from "@/lib/crm/amocrm";
import { saveConn } from "@/lib/crm/session";

export async function POST(req: Request) {
  const limited = rateLimit(req, "crm", 10);
  if (limited) return limited;
  const body = await req.json().catch(() => null);
  const account = parseAccount(String(body?.account ?? ""));
  const token = String(body?.token ?? "").trim();
  if (!account || token.length < 20) {
    return NextResponse.json({ error: "Укажите адрес аккаунта (например, mycompany.amocrm.ru) и долгосрочный токен" }, { status: 400 });
  }
  if (!process.env.CRM_SESSION_SECRET) {
    return NextResponse.json({ error: "На сервере не задан CRM_SESSION_SECRET (см. .env.example)" }, { status: 503 });
  }
  const conn = { ...account, token };
  try {
    const { name } = await getAccount(conn); // verifies the token against GET /api/v4/account
    const saved = await saveConn(conn, name);
    return NextResponse.json({ connection: { id: saved.id, name: saved.name, subdomain: saved.subdomain, domain: saved.domain } });
  } catch (e) {
    const status = e instanceof CrmError ? e.status : 502;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Не удалось подключиться" }, { status });
  }
}
