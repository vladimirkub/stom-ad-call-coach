"use client";

import Link from "next/link";
import { useState } from "react";

const fmt = (n: number) => Math.round(n).toLocaleString("ru-RU");

function Field({ label, value, onChange, suffix }: { label: string; value: number; onChange: (v: number) => void; suffix: string }) {
  return (
    <label className="block text-sm">
      <span className="text-slate-300">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 outline-none focus:border-emerald-400"
        />
        <span className="w-10 text-slate-500">{suffix}</span>
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
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-8">
      <Link href="/" className="text-xs text-slate-500 hover:text-slate-300">← На главную</Link>
      <h1 className="text-2xl font-bold">Калькулятор потерь</h1>
      <p className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-sm text-amber-200">
        Это модельный расчёт. Значения по умолчанию условные, подставьте реальные цифры клиники из CRM.
      </p>

      <section className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 sm:grid-cols-2">
        <Field label="Заявок в день" value={leads} onChange={setLeads} suffix="шт." />
        <Field label="Заявка → запись на приём" value={booking} onChange={setBooking} suffix="%" />
        <Field label="Запись → пациент пришёл" value={showUp} onChange={setShowUp} suffix="%" />
        <Field label="Пришёл → начал лечение" value={treat} onChange={setTreat} suffix="%" />
        <Field label="Средний чек лечения" value={check} onChange={setCheck} suffix="₽" />
      </section>

      <section className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 sm:grid-cols-2">
        <Field label="Прирост записи после обучения" value={dBooking} onChange={setDBooking} suffix="п.п." />
        <Field label="Прирост явки после обучения" value={dShowUp} onChange={setDShowUp} suffix="п.п." />
      </section>

      <section className="space-y-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-5">
        <p className="text-sm text-slate-300">Выручка в месяц сейчас: <strong>{fmt(now)} ₽</strong></p>
        <p className="text-sm text-slate-300">Выручка при указанном приросте: <strong>{fmt(after)} ₽</strong></p>
        <p className="text-2xl font-bold text-emerald-300">+{fmt(after - now)} ₽ в месяц</p>
        <p className="text-sm text-slate-400">Сейчас на неявках теряется (отдельно от прироста): {fmt(noShowLoss)} ₽ в месяц.</p>
        <p className="text-xs text-slate-500">Формула: заявки × 30 × запись × явка × лечение × чек. Расчёт предполагает, что остальные показатели не меняются.</p>
      </section>
    </main>
  );
}
