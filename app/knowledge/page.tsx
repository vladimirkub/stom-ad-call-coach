"use client";

import { useEffect, useState } from "react";
import type { KbEntry } from "@/lib/kb";
import { Panel, PanelTitle, PageHeader, Shell } from "../ui";
import { Alert, Check } from "../icons";

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

  const Section = ({ kind, title, tone }: { kind: "do" | "avoid"; title: string; tone: "accent" | "bad" }) => (
    <section className="space-y-3">
      <PanelTitle tone={tone} icon={tone === "accent" ? <Check /> : <Alert />}>
        {title} <span className="font-normal tabular-nums text-slate-500">{group(kind).length}</span>
      </PanelTitle>
      {group(kind).length === 0 && <p className="text-sm text-slate-500">Пока ничего.</p>}
      {group(kind).map((e, i) => (
        <Panel key={e.id} as="div" delay={Math.min(i, 8) * 40} innerClassName="p-4 text-sm">
          <article>
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs text-slate-500">Когда: {e.situation}</p>
              <span className="chip shrink-0 tabular-nums" title="Сколько звонков подтвердили правило">×{e.confirmations}</span>
            </div>
            <p className="mt-1.5 leading-relaxed text-pretty text-slate-100">{e.advice}</p>
            {e.example && <p className="mt-2 border-l-2 border-white/10 pl-3 text-slate-400">«{e.example}»</p>}
            <button onClick={() => remove(e.id)} className="mt-3 text-xs text-slate-500 underline-offset-4 transition hover:text-rose-300 hover:underline">Удалить правило</button>
          </article>
        </Panel>
      ))}
    </section>
  );

  return (
    <Shell>
      <PageHeader eyebrow="Общая память" title="База знаний виртуального оператора">
        Практики, которые выделяются из разбора каждого звонка. Перед каждым новым звонком самые подтверждённые подставляются в инструкцию оператора. Лишнее или сомнительное правило можно удалить.
      </PageHeader>
      {error && <p role="alert" className="alert alert-error mb-4">{error}</p>}
      {entries === null ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-3xl bg-white/[0.04]" />)}
        </div>
      ) : (
        <div className="space-y-10">
          {Section({ kind: "do", title: "Что работает", tone: "accent" })}
          {Section({ kind: "avoid", title: "Чего избегать", tone: "bad" })}
        </div>
      )}
    </Shell>
  );
}
