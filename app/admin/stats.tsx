"use client";

import { useEffect, useState } from "react";
import { SKILLS } from "@/lib/scoring";
import { TEMPO } from "@/lib/tempo";
import { Panel, PanelTitle } from "../ui";

// Owner statistics: overview -> clinic -> trainee -> one call. Each level loads from /api/admin/stats.

export type StatsView = { view: "overview" } | { view: "clinic"; id: number } | { view: "user"; id: number } | { view: "training"; id: string };

type Overview = {
  totals: { trainings7: number; trainings30: number; activeUsers7: number; average30: number | null };
  clinics: { id: number; legalName: string; city: string; users: number; active7: number; trainings7: number; trainings30: number; avg30: number | null; lastAt: number | null }[];
};
type Skills = Record<string, number | null>;
type ClinicStats = {
  clinic: { id: number; legalName: string; city: string; slug: string };
  calls30: number;
  skills: Skills;
  misses: { id: string; label: string; count: number; share: number }[];
  users: { id: number; firstName: string; lastName: string; login: string; active: boolean; count: number; average: number | null; booked: number; lastAt: number | null; voiceAvgS: number | null; onTimeShare: number | null; change7: number | null }[];
};
type UserStats = {
  user: { id: number; firstName: string; lastName: string; login: string; active: boolean; clinicId: number; clinicName: string };
  count: number;
  average: number | null;
  booked: number;
  skills: Skills;
  trainings: { id: string; patient: string; mode: string; startedAt: number; duration: number; endedBy: string | null; total: number; booked: boolean }[];
};
type Training = {
  id: string; patient: string; trainee: string; userId: number; mode: string; startedAt: number; duration: number; endedBy: string | null;
  transcript: { role: "user" | "agent"; text: string }[];
  live: string[];
  evaluation: { total: number; summary: string; appointmentBooked: boolean; checklist: { id: string; label: string; done: boolean; evidence?: string }[]; improvements?: string[]; strengths?: string[] };
};

function useStats<T>(query: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setData(null);
    fetch(`/api/admin/stats?${query}`, { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || `Ошибка ${r.status}`);
        if (live) setData(body as T);
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [query]);
  return { data, error };
}

const dateTime = (ms: number) => new Date(ms).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const ago = (ms: number | null) => {
  if (!ms) return "не тренировался";
  const days = Math.floor((Date.now() - ms) / 864e5);
  return days === 0 ? "сегодня" : days === 1 ? "вчера" : `${days} дн. назад`;
};
const minutes = (s: number) => (s < 60 ? `${s} с` : `${Math.round(s / 60)} мин`);
const scoreTone = (v: number | null) => (v == null ? "text-slate-500" : v >= 70 ? "text-accent" : v >= 40 ? "text-amber-200" : "text-rose-300");

function Loading({ error }: { error: string }) {
  return error ? <p role="alert" className="alert alert-error">{error}</p> : <p className="text-sm text-slate-500">Загружаем…</p>;
}

/** Downloads the PDF report; a plain link, so the browser saves the file under the name the server gives it. */
function PdfButton({ type, id }: { type: "clinic" | "user"; id: number }) {
  return (
    <a href={`/api/admin/report?type=${type}&id=${id}`} download className="btn btn-ghost shrink-0 px-4 py-2 text-xs">
      Скачать PDF
    </a>
  );
}

function Back({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="mb-4 rounded-full px-3 py-1.5 text-sm text-slate-400 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06] hover:text-slate-100">
      ← {children}
    </button>
  );
}

