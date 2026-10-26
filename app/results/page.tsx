"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SKILLS } from "@/lib/scoring";
import { addEntry, type HistoryEntry } from "@/lib/history";
import type { EvaluationResult, ModelScript, Turn } from "@/lib/schemas";

type Saved = {
  id?: string;
  result: EvaluationResult;
  transcript: Turn[];
  patient: string;
  scenarioId?: string;
  modelScript?: ModelScript;
  mode?: "virtual";
  learn?: { added: number; reinforced: number; total: number; skipped?: string };
};

export default function Results() {
  const [data, setData] = useState<Saved | null | undefined>(undefined);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [learning, setLearning] = useState(false);
  const [learnError, setLearnError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("dealbreaker:result");
      let saved: Saved | null = raw ? JSON.parse(raw) : null;
      // Sessions saved by older versions lack the checklist format: treat them as missing.
      const r = saved?.result;
      if (saved && !(r && Array.isArray(r.checklist) && Array.isArray(r.moments) && r.scores && Array.isArray(saved.transcript))) saved = null;
      setData(saved);
      if (saved?.id && saved.scenarioId && saved.scenarioId !== "real" && saved.mode !== "virtual") {
        setHistory(
          addEntry({
            id: saved.id,
            ts: Date.now(),
            scenarioId: saved.scenarioId,
            patient: saved.patient,
            total: saved.result.total,
            scores: saved.result.scores,
            appointmentBooked: saved.result.appointmentBooked,
          }),
        );
      }
    } catch {
      setData(null);
    }
  }, []);

  async function learn(saved: Saved) {
    setLearning(true);
    setLearnError(null);
    try {
      const res = await fetch("/api/knowledge/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: saved.transcript, result: saved.result }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Не удалось обновить базу знаний");
      const next = { ...saved, learn: body };
      setData(next);
      try {
        sessionStorage.setItem("dealbreaker:result", JSON.stringify(next));
      } catch {}
    } catch (e) {
      setLearnError(e instanceof Error ? e.message : "Не удалось обновить базу знаний");
    } finally {
      setLearning(false);
    }
  }

  // A virtual-operator call teaches the shared knowledge base once, right after the breakdown is shown.
  useEffect(() => {
    if (data && data.mode === "virtual" && !data.learn && !learning && !learnError) void learn(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  async function loadScript() {
    if (!data?.scenarioId) return;
    setLoading(true);
    setScriptError(null);
    try {
      const res = await fetch("/api/model-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioId: data.scenarioId,
          transcript: data.transcript,
          scores: data.result.scores,
          strengths: data.result.strengths,
          improvements: data.result.improvements,
          objectionUncovered: data.result.objectionUncovered,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Не удалось составить эталон");
      const next = { ...data, modelScript: body as ModelScript };
      setData(next);
      try {
        sessionStorage.setItem("dealbreaker:result", JSON.stringify(next));
      } catch {}
    } catch (e) {
      setScriptError(e instanceof Error ? e.message : "Не удалось составить эталон");
    } finally {
      setLoading(false);
    }
  }

  if (data === undefined) return null;
  if (!data) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-16">
        <p className="mb-4">Сессия не найдена.</p>
        <Link href="/app" className="text-amber-400 underline">Выбрать пациента</Link>
      </main>
    );
  }
  const { result } = data;
  const real = data.scenarioId === "real";
  const virtual = data.mode === "virtual";
  const momentByTurn = new Map(result.moments.map((m) => [m.turn, m]));
  const attempts = history.filter((h) => h.scenarioId === data.scenarioId);
  const prev = attempts.length > 1 ? attempts[attempts.length - 2] : null;
  const delta = prev ? result.total - prev.total : null;

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        <p className="text-sm uppercase tracking-widest text-slate-400">{virtual ? "Оценка виртуального оператора" : real ? "Оценка реального звонка" : "Итоговый балл"}</p>
        <p className="text-7xl font-bold text-amber-400">{result.total}<span className="text-2xl text-slate-500">/100</span></p>
        {!virtual && delta !== null && (
          <p className={`mt-1 text-sm font-semibold ${delta >= 0 ? "text-emerald-300" : "text-red-300"}`}>
            {delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ ${delta}` : "без изменений"} к прошлой попытке с этим пациентом
          </p>
        )}
        <p className={`mt-3 inline-block rounded-full px-3 py-1 text-sm font-semibold ${result.appointmentBooked ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
          {result.appointmentBooked ? "✅ Запись на приём оформлена" : "❌ Запись не оформлена"}
        </p>
        <p className="mt-3 text-slate-300">{result.summary}</p>
      </section>

      <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
        {SKILLS.map((s) => {
          const items = result.checklist.filter((c) => c.skill === s.key);
          return (
            <div key={s.key}>
              <div className="flex justify-between text-sm">
                <span className="font-medium">{s.label} <span className="text-slate-500">· {Math.round(s.weight * 100)}%</span></span>
                <span>{result.scores[s.key]}/10</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-white/10">
                <div className="h-2 rounded-full bg-amber-400" style={{ width: `${result.scores[s.key] * 10}%` }} />
              </div>
              <details className="mt-1 text-sm">
                <summary className="cursor-pointer text-xs text-slate-500">
                  Критерии: {items.filter((i) => i.done).length} из {items.length}
                </summary>
                <ul className="mt-2 space-y-1.5">
                  {items.map((c) => (
                    <li key={c.id} className="flex gap-2 text-slate-300">
                      <span>{c.done ? "✅" : "⬜"}</span>
                      <span>
                        {c.label}
                        {c.evidence && <span className="block text-xs text-slate-500">{c.evidence}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          );
        })}
      </section>

      {attempts.length > 1 && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="mb-3 text-lg font-semibold">📈 Ваш прогресс с этим пациентом</h2>
          <div className="flex h-24 items-end gap-1.5">
            {attempts.slice(-10).map((a, i, arr) => (
              <div key={a.id} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${a.total}/100`}>
                <span className="text-[10px] text-slate-400">{a.total}</span>
                <div className={`w-full rounded-t ${i === arr.length - 1 ? "bg-amber-400" : "bg-white/25"}`} style={{ height: `${Math.max(a.total, 3)}%` }} />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">Последние попытки слева направо, текущая выделена. Данные хранятся только в этом браузере.</p>
        </section>
      )}

      {!real && result.hiddenObjection && (
        <section className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-5">
          <h2 className="text-lg font-semibold">🔓 Скрытая причина сомнений</h2>
          <p className="mt-2 text-slate-200">{result.hiddenObjection}</p>
          <p className="mt-3 text-sm">
            <strong>{result.objectionUncovered ? (virtual ? "✅ Оператор её раскрыл." : "✅ Вы её раскрыли.") : (virtual ? "❌ Оператор её не раскрыл." : "❌ Вы её не раскрыли.")}</strong>{" "}
            {result.objectionEvidence && <span className="text-slate-400">{result.objectionEvidence}</span>}
          </p>
        </section>
      )}

      {!real && result.showUpRisk && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold">🚪 Риск неявки</h2>
          <p className="mt-2 text-sm text-slate-300">{result.showUpRisk}</p>
        </section>
      )}

      {result.unsupportedClaims.length > 0 && (
        <section className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
          <h2 className="text-lg font-semibold text-red-300">⚠ Утверждения, которых нет на сайте</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">{result.unsupportedClaims.map((c, i) => <li key={i}>{c}</li>)}</ul>
          {real && <p className="mt-3 text-xs text-slate-500">Звонок оценён по расшифровке: числа и названия могли быть распознаны неточно. Сверьте со звуком, прежде чем делать выводы по оператору.</p>}
        </section>
      )}

      {result.moments.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="mb-3 text-lg font-semibold">🎯 Ключевые моменты звонка</h2>
          <ul className="space-y-3">
            {[...result.moments].sort((a, b) => a.turn - b.turn).map((m, i) => (
              <li key={i} className={`rounded-xl border-l-4 bg-black/20 p-3 text-sm ${m.kind === "good" ? "border-emerald-400" : "border-red-400"}`}>
                <p className="text-xs text-slate-500">Реплика №{m.turn}</p>
                <p className="mt-0.5 italic text-slate-300">«{data.transcript[m.turn - 1]?.text}»</p>
                <p className={`mt-1 ${m.kind === "good" ? "text-emerald-300" : "text-red-300"}`}>{m.kind === "good" ? "✅" : "⚠"} {m.comment}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="mb-2 font-semibold text-emerald-300">Что получилось</h2>
          {result.strengths.length ? <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">{result.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul> : <p className="text-sm text-slate-500">Сильных сторон в этом звонке не найдено.</p>}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="mb-2 font-semibold text-sky-300">{virtual ? "Рекомендации оператору" : "Что сделать в следующий раз"}</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">{result.improvements.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      </section>

      {!real && (
        <section className="rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-5">
          <h2 className="text-lg font-semibold text-emerald-300">🎓 Как это сделал бы сильный оператор</h2>
          {!data.modelScript ? (
            <>
              <p className="mt-2 text-sm text-slate-300">
                Получите эталонный разговор с этим пациентом: с пояснениями, почему каждая фраза работает, и сравнением с вашими фразами.
              </p>
              {scriptError && <p role="alert" className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{scriptError}</p>}
              <button
                onClick={loadScript}
                disabled={loading || !data.scenarioId}
                className="mt-4 rounded-xl bg-emerald-400 px-5 py-3 font-semibold text-black disabled:opacity-50"
              >
                {loading ? "Составляем эталон… это займёт около минуты" : scriptError ? "Попробовать ещё раз" : "Показать эталонный разговор"}
              </button>
              {!data.scenarioId && <p className="mt-2 text-xs text-slate-500">Пройдите новый звонок, чтобы получить эталон.</p>}
            </>
          ) : (
            <div className="mt-3 space-y-5">
              <p className="text-sm text-slate-300">{data.modelScript.intro}</p>
              <div className="space-y-3">
                {data.modelScript.dialogue.map((d, i) => (
                  <div key={i} className={`flex ${d.role === "operator" ? "justify-end" : "justify-start"}`}>
                    <div className="max-w-[88%]">
                      <div className={`rounded-2xl px-4 py-2 text-sm ${d.role === "operator" ? "bg-emerald-400 text-black" : "bg-white/10"}`}>
                        <span className="mb-0.5 block text-[10px] font-semibold uppercase opacity-60">{d.role === "operator" ? "Эталонный оператор" : data.patient}</span>
                        {d.text}
                      </div>
                      {d.role === "operator" && d.tip && <p className="mt-1 pl-2 text-xs text-emerald-300">💡 {d.tip}</p>}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500">Это пример от ИИ на основе фактов сайта. Реплики пациента смоделированы: живой человек может ответить иначе.</p>
              {data.modelScript.comparisons.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold">Было → Стало</h3>
                  {data.modelScript.comparisons.map((c, i) => (
                    <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
                      <p className="text-red-300">Вы: «{c.yours}»</p>
                      <p className="mt-1 text-emerald-300">Лучше: «{c.better}»</p>
                      <p className="mt-1 text-xs text-slate-400">{c.why}</p>
                    </div>
                  ))}
                </div>
              )}
              <div>
                <h3 className="mb-1 font-semibold">Фразы, которые стоит запомнить</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">{data.modelScript.keyPhrases.map((k, i) => <li key={i}>{k}</li>)}</ul>
              </div>
            </div>
          )}
        </section>
      )}

      {virtual && (
        <section className="rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-5">
          <h2 className="text-lg font-semibold text-emerald-300">🧠 База знаний</h2>
          {learning || (!data.learn && !learnError) ? (
            <p className="mt-2 text-sm text-slate-300">Выделяем практики из этого звонка и добавляем их в общую базу знаний… (около минуты)</p>
          ) : learnError ? (
            <>
              <p role="alert" className="mt-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{learnError}</p>
              <button onClick={() => learn(data)} className="mt-3 rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-black">Попробовать ещё раз</button>
            </>
          ) : data.learn?.skipped ? (
            <p className="mt-2 text-sm text-slate-300">{data.learn.skipped}.</p>
          ) : (
            <p className="mt-2 text-sm text-slate-300">
              Добавлено новых практик: <strong>{data.learn?.added}</strong>, подтверждено существующих: <strong>{data.learn?.reinforced}</strong>. Всего в базе: {data.learn?.total}. Они будут применены в следующих звонках оператора.
            </p>
          )}
          <Link href="/knowledge" className="mt-3 inline-block text-sm font-semibold text-emerald-300 underline">Открыть базу знаний</Link>
        </section>
      )}

      <details className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm">
        <summary className="cursor-pointer">Транскрипт</summary>
        <div className="mt-3 space-y-2">
          {data.transcript.map((t, i) => {
            const m = momentByTurn.get(i + 1);
            return (
              <p key={i} className={`border-l-2 pl-2 ${m ? (m.kind === "good" ? "border-emerald-400" : "border-red-400") : "border-transparent"}`}>
                <span className="mr-1 text-xs text-slate-500">#{i + 1}</span>
                <strong>{t.role === "user" ? "Оператор" : data.patient}:</strong> {t.text}
              </p>
            );
          })}
        </div>
      </details>

      <div className="flex flex-wrap gap-3">
        <Link href="/app" className="inline-block rounded-xl bg-amber-400 px-6 py-3 font-semibold text-black">{virtual ? "На главную" : real ? "На главную" : "Другой пациент или ещё раз"}</Link>
        {virtual && (
          <Link href="/operator" className="inline-block rounded-xl border border-white/20 px-6 py-3 font-semibold">Ещё один звонок оператора</Link>
        )}
        {!real && data.scenarioId && (
          <Link href={`/challenge/${data.scenarioId}`} className="inline-block rounded-xl border border-white/20 px-6 py-3 font-semibold">Ещё раз с этим пациентом</Link>
        )}
      </div>
    </main>
  );
}
