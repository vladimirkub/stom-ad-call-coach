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
import { Book, ListCheck, Phone, Target } from "../../icons";
import { CHECKLIST_TOTAL, LiveChecklist, useLiveChecklist } from "../../live-checklist";
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
  const [hungUp, setHungUp] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const add = (turn: Turn) => setTranscript((t) => [...t, turn]);

  const conversation = useConversation({
    onMessage: ({ role, message }) => {
      // Expressive voices may carry audio tags like "[sighs]": they shape the voice, not the transcript.
      const text = (role === "agent" ? message?.replace(/\[[^\]\n]{1,30}\]\s*/g, "") : message)?.trim();
      if (text) add({ role, text });
    },
    onError: (message) => setError(`Ошибка голоса: ${message}`),
    onDisconnect: (details) => {
      if (details.reason === "error") setError(`Голосовое соединение потеряно: ${details.message}`);
      // The patient can end the call herself (end_call tool) when the operator loses her trust.
      if (details.reason === "agent") setHungUp(true);
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
      if (conversation.status !== "connected") return;
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
      if (body.reply) add({ role: "agent", text: body.reply });
      if (body.ended) setHungUp(true);
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
      // The other side may have already hung up; ending a session that is gone throws.
      if (mode === "voice" && conversation.status === "connected") await conversation.endSession();
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
  const { done, checking } = useLiveChecklist(id, transcript, live && !finishing);
  const micOn = !conversation.isMuted;
  const speaking = conversation.isSpeaking;
  // Voice controls only make sense while the voice session is up; after a hang-up only "get the evaluation" remains.
  const voiceUp = mode === "voice" && conversation.status === "connected";
  // The call is over when the voice session is gone or the patient hung up in text mode; only "get the evaluation" remains.
  const callOver = (mode === "voice" && !voiceUp) || (mode === "text" && hungUp);

  return (
    <Shell width="max-w-[1440px]" back={{ href: "/app", label: "Другой пациент" }}>
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
        <Panel delay={100} innerClassName="h-full p-4">
          <p className="text-xs font-medium text-slate-500">Карточка заявки</p>
          <p className="mt-1 text-sm leading-relaxed text-pretty text-slate-300">{context(scenario.lead)}</p>
        </Panel>
        <Panel delay={140} tone="accent" innerClassName="h-full p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-accent"><Target className="h-3.5 w-3.5" />Ваша цель</p>
          <p className="mt-1 text-sm leading-relaxed text-pretty text-slate-300">Вы оператор. Запишите пациента на приём и убедитесь, что он придёт.</p>
        </Panel>
      </div>

      <div className="mt-3 grid flex-1 gap-5 lg:mt-5 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)_minmax(0,17rem)] xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)_minmax(0,21rem)]">
        {/* Desktop: the memo stays open and pinned beside the dialog. Phone: it folds above the dialog. */}
        <aside aria-label="Памятка оператора" className="rise hidden lg:block" style={{ animationDelay: "180ms" }}>
          <div className="bezel sticky top-4">
            <div className="bezel-core max-h-[calc(100dvh-2.6rem)] overflow-y-auto p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-slate-100"><Book className="h-4 w-4 text-accent" />Памятка оператора: что известно о клинике</p>
              <Memo className="mt-3 text-[13px]" />
            </div>
          </div>
        </aside>
        <details className="rise group rounded-2xl bg-white/[0.03] p-4 text-sm ring-1 ring-inset ring-white/[0.06] lg:hidden" style={{ animationDelay: "180ms" }}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium text-slate-200">
            <span className="flex items-center gap-2"><Book className="h-4 w-4 text-slate-500" />Памятка оператора: что известно о клинике</span>
            <span className="text-xs text-slate-500 group-open:hidden">Открыть</span>
            <span className="hidden text-xs text-slate-500 group-open:inline">Свернуть</span>
          </summary>
          <Memo className="mt-3" />
        </details>
        <details className="rise group rounded-2xl bg-white/[0.03] p-4 text-sm ring-1 ring-inset ring-white/[0.06] lg:hidden" style={{ animationDelay: "200ms" }}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium text-slate-200">
            <span className="flex items-center gap-2"><ListCheck className="h-4 w-4 text-slate-500" />Чек-лист звонка <span className="tabular-nums text-slate-500">{done.size}/{CHECKLIST_TOTAL}</span></span>
            <span className="text-xs text-slate-500 group-open:hidden">Открыть</span>
            <span className="hidden text-xs text-slate-500 group-open:inline">Свернуть</span>
          </summary>
          <LiveChecklist done={done} checking={checking} className="mt-3" />
        </details>

        <div className="flex min-w-0 flex-col">
          {error && <div role="alert" className="alert alert-error mb-3">{error}</div>}

          {!live && (
            <div className="rise mb-4 flex flex-col gap-2.5 sm:flex-row" style={{ animationDelay: "220ms" }}>
              <button onClick={startVoice} disabled={busy} className="btn btn-primary group/btn py-1.5 pr-1.5 pl-6 sm:flex-1 sm:justify-between">
                {busy ? "Набираем номер…" : "Позвонить пациенту голосом"}
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-950/10 transition duration-500 group-hover/btn:scale-105"><Phone className="h-4 w-4" /></span>
              </button>
              <button onClick={startText} className="btn btn-ghost">Текстовый режим</button>
            </div>
          )}

          <section aria-label="Транскрипт" className="flex min-h-64 flex-1 flex-col gap-2.5 rounded-3xl bg-ink-900/60 p-4 ring-1 ring-inset ring-white/[0.06]">
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
            <CallBar inset>
              <div className="flex items-center gap-3">
                {voiceUp && <MicButton on={micOn} onToggle={() => conversation.setMuted(micOn)} />}
                <Status live={voiceUp && (speaking || micOn)}>
                  {callOver
                    ? finishing
                      ? "Звонок завершён, оцениваем…"
                      : hungUp
                        ? "Пациент завершил звонок. Получите оценку разговора."
                        : "Звонок завершён. Получите оценку разговора."
                    : mode === "voice"
                      ? speaking
                        ? `${scenario.short} говорит…`
                        : micOn
                          ? "Микрофон включён: говорите"
                          : "Микрофон выключен: нажмите, чтобы говорить"
                      : "Текстовый режим"}
                </Status>
                <button onClick={finish} disabled={finishing} className="btn btn-light shrink-0">
                  {finishing ? "Оцениваем… 30–60 с" : callOver ? "Получить оценку" : "Завершить звонок"}
                </button>
              </div>
              {!callOver && (
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
              )}
            </CallBar>
          )}
        </div>

        <aside aria-label="Чек-лист звонка" className="rise hidden lg:block" style={{ animationDelay: "200ms" }}>
          <div className="bezel sticky top-4">
            <div className="bezel-core max-h-[calc(100dvh-2.6rem)] overflow-y-auto p-4">
              <p className="flex items-center justify-between gap-3 text-sm font-medium text-slate-100">
                <span className="flex items-center gap-2"><ListCheck className="h-4 w-4 text-accent" />Чек-лист звонка</span>
                <span className="tabular-nums text-slate-400">{done.size}/{CHECKLIST_TOTAL}</span>
              </p>
              <div className="mt-2.5 h-1 rounded-full bg-white/[0.06]">
                <div className="h-1 rounded-full bg-accent transition-[width] duration-700 ease-[var(--ease-spring)]" style={{ width: `${(done.size / CHECKLIST_TOTAL) * 100}%` }} />
              </div>
              <LiveChecklist done={done} checking={checking} className="mt-4" />
            </div>
          </div>
        </aside>
      </div>
    </Shell>
  );
}

function Memo({ className = "" }: { className?: string }) {
  return (
    <ul className={`space-y-2 text-slate-300 ${className}`}>
      {clinic.memo.map((m, i) => (
        <li key={i} className="flex gap-2.5 leading-relaxed"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent/70" />{m}</li>
      ))}
    </ul>
  );
}
