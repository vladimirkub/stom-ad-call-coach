"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import scenarios from "@/lib/scenarios-public.json";
import clinic from "@/lib/clinic.json";
import { startSessionFast } from "@/lib/voice";
import type { Turn } from "@/lib/schemas";
import { Shell, Panel } from "../../ui";
import { CallBar, MicButton, Status } from "../../call-ui";
import { Book, Phone, Target } from "../../icons";
import { context, initials, quote, years } from "../../patient-grid";

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
    <Shell back={{ href: "/app", label: "Другой пациент" }}>
      <header className="rise mt-8 mb-5 flex items-start gap-4" style={{ animationDelay: "60ms" }}>
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-lg font-semibold tracking-tight text-slate-100 ring-1 ring-white/10">
          {initials(scenario.name)}
        </span>
        <div className="min-w-0">
          <p className="eyebrow">{scenario.short}, {years(scenario.age)} · {scenario.tag}</p>
          <h1 className="mt-1 text-3xl font-semibold leading-[1.08] tracking-[-0.03em] text-balance sm:text-4xl">{quote(scenario.title)}</h1>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
        <Panel delay={100} innerClassName="p-4">
          <p className="text-xs font-medium text-slate-500">Карточка заявки</p>
          <p className="mt-1 text-sm leading-relaxed text-pretty text-slate-300">{context(scenario.lead)}</p>
        </Panel>
        <Panel delay={140} tone="accent" innerClassName="p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-accent"><Target className="h-3.5 w-3.5" />Ваша цель</p>
          <p className="mt-1 text-sm leading-relaxed text-pretty text-slate-300">Вы оператор. Запишите пациента на приём и убедитесь, что он придёт.</p>
        </Panel>
      </div>

      <details className="rise group mt-3 rounded-2xl bg-white/[0.03] p-4 text-sm ring-1 ring-inset ring-white/[0.06]" style={{ animationDelay: "180ms" }}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium text-slate-200">
          <span className="flex items-center gap-2"><Book className="h-4 w-4 text-slate-500" />Памятка оператора: что известно о клинике</span>
          <span className="text-xs text-slate-500 group-open:hidden">Открыть</span>
          <span className="hidden text-xs text-slate-500 group-open:inline">Свернуть</span>
        </summary>
        <ul className="mt-3 space-y-2 text-slate-300">
          {clinic.memo.map((m, i) => (
            <li key={i} className="flex gap-2.5 leading-relaxed"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent/70" />{m}</li>
          ))}
        </ul>
      </details>

      {error && <div role="alert" className="alert alert-error mt-3">{error}</div>}

      {!live && (
        <div className="rise mt-5 flex flex-col gap-2.5 sm:flex-row" style={{ animationDelay: "220ms" }}>
          <button onClick={startVoice} disabled={busy} className="btn btn-primary group/btn py-1.5 pr-1.5 pl-6 sm:flex-1 sm:justify-between">
            {busy ? "Набираем номер…" : "Позвонить пациенту голосом"}
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-950/10 transition duration-500 group-hover/btn:scale-105"><Phone className="h-4 w-4" /></span>
          </button>
          <button onClick={startText} className="btn btn-ghost">Текстовый режим</button>
        </div>
      )}

      <section aria-label="Транскрипт" className="mt-5 flex min-h-48 flex-1 flex-col gap-2.5 rounded-3xl bg-ink-900/60 p-4 ring-1 ring-inset ring-white/[0.06]">
        {transcript.length === 0 && (
          <p className="m-auto max-w-[40ch] text-center text-sm text-pretty text-slate-500">Здесь появится транскрипт звонка. Пациент возьмёт трубку первым, а вы представляетесь.</p>
        )}
        {transcript.map((t, i) => (
          <div key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`bubble ${t.role === "user" ? "bubble-mine" : "bubble-theirs"}`}>
              <span className="bubble-label">{t.role === "user" ? "Вы, оператор" : scenario.short}</span>
              {t.text}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </section>

      {live && (
        <CallBar>
          <div className="flex items-center gap-3">
            {mode === "voice" && <MicButton on={micOn} onToggle={() => conversation.setMuted(micOn)} />}
            <Status live={mode === "voice" && (speaking || micOn)}>
              {mode === "voice"
                ? speaking
                  ? `${scenario.short} говорит…`
                  : micOn
                    ? "Микрофон включён: говорите"
                    : "Микрофон выключен: нажмите, чтобы говорить"
                : "Текстовый режим"}
            </Status>
            <button onClick={finish} disabled={finishing} className="btn btn-light shrink-0">
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
              className="field min-w-0 flex-1 rounded-full px-5 py-3"
            />
            <button disabled={busy || !draft.trim()} className="btn btn-primary">Отправить</button>
          </form>
        </CallBar>
      )}
    </Shell>
  );
}
