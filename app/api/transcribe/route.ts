import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/ratelimit";
import { SttError, transcribe } from "@/lib/stt";

const MAX_BYTES = 50 * 1024 * 1024;
const AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|webm|mp4|aiff?|amr)$/i;

export async function POST(req: Request) {
  const limited = rateLimit(req, "stt", 10);
  if (limited) return limited;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Выберите аудиофайл" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Файл больше 50 МБ" }, { status: 413 });
  if (!file.type.startsWith("audio/") && !file.type.startsWith("video/") && !AUDIO_EXT.test(file.name)) {
    return NextResponse.json({ error: "Нужен аудиофайл (mp3, wav, m4a, ogg…)" }, { status: 415 });
  }
  try {
    return NextResponse.json(await transcribe({ file }));
  } catch (e) {
    console.error("[transcribe]", e);
    const status = e instanceof SttError ? e.status : 502;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Не удалось расшифровать запись" }, { status });
  }
}
