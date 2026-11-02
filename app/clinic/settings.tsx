"use client";

import { useCallback, useEffect, useState } from "react";
import { Panel, PanelTitle } from "../ui";

// The clinic manager's settings: the clinic's directions and the facts patients and the evaluator know about it. The
// manager edits a copy and sends it; nothing changes in trainings until Stom AD approves it (lib/proposals.ts).

type Fact = { section: string; text: string; source: string | null };
type Changes = { directionsAdded: string[]; directionsRemoved: string[]; facts: { added: string[]; removed: Fact[] }; wishes: { before: string; after: string } | null; stale: boolean };
type Decision = { status: "approved" | "rejected"; answer: string; decidedAt: number };
type State = {
  sections: { key: string; label: string; hint: string }[];
  options: { key: string; label: string; hint: string }[];
  directions: string[];
  facts: Fact[];
  wishes: string;
  version: number | null;
  pending: { updatedAt: number; comment: string; changes: Changes } | null;
  last: Decision | null;
};

const date = (ms: number) => new Date(ms).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

async function call(body?: object): Promise<State> {
  const res = await fetch("/api/clinic/settings", body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || `Ошибка ${res.status}`);
  return out as State;
}

export function ClinicSettings() {
  const [state, setState] = useState<State | null>(null);
  const [directions, setDirections] = useState<string[]>([]);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [comment, setComment] = useState("");
  const [wishes, setWishes] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const apply = useCallback((s: State) => {
    setState(s);
    setDirections(s.directions);
    setFacts(s.facts);
    setWishes(s.wishes);
    setComment(s.pending?.comment ?? "");
    setDirty(false);
  }, []);

  const run = useCallback(
    async (body?: object, done?: string) => {
      setBusy(true);
      setError("");
      setNotice("");
      try {
        apply(await call(body));
        if (done) setNotice(done);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [apply],
  );

  useEffect(() => {
    run();
  }, [run]);

  if (!state) return <Panel><p className="text-sm text-slate-500">{error || "Загружаем настройки…"}</p></Panel>;
  if (state.version == null) {
    return (
      <Panel>
        <PanelTitle>Легенда клиники ещё не готова</PanelTitle>
        <p className="mt-2 text-sm text-pretty text-slate-400">Stom AD собирает факты о клинике с вашего сайта. Когда легенда будет утверждена, здесь можно будет её дополнить.</p>
      </Panel>
    );
  }

  const edit = (i: number, text: string) => {
    setFacts((fs) => fs.map((f, j) => (j === i ? { ...f, text } : f)));
    setDirty(true);
  };
  const remove = (i: number) => {
    setFacts((fs) => fs.filter((_, j) => j !== i));
    setDirty(true);
  };
  const add = (section: string) => {
    setFacts((fs) => [...fs, { section, text: "", source: null }]);
    setDirty(true);
  };
  const toggle = (key: string, on: boolean) => {
    setDirections((ds) => (on ? [...ds, key] : ds.filter((d) => d !== key)));
    setDirty(true);
  };
  const missing = state.sections.find((s) => s.key === "missing");
  const pending = state.pending;

  return (
    <div className="flex flex-col gap-5">
      {pending && (
        <Panel tone="accent">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <PanelTitle>Изменения ждут утверждения</PanelTitle>
              <p className="mt-1 text-sm text-pretty text-slate-400">
                Отправлено {date(pending.updatedAt)}. Пока Stom AD не утвердит изменения, тренировки идут по текущей легенде. Можно поправить и отправить заново.
              </p>
              <ChangeSummary changes={pending.changes} />
            </div>
            <button type="button" disabled={busy} onClick={() => run({ action: "withdraw" }, "Изменения отозваны")} className="btn btn-ghost shrink-0 px-4 py-2 text-xs">
              Отозвать
            </button>
          </div>
        </Panel>
      )}
      {!pending && state.last && (
        <Panel>
          <p className={`text-sm font-medium ${state.last.status === "approved" ? "text-accent" : "text-rose-300"}`}>
            {state.last.status === "approved" ? "Последние изменения утверждены" : "Последние изменения отклонены"} · {date(state.last.decidedAt)}
          </p>
          {state.last.answer && <p className="mt-1 text-sm text-pretty text-slate-400">Комментарий Stom AD: {state.last.answer}</p>}
        </Panel>
      )}

      <Panel>
        <PanelTitle>Направления клиники</PanelTitle>
        <p className="mt-1 mb-4 text-xs text-pretty text-slate-500">
          По каким услугам звонят пациенты в тренажёре. Снимите галочку, если это направление администраторам отрабатывать не нужно.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {state.options.map((o) => {
            const on = directions.includes(o.key);
            return (
              <label key={o.key} className={`flex cursor-pointer gap-3 rounded-xl p-3 ring-1 ring-inset transition ${on ? "bg-accent/10 ring-accent/40" : "bg-ink-950/50 ring-white/[0.06] hover:ring-white/15"}`}>
                <input id={`dir-${o.key}`} type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]" checked={on} onChange={(e) => toggle(o.key, e.target.checked)} />
                <span className="min-w-0">
                  <span className="block text-sm text-slate-100">{o.label}</span>
                  <span className="block text-xs text-slate-500">{o.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </Panel>

      <Panel>
        <PanelTitle>Пожелания к тренировке</PanelTitle>
        <p className="mt-1 mb-3 text-xs text-pretty text-slate-500">
          Своими словами: на чём проверить ваших администраторов. Пациенты сами поднимут эти темы, а в разборе каждого звонка появится блок «По пожеланиям
          клиники».
        </p>
        <textarea
          id="settings-wishes"
          className="field min-h-[7rem] resize-y"
          placeholder="Например: «Хочу проверить, как администраторы отрабатывают страх наркоза у детей, рассказывают про опыт врачей с маленькими пациентами и закрывают возражение „подумаем и перезвоним“»"
          value={wishes}
          maxLength={100000}
          onChange={(e) => { setWishes(e.target.value); setDirty(true); }}
        />
        <p className="mt-2 text-xs tabular-nums text-slate-600">{wishes.length.toLocaleString("ru-RU")} / 100 000</p>
      </Panel>

      <Panel>
        <PanelTitle>Что знают о клинике пациенты и тренер</PanelTitle>
        <p className="mt-1 text-xs text-pretty text-slate-500">
          Факты с вашего сайта и из рекламы. Поправьте устаревшее и добавьте то, чего на сайте нет: парковка, условия рассрочки, новые акции и их сроки.
          Пациенты задают вопросы по этим фактам, а тренер проверяет по ним ответы администраторов.
        </p>
        <div className="mt-4 flex flex-col gap-6">
          {state.sections
            .filter((s) => s.key !== "missing")
            .map((s) => {
              const items = facts.map((f, i) => ({ f, i })).filter(({ f }) => f.section === s.key);
              return (
                <section key={s.key}>
                  <h3 className="text-sm font-semibold text-slate-100">{s.label}</h3>
                  <p className="text-xs text-slate-500">{s.hint}</p>
                  <ul className="mt-2 flex flex-col gap-2">
                    {items.map(({ f, i }) => (
                      <li key={i} className="flex items-start gap-2">
                        <textarea
                          id={`fact-${i}`}
                          aria-label={s.label}
                          className="field min-h-[2.75rem] flex-1 resize-y text-[13px] leading-relaxed"
                          rows={Math.min(4, Math.max(1, Math.ceil(f.text.length / 90)))}
                          value={f.text}
                          maxLength={400}
                          placeholder="Например: «Бесплатная парковка во дворе клиники»"
                          onChange={(e) => edit(i, e.target.value)}
                        />
                        <button type="button" aria-label="Удалить факт" onClick={() => remove(i)} className="mt-1.5 rounded-full px-3 py-1 text-xs text-slate-400 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06] hover:text-rose-300">
                          Удалить
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button type="button" onClick={() => add(s.key)} className="mt-2 rounded-full px-3 py-1 text-xs font-medium text-accent ring-1 ring-inset ring-accent/40 transition hover:bg-accent/10">
                    + Добавить
                  </button>
                </section>
              );
            })}
          {missing && facts.some((f) => f.section === "missing") && (
            <section className="rounded-2xl bg-amber-400/[0.05] p-4 ring-1 ring-inset ring-amber-300/20">
              <h3 className="text-sm font-semibold text-amber-100">{missing.label}</h3>
              <p className="text-xs text-pretty text-slate-400">
                Этого не нашлось на сайте, и пациенты об этом спрашивают. Если у клиники это есть, добавьте факт в нужный раздел выше и уберите строку отсюда.
              </p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {facts.map((f, i) =>
                  f.section === "missing" ? (
                    <li key={i} className="flex items-start justify-between gap-3 text-[13px] text-slate-300">
                      <span>{f.text}</span>
                      <button type="button" aria-label="Убрать" onClick={() => remove(i)} className="shrink-0 rounded-full px-3 py-0.5 text-xs text-slate-400 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06]">
                        Убрать
                      </button>
                    </li>
                  ) : null,
                )}
              </ul>
            </section>
          )}
        </div>
      </Panel>

      <Panel>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-400">
          Комментарий для Stom AD, если нужно
          <textarea id="proposal-comment" className="field min-h-[4rem] resize-y" maxLength={1000} value={comment} onChange={(e) => { setComment(e.target.value); setDirty(true); }} />
        </label>
        {error && <p role="alert" className="alert alert-error mt-3">{error}</p>}
        {notice && <p role="status" className="mt-3 text-sm text-accent">{notice}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !dirty}
            onClick={() => run({ action: "propose", directions, facts: facts.filter((f) => f.text.trim()), wishes, comment }, "Отправлено на утверждение")}
          >
            {busy ? "Отправляем…" : pending ? "Отправить заново" : "Отправить на утверждение"}
          </button>
          <p className="text-xs text-pretty text-slate-500">После утверждения пациенты клиники за пару минут перестроятся под новые факты.</p>
        </div>
      </Panel>
    </div>
  );
}

/** What a proposal changes, in one short list. Also used by the owner's review. */
export function ChangeSummary({ changes }: { changes: Changes }) {
  const { directionsAdded, directionsRemoved, facts, wishes } = changes;
  return (
    <ul className="mt-3 flex flex-col gap-1 text-sm text-slate-300">
      {directionsAdded.length > 0 && <li><span className="text-accent">+ направления:</span> {directionsAdded.join(", ")}</li>}
      {directionsRemoved.length > 0 && <li><span className="text-rose-300">− направления:</span> {directionsRemoved.join(", ")}</li>}
      {wishes && (
        <li>
          <span className="text-accent">пожелания к тренировке:</span> {wishes.after ? <span className="whitespace-pre-line">«{wishes.after}»</span> : <span className="text-slate-500">убраны</span>}
        </li>
      )}
      {facts.added.map((t, i) => <li key={`a${i}`}><span className="text-accent">+</span> {t}</li>)}
      {facts.removed.map((f, i) => <li key={`r${i}`} className="text-slate-500"><span className="text-rose-300">−</span> <s>{f.text}</s></li>)}
    </ul>
  );
}
