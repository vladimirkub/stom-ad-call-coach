"use client";

import { Panel, PageHeader, Shell } from "../ui";
import { Alert } from "../icons";
import { useState } from "react";

const fmt = (n: number) => Math.round(n).toLocaleString("ru-RU");

function Field({ label, value, onChange, suffix }: { label: string; value: number; onChange: (v: number) => void; suffix: string }) {
  return (
    <label className="block text-sm">
      <span className="text-slate-400">{label}</span>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="field tabular-nums"
        />
        <span className="w-10 text-xs text-slate-500">{suffix}</span>
      </div>
    </label>
  );
}

export default function Calculator() {
  // Placeholder inputs for illustration only: replace them with the clinic's real numbers.
  const [leads, setLeads] = useState(15);
  const [booking, setBooking] = useState(40);
  const [showUp, setShowUp] = useState(60);
  const [treat, setTreat] = useState(50);
  const [check, setCheck] = useState(60000);
  const [dBooking, setDBooking] = useState(10);
  const [dShowUp, setDShowUp] = useState(15);

  const revenue = (b: number, s: number) => leads * 30 * (Math.min(b, 100) / 100) * (Math.min(s, 100) / 100) * (treat / 100) * check;
  const now = revenue(booking, showUp);
  const after = revenue(booking + dBooking, showUp + dShowUp);
  const noShowLoss = leads * 30 * (booking / 100) * (1 - showUp / 100) * (treat / 100) * check;

  return (
    <Shell width="max-w-5xl">
      <PageHeader eyebrow="Деньги" title="Калькулятор потерь">
        Сколько выручки клиника теряет между заявкой и лечением и сколько вернёт обучение операторов.
      </PageHeader>
      <p className="rise alert alert-warn mb-4 flex gap-2" style={{ animationDelay: "80ms" }}><Alert className="mt-0.5 h-4 w-4 shrink-0" />Это модельный расчёт. Значения по умолчанию условные, подставьте реальные цифры клиники из CRM.</p>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <div className="space-y-4">
          <Panel delay={100} innerClassName="space-y-4 p-5">
            <p className="text-xs font-medium text-slate-500">Воронка сейчас</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Заявок в день" value={leads} onChange={setLeads} suffix="шт." />
              <Field label="Заявка → запись на приём" value={booking} onChange={setBooking} suffix="%" />
              <Field label="Запись → пациент пришёл" value={showUp} onChange={setShowUp} suffix="%" />
              <Field label="Пришёл → начал лечение" value={treat} onChange={setTreat} suffix="%" />
              <Field label="Средний чек лечения" value={check} onChange={setCheck} suffix="₽" />
            </div>
          </Panel>
          <Panel delay={140} innerClassName="space-y-4 p-5">
            <p className="text-xs font-medium text-slate-500">После обучения</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Прирост записи" value={dBooking} onChange={setDBooking} suffix="п.п." />
              <Field label="Прирост явки" value={dShowUp} onChange={setDShowUp} suffix="п.п." />
            </div>
          </Panel>
        </div>

        <Panel delay={180} tone="accent" className="lg:sticky lg:top-4 lg:self-start" innerClassName="space-y-5 p-6">
          <div>
            <p className="eyebrow">Прирост выручки</p>
            <p className="mt-1 text-4xl font-semibold tabular-nums tracking-[-0.03em] text-slate-50 sm:text-5xl">+{fmt(after - now)} ₽</p>
            <p className="text-sm text-slate-400">в месяц</p>
          </div>
          <dl className="space-y-2.5 border-t border-white/[0.06] pt-4 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-slate-400">Выручка сейчас</dt><dd className="tabular-nums text-slate-100">{fmt(now)} ₽</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-400">При указанном приросте</dt><dd className="tabular-nums text-slate-100">{fmt(after)} ₽</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-400">Теряется на неявках сейчас</dt><dd className="tabular-nums text-rose-300">{fmt(noShowLoss)} ₽</dd></div>
          </dl>
          <p className="text-xs text-slate-500">Формула: заявки × 30 × запись × явка × лечение × чек. Расчёт предполагает, что остальные показатели не меняются.</p>
        </Panel>
      </div>
    </Shell>
  );
}
