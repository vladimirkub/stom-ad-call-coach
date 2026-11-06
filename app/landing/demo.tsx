"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "./analytics";
import { reducedMotion } from "./motion";

// Screen 4: the trainer in miniature. Pick a situation and a short call plays out, then the review the administrator
// would get. Clearly marked as an interactive example: nothing here talks to the real trainer.

type Demo = { id: string; label: string; patient: string; lines: [string, string][]; score: number; plus: string; minus: string };

export function TrainerDemo({ demos, label, empty }: { demos: Demo[]; label: string; empty: string }) {
  const [active, setActive] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const started = useRef(false);
  const demo = demos.find((d) => d.id === active);

  useEffect(() => {
    if (!demo) return;
    if (reducedMotion()) return setCount(demo.lines.length + 1);
    setCount(0);
    const timers = Array.from({ length: demo.lines.length + 1 }, (_, i) => setTimeout(() => setCount(i + 1), 350 + i * 1100));
    return () => timers.forEach(clearTimeout);
  }, [demo]);

  const pick = (id: string) => {
    if (!started.current) {
      started.current = true;
      track("demo_start", { situation: id });
    }
    setActive(id);
  };

  return (
    <div className="rounded-[2rem] bg-white/[0.04] p-2 ring-1 ring-inset ring-white/[0.08]">
      <div className="rounded-3xl bg-graphite-800 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-white">Выберите ситуацию</p>
          <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-mist">{label}</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Ситуации">
          {demos.map((d) => (
            <button
              key={d.id}
              type="button"
              role="tab"
              aria-selected={d.id === active}
              onClick={() => pick(d.id)}
              className={`rounded-full px-3.5 py-2 text-sm font-semibold transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] ${d.id === active ? "bg-flame text-graphite" : "text-white ring-1 ring-inset ring-white/15 hover:bg-white/[0.06]"}`}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="mt-5 flex min-h-[25rem] flex-col rounded-2xl bg-graphite p-4 ring-1 ring-inset ring-white/[0.05]">
          {!demo ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.05] text-flame">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
                </svg>
              </span>
              <p className="max-w-64 text-sm text-mist text-balance">{empty}</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-mist">Звонит {demo.patient}</p>
              <div className="mt-3 flex flex-1 flex-col gap-2">
                {demo.lines.slice(0, count).map(([who, text], i) => (
                  <div key={`${demo.id}-${i}`} className={`site-in flex ${who === "a" ? "justify-end" : "justify-start"}`}>
                    <p className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${who === "a" ? "rounded-br-md bg-flame text-graphite" : "rounded-bl-md bg-graphite-700 text-white"}`}>{text}</p>
                  </div>
                ))}
              </div>
              {count > demo.lines.length && (
                <div className="site-in mt-4 grid gap-3 rounded-xl bg-graphite-800 p-4 ring-1 ring-inset ring-white/[0.06] sm:grid-cols-[auto_1fr]">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-semibold tracking-tight tabular-nums text-white">{demo.score}</span>
                    <span className="text-sm text-mist">/100</span>
                  </div>
                  <div className="grid gap-1.5 text-sm">
                    <p className="text-pulse">+ {demo.plus}</p>
                    <p className="text-flame">− {demo.minus}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
