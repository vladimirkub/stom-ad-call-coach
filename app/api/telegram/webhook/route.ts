import { NextResponse } from "next/server";
import { handleUpdate } from "@/lib/leads";
import { validWebhookSecret, type TgUpdate } from "@/lib/telegram";

// Telegram calls this for every message and button press in the request bot. Only calls carrying the secret set with
// setWebhook (lib/telegram.ts) are handled; the answer is always 200 so Telegram does not resend an update.
export async function POST(req: Request) {
  if (!validWebhookSecret(req.headers.get("x-telegram-bot-api-secret-token"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const update = (await req.json().catch(() => null)) as TgUpdate | null;
  if (update) await handleUpdate(update).catch((e) => console.error("[telegram]", e));
  return NextResponse.json({ ok: true });
}
