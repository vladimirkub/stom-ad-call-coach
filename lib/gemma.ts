import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z, type ZodType } from "zod";

// Paid Gemini models (Gemma 4 has no paid tier, so its free-tier limits broke with a few concurrent users).
// "fast" serves every live turn (patient chat, live checklist), "smart" the one-off analyses (evaluation, script, learning).
// On overload or a 5xx the next attempt goes to FALLBACK at once instead of waiting on the same busy model.
const MODELS = {
  fast: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
  smart: process.env.GEMINI_SMART_MODEL || "gemini-3.6-flash",
} as const;
const FALLBACK = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.1-flash-lite";
type Tier = keyof typeof MODELS;

function client() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured on the server");
  return new GoogleGenAI({ apiKey });
}

/** Concatenate answer text, skipping any "thought" parts the model may emit. */
function answerText(response: Awaited<ReturnType<GoogleGenAI["models"]["generateContent"]>>): string {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const text = parts.filter((p) => !p.thought && p.text).map((p) => p.text).join("");
  return text || response.text || "";
}

/** Transient Gemini failures (5xx, 429, network errors) are retried; anything else is surfaced immediately. */
function isTransient(e: unknown): boolean {
  const status = (e as { status?: number })?.status;
  if (typeof status === "number") return status >= 500 || status === 429;
  const cause = String((e as { cause?: unknown })?.cause ?? "");
  return /"code":\s*(5\d\d|429)|INTERNAL|UNAVAILABLE|overloaded|fetch failed|ECONNRESET|ETIMEDOUT|Timeout/i.test(`${String((e as Error)?.message ?? e)} ${cause}`);
}

export async function gemmaText(opts: {
  system: string;
  contents: { role: "user" | "model"; text: string }[];
  /** "minimal" turns thinking down to the minimum: much faster for long structured output. */
  thinking?: "minimal" | "default";
  /** Thinking tokens count against the output budget, so long JSON can be cut off without an explicit limit. */
  maxOutputTokens?: number;
  tier?: Tier;
  /** Ask the API for strict JSON (no markdown, quotes escaped); the caller still validates the shape. */
  json?: boolean;
  /** JSON Schema the answer must follow (structured output): the API then cannot return malformed JSON. */
  jsonSchema?: object;
}) {
  const ai = client();
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: attempt % 2 === 0 ? MODELS[opts.tier ?? "fast"] : FALLBACK,
        contents: opts.contents.map((c) => ({ role: c.role, parts: [{ text: c.text }] })),
        config: {
          systemInstruction: opts.system,
          ...(opts.maxOutputTokens ? { maxOutputTokens: opts.maxOutputTokens } : {}),
          ...(opts.thinking === "minimal" ? { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } } : {}),
          ...(opts.json || opts.jsonSchema ? { responseMimeType: "application/json" } : {}),
          ...(opts.jsonSchema ? { responseJsonSchema: opts.jsonSchema } : {}),
        },
      });
      const text = answerText(response).trim();
      if (!text) throw new Error("Model returned an empty response");
      return text;
    } catch (e) {
      lastError = e;
      if (!isTransient(e) || attempt === 3) break;
      // The next attempt already switches model, so only a short pause is needed.
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  throw lastError;
}

/** JSON mode returns a bare object; older answers may still wrap it in a markdown fence, so extract before parsing. */
export function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in model output");
  return JSON.parse(body.slice(start, end + 1));
}

const schemas = new WeakMap<object, object>();
/** The zod schema as JSON Schema for the API; null if zod cannot express it (then plain JSON mode is used). */
function jsonSchemaOf(schema: ZodType): object | undefined {
  if (!schemas.has(schema)) {
    try {
      const { $schema: _, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
      schemas.set(schema, rest);
    } catch {
      return undefined;
    }
  }
  return schemas.get(schema);
}

export async function gemmaJson<T>(opts: { system: string; prompt: string; schema: ZodType<T>; thinking?: "minimal" | "default"; maxOutputTokens?: number; tier?: Tier }): Promise<T> {
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const prompt = attempt === 0 ? opts.prompt : `${opts.prompt}\n\nYour previous answer was invalid (${lastError}). Reply with ONLY the JSON object.`;
    const raw = await gemmaText({
      system: opts.system,
      contents: [{ role: "user", text: prompt }],
      maxOutputTokens: opts.maxOutputTokens ?? 16384,
      tier: opts.tier,
      // Prompt-only JSON broke on unescaped quotes inside Russian text (e.g. "Все зубы за 1 день"), and JSON mode alone
      // still let some answers through malformed (a patient fit failed 3 times in a row); the schema constrains the output.
      json: true,
      jsonSchema: jsonSchemaOf(opts.schema),
      // Minimal thinking by default: on gemini-3.6-flash evaluations took 3-8 s instead of 10-31 s and scored the six
      // benchmark calls as before (strong 90-94, medium 25-32, weak 0). GEMINI_JSON_THINKING=on restores full thinking.
      thinking: opts.thinking ?? (process.env.GEMINI_JSON_THINKING === "on" ? "default" : "minimal"),
    });
    try {
      return opts.schema.parse(extractJson(raw));
    } catch (e) {
      lastError = e instanceof Error ? e.message.slice(0, 300) : "parse error";
    }
  }
  throw new Error(`Model response failed validation: ${lastError}`);
}
