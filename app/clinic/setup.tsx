"use client";

import { useCallback, useEffect, useState } from "react";
import { Panel, PanelTitle } from "../ui";
import { FormerDoctorsFields } from "./settings";

// The clinic manager's own setup (lib/clinic-setup.ts): five steps and one rebuild, no approval by Stom AD. Changes in
// prices, offers, payment and doctors are shown for a quick review before they apply; everything else applies alone.

type Fact = { section: string; text: string; source: string | null };
type Site = { url: string; label: string };
type Option = { key: string; label: string; hint: string };
type State = {
  autonomous: true;
  sections: Option[];
  options: Option[];
  sites: Site[];
  offers: string;
  directions: string[];
  wishes: string;
  formerDoctors: string[];
  ownFacts: Fact[];
  version: number | null;
  rebuild: { status: "analyzing" | "draft" | "failed"; error: string | null; startedAt: number } | null;
  review: { changes: { added: string[]; removed: Fact[] }; facts: Fact[] } | null;
  patients: { status: "pending" | "ready" | "failed" | null; error: string | null; ready: number; total: number } | null;
  rebuildsLeft: number;
  history: { id: number; version: number; approvedAt: number; facts: number; status: string; author: string; note: string }[];
};

const date = (ms: number) => new Date(ms).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

async function call(body?: object): Promise<State | { autonomous: false }> {
  const res = await fetch("/api/clinic/setup", body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || `Ошибка ${res.status}`);
  return out;
}

function Step({ n, title, hint, children }: { n: number; title: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <Panel>
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">{n}</span>
        <div className="min-w-0 flex-1">
          <PanelTitle>{title}</PanelTitle>
          {hint && <p className="mt-1 mb-3 text-xs text-pretty text-slate-500">{hint}</p>}
          {!hint && <div className="mb-3" />}
          {children}
        </div>
      </div>
    </Panel>
  );
}

