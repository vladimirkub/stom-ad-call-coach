import { NextResponse } from "next/server";
import { CrmError, getRecordingLink, type Entity } from "@/lib/crm/amocrm";
import { getConn } from "@/lib/crm/session";

/**
 * Lets an <audio> tag play a call: the recording URL is read from the CRM note server-side and the browser is
 * redirected to it, so the audio streams straight from the telephony provider (no proxying, no client-supplied URL).
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const conn = await getConn(q.get("connection")).catch(() => null);
  if (!conn) return NextResponse.json({ error: "CRM не подключена" }, { status: 401 });

  const entity: Entity | null = q.get("entity") === "contacts" || q.get("entity") === "leads" ? (q.get("entity") as Entity) : null;
  const noteId = Number(q.get("noteId"));
  if (!entity || !Number.isInteger(noteId) || noteId <= 0) return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });

  try {
    const res = NextResponse.redirect(await getRecordingLink(conn, entity, noteId), 302);
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("Referrer-Policy", "no-referrer");
    return res;
  } catch (e) {
    const status = e instanceof CrmError ? e.status : 502;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Не удалось получить запись" }, { status });
  }
}
