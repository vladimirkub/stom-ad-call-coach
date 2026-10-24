// ElevenLabs Speech-to-Text (Scribe v2). Docs: POST /v1/speech-to-text, multipart, exactly one of file / cloud_storage_url.
import { groupBySpeaker, type SpokenTurn } from "./parse.ts";

export class SttError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type Transcription = { turns: SpokenTurn[]; speakers: string[]; durationSec: number };

export async function transcribe(input: { file: File } | { url: string }): Promise<Transcription> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new SttError("ELEVENLABS_API_KEY не настроен на сервере", 503);

  const form = new FormData();
  form.set("model_id", "scribe_v2");
  form.set("language_code", "ru");
  form.set("diarize", "true");
  form.set("tag_audio_events", "false");
  if ("file" in input) form.set("file", input.file, input.file.name || "call");
  else form.set("cloud_storage_url", input.url);

  let res: Response;
  try {
    res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": apiKey }, body: form });
  } catch {
    throw new SttError("Не удалось связаться с ElevenLabs", 502);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && /permission/i.test(JSON.stringify(body))) {
      throw new SttError('У ключа ElevenLabs нет разрешения «Speech to Text». Включите его для ключа в настройках ElevenLabs (Developers → API Keys) и повторите.', 403);
    }
    const detail = body?.detail?.message ?? body?.detail ?? "";
    const hint = "url" in input ? " Возможно, ссылка на запись из CRM требует авторизации: скачайте файл и загрузите его вручную." : "";
    throw new SttError(`Не удалось расшифровать запись (${res.status}${typeof detail === "string" && detail ? `: ${detail}` : ""}).${hint}`, 502);
  }
  const turns = groupBySpeaker(body.words, body.text ?? "");
  if (!turns.length) throw new SttError("В записи не удалось распознать речь", 422);
  const words: { end?: number }[] = body.words ?? [];
  return {
    turns,
    speakers: [...new Set(turns.map((t) => t.speaker))],
    durationSec: Math.round(words.reduce((m, w) => Math.max(m, w.end ?? 0), 0)),
  };
}