/** The setup page, or null when the clinic is not autonomous (the caller then shows the proposals page). */
export function ClinicSetup({ onManual }: { onManual: () => void }) {
  const [state, setState] = useState<State | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [offers, setOffers] = useState("");
  const [directions, setDirections] = useState<string[]>([]);
  const [wishes, setWishes] = useState("");
  const [former, setFormer] = useState<string[]>([]);
  const [own, setOwn] = useState<Fact[]>([]);
  const [editing, setEditing] = useState<Fact[] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const apply = useCallback((s: State, keepEdits = false) => {
    setState(s);
    if (keepEdits) return;
    setSites(s.sites.length ? s.sites : [{ url: "", label: "Официальный сайт" }]);
    setOffers(s.offers);
    setDirections(s.directions);
    setWishes(s.wishes);
    setFormer(s.formerDoctors);
    setOwn(s.ownFacts);
    setDirty(false);
  }, []);

  const load = useCallback(
    async (body?: object, done?: string, keepEdits = false) => {
      if (body) setBusy((body as { action: string }).action);
      setError("");
      setNotice("");
      try {
        const s = await call(body);
        if (!s.autonomous) return onManual();
        apply(s, keepEdits);
        if (done) setNotice(done);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return false;
      } finally {
        setBusy("");
      }
    },
    [apply, onManual],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // While the rebuild runs or the patients are being refitted, check every few seconds; the fields stay as edited.
  const running = state?.rebuild?.status === "analyzing" || state?.patients?.status === "pending";
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => void load(undefined, undefined, true), 4000);
    return () => clearInterval(t);
  }, [running, load]);

  if (!state) return <p className="text-sm text-slate-500">{error || "Загружаем настройки…"}</p>;

  const fields = () => ({ sites: sites.filter((s) => s.url.trim()), offers, directions, wishes, formerDoctors: former, ownFacts: own.filter((f) => f.text.trim()) });
  const edit = <T,>(set: (v: T) => void) => (v: T) => { set(v); setDirty(true); };
  const rebuild = () => {
    if (!wishes.trim()) return setError("Заполните пожелания к тренировке (шаг 3): без них пересборка не запускается.");
    void load({ action: "rebuild", ...fields() }, "Пересборка запущена. Администраторы пока тренируются на текущей версии.");
  };
  const sectionLabel = (k: string) => state.sections.find((s) => s.key === k)?.label ?? k;
  const ownSections = state.sections.filter((s) => s.key !== "missing");

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-pretty text-slate-400">
            {state.version
              ? <>Сейчас тренировки идут на легенде версии {state.version}. Измените нужное и нажмите «Пересобрать легенду и пациентов» внизу.</>
              : <>Легенды у клиники ещё нет. Заполните шаги и нажмите кнопку внизу: через несколько минут пациенты будут готовы.</>}
          </p>
          {state.version && state.patients?.status === "ready" && (
            <span className="rounded-full bg-accent/15 px-3 py-1 text-xs text-accent">Легенда v{state.version} · {state.patients.ready} пациентов готовы</span>
          )}
        </div>
      </Panel>

      <Step n={1} title="Сайты и рекламные офферы" hint="Отсюда тренажёр берёт цены, акции, адреса и врачей. До 12 страниц.">
        <div className="flex flex-col gap-2">
          {sites.map((s, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_14rem_auto]">
              <input
                id={`setup-site-${i}`}
                aria-label="Адрес сайта"
                className="field text-[13px]"
                placeholder="https://clinic.ru"
                value={s.url}
                onChange={(e) => edit(setSites)(sites.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
              />
              <input
                aria-label="Подпись"
                className="field text-[13px]"
                placeholder="Официальный сайт"
                value={s.label}
                onChange={(e) => edit(setSites)(sites.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
              />
              <button type="button" onClick={() => edit(setSites)(sites.filter((_, j) => j !== i))} className="rounded-full px-3 py-1 text-xs text-slate-400 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06]">
                Убрать
              </button>
            </div>
          ))}
          {sites.length < 12 && (
            <button type="button" onClick={() => edit(setSites)([...sites, { url: "", label: "" }])} className="w-fit rounded-full px-3 py-1 text-xs font-medium text-accent ring-1 ring-inset ring-accent/40 transition hover:bg-accent/10">
              + Добавить сайт
            </button>
          )}
          <textarea
            id="setup-offers"
            className="field mt-2 min-h-[5rem] resize-y text-[13px]"
            placeholder="Текст объявлений, лендингов, прайса и акций: «Имплант под ключ от 39 900 ₽ до 30 ноября…»"
            value={offers}
            maxLength={20000}
            onChange={(e) => edit(setOffers)(e.target.value)}
          />
        </div>
      </Step>

      <Step n={2} title="Направления клиники" hint="Пациенты приходят по этим направлениям.">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {state.options.map((o) => (
            <label key={o.key} className="flex items-start gap-2.5 rounded-xl bg-white/[0.03] p-3 ring-1 ring-inset ring-white/[0.07]">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
                checked={directions.includes(o.key)}
                onChange={(e) => edit(setDirections)(e.target.checked ? [...directions, o.key] : directions.filter((d) => d !== o.key))}
              />
              <span className="min-w-0">
                <span className="block text-sm text-slate-100">{o.label}</span>
                <span className="block text-xs text-slate-500">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </Step>

      <Step
        n={3}
        title={<>Пожелания к тренировке <span className="text-xs font-normal text-rose-300">обязательно</span></>}
        hint="Своими словами: на чём проверить ваших администраторов. Пациенты сами поднимут эти темы, а в разборе звонка появится блок «По пожеланиям клиники»."
      >
        <textarea
          id="setup-wishes"
          className="field min-h-[6rem] resize-y"
          placeholder="Хочу проверить, как администраторы отрабатывают «дорого», рассказывают про опыт врачей и не отпускают пациента со словами «подумаю»"
          value={wishes}
          maxLength={100000}
          onChange={(e) => edit(setWishes)(e.target.value)}
        />
      </Step>

      <Step n={4} title="Врачи, которые уволились" hint="Пациент №25 будет просить записать его к одному из них. Если пусто, тренажёр возьмёт вымышленные имена.">
        <FormerDoctorsFields value={former} onChange={edit(setFormer)} />
      </Step>

      <Step n={5} title="Свои факты" hint="То, чего нет на сайте: парковка, условия рассрочки, новые акции. Сохраняются при каждой пересборке.">
        <ul className="flex flex-col gap-2">
          {own.map((f, i) => (
            <li key={i} className="grid gap-2 sm:grid-cols-[12rem_1fr_auto]">
              <select
                aria-label="Раздел"
                className="field text-[13px]"
                value={f.section}
                onChange={(e) => edit(setOwn)(own.map((x, j) => (j === i ? { ...x, section: e.target.value } : x)))}
              >
                {ownSections.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <input
                aria-label="Факт"
                className="field text-[13px]"
                maxLength={400}
                placeholder="Бесплатная парковка во дворе клиники"
                value={f.text}
                onChange={(e) => edit(setOwn)(own.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
              />
              <button type="button" onClick={() => edit(setOwn)(own.filter((_, j) => j !== i))} className="rounded-full px-3 py-1 text-xs text-slate-400 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06]">
                Удалить
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => edit(setOwn)([...own, { section: "features", text: "", source: null }])} className="mt-2 rounded-full px-3 py-1 text-xs font-medium text-accent ring-1 ring-inset ring-accent/40 transition hover:bg-accent/10">
          + Добавить факт
        </button>
      </Step>

      {error && <p role="alert" className="alert alert-error">{error}</p>}
      {notice && <p role="status" className="text-sm text-accent">{notice}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" disabled={!!busy || state.rebuild?.status === "analyzing" || !!state.review} onClick={rebuild}>
          {busy === "rebuild" ? "Запускаем…" : "Пересобрать легенду и пациентов"}
        </button>
        <button type="button" className="btn btn-ghost" disabled={!!busy || !dirty} onClick={() => void load({ action: "save", ...fields() }, "Сохранено. В тренировках изменения появятся после пересборки.")}>
          Сохранить без пересборки
        </button>
        <span className="text-xs text-slate-500">Пересборок осталось сегодня: {state.rebuildsLeft} из 5</span>
      </div>

      {(state.rebuild?.status === "analyzing" || state.patients?.status === "pending") && (
        <Panel tone="accent">
          <PanelTitle>Пересборка идёт</PanelTitle>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            <li className={state.rebuild?.status === "analyzing" ? "text-accent" : "text-slate-300"}>
              {state.rebuild?.status === "analyzing" ? "Читаем сайты и составляем легенду…" : "✓ Легенда составлена"}
            </li>
            {state.patients?.status === "pending" && state.rebuild?.status !== "analyzing" && <li className="text-accent">Подстраиваем пациентов под новую легенду…</li>}
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            {state.rebuild?.status === "analyzing"
              ? "Администраторы пока тренируются на прежней версии. Страницу можно не обновлять."
              : "Обычно это 1–2 минуты: пациенты появятся у администраторов, как только подстройка закончится. Страницу можно не обновлять."}
          </p>
        </Panel>
      )}
      {state.rebuild?.status === "failed" && (
        <p role="alert" className="alert alert-error">Пересборка не удалась: {state.rebuild.error || "неизвестная ошибка"}. Текущая легенда не изменилась, попробуйте ещё раз.</p>
      )}
      {state.patients?.status === "failed" && state.rebuild?.status !== "analyzing" && (
        <p role="alert" className="alert alert-error">Не всех пациентов удалось подстроить: {state.patients.error}. Тренажёр попробует снова через 15 минут.</p>
      )}

      {state.review && (
        <Panel tone="accent">
          <PanelTitle>Проверьте важные изменения</PanelTitle>
          <p className="mt-1 text-xs text-pretty text-slate-500">
            {state.version ? "Показаны только цены, акции, оплата и врачи. Остальное применится само." : "Это первая легенда клиники: проверьте цены, акции, оплату и врачей."}
          </p>
          {!editing ? (
            <>
              <ul className="mt-3 flex flex-col gap-1 text-sm text-slate-300">
                {state.review.changes.added.map((t, i) => <li key={`a${i}`}><span className="text-accent">+</span> {t}</li>)}
                {state.review.changes.removed.map((f, i) => <li key={`r${i}`} className="text-slate-500"><span className="text-rose-300">−</span> <s>{f.text}</s></li>)}
                {!state.review.changes.added.length && !state.review.changes.removed.length && <li className="text-slate-500">Значимых изменений нет.</li>}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => void load({ action: "apply" }, "Легенда применена, пациенты подстраиваются")}>
                  Применить и подстроить пациентов
                </button>
                <button type="button" className="btn btn-ghost" disabled={!!busy} onClick={() => setEditing(state.review!.facts)}>Поправить факты</button>
                <button type="button" className="btn btn-ghost" disabled={!!busy} onClick={() => void load({ action: "discard" }, "Пересборка отменена, легенда не изменилась")}>Отменить</button>
              </div>
            </>
          ) : (
            <>
              <ul className="mt-3 flex flex-col gap-2">
                {editing.map((f, i) => (
                  <li key={i} className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
                    <span className="pt-2 text-xs text-slate-500">{sectionLabel(f.section)}</span>
                    <textarea
                      aria-label={sectionLabel(f.section)}
                      className="field min-h-[2.5rem] resize-y text-[13px]"
                      rows={Math.min(3, Math.max(1, Math.ceil(f.text.length / 90)))}
                      value={f.text}
                      maxLength={400}
                      onChange={(e) => setEditing(editing.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                    />
                    <button type="button" onClick={() => setEditing(editing.filter((_, j) => j !== i))} className="rounded-full px-3 py-1 text-xs text-slate-400 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06]">
                      Удалить
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!!busy}
                  onClick={async () => { if (await load({ action: "apply", facts: editing.filter((f) => f.text.trim()) }, "Легенда применена, пациенты подстраиваются")) setEditing(null); }}
                >
                  Применить с правками
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Назад</button>
              </div>
            </>
          )}
        </Panel>
      )}

      {state.history.length > 0 && (
        <Panel>
          <PanelTitle>История версий</PanelTitle>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm">
            {state.history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="w-9 font-semibold tabular-nums text-slate-200">v{h.version}</span>
                <span className="text-xs text-slate-500">{date(h.approvedAt)} · {h.author || "Stom AD"}{h.note ? ` · ${h.note}` : ""}</span>
                {h.status === "approved" ? (
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] text-accent">текущая</span>
                ) : (
                  <button
                    type="button"
                    disabled={!!busy || running}
                    onClick={() => window.confirm(`Вернуть версию ${h.version}? Пациенты пересоберутся под неё.`) && void load({ action: "rollback", version: h.version }, `Возвращена версия ${h.version}`)}
                    className="rounded-full px-2.5 py-0.5 text-[11px] text-slate-300 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06]"
                  >
                    Вернуть
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
