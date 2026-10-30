"use client";

import { useEffect, useState } from "react";
import { TEMPO } from "@/lib/tempo";
import { Mic, MicOff } from "./icons";

// Pieces shared by the two live-call screens (trainer and virtual operator).

export function MicButton({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={on}
      aria-label={on ? "Выключить микрофон" : "Включить микрофон"}
      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition duration-300 active:scale-95 ${
        on ? "ring-pulse bg-accent text-ink-950" : "bg-ink-700 text-slate-400 ring-1 ring-inset ring-white/10 hover:text-slate-200"
      }`}
    >
      {on ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
    </button>
  );
}

// Sticky bottom bar for call controls; blur is fine here because the bar itself is fixed in place.
// `inset` keeps the bar inside its column on desktop (used when a sidebar sits next to the dialog).
export function CallBar({ children, inset }: { children: React.ReactNode; inset?: boolean }) {
  return (
    <div
      className={`sticky bottom-0 z-10 -mx-4 mt-4 flex flex-col gap-3 bg-ink-950/85 px-4 pt-3 pb-4 shadow-[0_-1px_0_rgb(255_255_255/0.06)] backdrop-blur-xl ${
        inset ? "lg:mx-0 lg:px-0" : "lg:-mx-6 lg:px-6"
      }`}
    >
      {children}
    </div>
  );
}

export function Status({ children, live }: { children: React.ReactNode; live?: boolean }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-300">
      {live && <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent" />}
      <span className="truncate">{children}</span>
    </span>
  );
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * The call's pace against the 2.5-minute target (lib/tempo.ts): elapsed time in voice, the operator's replies in text.
 * Mint while on pace, amber when it is time to close on a booking, rose past the target.
 */
export function CallTimer({ mode, startedAt, endedAt, replies }: { mode: "voice" | "text"; startedAt: number; endedAt: number | null; replies: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (endedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [endedAt]);
  const voice = mode === "voice";
  const value = voice ? Math.max(0, Math.round(((endedAt ?? now) - startedAt) / 1000)) : replies;
  const warn = voice ? TEMPO.warnSeconds : TEMPO.targetTextReplies - 2;
  const target = voice ? TEMPO.targetSeconds : TEMPO.targetTextReplies;
  const tone = value > target ? "bg-rose-500/15 text-rose-200 ring-rose-400/30" : value >= warn ? "bg-amber-400/15 text-amber-100 ring-amber-300/30" : "bg-accent/10 text-accent ring-accent/25";
  const hint = voice ? `Цель — записать пациента за ${clock(TEMPO.targetSeconds)}` : `Цель — записать пациента за ${TEMPO.targetTextReplies} реплик`;
  return (
    <span title={hint} className={`flex shrink-0 items-baseline gap-1 rounded-full px-3 py-1.5 text-sm font-medium tabular-nums ring-1 ring-inset transition-colors duration-500 ${tone}`}>
      {voice ? clock(value) : value}
      <span className="text-xs font-normal opacity-70">/ {voice ? clock(target) : `${target} реплик`}</span>
    </span>
  );
}
