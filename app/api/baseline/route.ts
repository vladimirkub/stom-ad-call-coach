import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/ratelimit";
import { gemmaJson } from "@/lib/gemma";
import { TranscriptSchema } from "@/lib/schemas";

/**
 * Benchmark baseline: the SAME model (Gemma 4) with no rubric, no clinic facts and no checklist,
 * just "rate this call 0-100". Used only by scripts/benchmark.mjs to measure what our layer adds.
 */
export async function POST(req: Request) {
  const limited = rateLimit(req, "baseline", 40);
  if (limited) return limited;
  const body = await req.json().catch(() => null);
  const t = TranscriptSchema.safeParse(body?.transcript);
  if (!t.success) return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  const text = t.data.map((x) => `${x.role === "user" ? "ОПЕРАТОР" : "ПАЦИЕНТ"}: ${x.text}`).join("\n");
  try {
    const r = await gemmaJson({
      system: 'Ты оцениваешь звонок оператора стоматологической клиники пациенту. Ответь ТОЛЬКО JSON: {"score": целое 0-100, "comment": "1 предложение"}.',
      prompt: `Оцени работу оператора.\n\n${text}`,
      schema: z.object({ score: z.number().int().min(0).max(100), comment: z.string().default("") }),
    });
    return NextResponse.json(r);
  } catch (e) {
    console.error("[baseline]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Ошибка" }, { status: 502 });
  }
}
