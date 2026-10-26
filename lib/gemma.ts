import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import type { ZodType } from "zod";

const MODEL = process.env.GEMMA_MODEL || "gemma-4-26b-a4b-it";

function client() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured on the server");
  return new GoogleGenAI({ apiKey });
}

/** Concatenate answer text, skipping any "thought" parts Gemma 4 may emit. */
function answerText(response: Awaited<ReturnType<GoogleGenAI["models"]["generateContent"]>>): string {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const text = parts.filter((p) => !p.thought && p.text).map((p) => p.text).join("");
  return text || response.text || "";
}

/** Transient Gemini failures (5xx, 429) are retried; anything else is surfaced immediately. */
function isTransient(e: unknown): boolean {
  const status = (e as { status?: number })?.status;
  if (typeof status === "number") return status >= 500 || status === 429;
  return /"code":\s*(5\d\d|429)|INTERNAL|UNAVAILABLE|overloaded/i.test(String((e as Error)?.message ?? e));
}

export async function gemmaText(opts: {
  system: string;
  contents: { role: "user" | "model"; text: string }[];
  /** "minimal" turns Gemma 4 thinking off (documented toggle): much faster for long structured output. */
  thinking?: "minimal" | "default";
  /** Thinking tokens count against the output budget, so long JSON can be cut off without an explicit limit. */
  maxOutputTokens?: number;
}) {
  const ai = client();
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: opts.contents.map((c) => ({ role: c.role, parts: [{ text: c.text }] })),
        config: {
          systemInstruction: opts.system,
          ...(opts.maxOutputTokens ? { maxOutputTokens: opts.maxOutputTokens } : {}),
          ...(opts.thinking === "minimal" ? { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } } : {}),
        },
      });
      const text = answerText(response).trim();
      if (!text) throw new Error("Gemma returned an empty response");
      return text;
    } catch (e) {
      lastError = e;
      if (!isTransient(e) || attempt === 3) break;
      // Rate limits (429) need a longer pause than a transient 5xx.
      const status = (e as { status?: number })?.status;
      await new Promise((r) => setTimeout(r, (status === 429 ? 4000 : 1000) * (attempt + 1)));
    }
  }
  throw lastError;
}

/** Gemma's JSON mode is not documented, so we ask for JSON in the prompt, extract it, and validate with Zod. */
export function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in model output");
  return JSON.parse(body.slice(start, end + 1));
}

export async function gemmaJson<T>(opts: { system: string; prompt: string; schema: ZodType<T>; thinking?: "minimal" | "default"; maxOutputTokens?: number }): Promise<T> {
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const prompt = attempt === 0 ? opts.prompt : `${opts.prompt}\n\nYour previous answer was invalid (${lastError}). Reply with ONLY the JSON object.`;
    const raw = await gemmaText({
      system: opts.system,
      contents: [{ role: "user", text: prompt }],
      maxOutputTokens: opts.maxOutputTokens ?? 16384,
      // Thinking stays on by default: turning it off was ~15% faster but noticeably less accurate in evaluations.
      thinking: opts.thinking ?? (process.env.GEMMA_JSON_THINKING === "off" ? "minimal" : "default"),
    });
    try {
      return opts.schema.parse(extractJson(raw));
    } catch (e) {
      lastError = e instanceof Error ? e.message.slice(0, 300) : "parse error";
    }
  }
  throw new Error(`Model response failed validation: ${lastError}`);
}
