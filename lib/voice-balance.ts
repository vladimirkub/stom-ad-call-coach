// The ElevenLabs credit balance for the owner: what is left, in minutes of voice, and for how many days at the recent
// pace. Read from the subscription (the API key needs the "User: Read" permission); cached for a few minutes because the
// admin asks on every load.
import { db } from "./db.ts";
import { CREDITS_PER_MINUTE } from "./plans.ts";

/** Warn the owner when the balance lasts fewer days than this at the recent pace, or fewer minutes than LOW_MINUTES. */
export const LOW_DAYS = 5;
export const LOW_MINUTES = 60;

type Subscription = { tier?: string; character_count?: number; character_limit?: number; next_character_count_reset_unix?: number };
export type VoiceBalance = {
  tier: string; used: number; limit: number; left: number; minutesLeft: number;
  resetAt: number | null; perDay: number; daysLeft: number | null; low: boolean;
};

/** The balance from a subscription and the voice minutes of the last 7 days. */
export function balanceView(sub: Subscription, minutes7: number): VoiceBalance | null {
  if (typeof sub.character_limit !== "number" || typeof sub.character_count !== "number") return null;
  const left = Math.max(0, sub.character_limit - sub.character_count);
  const minutesLeft = Math.floor(left / CREDITS_PER_MINUTE);
  const perDay = Math.round(((minutes7 / 7) * CREDITS_PER_MINUTE));
  const daysLeft = perDay > 0 ? Math.floor(left / perDay) : null;
  return {
    tier: sub.tier ?? "",
    used: sub.character_count,
    limit: sub.character_limit,
    left,
    minutesLeft,
    resetAt: sub.next_character_count_reset_unix ? sub.next_character_count_reset_unix * 1000 : null,
    perDay,
    daysLeft,
    low: minutesLeft < LOW_MINUTES || (daysLeft !== null && daysLeft < LOW_DAYS),
  };
}

/** Voice minutes of all recorded calls over the last 7 days. */
export function recentMinutes(now = Date.now()): number {
  const row = db().prepare("SELECT COALESCE(SUM(duration_s), 0) AS s FROM usage WHERE started_at > ?").get(now - 7 * 864e5) as { s: number };
  return row.s / 60;
}

let cache: { at: number; value: VoiceBalance | null } | null = null;

/** The current balance, or null when ElevenLabs does not answer or the key may not read the subscription. */
export async function voiceBalance(now = Date.now()): Promise<VoiceBalance | null> {
  if (cache && now - cache.at < 5 * 60_000) return cache.value;
  let value: VoiceBalance | null = null;
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) value = balanceView((await res.json()) as Subscription, recentMinutes(now));
  } catch {
    value = null;
  }
  cache = { at: now, value };
  return value;
}
