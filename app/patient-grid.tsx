"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import scenarios from "@/lib/scenarios-public.json";
import { getHistory, type HistoryEntry } from "@/lib/history";

export default function PatientGrid() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  useEffect(() => setHistory(getHistory()), []);

  const mine = history.filter((h) => scenarios.some((s) => s.id === h.scenarioId));
  const best = mine.reduce((m, h) => Math.max(m, h.total), 0);

  return (
    <section className="grid gap-3">
      <div className="flex items-end justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Выберите пациента</h2>
        {mine.length > 0 && (
          <p className="text-xs text-slate-500">
            Попыток: {mine.length} · лучший результат: {best}/100
          </p>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {scenarios.map((s) => {
          const tries = history.filter((h) => h.scenarioId === s.id);
          const last = tries[tries.length - 1];
          const top = tries.reduce((m, h) => Math.max(m, h.total), 0);
          return (
            <Link
              key={s.id}
              href={`/challenge/${s.id}`}
              className="group flex flex-col rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-amber-400/60 hover:bg-white/10"
            >
              <span className="mb-2 w-fit rounded-full bg-amber-400/15 px-2.5 py-0.5 text-xs font-medium text-amber-300">{s.tag}</span>
              <h3 className="text-lg font-semibold group-hover:text-amber-300">{s.title}</h3>
              <p className="mt-1 flex-1 text-sm text-slate-300">{s.lead}</p>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="font-semibold text-amber-400">Позвонить →</span>
                {last && (
                  <span className="text-xs text-slate-400">
                    Попыток {tries.length} · последняя {last.total} · лучшая {top}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
