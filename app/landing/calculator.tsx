"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "./analytics";
import { reducedMotion } from "./motion";

// Screen 3: how much revenue the lost requests could stand for. requests × share × revenue per patient, recomputed on
// every slider move; the number glides to its new value. Illustrative only, the disclaimer says so.

type Range = { label: string; min: number; max: number; step: number; value: number };
const rub = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₽`;
const requestsWord = (n: number) => {
  const d = n % 10, dd = n % 100;
  return d === 1 && dd !== 11 ? "обращение" : d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? "обращения" : "обращений";
};

/** A number that eases to its new value over ~0.5 s (instantly for reduced motion). */
function useGlide(value: number) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reducedMotion()) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 500);
      const v = a + (value - a) * (1 - Math.pow(1 - k, 3));
      from.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return shown;
}

export function Calculator({ requests, share, revenue, result, disclaimer }: { requests: Range; share: Range; revenue: Range; result: string; disclaimer: string }) {
  const [r, setR] = useState(requests.value);
  const [s, setS] = useState(share.value);
  const [v, setV] = useState(revenue.value);
  const reported = useRef(false);
  const lostCount = Math.round((r * s) / 100);
  const total = useGlide(lostCount * v);
  const count = useGlide(lostCount);

  const touch = () => {
    if (reported.current) return;
    reported.current = true;
    track("calculator_interaction");
  };
  const sliders: [Range, number, (n: number) => void, (n: number) => string][] = [
    [requests, r, setR, (n) => n.toLocaleString("ru-RU")],
    [share, s, setS, (n) => `${n}%`],
    [revenue, v, setV, rub],
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr]">
      <div className="rounded-[2rem] bg-white/[0.03] p-2 ring-1 ring-inset ring-white/[0.07]">
        <div className="flex h-full flex-col gap-8 rounded-3xl bg-graphite-800 p-6 sm:p-8">
          {sliders.map(([cfg, val, set, fmt]) => {
            const id = `calc-${cfg.min}-${cfg.max}`;
            const pct = ((val - cfg.min) / (cfg.max - cfg.min)) * 100;
            return (
              <div key={cfg.label}>
                <div className="flex items-baseline justify-between gap-4">
                  <label htmlFor={id} className="text-sm text-mist">{cfg.label}</label>
                  <output htmlFor={id} className="shrink-0 whitespace-nowrap text-xl font-semibold tabular-nums text-white">{fmt(val)}</output>
                </div>
                <input
                  id={id}
                  type="range"
                  min={cfg.min}
                  max={cfg.max}
                  step={cfg.step}
                  value={val}
                  onChange={(e) => {
                    set(Number(e.target.value));
                    touch();
                  }}
                  style={{ background: `linear-gradient(to right, var(--color-flame) ${pct}%, rgb(255 255 255 / 0.08) ${pct}%)` }}
                  className="site-range mt-4 h-1.5 w-full cursor-pointer appearance-none rounded-full [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(245,138,53,0.25)]"
                />
                <div className="mt-2 flex justify-between text-xs text-mist/60">
                  <span>{fmt(cfg.min)}</span>
                  <span>{fmt(cfg.max)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-[2rem] bg-flame/[0.06] p-2 ring-1 ring-inset ring-flame/25">
        <div className="flex h-full flex-col justify-between gap-8 rounded-3xl bg-graphite-800 p-6 sm:p-8">
          <div>
            <p className="text-sm text-mist">{result}</p>
            <p className="mt-4 text-5xl font-semibold tracking-tight tabular-nums text-white sm:text-6xl" aria-live="polite">
              {rub(total)}
              <span className="ml-2 text-xl font-medium text-mist">/мес.</span>
            </p>
            <p className="mt-4 text-base text-white/80">
              Это примерно <span className="font-semibold text-flame tabular-nums">{Math.round(count)}</span> {requestsWord(lostCount)} в месяц без записи.
            </p>
          </div>
          <p className="text-xs text-mist/80 text-pretty">{disclaimer}</p>
        </div>
      </div>
    </div>
  );
}
