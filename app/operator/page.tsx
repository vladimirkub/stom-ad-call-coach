"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { createAmbience, type Ambience } from "@/lib/ambience";
import { startSessionFast } from "@/lib/voice";
import type { Turn } from "@/lib/schemas";
import { Panel, PageHeader, Shell } from "../ui";
import { CallBar, MicButton, Status } from "../call-ui";
import { Phone, Play, Spark, Stop } from "../icons";

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
      // The expressive voice may carry audio tags like "[warmly]": they shape the voice, not the transcript.
      const text = (role === "agent" ? message?.replace(/\[[^\]\n]{1,30}\]\s*/g, "") : message)?.trim();
      if (text) setLines((l) => [...l, { who: role === "agent" ? "operator" : "patient", text }]);
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
      // The operator may have already hung up; ending a session that is gone throws.
      if (conversation.status === "connected") await conversation.endSession();
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
  // After a hang-up (either side) the mic is gone: only "get the breakdown" remains.
  const voiceUp = conversation.status === "connected";

  return (
    <Shell>
      <PageHeader eyebrow="Режим 2 · вы пациент" title="Виртуальный оператор звонит вам">
        Вы пациент, оставивший заявку на сайте клиники. Сценария нет: выдумывайте любые запросы, вопросы и возражения, как в жизни. Можете согласиться, сомневаться, торговаться, отказаться или уйти от темы. Оператор о вас ничего не знает и подстраивается по ходу разговора.
      </PageHeader>

      <Panel delay={100} innerClassName="flex flex-wrap items-center gap-x-4 gap-y-3 p-4 text-sm">
        <label className="flex cursor-pointer items-center gap-2.5">
          <input type="checkbox" checked={ambOn} onChange={(e) => setAmbOn(e.target.checked)} className="peer sr-only" />
          <span className="relative h-5 w-9 rounded-full bg-white/10 transition peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-accent after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-slate-100 after:transition peer-checked:after:translate-x-4" />
          <span className="font-medium text-slate-200">Фон колл-центра</span>
        </label>
        <input type="range" min={0} max={1} step={0.05} value={ambVol} onChange={(e) => setAmbVol(Number(e.target.value))} aria-label="Громкость фона" className="w-32 accent-[var(--color-accent)] disabled:opacity-40" disabled={!ambOn && !ambTest} />
        {!live && (
          <button onClick={() => setAmbTest((v) => !v)} className="btn btn-ghost px-3 py-1.5 text-xs" data-state={ambTest ? "playing" : "idle"}>
            {ambTest ? <Stop className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {ambTest ? "Остановить" : "Послушать фон"}
          </button>
        )}
        <span className="basis-full text-xs text-slate-500">Звучит только у вас. Лучше в наушниках, иначе микрофон услышит шум.</span>
      </Panel>

      {error && <div role="alert" className="alert alert-error mt-3">{error}</div>}

      {!live && !finishing && (
        <button onClick={accept} disabled={busy} className="rise btn btn-primary group/btn mt-5 justify-between py-1.5 pr-1.5 pl-6" style={{ animationDelay: "160ms" }}>
          {busy ? "Оператор набирает номер…" : "Принять звонок"}
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-950/10 transition duration-500 group-hover/btn:scale-105"><Phone className="h-4 w-4" /></span>
        </button>
      )}
      {applied !== null && live && (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
          <Spark className="h-3.5 w-3.5 text-accent" />
          {applied > 0 ? `Оператор использует ${applied} практик из базы знаний.` : "База знаний пока пуста: оператор работает по базовой инструкции."}
        </p>
      )}

      <section aria-label="Транскрипт" className="mt-4 flex min-h-48 flex-1 flex-col gap-2.5 rounded-3xl bg-ink-900/60 p-4 ring-1 ring-inset ring-white/[0.06]">
        {lines.length === 0 && <p className="m-auto max-w-[40ch] text-center text-sm text-pretty text-slate-500">Здесь появится запись разговора. Оператор заговорит первым.</p>}
        {lines.map((l, i) => (
          <div key={i} className={`flex ${l.who === "patient" ? "justify-end" : "justify-start"}`}>
            <div className={`bubble ${l.who === "patient" ? "bubble-mine" : "bubble-theirs"}`}>
              <span className="bubble-label">{l.who === "patient" ? "Вы, пациент" : "Виртуальный оператор"}</span>
              {l.text}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </section>

      {live && (
        <CallBar>
          <div className="flex items-center gap-3">
            {voiceUp && <MicButton on={micOn} onToggle={() => conversation.setMuted(micOn)} />}
            <Status live={voiceUp && (conversation.isSpeaking || micOn)}>
              {!voiceUp
                ? finishing
                  ? "Звонок завершён, разбираем…"
                  : "Звонок завершён. Получите разбор разговора."
                : conversation.isSpeaking
                  ? "Оператор говорит…"
                  : micOn
                    ? "Микрофон включён: отвечайте"
                    : "Микрофон выключен: нажмите, чтобы говорить"}
            </Status>
            <button onClick={finish} disabled={finishing} className="btn btn-light shrink-0">
              {finishing ? "Разбираем… 30–60 с" : voiceUp ? "Завершить звонок" : "Получить разбор"}
            </button>
          </div>
        </CallBar>
      )}
    </Shell>
  );
}
