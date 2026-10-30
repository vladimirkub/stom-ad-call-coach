"use client";

import { useEffect, useRef, useState } from "react";
import { SKILLS, modelRubric } from "@/lib/scoring";
import type { Turn } from "@/lib/schemas";
import { Check } from "./icons";

const RUBRIC = modelRubric(false);
export const CHECKLIST_TOTAL = RUBRIC.length;

/**
 * Re-checks the transcript after each new operator line (debounced, one request at a time).
 * Ticks only accumulate during a call: the final verdict comes from the evaluation on the results page.
 */
export function useLiveChecklist(scenarioId: string, transcript: Turn[], active: boolean) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [checking, setChecking] = useState(false);
  const inFlight = useRef(false);
  const checkedTurns = useRef(0);
  const latest = useRef(transcript);
  latest.current = transcript;

  const operatorTurns = transcript.filter((t) => t.role === "user").length;

  useEffect(() => {
    if (!active || operatorTurns === 0 || operatorTurns <= checkedTurns.current || inFlight.current) return;
    const timer = setTimeout(async () => {
      inFlight.current = true;
      setChecking(true);
      const snapshot = latest.current;
      try {
        const res = await fetch("/api/checklist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenarioId, transcript: snapshot.slice(-100) }),
        });
        const body = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(body.passed)) setDone((prev) => new Set([...prev, ...body.passed]));
      } catch {
        // A missed update is harmless: the next operator line triggers another check.
      } finally {
        // Counted even on failure, so an error (e.g. a rate limit) waits for the next line instead of retrying in a loop.
        checkedTurns.current = snapshot.filter((t) => t.role === "user").length;
        inFlight.current = false;
        setChecking(false);
      }
    }, 1200);
    return () => clearTimeout(timer);
    // `checking` re-runs the effect when a request finishes, so lines that arrived meanwhile get checked too.
  }, [active, operatorTurns, scenarioId, checking]);

  return { done, checking };
}

export function LiveChecklist({ done, checking, className = "" }: { done: Set<string>; checking: boolean; className?: string }) {
  return (
    <div className={className}>
      {SKILLS.map((s) => {
        const items = RUBRIC.filter((r) => r.skill === s.key);
        const n = items.filter((i) => done.has(i.id)).length;
        return (
          <section key={s.key} className="mt-4 first:mt-0">
            <h3 className="flex items-baseline justify-between gap-3 text-xs font-medium text-slate-400">
              {s.label}
              <span className={`tabular-nums ${n === items.length ? "text-accent" : "text-slate-500"}`}>{n}/{items.length}</span>
            </h3>
            <ul className="mt-2 space-y-1.5">
              {items.map((i) => {
                const ok = done.has(i.id);
                return (
                  <li key={i.id} className={`flex gap-2.5 text-[13px] leading-snug transition-colors duration-500 ${ok ? "text-slate-100" : "text-slate-500"}`}>
                    <span
                      key={ok ? "on" : "off"}
                      className={`mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded ${ok ? "check-pop bg-accent text-ink-950" : "ring-1 ring-inset ring-white/15"}`}
                    >
                      {ok && <Check className="h-3 w-3" />}
                    </span>
                    {i.label}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-600">
        <span className={`h-1.5 w-1.5 rounded-full ${checking ? "animate-pulse bg-accent" : "bg-slate-700"}`} />
        {checking ? "Проверяем последние реплики…" : "Предварительно. Итоговая оценка будет в разборе."}
      </p>
    </div>
  );
}
