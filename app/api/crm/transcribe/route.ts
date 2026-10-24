import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/ratelimit";
import { CrmError, getRecordingLink, type Entity } from "@/lib/crm/amocrm";
import { getConn } from "@/lib/crm/session";
import { SttError, transcribe } from "@/lib/stt";

export async function POST(req: Request) {
  const limited = rateLimit(req, "stt", 10);
  if (limited) return limited;
  const body = await req.json().catch(() => null);
  const conn = await getConn(typeof body?.connection === "string" ? body.connection : null).catch(() => null);
  if (!conn) return NextResponse.json({ error: "CRM не подключена" }, { status: 401 });

  const entity: Entity | null = body?.entity === "contacts" || body?.entity === "leads" ? body.entity : null;
  const noteId = Number(body?.noteId);
  if (!entity || !Number.isInteger(noteId) || noteId <= 0) return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });

  try {
    // The recording URL comes from the CRM note (server-side), never from the browser.
    const url = await getRecordingLink(conn, entity, noteId);
    return NextResponse.json(await transcribe({ url }));
  } catch (e) {
    console.error("[crm/transcribe]", e);
    const status = e instanceof CrmError || e instanceof SttError ? e.status : 502;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Не удалось расшифровать звонок" }, { status });
  }
}
