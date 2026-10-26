"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { createAmbience, type Ambience } from "@/lib/ambience";
import { startSessionFast } from "@/lib/voice";
import type { Turn } from "@/lib/schemas";

export default function OperatorPage() {
  return (
    <ConversationProvider>
      <Call />
    </ConversationProvider>
  );
}

// Here the AI is the operator and the human is the patient: onMessage role "agent" = operator, "user" = patient.
type Line = { who: "operator" | "patient"; text: string };

function Call() {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([]);
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [applied, setApplied] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Call-center background: it plays for the human's ears only and stops with the call.
  const [ambOn, setAmbOn] = useState(true);
  const [ambVol, setAmbVol] = useState(0.4);
  const [ambTest, setAmbTest] = useState(false);
  const amb = useRef<Ambience | null>(null);

  const conversation = useConversation({
    onMessage: ({ role, message }) => {
      if (message?.trim()) setLines((l) => [...l, { who: role === "agent" ? "operator" : "patient", text: message.trim() }]);
    },
    onError: (message) => setError(`Ошибка голоса: ${message}`),
    onDisconnect: (details) => {
      if (details.reason === "error") setError(`Голосовое соединение потеряно: ${details.message}`);
    },
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const ambActive = (live && !finishing && ambOn) || ambTest;
  useEffect(() => {
    if (!ambActive) return;
    const a = createAmbience();
    a.setVolume(ambVol);
    a.start();
    amb.current = a;
    return () => {
      a.stop();
      amb.current = null;
    };
    // The volume is applied by the effect below, without restarting the sound.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambActive]);
  useEffect(() => {
    amb.current?.setVolume(ambVol);
  }, [ambVol]);

  async function accept() {
    setError(null);
    setBusy(true);
    try {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        throw new Error("Нет доступа к микрофону. Разрешите его в настройках браузера и повторите.");
      }
      const res = await fetch("/api/operator/start", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Не удалось начать звонок");
      setApplied(body.practicesApplied ?? 0);
      await startSessionFast(conversation, body);
      setLive(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось начать звонок");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setError(null);
    setFinishing(true);
    try {
      await conversation.endSession();
      // The evaluator expects the operator as "user" and the patient as "agent".
      const transcript: Turn[] = lines.map((l) => ({ role: l.who === "operator" ? "user" : "agent", text: l.text }));
      const res = await fetch("/api/evaluate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scenarioId: "real", transcript }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Не удалось оценить звонок");
      sessionStorage.setItem("dealbreaker:result", JSON.stringify({ id: crypto.randomUUID(), result: body, transcript, patient: "Вы (пациент)", scenarioId: "real", mode: "virtual" }));
      router.push("/results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось оценить звонок");
      setFinishing(false);
    }
  }

  const micOn = !conversation.isMuted;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 px-4 py-6">
      <header>
        <Link href="/app" className="text-xs text-slate-500 hover:text-slate-300">← На главную</Link>
        <h1 className="mt-1 text-2xl font-bold">Виртуальный оператор звонит вам</h1>
        <p className="text-sm text-slate-400">
          Вы — пациент, оставивший заявку на сайте клиники. Сценария нет: выдумывайте любые запросы, вопросы и возражения, как в жизни. Можете согласиться, сомневаться, торговаться, отказаться или уйти от темы. Оператор о вас ничего не знает и подстраивается по ходу разговора.
        </p>
      </header>

      <section className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={ambOn} onChange={(e) => setAmbOn(e.target.checked)} />
          <span>Фон колл-центра</span>
        </label>
        <input type="range" min={0} max={1} step={0.05} value={ambVol} onChange={(e) => setAmbVol(Number(e.target.value))} aria-label="Громкость фона" className="w-32" disabled={!ambOn && !ambTest} />
        {!live && (
          <button onClick={() => setAmbTest((v) => !v)} className="rounded-lg border border-white/20 px-3 py-1 text-xs" data-state={ambTest ? "playing" : "idle"}>
            {ambTest ? "⏹ Остановить" : "▶ Послушать фон"}
          </button>
        )}
        <span className="text-xs text-slate-500">Звучит только у вас. Лучше в наушниках, иначе микрофон услышит шум.</span>
      </section>

      {error && <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

      {!live && !finishing && (
        <button onClick={accept} disabled={busy} className="rounded-xl bg-emerald-400 px-5 py-3 font-semibold text-black disabled:opacity-50">
          {busy ? "Оператор набирает номер…" : "📞 Принять звонок"}
        </button>
      )}
      {applied !== null && live && (
        <p className="text-xs text-slate-500">{applied > 0 ? `Оператор использует ${applied} практик из базы знаний.` : "База знаний пока пуста: оператор работает по базовой инструкции."}</p>
      )}

      <section aria-label="Транскрипт" className="flex-1 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-black/30 p-4">
        {lines.length === 0 && <p className="text-sm text-slate-500">Здесь появится запись разговора. Оператор заговорит первым.</p>}
        {lines.map((l, i) => (
          <div key={i} className={`flex ${l.who === "patient" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${l.who === "patient" ? "bg-amber-400 text-black" : "bg-emerald-400/20"}`}>
              <span className="mb-0.5 block text-[10px] font-semibold uppercase opacity-60">{l.who === "patient" ? "Вы (пациент)" : "Виртуальный оператор"}</span>
              {l.text}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </section>

      {live && (
        <div className="sticky bottom-0 -mx-4 mt-auto flex items-center gap-3 border-t border-white/10 bg-[#0b0d12]/95 px-4 pb-4 pt-3 backdrop-blur">
          <button
            onClick={() => conversation.setMuted(micOn)}
            aria-pressed={micOn}
            aria-label={micOn ? "Выключить микрофон" : "Включить микрофон"}
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl transition ${micOn ? "animate-pulse bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]" : "bg-slate-700 text-slate-300"}`}
          >
            {micOn ? "🎙" : "🔇"}
          </button>
          <span className="min-w-0 flex-1 text-sm text-slate-300">
            {conversation.isSpeaking ? "🔊 Оператор говорит…" : micOn ? "Микрофон включён: отвечайте" : "Микрофон выключен: нажмите, чтобы говорить"}
          </span>
          <button onClick={finish} disabled={finishing} className="shrink-0 rounded-xl bg-white px-4 py-3 font-semibold text-black disabled:opacity-50">
            {finishing ? "Разбираем… 30–60 с" : "Завершить звонок"}
          </button>
        </div>
      )}
    </main>
  );
}
