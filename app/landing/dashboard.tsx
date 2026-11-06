"use client";

import { useState } from "react";

// Screen 7: a mock of the manager's cabinet. Made-up numbers, marked «Демо» in the corner as the brief requires.
// The 7 / 30 day switch swaps every figure, the chart redraws and the score bars slide to their new length.

const DATA = {
  7: {
    avg: 76.4,
    delta: "+4,2",
    calls: 38,
    best: 94,
    points: [68, 71, 70, 74, 73, 78, 81],
    team: [
      ["Анна Ковалёва", 84.6, 11],
      ["Дарья Пименова", 79.1, 9],
      ["Ольга Терехова", 73.8, 10],
      ["Марина Савина", 67.2, 8],
    ],
    errors: [
      ["Не назвали следующий шаг", 34],
      ["Цена без объяснения ценности", 27],
      ["Не выяснили, кто принимает решение", 19],
      ["Не подтвердили время записи", 12],
    ],
  },
  30: {
    avg: 71.8,
    delta: "+9,6",
    calls: 146,
    best: 96,
    points: [58, 61, 60, 64, 66, 65, 69, 70, 72, 71, 75, 76],
    team: [
      ["Анна Ковалёва", 81.3, 41],
      ["Дарья Пименова", 74.9, 37],
      ["Ольга Терехова", 70.2, 36],
      ["Марина Савина", 61.7, 32],
    ],
    errors: [
      ["Цена без объяснения ценности", 31],
      ["Не назвали следующий шаг", 29],
      ["Не выяснили, кто принимает решение", 22],
      ["Перебивали пациента", 14],
    ],
  },
} as const;

const HISTORY = [
  ["Сегодня, 14:12", "Анна Ковалёва", "Стоимость · «А почему так дорого?»", 91],
  ["Сегодня, 11:47", "Марина Савина", "Возражение · «Я подумаю»", 63],
  ["Вчера, 17:05", "Дарья Пименова", "Запись · «Мне нужно сегодня»", 82],
  ["Вчера, 10:31", "Ольга Терехова", "Претензия · «Верните деньги»", 74],
] as const;

const fmt = (n: number) => n.toLocaleString("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function Dashboard() {
  const [range, setRange] = useState<7 | 30>(7);
  const d = DATA[range];
  const min = 50, max = 90;
  const path = d.points
    .map((p, i) => `${i ? "L" : "M"}${((i / (d.points.length - 1)) * 300).toFixed(1)},${(100 - ((p - min) / (max - min)) * 100).toFixed(1)}`)
    .join(" ");

  return (
    <div className="rounded-[2rem] bg-white/[0.04] p-2 ring-1 ring-inset ring-white/[0.08]">
      <div className="rounded-3xl bg-graphite-800 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <p className="text-base font-semibold text-white">Кабинет руководителя</p>
            <span className="rounded-md bg-flame px-2 py-0.5 text-xs font-semibold text-graphite">Демо</span>
          </div>
          <div className="flex rounded-full bg-graphite p-1 ring-1 ring-inset ring-white/[0.06]" role="tablist" aria-label="Период">
            {([7, 30] as const).map((r) => (
              <button
                key={r}
                type="button"
                role="tab"
                aria-selected={range === r}
                onClick={() => setRange(r)}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${range === r ? "bg-white text-graphite" : "text-mist hover:text-white"}`}
              >
                {r} дней
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            ["Средний балл команды", fmt(d.avg), `${d.delta} за период`],
            ["Тренировок", String(d.calls), "голос и текст"],
            ["Лучший звонок", String(d.best), "из 100"],
          ].map(([k, v, note]) => (
            <div key={k} className="rounded-2xl bg-graphite p-4 ring-1 ring-inset ring-white/[0.05]">
              <p className="text-xs text-mist">{k}</p>
              <p key={`${range}-${v}`} className="site-in mt-2 text-3xl font-semibold tracking-tight tabular-nums text-white">{v}</p>
              <p className="mt-1 text-xs text-pulse">{note}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1.3fr_1fr]">
          <div className="rounded-2xl bg-graphite p-4 ring-1 ring-inset ring-white/[0.05]">
            <p className="text-xs text-mist">Динамика среднего балла</p>
            <svg viewBox="0 0 300 100" preserveAspectRatio="none" className="mt-3 h-32 w-full overflow-visible" aria-hidden>
              {[0, 50, 100].map((y) => (
                <line key={y} x1="0" x2="300" y1={y} y2={y} stroke="rgb(255 255 255 / 0.06)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              ))}
              <path key={range} d={path} fill="none" stroke="var(--color-flame)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="site-in" />
            </svg>
            <div className="mt-2 flex justify-between text-xs text-mist/60">
              <span>{range === 7 ? "7 дней назад" : "30 дней назад"}</span>
              <span>Сегодня</span>
            </div>
          </div>
          <div className="rounded-2xl bg-graphite p-4 ring-1 ring-inset ring-white/[0.05]">
            <p className="text-xs text-mist">Рейтинг сотрудников</p>
            <ul className="mt-3 grid gap-3">
              {d.team.map(([name, score, n], i) => (
                <li key={name}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate text-white">
                      <span className="mr-2 text-mist/60">{i + 1}</span>
                      {name}
                    </span>
                    <span className="tabular-nums text-white">{fmt(score)}</span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full origin-left rounded-full bg-pulse transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ transform: `scaleX(${score / 100})` }} />
                  </div>
                  <p className="mt-1 text-xs text-mist/60">{n} тренировок</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-2xl bg-graphite p-4 ring-1 ring-inset ring-white/[0.05]">
            <p className="text-xs text-mist">Частые ошибки</p>
            <ul className="mt-3 grid gap-2.5">
              {d.errors.map(([e, pct]) => (
                <li key={e} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-white/90">{e}</span>
                  <span className="shrink-0 rounded-md bg-flame/10 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-flame">{pct}%</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-graphite p-4 ring-1 ring-inset ring-white/[0.05]">
            <p className="text-xs text-mist">История тренировок</p>
            <ul className="mt-3 grid gap-2.5">
              {HISTORY.map(([when, who, patient, score]) => (
                <li key={when} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate text-white/90">{who}</span>
                    <span className="block truncate text-xs text-mist/70">{when} · {patient}</span>
                  </span>
                  <span className={`shrink-0 text-base font-semibold tabular-nums ${score >= 75 ? "text-pulse" : "text-flame"}`}>{score}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
