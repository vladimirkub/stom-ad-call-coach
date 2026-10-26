"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import scenarios from "@/lib/scenarios-public.json";
import clinic from "@/lib/clinic.json";
import { startSessionFast } from "@/lib/voice";
import type { Turn } from "@/lib/schemas";

type Mode = "idle" | "voice" | "text";

export default function Challenge({ id }: { id: string }) {
  return (
    <ConversationProvider>
      <Call id={id} />
    </ConversationProvider>
  );
}

function Call({ id }: { id: string }) {
  const scenario = scenarios.find((s) => s.id === id)!;
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idle");
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const add = (turn: Turn) => setTranscript((t) => [...t, turn]);

  const conversation = useConversation({
    onMessage: ({ role, message }) => {
      if (message?.trim()) add({ role, text: message.trim() });
    },
    onError: (message) => setError(`Ошибка голоса: ${message}`),
    onDisconnect: (details) => {
      if (details.reason === "error") setError(`Голосовое соединение потеряно: ${details.message}`);
    },
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  async function startVoice() {
    setError(null);
    setBusy(true);
    try {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        throw new Error("Нет доступа к микрофону. Разрешите его в настройках браузера или используйте текстовый режим.");
      }
      const res = await fetch(`/api/signed-url?scenario=${id}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Не удалось начать голосовую сессию");
      await startSessionFast(conversation, body);
      setMode("voice");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось запустить голос");
    } finally {
      setBusy(false);
    }
  }

  function startText() {
    setError(null);
    setTranscript([{ role: "agent", text: scenario.firstMessage }]);
    setMode("text");
  }

  async function sendText() {
    const text = draft.trim();
    if (!text || busy) return;
    const next: Turn[] = [...transcript, { role: "user", text }];
    setTranscript(next);
    setDraft("");
    setError(null);
    if (mode === "voice") {
      conversation.sendUserMessage(text);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId: id, transcript: next }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Пациент не смог ответить");
      add({ role: "agent", text: body.reply });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка чата");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setError(null);
    setFinishing(true);
    try {
      if (mode === "voice") await conversation.endSession();
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId: id, transcript }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Не удалось оценить сессию");
      sessionStorage.setItem("dealbreaker:result", JSON.stringify({ id: crypto.randomUUID(), result: body, transcript, patient: scenario.short, scenarioId: id }));
      router.push("/results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось оценить сессию");
      setFinishing(false);
    }
  }

  const live = mode !== "idle";
  const micOn = !conversation.isMuted;
  const speaking = conversation.isSpeaking;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 px-4 py-6">
      <header>
        <Link href="/app" className="text-xs text-slate-500 hover:text-slate-300">← Выбрать другого пациента</Link>
        <h1 className="mt-1 text-2xl font-bold">{scenario.title}</h1>
        <p className="text-sm text-slate-400">Карточка заявки: {scenario.lead}</p>
        <p className="mt-1 text-sm text-slate-500">Вы — оператор колл-центра. Цель: записать пациента на приём и убедиться, что он придёт.</p>
      </header>

      <details className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
        <summary className="cursor-pointer font-medium">Памятка оператора: что известно о клинике</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300">
          {clinic.memo.map((m, i) => <li key={i}>{m}</li>)}
        </ul>
      </details>

      {error && (
        <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {!live ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-5">
          <button
            onClick={startVoice}
            disabled={busy}
            className="rounded-xl bg-amber-400 px-5 py-3 font-semibold text-black disabled:opacity-50"
          >
            {busy ? "Набираем…" : "📞 Позвонить пациенту голосом"}
          </button>
          <button onClick={startText} className="rounded-xl border border-white/20 px-5 py-3 text-slate-200">
            Текстовый режим
          </button>
        </div>
      ) : null}

      <section aria-label="Транскрипт" className="flex-1 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-black/30 p-4">
        {transcript.length === 0 && <p className="text-sm text-slate-500">Здесь появится транскрипт звонка. Пациент возьмёт трубку первым, а вы представляетесь.</p>}
        {transcript.map((t, i) => (
          <div key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${t.role === "user" ? "bg-amber-400 text-black" : "bg-white/10"}`}>
              <span className="mb-0.5 block text-[10px] font-semibold uppercase opacity-60">{t.role === "user" ? "Вы (оператор)" : scenario.short}</span>
              {t.text}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </section>

      {live && (
        <div className="sticky bottom-0 -mx-4 mt-auto flex flex-col gap-3 border-t border-white/10 bg-[#0b0d12]/95 px-4 pb-4 pt-3 backdrop-blur">
          <div className="flex items-center gap-3">
            {mode === "voice" && (
              <button
                onClick={() => conversation.setMuted(micOn)}
                aria-pressed={micOn}
                aria-label={micOn ? "Выключить микрофон" : "Включить микрофон"}
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl transition ${
                  micOn ? "animate-pulse bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]" : "bg-slate-700 text-slate-300"
                }`}
              >
                {micOn ? "🎙" : "🔇"}
              </button>
            )}
            <span className="min-w-0 flex-1 text-sm text-slate-300">
              {mode === "voice"
                ? speaking
                  ? `🔊 ${scenario.short} говорит…`
                  : micOn
                    ? "Микрофон включён: говорите"
                    : "Микрофон выключен: нажмите, чтобы говорить"
                : "⌨ Текстовый режим"}
            </span>
            <button onClick={finish} disabled={finishing} className="shrink-0 rounded-xl bg-white px-4 py-3 font-semibold text-black disabled:opacity-50">
              {finishing ? "Оцениваем… 30–60 с" : "Завершить звонок"}
            </button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendText();
            }}
            className="flex gap-2"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={mode === "voice" ? "Или напишите сообщение…" : "Напишите реплику оператора…"}
              className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3 outline-none focus:border-amber-400"
            />
            <button disabled={busy || !draft.trim()} className="rounded-xl bg-amber-400 px-5 font-semibold text-black disabled:opacity-40">
              Отправить
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
