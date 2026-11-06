import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/session";
import { approveLead, checkLines, deleteLead, listLeads, looksLikeSite, ownerChat, ownerLinkUrl, rejectLead } from "@/lib/leads";
import { botConfigured, ensureWebhook } from "@/lib/telegram";

const WEBHOOK = "https://coach.stom-ad.com/api/telegram/webhook";

/** Owner: the connection requests from the bot, and whether notifications reach the owner's Telegram. */
export async function GET() {
  const gate = await requireOwner();
  if ("denied" in gate) return gate.denied;
  let botError = "";
  if (botConfigured()) await ensureWebhook(WEBHOOK).catch((e) => (botError = e instanceof Error ? e.message : String(e)));
  else botError = "Бот не настроен: нет TELEGRAM_BOT_TOKEN";
  const leads = listLeads().map((l) => ({ ...l, chatId: undefined, hasSite: looksLikeSite(l.site), checkLines: checkLines(l.checks) }));
  return NextResponse.json({ leads, ownerLinked: !!ownerChat(), botError });
}

/** Owner: { action: "approve" | "reject" | "delete", id } decides or removes a request; { action: "link" } returns a one-time Telegram link. */
export async function POST(req: Request) {
  const gate = await requireOwner();
  if ("denied" in gate) return gate.denied;
  const body = await req.json().catch(() => null);
  try {
    if (body?.action === "link") return NextResponse.json({ url: ownerLinkUrl() });
    const id = Number(body?.id);
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Не указана заявка" }, { status: 400 });
    if (body?.action === "approve") {
      const done = await approveLead(id);
      return NextResponse.json({ ok: true, access: done.access });
    }
    if (body?.action === "delete") {
      deleteLead(id);
      return NextResponse.json({ ok: true });
    }
    if (body?.action === "reject") {
      await rejectLead(id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Не получилось" }, { status: 400 });
  }
}
