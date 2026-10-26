import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/ratelimit";
import { TranscriptSchema } from "@/lib/schemas";
import { gemmaText } from "@/lib/gemma";
import { getScenario } from "@/lib/scenarios";

/** Text-mode fallback: Gemma plays the same patient persona. */
export async function POST(req: Request) {
  const limited = rateLimit(req, "chat", 40);
  if (limited) return limited;
  const body = await req.json().catch(() => null);
  const scenario = getScenario(body?.scenarioId);
  const parsed = TranscriptSchema.safeParse(body?.transcript);
  if (!scenario || !parsed.success) return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  try {
    const raw = await gemmaText({
      system: scenario.prompt,
      contents: parsed.data.map((t) => ({ role: t.role === "agent" ? ("model" as const) : ("user" as const), text: t.text })),
    });
    // In voice the patient hangs up with the end_call tool; text mode has no tools, so the model writes the name instead.
    const ended = /\bend_call\b/.test(raw);
    const reply = raw.replace(/\s*\bend_call\b\s*/g, " ").trim();
    return NextResponse.json({ reply, ended });
  } catch (e) {
    console.error("[chat]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Не удалось получить ответ" }, { status: 502 });
  }
}
