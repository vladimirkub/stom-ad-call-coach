// The Telegram Bot API, the few methods the request bot needs. The token comes from TELEGRAM_BOT_TOKEN and never leaves
// the server. Calls really go out only where TELEGRAM_LIVE=1 (set in the production server's own env file, never in
// .env.local); everywhere else, local checks and tests included, each call is logged instead, so nothing reaches real chats.
import { createHash, timingSafeEqual } from "node:crypto";

export type InlineButton = { text: string; callback_data?: string; url?: string };
export type Keyboard = InlineButton[][];

export type TgUpdate = {
  update_id: number;
  message?: { message_id: number; chat: { id: number; type: string }; from?: { id: number; username?: string }; text?: string };
  callback_query?: {
    id: string;
    from: { id: number; username?: string };
    data?: string;
    message?: { message_id: number; chat: { id: number } };
  };
};

const token = () => process.env.TELEGRAM_BOT_TOKEN ?? "";
export const botConfigured = () => !!token();
const dryRun = () => process.env.TELEGRAM_LIVE !== "1";

/** Calls one Bot API method; returns its result, or throws with Telegram's description. */
export async function tg<T = unknown>(method: string, body: Record<string, unknown>): Promise<T> {
  if (!token()) throw new Error("Бот не настроен: нет TELEGRAM_BOT_TOKEN");
  if (dryRun()) {
    console.log(`[telegram dry-run] ${method}`, JSON.stringify(body).slice(0, 500));
    return { message_id: 0 } as T;
  }
  const res = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description ?? res.status}`);
  return data.result as T;
}

export function send(chatId: string | number, text: string, keyboard?: Keyboard) {
  return tg<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text,
    link_preview_options: { is_disabled: true },
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  });
}

export function editText(chatId: string | number, messageId: number, text: string, keyboard?: Keyboard) {
  return tg("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: keyboard ?? [] },
  });
}

export function answerCallback(id: string, text?: string) {
  return tg("answerCallbackQuery", { callback_query_id: id, ...(text ? { text } : {}) }).catch(() => undefined);
}

/** The secret Telegram sends back in every webhook call, derived from the token, so no second secret has to be kept. */
export function webhookSecret(): string {
  return createHash("sha256").update(`webhook:${token()}`).digest("hex").slice(0, 48);
}

export function validWebhookSecret(header: string | null): boolean {
  if (!token() || !header) return false;
  const a = Buffer.from(header), b = Buffer.from(webhookSecret());
  return a.length === b.length && timingSafeEqual(a, b);
}

let webhookChecked = false;
/** Points the bot at this server's webhook once per process (no-op when it already does, or in a dry run). */
export async function ensureWebhook(url: string) {
  if (webhookChecked || !token() || dryRun()) return;
  const info = await tg<{ url?: string }>("getWebhookInfo", {});
  if (info.url !== url) {
    await tg("setWebhook", { url, secret_token: webhookSecret(), allowed_updates: ["message", "callback_query"], drop_pending_updates: false });
  }
  webhookChecked = true;
}
