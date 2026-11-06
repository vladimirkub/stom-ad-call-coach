"use client";

import { useEffect, useState } from "react";
import { reducedMotion, useInView } from "./motion";

// Screen 2: three situations where a request is lost. As a card scrolls into view the patient moves along the funnel
// and drops out at the step where the conversation failed. "Как ответить иначе" replays it with a better reply,
// and then the patient reaches the visit.

type Case = { quote: string; bad: string; why: string; lostAt: number; good: string };

export function ProblemCards({ cases, stages }: { cases: Case[]; stages: string[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {cases.map((c, i) => (
        <ProblemCard key={c.quote} c={c} stages={stages} delay={i * 250} />
      ))}
    </div>
  );
}

function ProblemCard({ c, stages, delay }: { c: Case; stages: string[]; delay: number }) {
  const [ref, seen] = useInView<HTMLDivElement>("0px 0px -20% 0px");
  const [better, setBetter] = useState(false);
  const target = better ? stages.length - 1 : c.lostAt;
  const [step, setStep] = useState(-1);

  useEffect(() => {
    if (!seen) return;
    if (reducedMotion()) return setStep(target);
    setStep(-1);
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let s = 0; s <= target; s++) timers.push(setTimeout(() => setStep(s), delay + 300 + s * 450));
    return () => timers.forEach(clearTimeout);
  }, [seen, target, delay]);

  const done = step === target;
  const lost = !better && done;
  return (
    <div ref={ref} className="rounded-[2rem] bg-white/[0.03] p-2 ring-1 ring-inset ring-white/[0.07]">
      <div className="flex h-full flex-col rounded-3xl bg-graphite-800 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <p className="text-xs font-medium text-mist">Пациент говорит</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-white">«{c.quote}»</p>

        <div className="mt-6 min-h-24">
          <p className="text-xs font-medium text-mist">{better ? "Как можно ответить" : "Администратор отвечает"}</p>
          <p key={String(better)} className={`site-in mt-2 text-base text-pretty ${better ? "text-pulse" : "text-white/80"}`}>
            {better ? c.good : c.bad}
          </p>
        </div>

        <ol className="mt-6 grid grid-cols-4 gap-2" aria-label="Путь пациента">
          {stages.map((s, k) => {
            const reached = k <= step;
            const dropped = !better && done && k > c.lostAt;
            return (
              <li key={s} className="flex flex-col gap-2">
                <span className="relative block h-1 overflow-hidden rounded-full bg-white/[0.07]">
                  <span
                    className={`absolute inset-0 origin-left rounded-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${reached ? "scale-x-100" : "scale-x-0"} ${lost && k === c.lostAt ? "bg-flame" : better ? "bg-pulse" : "bg-white/60"}`}
                  />
                </span>
                <span className={`text-xs transition-colors duration-500 ${dropped ? "text-white/25 line-through" : reached ? "text-white" : "text-mist/60"}`}>{s}</span>
              </li>
            );
          })}
        </ol>

        <div className="mt-6 flex flex-1 flex-col items-start justify-end gap-4">
          <p className={`min-h-10 text-sm text-pretty transition-opacity duration-500 ${done ? "opacity-100" : "opacity-0"} ${lost ? "text-flame" : "text-pulse"}`}>
            {lost ? `Пациент ушёл: ${c.why.toLowerCase()}` : "Пациент дошёл до визита"}
          </p>
          <button
            type="button"
            onClick={() => setBetter(!better)}
            className="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/15 transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-white/[0.06] active:scale-[0.98]"
          >
            {better ? "Как было" : "Как ответить иначе"}
          </button>
        </div>
      </div>
    </div>
  );
}
