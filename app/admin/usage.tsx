"use client";

import { Fragment, useEffect, useState } from "react";
import { OVERAGE_RUB_PER_MIN, PLANS } from "@/lib/plans";
import { Panel, PanelTitle } from "../ui";

// Owner usage: voice minutes, calls and our cost per clinic and administrator, and the plan each clinic's last 30 days
// point to. During the beta nothing is limited; this is for choosing the plan in each contract.

type Totals = { calls30: number; minutes30: number; text30: number; pending30: number; costRub30: number; minutesAll: number };
type Person = Totals & { id: number; name: string; login: string; patientMinutes30: number; operatorMinutes30: number; active30: boolean };
type Clinic = Totals & {
  id: number; legalName: string; city: string; seats: number; active30: number;
  plan: { key: string; label: string; priceRub: number; extraMinutes: number };
  users: Person[];
};
type Report = { usdRub: number; totals: Totals; owner: Totals; clinics: Clinic[]; syncFailed: number };

const rub = (v: number) => `${v.toLocaleString("ru-RU")} ₽`;
const min = (v: number) => v.toLocaleString("ru-RU", { maximumFractionDigits: 1 });

function Figure({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-slate-50">{value}</dd>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function UsagePanel() {
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/admin/usage", { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || `Ошибка ${r.status}`);
        setData(body as Report);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (!data) return error ? <p role="alert" className="alert alert-error">{error}</p> : <p className="text-sm text-slate-500">Загружаем расход из ElevenLabs…</p>;
  const { totals, owner, clinics } = data;
  return (
    <div className="flex flex-col gap-5">
      <Panel>
        <dl className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          <Figure label="Минут голоса за 30 дней" value={min(totals.minutes30)} hint={`всего с начала: ${min(totals.minutesAll)}`} />
          <Figure label="Голосовых звонков" value={totals.calls30} hint="за 30 дней" />
          <Figure label="Текстовых тренировок" value={totals.text30} hint="за 30 дней" />
          <Figure label="Себестоимость" value={rub(totals.costRub30)} hint={`за 30 дней, курс ${data.usdRub.toLocaleString("ru-RU")} ₽/$`} />
        </dl>
        {(totals.pending30 > 0 || data.syncFailed > 0) && (
          <p className="mt-4 text-xs text-slate-500">
            {totals.pending30 > 0 && `Ещё уточняются ${totals.pending30} зв.: ElevenLabs пока не отдал их длительность. `}
            {data.syncFailed > 0 && `Не удалось спросить ElevenLabs про ${data.syncFailed} зв., попробуем при следующем открытии.`}
          </p>
        )}
      </Panel>

      <Panel innerClassName="p-0">
        <div className="px-5 pt-5">
          <PanelTitle>Клиники</PanelTitle>
          <p className="mt-1 text-xs text-slate-500">Бета до 30 ноября: лимитов нет. Тариф подобран по числу администраторов и минутам голоса за последние 30 дней. Нажмите на клинику, чтобы увидеть администраторов.</p>
        </div>
        {clinics.length === 0 ? (
          <p className="p-5 text-sm text-slate-400">Клиник пока нет.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="px-5 py-2.5 font-medium">Клиника</th>
                  <th className="px-3 py-2.5 text-right font-medium" title="Заведено / тренировались за 30 дней">Админ.</th>
                  <th className="px-3 py-2.5 text-right font-medium">Мин. голоса 30 дн.</th>
                  <th className="px-3 py-2.5 text-right font-medium">Звонков / текст</th>
                  <th className="px-3 py-2.5 text-right font-medium">Себестоимость</th>
                  <th className="px-3 py-2.5 text-right font-medium">Мин. всего</th>
                  <th className="px-5 py-2.5 font-medium">Тариф по расходу</th>
                </tr>
              </thead>
              <tbody>
                {clinics.map((c) => (
                  <Fragment key={c.id}>
                    <tr onClick={() => setOpen(open === c.id ? null : c.id)} className="cursor-pointer border-t border-white/[0.06] transition hover:bg-white/[0.04]">
                      <td className="px-5 py-3">
                        <button type="button" aria-expanded={open === c.id} className="text-left font-medium text-slate-100 hover:text-accent">
                          <span className="mr-1.5 inline-block w-3 text-slate-500">{open === c.id ? "▾" : "▸"}</span>
                          {c.legalName}
                        </button>
                        <span className="block pl-[1.125rem] text-xs text-slate-500">{c.city}</span>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{c.seats} / {c.active30}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{min(c.minutes30)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{c.calls30} / {c.text30}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{rub(c.costRub30)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-400">{min(c.minutesAll)}</td>
                      <td className="px-5 py-3">
                        <span className="font-medium text-slate-100">{c.plan.label}</span>
                        <span className="block text-xs tabular-nums text-slate-500">
                          {rub(c.plan.priceRub)} в мес.{c.plan.extraMinutes > 0 && `, из них ${c.plan.extraMinutes} мин. сверх пакета`}
                        </span>
                      </td>
                    </tr>
                    {open === c.id &&
                      (c.users.length === 0 ? (
                        <tr className="bg-white/[0.02]"><td colSpan={7} className="px-5 py-3 pl-10 text-sm text-slate-500">Администраторов пока нет.</td></tr>
                      ) : (
                        c.users.map((u) => (
                          <tr key={u.id} className="bg-white/[0.02] text-slate-300">
                            <td className="px-5 py-2.5 pl-10">
                              {u.name}
                              <span className="block text-xs text-slate-500">{u.login}</span>
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs text-slate-500">{u.active30 ? "активен" : "не тренировался"}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums" title={`Пациенты ${min(u.patientMinutes30)} мин., виртуальный оператор ${min(u.operatorMinutes30)} мин.`}>
                              {min(u.minutes30)}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums">{u.calls30} / {u.text30}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums">{rub(u.costRub30)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{min(u.minutesAll)}</td>
                            <td className="px-5 py-2.5 text-xs text-slate-500">
                              {u.operatorMinutes30 > 0 && `оператор ${min(u.operatorMinutes30)} мин.`}
                            </td>
                          </tr>
                        ))
                      ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {owner.calls30 + owner.text30 > 0 && (
          <p className="border-t border-white/[0.06] px-5 py-3 text-xs text-slate-500">
            Ваши тестовые звонки за 30 дней: {min(owner.minutes30)} мин., {owner.calls30} голосом и {owner.text30} текстом, {rub(owner.costRub30)}. В клиники не входят.
          </p>
        )}
      </Panel>

      <Panel>
        <PanelTitle>Тарифы для договоров</PanelTitle>
        <ul className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          {PLANS.map((p) => (
            <li key={p.key} className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-inset ring-white/[0.07]">
              <p className="font-medium text-slate-100">{p.label}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-slate-50">{rub(p.priceRub)}</p>
              <p className="mt-1 text-xs text-slate-500">
                {Number.isFinite(p.admins) ? `до ${p.admins} администраторов` : "от 9 администраторов или несколько филиалов"}, {p.minutes} мин. голоса в месяц
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">Сверх пакета — {OVERAGE_RUB_PER_MIN} ₽ за минуту. Текстовые тренировки без ограничений.</p>
      </Panel>
    </div>
  );
}
