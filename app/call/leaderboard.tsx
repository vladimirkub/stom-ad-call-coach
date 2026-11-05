"use client";

import { useEffect, useState } from "react";

// The clinic's best three administrators this month and the administrator's own place (lib/leaderboard.ts), under the
// call button on /call: a little competition inside the team.

type Board = {
  month: string;
  minCalls: number;
  top: { name: string; average: number; calls: number; me: boolean }[];
  me: { counted: boolean; calls: number; average: number | null; place: number | null; of: number };
};

const calls = (n: number) => {
  const d = n % 10, dd = n % 100;
  return `${n} ${d === 1 && dd !== 11 ? "звонок" : d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? "звонка" : "звонков"}`;
};
// Gold, silver and bronze, toned to the dark interface.
const MEDAL = ["bg-amber-300 text-ink-950", "bg-slate-300 text-ink-950", "bg-orange-400/90 text-ink-950"];

export function Leaderboard() {
  const [board, setBoard] = useState<Board | null>(null);
  useEffect(() => {
    fetch("/api/me/leaderboard", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { board: Board | null } | null) => setBoard(b?.board ?? null))
      .catch(() => null);
  }, []);
  if (!board) return null;
  const { me } = board;
  const left = Math.max(0, board.minCalls - me.calls);

  return (
    <div className="rise bezel w-full max-w-sm text-left" style={{ animationDelay: "220ms" }}>
      <div className="bezel-core p-4">
        <p className="eyebrow">Рейтинг клиники</p>
        <h2 className="mt-0.5 text-base font-semibold tracking-tight text-slate-50">Лучшие администраторы {board.month}</h2>
        {board.top.length === 0 ? (
          <p className="mt-3 text-sm text-pretty text-slate-400">Пока никто не сделал {calls(board.minCalls)} в этом месяце. Станьте первым в рейтинге.</p>
        ) : (
          <ol className="mt-3 flex flex-col gap-1.5">
            {board.top.map((t, i) => (
              <li key={i} className={`flex items-center gap-3 rounded-xl px-2.5 py-2 ${t.me ? "bg-accent/10 ring-1 ring-inset ring-accent/30" : "bg-white/[0.03]"}`}>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${MEDAL[i]}`}>{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-100">{t.name}{t.me && <span className="ml-1.5 text-xs font-normal text-accent">это вы</span>}</span>
                  <span className="block text-[11px] text-slate-500">{calls(t.calls)}</span>
                </span>
                <span className="text-right">
                  <span className="text-lg font-semibold tabular-nums text-slate-50">{t.average}</span>
                  <span className="text-[11px] text-slate-500">/100</span>
                </span>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-3 border-t border-white/[0.06] pt-3 text-xs text-pretty text-slate-400">
          {!me.counted
            ? "Ваши тренировки в рейтинг команды не входят."
            : me.place
              ? <>Вы на <b className="text-slate-100">{me.place} месте</b> из {me.of} · ваш средний балл <b className="text-slate-100">{me.average}</b></>
              : left > 0
                ? <>Ещё {calls(left)} в этом месяце, и вы попадёте в рейтинг{me.average != null && <> · сейчас ваш средний балл {me.average}</>}.</>
                : null}
        </p>
      </div>
    </div>
  );
}
