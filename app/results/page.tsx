"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SKILLS } from "@/lib/scoring";
import { addEntry, type HistoryEntry } from "@/lib/history";
import type { EvaluationResult, ModelScript, Turn } from "@/lib/schemas";
import { Panel, PanelTitle, PageHeader, Shell } from "../ui";
import { useHome } from "../home-link";
import { Alert, ArrowUpRight, Book, Chart, Check, Cross, Door, Keyhole, Spark, Target } from "../icons";

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
  const home = useHome();

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
      <Shell>
        <PageHeader eyebrow="Разбор" title="Сессия не найдена">
          Результаты хранятся только в этой вкладке. Пройдите новый звонок, чтобы получить разбор.
        </PageHeader>
        <Link href={home} className="btn btn-primary w-fit">{home === "/call" ? "Позвонить пациенту" : "Выбрать пациента"}</Link>
      </Shell>
    );
  }
  const { result } = data;
  const real = data.scenarioId === "real";
  const virtual = data.mode === "virtual";
  const momentByTurn = new Map(result.moments.map((m) => [m.turn, m]));
  const attempts = history.filter((h) => h.scenarioId === data.scenarioId);
  const prev = attempts.length > 1 ? attempts[attempts.length - 2] : null;
  const delta = prev ? result.total - prev.total : null;
  const bullet = <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-current opacity-60" />;

  return (
    <Shell back={{ href: home, label: "На главную" }}>
      <div className="mt-8 space-y-4">
        <Panel delay={40} tone="accent" innerClassName="relative overflow-hidden p-6 sm:p-8">
          <div aria-hidden className="pointer-events-none absolute -top-24 -right-20 h-64 w-64 rounded-full bg-accent/[0.12] blur-3xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow">{virtual ? "Оценка виртуального оператора" : real ? "Оценка реального звонка" : `Итоговый балл · ${data.patient}`}</p>
              <p className="mt-2 flex items-baseline gap-1 font-semibold tracking-[-0.04em] tabular-nums">
                <span className="text-7xl text-slate-50 sm:text-8xl">{result.total}</span>
                <span className="text-2xl text-slate-500">/100</span>
              </p>
              {!virtual && delta !== null && (
                <p className={`mt-1 text-sm font-medium tabular-nums ${delta >= 0 ? "text-accent" : "text-rose-300"}`}>
                  {delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ ${delta}` : "Без изменений"} к прошлой попытке с этим пациентом
                </p>
              )}
            </div>
            <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${result.appointmentBooked ? "bg-accent text-ink-950" : "bg-rose-500/15 text-rose-200 ring-1 ring-inset ring-rose-400/30"}`}>
              {result.appointmentBooked ? <Check className="h-4 w-4" /> : <Cross className="h-4 w-4" />}
              {result.appointmentBooked ? "Запись на приём оформлена" : "Запись не оформлена"}
            </span>
          </div>
          <p className="relative mt-5 max-w-[65ch] leading-relaxed text-pretty text-slate-300">{result.summary}</p>
        </Panel>

        <Panel delay={80} innerClassName="space-y-5 p-5 sm:p-6">
          <PanelTitle icon={<Chart />}>Навыки по чек-листу</PanelTitle>
          {SKILLS.map((s) => {
            const items = result.checklist.filter((c) => c.skill === s.key);
            return (
              <div key={s.key}>
                <div className="flex justify-between gap-4 text-sm">
                  <span className="font-medium text-slate-100">{s.label} <span className="font-normal text-slate-500">· {Math.round(s.weight * 100)}%</span></span>
                  <span className="tabular-nums text-slate-300">{result.scores[s.key]}/10</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-white/[0.06]">
                  <div className="h-1.5 rounded-full bg-accent" style={{ width: `${result.scores[s.key] * 10}%` }} />
                </div>
                <details className="group mt-1.5 text-sm">
                  <summary className="cursor-pointer list-none text-xs text-slate-500 transition hover:text-slate-300">
                    Критерии: {items.filter((i) => i.done).length} из {items.length} <span className="group-open:hidden">· показать</span><span className="hidden group-open:inline">· скрыть</span>
                  </summary>
                  <ul className="mt-2.5 space-y-2">
                    {items.map((c) => (
                      <li key={c.id} className="flex gap-2.5 text-slate-300">
                        <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded ${c.done ? "bg-accent text-ink-950" : "ring-1 ring-inset ring-white/20"}`}>
                          {c.done && <Check className="h-3 w-3" />}
                        </span>
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
        </Panel>

        {attempts.length > 1 && (
          <Panel delay={120} innerClassName="p-5 sm:p-6">
            <PanelTitle icon={<Chart />}>Ваш прогресс с этим пациентом</PanelTitle>
            <div className="mt-4 flex h-28 items-end gap-1.5">
              {attempts.slice(-10).map((a, i, arr) => (
                <div key={a.id} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${a.total}/100`}>
                  <span className="text-[10px] tabular-nums text-slate-400">{a.total}</span>
                  <div className={`w-full rounded-md ${i === arr.length - 1 ? "bg-accent" : "bg-white/15"}`} style={{ height: `${Math.max(a.total, 3)}%` }} />
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">Последние попытки слева направо, текущая выделена. Данные хранятся только в этом браузере.</p>
          </Panel>
        )}

        {!real && (result.hiddenObjection || result.showUpRisk) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {result.hiddenObjection && (
              <Panel delay={140} innerClassName="h-full p-5">
                <PanelTitle icon={<Keyhole />}>Скрытая причина сомнений</PanelTitle>
                <p className="mt-3 text-sm leading-relaxed text-slate-200">{result.hiddenObjection}</p>
                <p className="mt-3 text-sm">
                  <span className={`inline-flex items-center gap-1.5 font-semibold ${result.objectionUncovered ? "text-accent" : "text-rose-300"}`}>
                    {result.objectionUncovered ? <Check className="h-4 w-4" /> : <Cross className="h-4 w-4" />}
                    {result.objectionUncovered ? (virtual ? "Оператор её раскрыл." : "Вы её раскрыли.") : (virtual ? "Оператор её не раскрыл." : "Вы её не раскрыли.")}
                  </span>{" "}
                  {result.objectionEvidence && <span className="text-slate-400">{result.objectionEvidence}</span>}
                </p>
              </Panel>
            )}
            {result.showUpRisk && (
              <Panel delay={160} innerClassName="h-full p-5">
                <PanelTitle icon={<Door />}>Риск неявки</PanelTitle>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">{result.showUpRisk}</p>
              </Panel>
            )}
          </div>
        )}

        {result.unsupportedClaims.length > 0 && (
          <div className="rise rounded-3xl bg-rose-500/[0.06] p-5 ring-1 ring-inset ring-rose-400/25" style={{ animationDelay: "180ms" }}>
            <PanelTitle tone="bad" icon={<Alert />}>Утверждения, которых нет на сайте</PanelTitle>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-300">{result.unsupportedClaims.map((c, i) => <li key={i} className="flex gap-2.5">{bullet}{c}</li>)}</ul>
            {real && <p className="mt-3 text-xs text-slate-500">Звонок оценён по расшифровке: числа и названия могли быть распознаны неточно. Сверьте со звуком, прежде чем делать выводы по оператору.</p>}
          </div>
        )}

        {result.moments.length > 0 && (
          <Panel delay={200} innerClassName="p-5 sm:p-6">
            <PanelTitle icon={<Target />}>Ключевые моменты звонка</PanelTitle>
            <ul className="mt-4 space-y-3">
              {[...result.moments].sort((a, b) => a.turn - b.turn).map((m, i) => (
                <li key={i} className={`rounded-2xl bg-ink-950/50 p-4 text-sm ring-1 ring-inset ${m.kind === "good" ? "ring-accent/25" : "ring-rose-400/25"}`}>
                  <p className="text-xs tabular-nums text-slate-500">Реплика №{m.turn}</p>
                  <p className="mt-1 text-slate-300">«{data.transcript[m.turn - 1]?.text}»</p>
                  <p className={`mt-2 flex gap-2 ${m.kind === "good" ? "text-accent" : "text-rose-300"}`}>
                    {m.kind === "good" ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <Alert className="mt-0.5 h-4 w-4 shrink-0" />}
                    {m.comment}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Panel delay={220} innerClassName="h-full p-5">
            <PanelTitle tone="accent" icon={<Check />}>Что получилось</PanelTitle>
            {result.strengths.length ? (
              <ul className="mt-3 space-y-1.5 text-sm text-slate-300">{result.strengths.map((s, i) => <li key={i} className="flex gap-2.5">{bullet}{s}</li>)}</ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Сильных сторон в этом звонке не найдено.</p>
            )}
          </Panel>
          <Panel delay={240} innerClassName="h-full p-5">
            <PanelTitle icon={<Target />}>{virtual ? "Рекомендации оператору" : "Что сделать в следующий раз"}</PanelTitle>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-300">{result.improvements.map((s, i) => <li key={i} className="flex gap-2.5">{bullet}{s}</li>)}</ul>
          </Panel>
        </div>

        {!real && (
          <Panel delay={260} tone="accent" innerClassName="p-5 sm:p-6">
            <PanelTitle tone="accent" icon={<Spark />}>Как это сделал бы сильный оператор</PanelTitle>
            {!data.modelScript ? (
              <>
                <p className="mt-3 max-w-[65ch] text-sm leading-relaxed text-slate-300">
                  Получите эталонный разговор с этим пациентом: с пояснениями, почему каждая фраза работает, и сравнением с вашими фразами.
                </p>
                {scriptError && <p role="alert" className="alert alert-error mt-3">{scriptError}</p>}
                <button onClick={loadScript} disabled={loading || !data.scenarioId} className="btn btn-primary mt-4 px-6 py-3">
                  {loading ? "Составляем эталон… это займёт около минуты" : scriptError ? "Попробовать ещё раз" : "Показать эталонный разговор"}
                </button>
                {!data.scenarioId && <p className="mt-2 text-xs text-slate-500">Пройдите новый звонок, чтобы получить эталон.</p>}
              </>
            ) : (
              <div className="mt-4 space-y-6">
                <p className="text-sm leading-relaxed text-slate-300">{data.modelScript.intro}</p>
                <div className="space-y-3">
                  {data.modelScript.dialogue.map((d, i) => (
                    <div key={i} className={`flex ${d.role === "operator" ? "justify-end" : "justify-start"}`}>
                      <div className="flex max-w-[88%] flex-col items-end">
                        <div className={`bubble max-w-none ${d.role === "operator" ? "bubble-mine" : "bubble-theirs self-start"}`}>
                          <span className="bubble-label">{d.role === "operator" ? "Эталонный оператор" : data.patient}</span>
                          {d.text}
                        </div>
                        {d.role === "operator" && d.tip && <p className="mt-1.5 flex gap-1.5 pr-2 text-xs text-accent"><Spark className="mt-0.5 h-3 w-3 shrink-0" />{d.tip}</p>}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500">Это пример от ИИ на основе фактов сайта. Реплики пациента смоделированы: живой человек может ответить иначе.</p>
                {data.modelScript.comparisons.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold tracking-tight">Было → стало</h3>
                    {data.modelScript.comparisons.map((c, i) => (
                      <div key={i} className="rounded-2xl bg-ink-950/50 p-4 text-sm ring-1 ring-inset ring-white/[0.06]">
                        <p className="text-slate-400"><span className="text-rose-300">Вы:</span> «{c.yours}»</p>
                        <p className="mt-1.5 text-slate-100"><span className="text-accent">Лучше:</span> «{c.better}»</p>
                        <p className="mt-2 text-xs text-slate-500">{c.why}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div>
                  <h3 className="mb-2 font-semibold tracking-tight">Фразы, которые стоит запомнить</h3>
                  <ul className="space-y-1.5 text-sm text-slate-300">{data.modelScript.keyPhrases.map((k, i) => <li key={i} className="flex gap-2.5">{bullet}{k}</li>)}</ul>
                </div>
              </div>
            )}
          </Panel>
        )}

        {virtual && (
          <Panel delay={260} tone="accent" innerClassName="p-5 sm:p-6">
            <PanelTitle tone="accent" icon={<Book />}>База знаний</PanelTitle>
            {learning || (!data.learn && !learnError) ? (
              <p className="mt-3 flex items-center gap-2 text-sm text-slate-300"><span className="h-2 w-2 animate-pulse rounded-full bg-accent" />Выделяем практики из этого звонка и добавляем их в общую базу знаний… (около минуты)</p>
            ) : learnError ? (
              <>
                <p role="alert" className="alert alert-error mt-3">{learnError}</p>
                <button onClick={() => learn(data)} className="btn btn-primary mt-3 px-4 py-2">Попробовать ещё раз</button>
              </>
            ) : data.learn?.skipped ? (
              <p className="mt-3 text-sm text-slate-300">{data.learn.skipped}.</p>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                Добавлено новых практик: <strong className="text-slate-50 tabular-nums">{data.learn?.added}</strong>, подтверждено существующих: <strong className="text-slate-50 tabular-nums">{data.learn?.reinforced}</strong>. Всего в базе: <span className="tabular-nums">{data.learn?.total}</span>. Они будут применены в следующих звонках оператора.
              </p>
            )}
            <Link href="/knowledge" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent underline-offset-4 hover:underline">
              Открыть базу знаний <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Panel>
        )}

        <details className="rise group rounded-3xl bg-white/[0.03] p-5 text-sm ring-1 ring-inset ring-white/[0.06]" style={{ animationDelay: "280ms" }}>
          <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-slate-200">
            Транскрипт
            <span className="text-xs font-normal text-slate-500"><span className="group-open:hidden">Показать</span><span className="hidden group-open:inline">Скрыть</span></span>
          </summary>
          <div className="mt-4 space-y-2.5">
            {data.transcript.map((t, i) => {
              const m = momentByTurn.get(i + 1);
              return (
                <p key={i} className={`border-l-2 pl-3 leading-relaxed text-slate-300 ${m ? (m.kind === "good" ? "border-accent" : "border-rose-400") : "border-transparent"}`}>
                  <span className="mr-1.5 text-xs tabular-nums text-slate-600">#{i + 1}</span>
                  <strong className="font-medium text-slate-100">{t.role === "user" ? "Оператор" : data.patient}:</strong> {t.text}
                </p>
              );
            })}
          </div>
        </details>

        <div className="flex flex-wrap gap-3 pt-2">
          <Link href={home} className="btn btn-primary px-6 py-3">{virtual || real ? "На главную" : home === "/call" ? "Следующий звонок" : "Другой пациент или ещё раз"}</Link>
          {virtual && <Link href="/operator" className="btn btn-ghost px-6 py-3">Ещё один звонок оператора</Link>}
          {!real && data.scenarioId && <Link href={`/challenge/${data.scenarioId}`} className="btn btn-ghost px-6 py-3">Ещё раз с этим пациентом</Link>}
        </div>
      </div>
    </Shell>
  );
}