function Figure({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-slate-50">{value}</dd>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function SkillBars({ skills }: { skills: Skills }) {
  return (
    <ul className="flex flex-col gap-3">
      {SKILLS.map((s) => {
        const v = skills[s.key];
        return (
          <li key={s.key}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-slate-300">{s.label}</span>
              <span className={`tabular-nums ${scoreTone(v == null ? null : v * 10)}`}>{v == null ? "—" : `${v}/10`}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-accent" style={{ width: `${(v ?? 0) * 10}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Score of each call over time, oldest to newest, on a fixed 0-100 scale. */
function ScoreChart({ points }: { points: { at: number; total: number }[] }) {
  if (points.length < 2) return <p className="text-sm text-slate-500">График появится после двух оценённых звонков.</p>;
  const W = 640, H = 160, P = 28;
  const x = (i: number) => P + (i * (W - 2 * P)) / (points.length - 1);
  const y = (v: number) => H - P - (v / 100) * (H - 2 * P);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.total).toFixed(1)}`).join(" ");
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[420px]" role="img" aria-label="Баллы по звонкам во времени">
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={P} x2={W - P} y1={y(v)} y2={y(v)} stroke="currentColor" className="text-white/10" strokeDasharray={v === 50 ? "3 4" : undefined} />
            <text x={P - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="currentColor" className="text-slate-500">{v}</text>
          </g>
        ))}
        <path d={`${line} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill="currentColor" className="text-accent/10" />
        <path d={line} fill="none" stroke="currentColor" strokeWidth="2" className="text-accent" />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.total)} r={i === points.length - 1 ? 4.5 : 3} fill="currentColor" className="text-accent">
            <title>{`${dateTime(p.at)}: ${p.total}/100`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

export function StatsPanel({ nav, go }: { nav: StatsView; go: (v: StatsView) => void }) {
  if (nav.view === "clinic") return <ClinicView id={nav.id} go={go} />;
  if (nav.view === "user") return <UserView id={nav.id} go={go} />;
  if (nav.view === "training") return <TrainingView id={nav.id} go={go} />;
  return <OverviewView go={go} />;
}

function OverviewView({ go }: { go: (v: StatsView) => void }) {
  const { data, error } = useStats<Overview>("view=overview");
  if (!data) return <Loading error={error} />;
  const { totals, clinics } = data;
  return (
    <div className="flex flex-col gap-5">
      <Panel>
        <dl className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          <Figure label="Тренировок за 7 дней" value={totals.trainings7} />
          <Figure label="Тренировок за 30 дней" value={totals.trainings30} />
          <Figure label="Активных администраторов" value={totals.activeUsers7} hint="тренировались за 7 дней" />
          <Figure label="Средний балл" value={totals.average30 == null ? "—" : <span className={scoreTone(totals.average30)}>{totals.average30}</span>} hint="за 30 дней, из 100" />
        </dl>
      </Panel>
      <Panel innerClassName="p-0">
        <div className="px-5 pt-5"><PanelTitle>Клиники</PanelTitle></div>
        {clinics.length === 0 ? (
          <p className="p-5 text-sm text-slate-400">Клиник пока нет. Заведите первую во вкладке «Клиники и доступы».</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="px-5 py-2.5 font-medium">Клиника</th>
                  <th className="px-3 py-2.5 text-right font-medium">Админ.</th>
                  <th className="px-3 py-2.5 text-right font-medium">Активны 7 дн.</th>
                  <th className="px-3 py-2.5 text-right font-medium">Звонков 7 / 30 дн.</th>
                  <th className="px-3 py-2.5 text-right font-medium">Средний балл</th>
                  <th className="px-5 py-2.5 font-medium">Последняя тренировка</th>
                </tr>
              </thead>
              <tbody>
                {clinics.map((c) => (
                  <tr key={c.id} onClick={() => go({ view: "clinic", id: c.id })} className="cursor-pointer border-t border-white/[0.06] transition hover:bg-white/[0.04]">
                    <td className="px-5 py-3">
                      <button type="button" className="text-left font-medium text-slate-100 hover:text-accent" onClick={(e) => { e.stopPropagation(); go({ view: "clinic", id: c.id }); }}>
                        {c.legalName}
                      </button>
                      <span className="block text-xs text-slate-500">{c.city}</span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{c.users}</td>
                    <td className={`px-3 py-3 text-right tabular-nums ${c.active7 === 0 && c.users > 0 ? "text-rose-300" : ""}`}>{c.active7}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{c.trainings7} / {c.trainings30}</td>
                    <td className={`px-3 py-3 text-right tabular-nums ${scoreTone(c.avg30)}`}>{c.avg30 ?? "—"}</td>
                    <td className={`px-5 py-3 ${c.lastAt ? "text-slate-400" : "text-rose-300"}`}>{ago(c.lastAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function ClinicView({ id, go }: { id: number; go: (v: StatsView) => void }) {
  const { data, error } = useStats<ClinicStats>(`view=clinic&id=${id}`);
  if (!data) return <><Back onClick={() => go({ view: "overview" })}>Сводка</Back><Loading error={error} /></>;
  const { clinic, users, skills, misses, calls30 } = data;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Back onClick={() => go({ view: "overview" })}>Сводка</Back>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">{clinic.city}</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-balance">{clinic.legalName}</h2>
            <p className="mt-1 text-sm text-slate-500">Звонков за 30 дней: {calls30}</p>
          </div>
          <PdfButton type="clinic" id={clinic.id} />
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelTitle>Навыки команды</PanelTitle>
          <p className="mt-1 mb-4 text-xs text-slate-500">Средние оценки за 30 дней, из 10</p>
          <SkillBars skills={skills} />
        </Panel>
        <Panel>
          <PanelTitle>Частые ошибки</PanelTitle>
          <p className="mt-1 mb-4 text-xs text-slate-500">Пункты чек-листа, которые команда пропускает чаще всего, за 30 дней</p>
          {misses.length === 0 ? (
            <p className="text-sm text-slate-500">Пока нет оценённых звонков.</p>
          ) : (
            <ol className="flex flex-col gap-2.5">
              {misses.map((m) => (
                <li key={m.id} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-slate-300">{m.label}</span>
                  <span className="shrink-0 tabular-nums text-rose-300">{m.share}% звонков</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
      <Panel innerClassName="p-0">
        <div className="px-5 pt-5"><PanelTitle>Администраторы</PanelTitle></div>
        {users.length === 0 ? (
          <p className="p-5 text-sm text-slate-400">В клинике нет администраторов.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="px-5 py-2.5 font-medium">Администратор</th>
                  <th className="px-3 py-2.5 text-right font-medium">Звонков</th>
                  <th className="px-3 py-2.5 text-right font-medium">Средний балл</th>
                  <th className="px-3 py-2.5 text-right font-medium">За неделю</th>
                  <th className="px-3 py-2.5 text-right font-medium">Записали</th>
                  <th className="px-3 py-2.5 text-right font-medium" title="Средняя длина голосового звонка">Средний звонок</th>
                  <th className="px-3 py-2.5 text-right font-medium" title="Доля голосовых звонков не дольше 3 минут">В 3 мин</th>
                  <th className="px-5 py-2.5 font-medium">Последняя тренировка</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} onClick={() => go({ view: "user", id: u.id })} className={`cursor-pointer border-t border-white/[0.06] transition hover:bg-white/[0.04] ${u.active ? "" : "text-slate-500"}`}>
                    <td className="px-5 py-3">
                      <button type="button" className="text-left font-medium hover:text-accent" onClick={(e) => { e.stopPropagation(); go({ view: "user", id: u.id }); }}>
                        {u.lastName} {u.firstName}
                      </button>
                      {!u.active && <span className="chip ml-2">отключён</span>}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{u.count}</td>
                    <td className={`px-3 py-3 text-right tabular-nums ${scoreTone(u.average)}`}>{u.average ?? "—"}</td>
                    <td className={`px-3 py-3 text-right tabular-nums ${u.change7 == null ? "text-slate-500" : u.change7 > 0 ? "text-accent" : u.change7 < 0 ? "text-rose-300" : ""}`}>
                      {u.change7 == null ? "—" : `${u.change7 > 0 ? "+" : ""}${u.change7}`}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{u.booked}</td>
                    <td className={`px-3 py-3 text-right tabular-nums ${u.voiceAvgS != null && u.voiceAvgS > TEMPO.targetSeconds ? "text-amber-200" : ""}`}>
                      {u.voiceAvgS == null ? "—" : `${Math.floor(u.voiceAvgS / 60)}:${String(u.voiceAvgS % 60).padStart(2, "0")}`}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{u.onTimeShare == null ? "—" : `${u.onTimeShare}%`}</td>
                    <td className={`px-5 py-3 ${u.lastAt ? "text-slate-400" : "text-rose-300"}`}>{ago(u.lastAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function UserView({ id, go }: { id: number; go: (v: StatsView) => void }) {
  const { data, error } = useStats<UserStats>(`view=user&id=${id}`);
  if (!data) return <><Back onClick={() => go({ view: "overview" })}>Сводка</Back><Loading error={error} /></>;
  const { user, trainings } = data;
  const points = [...trainings].reverse().map((t) => ({ at: t.startedAt, total: t.total }));
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Back onClick={() => go({ view: "clinic", id: user.clinicId })}>{user.clinicName}</Back>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">{user.clinicName}</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">{user.lastName} {user.firstName}</h2>
            <p className="mt-1 font-mono text-xs text-slate-500">{user.login}{!user.active && " · доступ отключён"}</p>
          </div>
          <PdfButton type="user" id={user.id} />
        </div>
      </div>
      <Panel>
        <dl className="grid grid-cols-3 gap-5">
          <Figure label="Звонков" value={data.count} />
          <Figure label="Средний балл" value={data.average == null ? "—" : <span className={scoreTone(data.average)}>{data.average}</span>} hint="из 100" />
          <Figure label="Записали пациента" value={data.booked} hint={data.count ? `${Math.round((100 * data.booked) / data.count)}% звонков` : undefined} />
        </dl>
      </Panel>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel>
          <PanelTitle>Балл по звонкам</PanelTitle>
          <div className="mt-4"><ScoreChart points={points} /></div>
        </Panel>
        <Panel>
          <PanelTitle>Навыки</PanelTitle>
          <p className="mt-1 mb-4 text-xs text-slate-500">Средние оценки по всем звонкам, из 10</p>
          <SkillBars skills={data.skills} />
        </Panel>
      </div>
      <Panel innerClassName="p-0">
        <div className="px-5 pt-5"><PanelTitle>Все звонки</PanelTitle></div>
        {trainings.length === 0 ? (
          <p className="p-5 text-sm text-slate-400">Оценённых звонков пока нет.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="px-5 py-2.5 font-medium">Когда</th>
                  <th className="px-3 py-2.5 font-medium">Пациент</th>
                  <th className="px-3 py-2.5 font-medium">Режим</th>
                  <th className="px-3 py-2.5 text-right font-medium">Длительность</th>
                  <th className="px-3 py-2.5 text-right font-medium">Балл</th>
                  <th className="px-5 py-2.5 font-medium">Запись</th>
                </tr>
              </thead>
              <tbody>
                {trainings.map((t) => (
                  <tr key={t.id} onClick={() => go({ view: "training", id: t.id })} className="cursor-pointer border-t border-white/[0.06] transition hover:bg-white/[0.04]">
                    <td className="px-5 py-3">
                      <button type="button" className="text-left hover:text-accent" onClick={(e) => { e.stopPropagation(); go({ view: "training", id: t.id }); }}>
                        {dateTime(t.startedAt)}
                      </button>
                    </td>
                    <td className="px-3 py-3">{t.patient}</td>
                    <td className="px-3 py-3 text-slate-400">{t.mode === "voice" ? "голос" : "текст"}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-400">{minutes(t.duration)}</td>
                    <td className={`px-3 py-3 text-right tabular-nums ${scoreTone(t.total)}`}>{t.total}</td>
                    <td className="px-5 py-3">{t.booked ? <span className="text-accent">записан</span> : <span className="text-slate-500">нет</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function TrainingView({ id, go }: { id: string; go: (v: StatsView) => void }) {
  const { data, error } = useStats<Training>(`view=training&id=${encodeURIComponent(id)}`);
  if (!data) return <><Back onClick={() => go({ view: "overview" })}>Сводка</Back><Loading error={error} /></>;
  const ev = data.evaluation;
  const missed = ev.checklist.filter((c) => !c.done);
  const passed = ev.checklist.filter((c) => c.done);
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Back onClick={() => go({ view: "user", id: data.userId })}>{data.trainee}</Back>
        <p className="eyebrow">{dateTime(data.startedAt)} · {data.mode === "voice" ? "голос" : "текст"} · {minutes(data.duration)}{data.endedBy === "patient" ? " · пациент положил трубку" : ""}</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">{data.trainee} → {data.patient}</h2>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel>
            <div className="flex items-baseline gap-3">
              <span className={`text-5xl font-semibold tracking-tight tabular-nums ${scoreTone(ev.total)}`}>{ev.total}</span>
              <span className="text-sm text-slate-500">/100 · {ev.appointmentBooked ? "пациент записан" : "запись не оформлена"}</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-pretty text-slate-300">{ev.summary}</p>
          </Panel>
          <Panel>
            <PanelTitle tone="bad">Не выполнено · {missed.length}</PanelTitle>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {missed.map((c) => (
                <li key={c.id}>
                  <span className="text-slate-200">{c.label}</span>
                  {c.evidence && <span className="block text-xs text-slate-500">{c.evidence}</span>}
                </li>
              ))}
            </ul>
            <div className="mt-5">
              <PanelTitle tone="accent">Выполнено · {passed.length}</PanelTitle>
            </div>
            <ul className="mt-3 flex flex-col gap-1.5 text-sm text-slate-400">
              {passed.map((c) => <li key={c.id}>{c.label}</li>)}
            </ul>
          </Panel>
        </div>
        <Panel>
          <PanelTitle>Диалог</PanelTitle>
          <div className="mt-4 flex flex-col gap-2.5">
            {data.transcript.map((t, i) => (
              <div key={i} className={`bubble ${t.role === "user" ? "bubble-mine self-end" : "bubble-theirs self-start"}`}>
                <span className="bubble-label">{t.role === "user" ? data.trainee : data.patient}</span>
                {t.text}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
