"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Panel, PanelTitle } from "../ui";

// The owner's editor for one clinic's legend: its websites, the analysis that drafts facts from them, the draft
// itself (edit, delete, add) and approval. Trainings use only the approved version.

type SectionKey = string;
type Fact = { section: SectionKey; text: string; source: string | null };
type Page = { url: string; ok: boolean; error?: string; title?: string; extra?: boolean };
type Legend = { id: number; status: "analyzing" | "draft" | "failed" | "approved" | "archived"; version: number | null; facts: Fact[]; pages: Page[]; error: string | null; updatedAt: number; approvedAt: number | null };
type State = {
  sections: { key: SectionKey; label: string; hint: string }[];
  offersSource: string;
  sites: { url: string; label: string }[];
  offers: string;
  approved: Legend | null;
  working: Legend | null;
  history: { id: number; version: number; approvedAt: number; facts: number; status: string }[];
  changes: { added: string[]; removed: Fact[] } | null;
  patients: { status: "pending" | "ready" | "failed" | null; error: string | null; personas: Record<string, Fit> } | null;
};
type Fit = { lead: string; situation: string; concerns: string };

const date = (ms: number) => new Date(ms).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
const shortUrl = (u: string) => {
  try {
    const p = new URL(u);
    return `${p.hostname.replace(/^www\./, "")}${p.pathname === "/" ? "" : decodeURIComponent(p.pathname)}`;
  } catch {
    return u;
  }
};

