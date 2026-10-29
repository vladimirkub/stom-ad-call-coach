"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import scenarios from "@/lib/scenarios-public.json";
import { getHistory, type HistoryEntry } from "@/lib/history";
import { ArrowUpRight } from "./icons";

export function years(n: number) {
  const d = n % 10, dd = n % 100;
  if (d === 1 && dd !== 11) return `${n} год`;
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return `${n} года`;
  return `${n} лет`;
}

export function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("");
}

// The title is "Имя: «реплика»"; the card already shows the name, so keep only the line.
export function quote(title: string) {
  const i = title.indexOf(": ");
  return i === -1 ? title : title.slice(i + 2);
}

// The lead starts with "Имя, 41 год." which the card header already shows.
export function context(lead: string) {
  // Non-breaking spaces keep prices like "91 000 ₽" on one line.
  return lead.replace(/^[^.]*\d+\s+(год|года|лет)\.\s*/, "").replace(/(\d) (?=\d{3}\b|₽)/g, "$1\u00a0");
}

// Compact 3x2 grid of patients that fills the height its parent gives it (no scrolling on desktop).
export default function PatientGrid() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  useEffect(() => setHistory(getHistory()), []);

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2">
      {scenarios.map((s, i) => {
        const tries = history.filter((h) => h.scenarioId === s.id);
        const last = tries[tries.length - 1];
        const top = tries.reduce((m, h) => Math.max(m, h.total), 0);
        return (
          <Link
            key={s.id}
            href={`/challenge/${s.id}`}
            style={{ animationDelay: `${120 + i * 60}ms` }}
            className="rise bezel group flex min-h-0 transition duration-500 ease-[var(--ease-spring)] hover:-translate-y-1 active:scale-[0.99]"
          >
            <article className="bezel-core flex min-h-0 flex-1 flex-col overflow-hidden p-4 transition-colors duration-500 group-hover:bg-ink-700">
              <header className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-sm font-semibold tracking-tight text-slate-200 ring-1 ring-white/10">
                  {initials(s.name)}
                </span>
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-sm font-medium text-slate-100">{s.short}</p>
                  <p className="text-xs text-slate-500">{years(s.age)}</p>
                </div>
                {last && (
                  <span
                    className="ml-auto shrink-0 rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[11px] tabular-nums text-slate-400"
                    title={`Попыток: ${tries.length}, последний результат ${last.total}, лучший ${top}`}
                  >
                    <span className={top >= 70 ? "text-accent" : "text-slate-200"}>{top}</span>/100
                  </span>
                )}
              </header>

              <p className="mt-4 flex items-center gap-1.5 short:mt-3 text-[11px] font-medium text-slate-500">
                <span className="h-1 w-1 shrink-0 rounded-full bg-accent/70" />
                <span className="truncate">{s.tag}</span>
              </p>
              <h3 className="mt-1 text-[17px] font-semibold leading-snug tracking-tight text-balance text-slate-50">{quote(s.title)}</h3>
              <p className="mt-2 line-clamp-3 text-[13px] short:line-clamp-1 leading-relaxed text-pretty text-slate-400">{context(s.lead)}</p>

              <span className="mt-auto flex items-center justify-between pt-3 text-sm font-medium text-slate-300 transition-colors duration-500 group-hover:text-accent">
                Позвонить
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] transition duration-500 ease-[var(--ease-spring)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:bg-accent group-hover:text-ink-950">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </span>
            </article>
          </Link>
        );
      })}
    </div>
  );
}

// Summary line for the section header: attempts and best score across all patients.
type Progress = { count: number; average: number | null; last7: { count: number; average: number | null }; change7: number | null };

/** The trainee's own progress from the server: all evaluated calls, average score, and the trend over the last 7 days. */
export function PatientStats() {
  const [p, setP] = useState<Progress | null>(null);
  useEffect(() => {
    fetch("/api/me/progress", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setP)
      .catch(() => null);
  }, []);
  if (!p) return null;
  if (p.count === 0) return <p className="shrink-0 text-xs text-slate-500">Пока нет оценённых звонков</p>;
  const trend = p.change7;
  return (
    <dl className="flex shrink-0 items-baseline gap-4 text-xs tabular-nums text-slate-500" aria-label="Мой прогресс">
      <div>
        <dt className="inline">Тренировок </dt>
        <dd className="inline text-slate-200">{p.count}</dd>
      </div>
      <div>
        <dt className="inline">Средний балл </dt>
        <dd className="inline text-slate-200">{p.average}/100</dd>
      </div>
      {trend !== null && (
        <div title="Средний балл за последние 7 дней против 7 дней до них">
          <dt className="inline">За неделю </dt>
          <dd className={`inline ${trend > 0 ? "text-accent" : trend < 0 ? "text-rose-300" : "text-slate-200"}`}>
            {trend > 0 ? "+" : ""}
            {trend}
          </dd>
        </div>
      )}
    </dl>
  );
}
