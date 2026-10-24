"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { KbEntry } from "@/lib/kb";

export default function Knowledge() {
  const [entries, setEntries] = useState<KbEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/knowledge").then((r) => r.json()).then((b) => setEntries(b.entries ?? [])).catch(() => setError("Не удалось загрузить базу знаний"));
  }, []);

  async function remove(id: string) {
    setError(null);
    try {
      const res = await fetch("/api/knowledge/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      if (!res.ok) throw new Error();
      setEntries((prev) => (prev ?? []).filter((e) => e.id !== id));
    } catch {
      setError("Не удалось удалить правило");
    }
  }

  const group = (kind: "do" | "avoid") => (entries ?? []).filter((e) => e.kind === kind);

  const Section = ({ kind, title, tone }: { kind: "do" | "avoid"; title: string; tone: string }) => (
    <section className="space-y-3">
      <h2 className={`text-lg font-semibold ${tone}`}>{title} ({group(kind).length})</h2>
      {group(kind).length === 0 && <p className="text-sm text-slate-500">Пока ничего.</p>}
      {group(kind).map((e) => (
        <article key={e.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs text-slate-400">Когда: {e.situation}</p>
            <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300" title="Сколько звонков подтвердили правило">×{e.confirmations}</span>
          </div>
          <p className="mt-1 text-slate-100">{e.advice}</p>
          {e.example && <p className="mt-1 italic text-slate-400">«{e.example}»</p>}
          <button onClick={() => remove(e.id)} className="mt-2 text-xs text-slate-500 underline hover:text-red-300">Удалить правило</button>
        </article>
      ))}
    </section>
  );

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Link href="/" className="text-xs text-slate-500 hover:text-slate-300">← На главную</Link>
      <div>
        <h1 className="text-2xl font-bold">База знаний виртуального оператора</h1>
        <p className="mt-1 text-sm text-slate-400">
          Практики, которые выделяются из разбора каждого звонка. Перед каждым новым звонком самые подтверждённые подставляются в инструкцию оператора. Лишнее или сомнительное правило можно удалить.
        </p>
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
      {entries === null ? <p className="text-sm text-slate-500">Загружаем…</p> : (
        <>
          {Section({ kind: "do", title: "Что работает", tone: "text-emerald-300" })}
          {Section({ kind: "avoid", title: "Чего избегать", tone: "text-red-300" })}
        </>
      )}
    </main>
  );
}