async function call(clinicId: number, body?: object): Promise<State> {
  const res = await fetch(body ? "/api/admin/legend" : `/api/admin/legend?clinicId=${clinicId}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify({ clinicId, ...body }) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
  return data as State;
}

export function LegendEditor({ clinicId, onChanged }: { clinicId: number; onChanged: () => void }) {
  const [state, setState] = useState<State | null>(null);
  const [sites, setSites] = useState<{ url: string; label: string }[]>([]);
  const [offers, setOffers] = useState("");
  const [facts, setFacts] = useState<Fact[]>([]);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  const apply = useCallback((s: State, keepEdits = false) => {
    setState(s);
    setSites(s.sites.length ? s.sites : [{ url: "", label: "Официальный сайт" }]);
    setOffers(s.offers);
    if (!keepEdits) {
      setFacts(s.working?.status === "draft" ? s.working.facts : []);
      setDirty(false);
    }
  }, []);

  const run = useCallback(
    async (label: string, body?: object, done?: string) => {
      setBusy(label);
      setError("");
      setNotice("");
      try {
        apply(await call(clinicId, body));
        if (done) setNotice(done);
        onChanged();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy("");
      }
    },
    [apply, clinicId, onChanged],
  );

  useEffect(() => {
    run("load");
  }, [run]);

  // While the server reads the sites or fits the patients, check back every 4 seconds.
  const analyzing = state?.working?.status === "analyzing";
  const fitting = state?.patients?.status === "pending";
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!analyzing && !fitting) return;
    timer.current = setInterval(async () => {
      try {
        const s = await call(clinicId);
        if (s.working?.status !== "analyzing" && s.patients?.status !== "pending") {
          apply(s);
          onChanged();
        }
      } catch {
        // the next tick tries again
      }
    }, 4000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [analyzing, fitting, apply, clinicId, onChanged]);

  if (!state) return <Panel><p className="text-sm text-slate-500">{error || "Загружаем легенду…"}</p></Panel>;

  const { approved, working, sections, changes } = state;
  const draft = working?.status === "draft";
  const hasSources = state.sites.length > 0 || state.offers.length > 0;
  const sourceLabel = (u: string) => (u === state.offersSource ? "текст офферов" : shortUrl(u));
  const added = new Set(changes?.added ?? []);
  const edit = (i: number, patch: Partial<Fact>) => {
    setFacts((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));
    setDirty(true);
  };

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Panel>
        <PanelTitle>Легенда клиники</PanelTitle>
        <p className="mt-2 text-sm text-pretty text-slate-400">
          {approved
            ? <>Утверждена версия {approved.version} от {date(approved.approvedAt!)} · {approved.facts.length} фактов. Тренировки строятся на ней.</>
            : <>Легенда ещё не утверждена: клиника тренируется на общей легенде.</>}
        </p>
        {state.history.length > 1 && (
          <p className="mt-1 text-xs text-slate-500">Прошлые версии: {state.history.filter((h) => h.status === "archived").map((h) => `v${h.version} (${date(h.approvedAt)})`).join(", ")}</p>
        )}
      </Panel>

      <Panel>
        <PanelTitle>Сайты клиники</PanelTitle>
        <p className="mt-1 mb-4 text-xs text-pretty text-slate-500">
          Официальный сайт и лендинги по направлениям. С этих страниц система сама найдёт до 8 внутренних страниц с ценами, акциями, врачами и контактами.
        </p>
        <div className="flex flex-col gap-2">
          {sites.map((s, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]">
              <input id={`site-label-${i}`} className="field" placeholder="Например, Имплантация" value={s.label} onChange={(e) => setSites(sites.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <input id={`site-url-${i}`} className="field" placeholder="https://clinic.ru/implantaciya" inputMode="url" value={s.url} onChange={(e) => setSites(sites.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
              <button type="button" aria-label="Убрать ссылку" className="rounded-full px-3 text-sm text-slate-400 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06]" onClick={() => setSites(sites.filter((_, j) => j !== i))}>
                Убрать
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost px-4 py-2 text-xs" onClick={() => setSites([...sites, { url: "", label: "" }])} disabled={sites.length >= 12}>
            Добавить ссылку
          </button>
          <button type="button" className="btn btn-ghost px-4 py-2 text-xs" disabled={!!busy} onClick={() => run("sites", { action: "sites", sites: sites.filter((s) => s.url.trim()) }, "Сайты сохранены")}>
            Сохранить сайты
          </button>
        </div>
      </Panel>

      <Panel>
        <PanelTitle>Рекламные офферы</PanelTitle>
        <p className="mt-1 mb-3 text-xs text-pretty text-slate-500">
          Если сайт скупой или его нет: вставьте тексты объявлений, лендингов, прайс и акции. Анализ учтёт их вместе с сайтами, а без сайтов соберёт легенду только из них.
        </p>
        <textarea
          id="legend-offers"
          className="field min-h-[9rem] resize-y"
          placeholder={"Например:\nИмплант Osstem под ключ — 39 900 ₽ вместо 55 000 ₽, акция до 30 ноября.\nКонсультация и КТ бесплатно. Рассрочка 0% на 12 месяцев."}
          value={offers}
          maxLength={20000}
          onChange={(e) => setOffers(e.target.value)}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-ghost px-4 py-2 text-xs" disabled={!!busy || offers === state.offers} onClick={() => run("offers", { action: "offers", offers }, "Офферы сохранены")}>
            Сохранить офферы
          </button>
          <span className="text-xs tabular-nums text-slate-600">{offers.length.toLocaleString("ru-RU")} / 20 000</span>
        </div>
      </Panel>

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-pretty text-slate-400">
            {hasSources
              ? `Источники: ${[state.sites.length ? `сайтов ${state.sites.length}` : "", state.offers ? "текст офферов" : ""].filter(Boolean).join(" и ")}.`
              : "Сохраните хотя бы одну ссылку или текст офферов."}
          </p>
          <button
            type="button"
            className="btn btn-primary px-4 py-2 text-xs"
            disabled={!!busy || analyzing || !hasSources}
            onClick={() => run("analyze", { action: "analyze" })}
          >
            {approved || draft ? "Обновить легенду" : "Составить легенду"}
          </button>
        </div>
        {draft && dirty && <p className="mt-2 text-xs text-amber-200">Новый анализ заменит черновик вместе с вашими правками.</p>}
        {(sites.some((s, i) => s.url !== (state.sites[i]?.url ?? "") && s.url.trim()) || offers !== state.offers) && (
          <p className="mt-2 text-xs text-amber-200">Есть несохранённые изменения в сайтах или офферах: анализ возьмёт сохранённые.</p>
        )}
      </Panel>

      {analyzing && (
        <Panel tone="accent">
          <p className="flex items-center gap-2.5 text-sm text-slate-200">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
            Читаем сайты и составляем черновик. Обычно это 1–3 минуты, страницу можно не держать открытой.
          </p>
        </Panel>
      )}

      {working?.status === "failed" && <p role="alert" className="alert alert-error">Анализ не удался: {working.error}</p>}

      {draft && (
        <Panel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <PanelTitle>Черновик · {facts.length} фактов</PanelTitle>
              <p className="mt-1 text-xs text-pretty text-slate-500">
                Проверьте каждый факт по ссылке на источник, исправьте или удалите лишнее. В тренировки попадёт только утверждённая версия.
              </p>
            </div>
            {changes && (
              <span className="chip">
                новых {changes.added.length} · пропало {changes.removed.length}
              </span>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-6">
            {sections.map((sec) => {
              const items = facts.map((f, i) => ({ f, i })).filter(({ f }) => f.section === sec.key);
              return (
                <section key={sec.key} aria-labelledby={`sec-${sec.key}`}>
                  <h3 id={`sec-${sec.key}`} className="text-sm font-semibold text-slate-100">{sec.label}</h3>
                  <p className="text-xs text-slate-500">{sec.hint}</p>
                  <ul className="mt-2 flex flex-col gap-2">
                    {items.map(({ f, i }) => (
                      <li key={i} className="rounded-xl bg-ink-950/50 p-2.5 ring-1 ring-inset ring-white/[0.06]">
                        <textarea
                          id={`fact-${i}`}
                          aria-label={`Факт: ${sec.label}`}
                          className="field min-h-[2.75rem] resize-y py-2"
                          rows={Math.min(4, Math.ceil(f.text.length / 90))}
                          value={f.text}
                          onChange={(e) => edit(i, { text: e.target.value })}
                        />
                        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="flex min-w-0 items-center gap-2">
                            {added.has(f.text) && <span className="chip bg-accent/15 text-accent">новое</span>}
                            {f.source === state.offersSource ? (
                              <span className="text-slate-500">из текста офферов</span>
                            ) : f.source ? (
                              <a href={f.source} target="_blank" rel="noreferrer" className="truncate text-slate-500 underline-offset-2 hover:text-accent hover:underline">
                                {sourceLabel(f.source)}
                              </a>
                            ) : (
                              <span className="text-slate-600">{sec.key === "missing" ? "на сайте не найдено" : "без источника"}</span>
                            )}
                          </span>
                          <button type="button" className="text-slate-500 transition hover:text-rose-300" onClick={() => { setFacts(facts.filter((_, j) => j !== i)); setDirty(true); }}>
                            Удалить
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <button type="button" className="mt-2 text-xs text-accent hover:underline" onClick={() => { setFacts([...facts, { section: sec.key, text: "", source: null }]); setDirty(true); }}>
                    + Добавить факт
                  </button>
                </section>
              );
            })}
          </div>

          {changes && changes.removed.length > 0 && (
            <div className="mt-6 rounded-xl bg-rose-500/[0.06] p-3 ring-1 ring-inset ring-rose-400/20">
              <p className="text-sm font-medium text-rose-200">Пропало по сравнению с утверждённой версией</p>
              <ul className="mt-2 flex flex-col gap-1.5 text-sm text-slate-300">
                {changes.removed.map((f, i) => (
                  <li key={i} className="flex items-start justify-between gap-3">
                    <span>{f.text}</span>
                    <button type="button" className="shrink-0 text-xs text-accent hover:underline" onClick={() => { setFacts([...facts, f]); setDirty(true); }}>
                      Вернуть
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-4">
            <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => run("approve", { action: "approve", facts: facts.filter((f) => f.text.trim()) }, "Легенда утверждена")}>
              Утвердить легенду
            </button>
            <button type="button" className="btn btn-ghost" disabled={!!busy || !dirty} onClick={() => run("save", { action: "save", facts: facts.filter((f) => f.text.trim()) }, "Черновик сохранён")}>
              Сохранить черновик
            </button>
            <button type="button" className="ml-auto text-sm text-slate-500 hover:text-rose-300" disabled={!!busy} onClick={() => run("discard", { action: "discard" })}>
              Удалить черновик
            </button>
          </div>
        </Panel>
      )}

      {!draft && !analyzing && approved && (
        <Panel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <PanelTitle>Утверждённая легенда · версия {approved.version}</PanelTitle>
            <button type="button" className="btn btn-ghost px-4 py-2 text-xs" disabled={!!busy} onClick={() => run("save", { action: "save", facts: approved.facts })}>
              Редактировать
            </button>
          </div>
          <div className="mt-4 flex flex-col gap-4">
            {sections.map((sec) => {
              const items = approved.facts.filter((f) => f.section === sec.key);
              if (items.length === 0) return null;
              return (
                <section key={sec.key}>
                  <h3 className="text-sm font-semibold text-slate-100">{sec.label}</h3>
                  <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-5 text-sm text-slate-300">
                    {items.map((f, i) => <li key={i}>{f.text}</li>)}
                  </ul>
                </section>
              );
            })}
          </div>
        </Panel>
      )}

      {approved && state.patients && (
        <Panel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <PanelTitle>Пациенты под эту клинику</PanelTitle>
              <p className="mt-1 text-xs text-pretty text-slate-500">
                Те же шесть характеров, но с услугами, ценами и акциями из легенды. Подстраиваются после каждого утверждения.
              </p>
            </div>
            <button type="button" className="btn btn-ghost px-4 py-2 text-xs" disabled={!!busy || fitting} onClick={() => run("refit", { action: "refit" })}>
              Пересобрать пациентов
            </button>
          </div>
          {fitting && (
            <p className="mt-4 flex items-center gap-2.5 text-sm text-slate-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
              Подстраиваем пациентов под легенду, около минуты. Пока это идёт, тренировки используют общих пациентов.
            </p>
          )}
          {state.patients.status === "failed" && <p role="alert" className="alert alert-error mt-4">Не удалось подстроить пациентов: {state.patients.error}</p>}
          {state.patients.status === "ready" && (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {Object.entries(state.patients.personas).map(([id, p]) => (
                <li key={id} className="rounded-xl bg-ink-950/50 p-3 ring-1 ring-inset ring-white/[0.06]">
                  <p className="text-sm text-slate-200">{p.lead}</p>
                  <details className="mt-2 text-xs text-slate-400">
                    <summary className="cursor-pointer text-slate-500 hover:text-slate-300">Ситуация и вопросы</summary>
                    <p className="mt-2 text-pretty">{p.situation}</p>
                    <p className="mt-2 whitespace-pre-line">{p.concerns}</p>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {(working?.pages.length ?? 0) > 0 && (
        <details className="bezel">
          <summary className="bezel-core cursor-pointer list-none p-4 text-sm text-slate-300">
            Прочитанные страницы: {working!.pages.filter((p) => p.ok).length} из {working!.pages.length}
          </summary>
          <ul className="flex flex-col gap-1.5 px-5 pt-3 pb-4 text-xs">
            {working!.pages.map((p, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-2">
                {p.url === state.offersSource ? (
                  <span className="text-slate-400">Текст офферов</span>
                ) : (
                  <a href={p.url} target="_blank" rel="noreferrer" className="min-w-0 truncate text-slate-400 hover:text-accent">
                    {p.extra ? "↳ " : ""}{shortUrl(p.url)}
                  </a>
                )}
                <span className={p.ok ? "text-accent" : "text-rose-300"}>{p.ok ? "прочитана" : p.error}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {error && <p role="alert" className="alert alert-error">{error}</p>}
      {notice && <p className="alert bg-accent/10 text-accent ring-accent/30">{notice}</p>}
    </div>
  );
}
