import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/ratelimit";
import { CrmError, listCalls, type CallItem } from "@/lib/crm/amocrm";
import { getConn, listConns } from "@/lib/crm/session";

const MAX_DAYS = 31;
const LIMIT = 100;

export async function GET(req: Request) {
  const limited = rateLimit(req, "crm", 30);
  if (limited) return limited;
  const q = new URL(req.url).searchParams;
  const which = q.get("connection") ?? "all";
  const conns = which === "all" ? await listConns().catch(() => []) : [await getConn(which).catch(() => null)].filter((c) => c !== null);
  if (!conns.length) return NextResponse.json({ error: "CRM не подключена" }, { status: 401 });

  const from = Date.parse(`${q.get("from")}T00:00:00`);
  const to = Date.parse(`${q.get("to")}T23:59:59`);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) {
    return NextResponse.json({ error: "Укажите корректный период" }, { status: 400 });
  }
  if (to - from > MAX_DAYS * 86400_000) {
    return NextResponse.json({ error: `Период не может быть больше ${MAX_DAYS} дней` }, { status: 400 });
  }
  // Only calls longer than 10 seconds are useful for evaluation; the user may raise the bar but not lower it.
  const minDuration = Math.max(10, Number(q.get("minDuration")) || 10);
  const range = { fromSec: Math.floor(from / 1000), toSec: Math.floor(to / 1000), minDuration };

  const settled = await Promise.allSettled(conns.map((c) => listCalls(c, range)));
  const calls: CallItem[] = [];
  const errors: { account: string; error: string }[] = [];
  let truncated = false;
  settled.forEach((r, i) => {
    const c = conns[i];
    if (r.status === "fulfilled") {
      truncated ||= r.value.truncated;
      for (const call of r.value.calls) calls.push({ ...call, key: `${c.id}:${call.key}`, connectionId: c.id, account: c.subdomain });
    } else {
      console.error("[crm/calls]", c.id, r.reason);
      errors.push({ account: c.subdomain, error: r.reason instanceof Error ? r.reason.message : "Не удалось получить звонки" });
    }
  });
  if (!calls.length && errors.length === conns.length) {
    const status = settled[0].status === "rejected" && settled[0].reason instanceof CrmError ? settled[0].reason.status : 502;
    return NextResponse.json({ error: errors.map((e) => `${e.account}: ${e.error}`).join("; ") }, { status });
  }
  calls.sort((a, b) => b.createdAt - a.createdAt);
  return NextResponse.json({ calls: calls.slice(0, LIMIT), truncated: truncated || calls.length > LIMIT, errors });
}
