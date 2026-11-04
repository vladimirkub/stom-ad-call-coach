"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import scenarios from "@/lib/scenarios-public.json";
import { getHistory, type HistoryEntry } from "@/lib/history";
import { ArrowUpRight } from "./icons";
import { useClinicData } from "./clinic-data";
import { useDirection } from "./direction-switch";
import { PATIENT_GROUPS, parseGroupTab, type GroupTab } from "@/lib/patient-groups";

const GROUP_KEY = "coach:group";

/** The patients' tab picked last, remembered in this browser; "all" until read on the client. The tabs in the header and
 * the grid below follow the same choice. */
function useGroupTab(): [GroupTab, (t: GroupTab) => void] {
  const [tab, set] = useState<GroupTab>("all");
  useEffect(() => {
    try {
      set(parseGroupTab(localStorage.getItem(GROUP_KEY)));
    } catch {}
    const follow = (e: Event) => set(parseGroupTab((e as CustomEvent).detail));
    window.addEventListener(GROUP_KEY, follow);
    return () => window.removeEventListener(GROUP_KEY, follow);
  }, []);
  const choose = (t: GroupTab) => {
    try {
      localStorage.setItem(GROUP_KEY, t);
    } catch {}
    window.dispatchEvent(new CustomEvent(GROUP_KEY, { detail: t }));
  };
  return [tab, choose];
}

/** Tabs by the kind of objection: everyone, or one group, with how many patients each holds. */
export function GroupTabs() {
  const [value, onChange] = useGroupTab();
  const tabs = [
    { key: "all" as GroupTab, label: "Все", hint: "все пациенты", count: scenarios.length },
    ...PATIENT_GROUPS.map((g) => ({ key: g.key as GroupTab, label: g.label, hint: g.hint, count: scenarios.filter((s) => s.group === g.key).length })),
  ];
  return (
    <div role="tablist" aria-label="Пациенты по типу возражения" className="-mx-1 flex w-0 min-w-[calc(100%+0.5rem)] gap-1 overflow-x-auto px-1 pb-0.5">
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={on}
            title={t.hint}
            onClick={() => onChange(t.key)}
            className={`shrink-0 rounded-full px-3.5 py-1 text-xs font-semibold whitespace-nowrap transition duration-300 ease-[var(--ease-spring)] active:scale-[0.98] ${on ? "bg-accent text-ink-950" : "bg-white/[0.04] text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.07]"}`}
          >
            {t.label} <span className={`tabular-nums font-medium ${on ? "text-ink-950/60" : "text-slate-500"}`}>{t.count}</span>
          </button>
        );
      })}
    </div>
  );
}

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

// Grid of patients followed by any extra cards (the workspace tools). On desktop it is 4×3 and fills the height its parent
// gives it, so the whole workspace fits one screen; each card shows as much description as its height allows (`fit-*` in globals.css).
export default function PatientGrid({ children }: { children?: React.ReactNode }) {
  const clinicData = useClinicData();
  const [direction] = useDirection();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  useEffect(() => setHistory(getHistory()), []);
  const [tab] = useGroupTab();
  const shown = tab === "all" ? scenarios : scenarios.filter((s) => s.group === tab);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {shown.map((s, i) => {
        const lead = clinicData ? context(clinicData.leads[s.id] ?? s.lead) : "";
        const tries = history.filter((h) => h.scenarioId === s.id);
        const last = tries[tries.length - 1];
        const top = tries.reduce((m, h) => Math.max(m, h.total), 0);
        return (
          <Link
            key={s.id}
            href={`/challenge/${s.id}`}
            title={lead || undefined}
            style={{ animationDelay: `${120 + i * 60}ms` }}
            className="rise bezel group flex min-h-0 transition duration-500 ease-[var(--ease-spring)] hover:-translate-y-1 active:scale-[0.99]"
          >
            <article className="fit-card bezel-core flex min-h-0 flex-1 flex-col overflow-hidden p-4 transition-colors lg:p-3.5 low:p-3 duration-500 group-hover:bg-ink-700">
              <header className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-sm font-semibold lg:h-9 lg:w-9 short:h-8 short:w-8 short:text-xs tracking-tight text-slate-200 ring-1 ring-white/10">
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

              <p className="fit-tag mt-4 flex items-center gap-1.5 text-[11px] font-medium text-slate-500 lg:mt-3">
                <span className="h-1 w-1 shrink-0 rounded-full bg-accent/70" />
                <span className="truncate">{s.tag}</span>
              </p>
              <h3 className="mt-1 text-[17px] font-semibold leading-snug tracking-tight text-balance text-slate-50 lg:mt-2.5 lg:line-clamp-2 lg:text-[15px] low:mt-1.5 low:text-sm">{quote(s.title)}</h3>
              <p className="fit-desc mt-2 line-clamp-3 text-[13px] leading-relaxed text-pretty text-slate-400 lg:mt-1.5 lg:text-[12.5px]">{lead || "\u00a0"}</p>

              <span className="mt-auto flex items-center justify-between pt-3 text-sm font-medium text-slate-300 lg:pt-2 low:pt-1 transition-colors duration-500 group-hover:text-accent">
                {direction === "inbound" ? "Принять звонок" : "Позвонить"}
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] low:h-6 low:w-6 transition duration-500 ease-[var(--ease-spring)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:bg-accent group-hover:text-ink-950">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </span>
            </article>
          </Link>
        );
      })}
      {tab === "all" && children}
    </div>
  );
}

// Summary line in the workspace's top bar: attempts and average score across all patients (nothing before the first call).
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
  if (p.count === 0) return null;
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
