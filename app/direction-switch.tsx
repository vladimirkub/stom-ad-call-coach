"use client";

import { useCallback, useEffect, useState } from "react";
import { DIRECTIONS, parseDirection, type CallDirection } from "@/lib/direction";

const KEY = "coach:direction";

/** The call direction the trainee picked last, remembered in this browser; outbound until read on the client. */
export function useDirection(): [CallDirection, (d: CallDirection) => void] {
  const [direction, set] = useState<CallDirection>("outbound");
  useEffect(() => {
    try {
      set(parseDirection(localStorage.getItem(KEY)));
    } catch {}
    // Every switch and label on the page follows the latest choice.
    const follow = (e: Event) => set(parseDirection((e as CustomEvent).detail));
    window.addEventListener(KEY, follow);
    return () => window.removeEventListener(KEY, follow);
  }, []);
  const choose = useCallback((d: CallDirection) => {
    try {
      localStorage.setItem(KEY, d);
    } catch {}
    window.dispatchEvent(new CustomEvent(KEY, { detail: d }));
  }, []);
  return [direction, choose];
}

/** Two-way switch: callback on a request, or the patient calls the clinic. */
export function DirectionSwitch({
  value,
  onChange,
  compact = false,
  className = "",
}: {
  value: CallDirection;
  onChange: (d: CallDirection) => void;
  /** One line per option, no hint: for the dense workspace header. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label="Какой звонок" className={`grid grid-cols-2 gap-1 rounded-full bg-white/[0.04] p-1 ring-1 ring-inset ring-white/[0.08] ${className}`}>
      {DIRECTIONS.map((d) => {
        const on = d.key === value;
        return (
          <button
            key={d.key}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(d.key)}
            title={compact ? d.hint : undefined}
            className={`flex flex-col items-center rounded-full leading-tight transition duration-300 ease-[var(--ease-spring)] active:scale-[0.98] ${compact ? "px-3.5 py-1" : "px-4 py-2"} ${on ? "bg-accent text-ink-950" : "text-slate-300 hover:bg-white/[0.06]"}`}
          >
            <span className={compact ? "text-xs font-semibold" : "text-sm font-semibold"}>{d.label}</span>
            {!compact && <span className={`text-[11px] ${on ? "text-ink-950/70" : "text-slate-500"}`}>{d.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}
