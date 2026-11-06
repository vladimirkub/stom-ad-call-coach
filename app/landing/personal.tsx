"use client";

import { useEffect, useState } from "react";
import { reducedMotion, useInView } from "./motion";

// Screen 6: three steps of tailoring the trainer to a clinic, played in turn once the block is in view: the site
// address types itself in, facts from the site appear, then a virtual patient asks about one of those facts.
// The steps on the left are buttons too, so the visitor can go back to any of them.

export function Personalize({ steps, site, facts, call }: { steps: [string, string][]; site: string; facts: string[]; call: string }) {
  const [ref, seen] = useInView<HTMLDivElement>("0px 0px -25% 0px");
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!seen) return;
    if (reducedMotion()) return setTick(99);
    setTick(0);
    const t = setInterval(() => setTick((k) => k + 1), 90);
    return () => clearInterval(t);
  }, [seen, step]);

  useEffect(() => {
    if (!seen || !auto || reducedMotion()) return;
    const t = setTimeout(() => setStep((s) => (s + 1) % steps.length), 4200);
    return () => clearTimeout(t);
  }, [seen, auto, step, steps.length]);

  const typedSite = site.slice(0, Math.max(0, tick - 2));
  const factCount = Math.min(facts.length, Math.floor(tick / 5));

  return (
    <div ref={ref} className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.2fr]">
      <ol className="grid gap-2">
        {steps.map(([title, text], i) => (
          <li key={title}>
            <button
              type="button"
              onClick={() => {
                setAuto(false);
                setStep(i);
              }}
              aria-current={step === i ? "step" : undefined}
              className={`w-full rounded-3xl p-5 text-left transition duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${step === i ? "bg-graphite-800 ring-1 ring-inset ring-white/[0.08]" : "hover:bg-white/[0.03]"}`}
            >
              <span className="flex items-center gap-3">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors duration-500 ${step === i ? "bg-flame text-graphite" : "bg-white/[0.06] text-mist"}`}>{i + 1}</span>
                <span className={`text-lg font-semibold transition-colors duration-500 ${step === i ? "text-white" : "text-mist"}`}>{title}</span>
              </span>
              <span className={`mt-2 block pl-11 text-sm text-mist transition-opacity duration-500 ${step === i ? "opacity-100" : "opacity-60"}`}>{text}</span>
              {step === i && auto && seen && (
                <span className="mt-4 ml-11 block h-0.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <span key={step} className="block h-full origin-left rounded-full bg-flame motion-safe:animate-[site-progress_4.2s_linear_both]" />
                </span>
              )}
            </button>
          </li>
        ))}
      </ol>

      <div className="rounded-[2rem] bg-white/[0.04] p-2 ring-1 ring-inset ring-white/[0.08]">
        <div className="flex min-h-80 flex-col justify-center rounded-3xl bg-graphite-800 p-6 sm:p-8">
          {step === 0 && (
            <div key="s0" className="site-in">
              <p className="text-sm text-mist">Сайт клиники</p>
              <div className="mt-3 flex items-center gap-3 rounded-2xl bg-graphite p-2 pl-4 ring-1 ring-inset ring-white/[0.08]">
                <span className="text-mist/60">https://</span>
                <span className="flex-1 truncate text-base text-white">
                  {typedSite}
                  <span className="site-caret ml-0.5 inline-block h-4 w-px translate-y-0.5 bg-flame" />
                </span>
                <span className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors duration-500 ${typedSite === site ? "bg-flame text-graphite" : "bg-white/[0.06] text-mist"}`}>Изучить</span>
              </div>
              <p className={`mt-4 text-sm text-pulse transition-opacity duration-500 ${typedSite === site ? "opacity-100" : "opacity-0"}`}>Читаем страницы услуг, цен и врачей…</p>
            </div>
          )}
          {step === 1 && (
            <div key="s1" className="site-in">
              <p className="text-sm text-mist">Нашли на сайте и вписали в сценарии</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {facts.map((f, i) => (
                  <li
                    key={f}
                    className={`rounded-full px-3 py-1.5 text-sm transition duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${i < factCount ? "translate-y-0 bg-white/[0.06] text-white opacity-100" : "translate-y-2 opacity-0"}`}
                  >
                    {f}
                  </li>
                ))}
              </ul>
              <p className={`mt-6 text-sm text-mist transition-opacity duration-500 ${factCount === facts.length ? "opacity-100" : "opacity-0"}`}>
                Пациенты узнают цены, акции и врачей именно вашей клиники.
              </p>
            </div>
          )}
          {step === 2 && (
            <div key="s2" className="site-in">
              <div className="flex items-center justify-between">
                <p className="text-sm text-mist">Звонит пациентка</p>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-pulse/10 px-2 py-0.5 text-xs font-medium text-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-pulse" />
                  Тренировка
                </span>
              </div>
              <p className="mt-4 max-w-[85%] rounded-2xl rounded-bl-md bg-graphite-700 px-4 py-3 text-base text-white">{call}</p>
              <p className={`mt-3 ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-flame px-4 py-3 text-base text-graphite transition duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${tick > 14 ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}>
                Да, скидка 20% действует. В субботу есть 11:00 и 14:30, какое время удобнее?
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
