"use client";

import { useEffect, useRef, useState } from "react";
import { reducedMotion } from "./motion";

// The hero picture: a training call in progress. Replies type out in turn, the waveform moves while someone speaks,
// and checklist items light up as the administrator does the right things. Loops; static for reduced motion.

const SCRIPT: { who: "p" | "a"; text: string; tick?: number }[] = [
  { who: "p", text: "А почему у вас имплантация дороже, чем в соседней клинике?" },
  { who: "a", text: "Хороший вопрос. Там цена указана с коронкой или только за имплант?", tick: 0 },
  { who: "p", text: "Вроде только за сам имплант…" },
  { who: "a", text: "У нас в стоимость входят имплант, абатмент, коронка и снимки. Выходит честнее.", tick: 1 },
  { who: "p", text: "Хм. А на консультацию когда можно?" },
  { who: "a", text: "Завтра в 18:30 вам удобно?", tick: 2 },
];
const CHECKS = ["Выяснил, с чем сравнивает", "Объяснил ценность", "Предложил время"];
const BARS = 36;

export function HeroCall() {
  const [shown, setShown] = useState(0); // fully typed replies
  const [typed, setTyped] = useState(0); // characters of the reply being typed
  const [seconds, setSeconds] = useState(47);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (reducedMotion()) {
      setShown(SCRIPT.length);
      return;
    }
    const clock = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(clock);
  }, []);

  useEffect(() => {
    if (reducedMotion()) return;
    if (shown >= SCRIPT.length) {
      timer.current = setTimeout(() => {
        setShown(0);
        setTyped(0);
        setSeconds(47);
      }, 4200);
    } else {
      const line = SCRIPT[shown].text;
      if (typed < line.length) timer.current = setTimeout(() => setTyped((t) => t + 1), SCRIPT[shown].who === "p" ? 34 : 26);
      else
        timer.current = setTimeout(() => {
          setShown((s) => s + 1);
          setTyped(0);
        }, 900);
    }
    return () => clearTimeout(timer.current);
  }, [shown, typed]);

  const speaking = shown < SCRIPT.length && typed > 0 ? SCRIPT[shown].who : null;
  const ticked = new Set(SCRIPT.slice(0, shown).flatMap((l) => (l.tick === undefined ? [] : [l.tick])));
  const visible = SCRIPT.slice(0, Math.min(shown + 1, SCRIPT.length)).slice(-4);
  const offset = Math.max(0, Math.min(shown + 1, SCRIPT.length) - 4);
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="rounded-[2rem] bg-white/[0.04] p-2 ring-1 ring-inset ring-white/[0.08]">
      <div className="rounded-3xl bg-graphite-800 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            Тренировка звонка
            <span className="inline-flex items-center gap-1.5 rounded-full bg-pulse/10 px-2 py-0.5 text-xs font-medium text-pulse">
              <span className="relative flex h-1.5 w-1.5">
                <span className="site-ping absolute inset-0 rounded-full bg-pulse" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-pulse" />
              </span>
              В процессе
            </span>
          </div>
          <span className="font-mono text-xs tabular-nums text-mist">{clock}</span>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-graphite-700 p-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-graphite-600 text-sm font-semibold text-white">П</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Пациент, 52 года · виртуальный</p>
            <p className="truncate text-xs text-mist">Звонит по рекламе имплантации</p>
          </div>
        </div>

        <div aria-hidden className="mt-4 flex h-12 items-center justify-between gap-[3px]">
          {Array.from({ length: BARS }, (_, i) => (
            <span
              key={i}
              className={`block h-full w-full max-w-1.5 origin-center transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${speaking ? "scale-y-100" : "scale-y-[0.12]"}`}
            >
              <span
                className={`wave-bar block h-full w-full rounded-full transition-colors duration-500 ${speaking === "a" ? "bg-flame" : speaking === "p" ? "bg-pulse" : "bg-white/30"}`}
                style={{ animationDelay: `${(i * 97) % 1100}ms`, animationDuration: `${900 + ((i * 53) % 600)}ms` }}
              />
            </span>
          ))}
        </div>

        <div className="mt-4 flex h-64 flex-col justify-end gap-2 overflow-hidden" aria-live="off">
          {visible.map((l, k) => {
            const i = offset + k;
            const text = i < shown ? l.text : l.text.slice(0, typed);
            const mine = l.who === "a";
            return (
              <div key={i} className={`site-in flex ${mine ? "justify-end" : "justify-start"}`}>
                <p
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${mine ? "rounded-br-md bg-flame text-graphite" : "rounded-bl-md bg-graphite-700 text-white"}`}
                >
                  <span className="mb-0.5 block text-xs font-medium opacity-60">{mine ? "Администратор" : "Пациент"}</span>
                  {text || " "}
                  {i === shown && <span className="site-caret ml-0.5 inline-block h-3.5 w-px translate-y-0.5 bg-current" />}
                </p>
              </div>
            );
          })}
        </div>

        <ul className="mt-4 flex flex-wrap gap-2">
          {CHECKS.map((c, i) => (
            <li
              key={c}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-500 ${ticked.has(i) ? "bg-pulse/15 text-pulse" : "bg-white/[0.04] text-mist/70"}`}
            >
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                {ticked.has(i) ? <path d="m5 12 5 5 9-10" /> : <circle cx="12" cy="12" r="7" />}
              </svg>
              {c}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
