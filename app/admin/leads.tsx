"use client";

import { useCallback, useEffect, useState } from "react";
import { Panel, PanelTitle } from "../ui";

// Owner: connection requests from the Telegram bot. A new request shows who wrote, the automatic site check and the
// buttons; "Выдать доступ" creates the clinic and its manager login and sends the access to the applicant in Telegram.
// Below: requests already decided, with whether the clinic has signed in and trained.

type CheckLine = { ok: boolean; text: string };
type Lead = {
  id: number;
  username: string;
  fullName: string;
  position: string;
  clinic: string;
  city: string;
  site: string;
  hasSite: boolean;
  status: "new" | "approved" | "rejected";
  checkLines: CheckLine[];
  createdAt: number;
  decidedAt: number | null;
  access: { until: number | null; login: string | null; lastLogin: number | null; trainings: number } | null;
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" }, cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Ошибка ${res.status}`);
  return body as T;
}

const when = (t: number) => {
  const d = new Date(t);
  const today = new Date();
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `сегодня ${time}`;
  if (d.toDateString() === new Date(today.getTime() - 864e5).toDateString()) return `вчера ${time}`;
  return `${d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} ${time}`;
};
const dateOnly = (t: number) => new Date(t).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

export function LeadsPanel({ onCount }: { onCount?: (n: number) => void }) {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [linked, setLinked] = useState(true);
  const [botError, setBotError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [issued, setIssued] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    try {
      const r = await api<{ leads: Lead[]; ownerLinked: boolean; botError: string }>("/api/admin/leads");
      setLeads(r.leads);
      setLinked(r.ownerLinked);
      setBotError(r.botError);
      onCount?.(r.leads.filter((l) => l.status === "new").length);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [onCount]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  async function decide(id: number, action: "approve" | "reject" | "delete") {
    if (action === "reject" && !window.confirm("Отклонить заявку? Клиника получит вежливый отказ в Telegram.")) return;
    if (action === "delete" && !window.confirm("Удалить заявку из списка? Если доступ был выдан, клиника и её логины останутся во вкладке «Клиники и доступы».")) return;
    setBusy(id);
    setError("");
    try {
      const r = await api<{ access?: { login: string } }>("/api/admin/leads", { method: "POST", body: JSON.stringify({ action, id }) });
      if (r.access) setIssued((m) => ({ ...m, [id]: r.access!.login }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function link() {
    try {
      const { url } = await api<{ url: string }>("/api/admin/leads", { method: "POST", body: JSON.stringify({ action: "link" }) });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const fresh = leads?.filter((l) => l.status === "new") ?? [];
  const decided = leads?.filter((l) => l.status !== "new") ?? [];

  return (
    <div className="flex flex-col gap-5">
      {botError && <p role="alert" className="alert alert-error">{botError}</p>}
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <PanelTitle>{linked ? "Уведомления приходят в ваш Telegram" : "Привяжите свой Telegram"}</PanelTitle>
            <p className="mt-1 text-sm text-pretty text-slate-400">
              {linked
                ? "Новая заявка придёт сообщением от бота @StomADCallCoach_bot, с кнопками «Выдать доступ» и «Отклонить»."
                : "Нажмите кнопку, Telegram откроет бота: нажмите в нём «Запустить». С этого момента заявки будут приходить вам. Ссылка действует 15 минут."}
            </p>
          </div>
          <button type="button" onClick={link} className={linked ? "btn btn-ghost" : "btn btn-primary"}>
            {linked ? "Перепривязать" : "Привязать Telegram"}
          </button>
        </div>
      </Panel>

      {error && <p role="alert" className="alert alert-error">{error}</p>}

      <Panel delay={60}>
        <PanelTitle>Новые заявки{fresh.length ? ` · ${fresh.length}` : ""}</PanelTitle>
        {leads === null ? (
          <div className="mt-4 grid gap-3">
            {[0, 1].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-white/[0.04]" />)}
          </div>
        ) : fresh.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">Новых заявок нет. Они появятся здесь, когда клиника ответит на вопросы бота: кнопки «Попробовать бесплатно» на сайте ведут в него.</p>
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {fresh.map((l) => (
              <article key={l.id} className="flex flex-col gap-3 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-inset ring-white/[0.07]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-slate-50">{l.clinic}{l.city ? ` · ${l.city}` : ""}</h3>
                    <p className="mt-0.5 text-sm text-slate-200">{[l.fullName, l.position.toLowerCase()].filter(Boolean).join(", ")}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-400">
                      {l.hasSite ? l.site : "сайта нет"}
                      {l.username && (
                        <>
                          {" · "}
                          <a href={`https://t.me/${l.username}`} target="_blank" rel="noopener" className="text-accent hover:underline">@{l.username}</a>
                        </>
                      )}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-500">{when(l.createdAt)}</span>
                </div>
                <ul className="grid gap-1 text-xs">
                  {l.checkLines.map((c) => (
                    <li key={c.text} className={c.ok ? "text-accent" : "text-amber-200"}>
                      {c.ok ? "✓" : "!"} {c.text}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto flex flex-wrap gap-2">
                  <button type="button" disabled={busy === l.id} onClick={() => decide(l.id, "approve")} className="btn btn-primary">
                    {busy === l.id ? "Выдаём…" : "Выдать доступ"}
                  </button>
                  {l.username && (
                    <a href={`https://t.me/${l.username}`} target="_blank" rel="noopener" className="btn btn-ghost">Написать</a>
                  )}
                  <button type="button" disabled={busy === l.id} onClick={() => decide(l.id, "reject")} className="rounded-full px-3 py-2 text-sm text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-200">
                    Отклонить
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>

      {decided.length > 0 && (
        <Panel delay={120}>
          <PanelTitle>Решённые заявки</PanelTitle>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">Клиника</th>
                  <th className="py-2 pr-3 font-medium">Руководитель</th>
                  <th className="py-2 pr-3 font-medium">Решение</th>
                  <th className="py-2 pr-3 font-medium">Доступ</th>
                  <th className="py-2 pr-3 font-medium">Активность</th>
                  <th className="py-2 font-medium"><span className="sr-only">Действия</span></th>
                </tr>
              </thead>
              <tbody>
                {decided.map((l) => (
                  <tr key={l.id} className="border-t border-white/[0.05] align-top">
                    <td className="py-2.5 pr-3 text-slate-100">{l.clinic}<span className="block text-xs text-slate-500">{l.city}</span></td>
                    <td className="py-2.5 pr-3 text-slate-300">{l.fullName}<span className="block text-xs text-slate-500">{l.access?.login ?? issued[l.id] ?? (l.username ? `@${l.username}` : "")}</span></td>
                    <td className="py-2.5 pr-3">
                      <span className={l.status === "approved" ? "text-accent" : "text-slate-400"}>{l.status === "approved" ? "Доступ выдан" : "Отклонена"}</span>
                      {l.decidedAt && <span className="block text-xs text-slate-500">{when(l.decidedAt)}</span>}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-300">{l.status !== "approved" ? "—" : l.access?.until ? `до ${dateOnly(l.access.until)}` : "без срока"}</td>
                    <td className="py-2.5 pr-3 text-slate-300">
                      {l.status !== "approved" ? "—" : l.access?.lastLogin ? `вход ${when(l.access.lastLogin)}` : <span className="text-amber-200">ещё не входили</span>}
                      {l.status === "approved" && <span className="block text-xs text-slate-500">тренировок: {l.access?.trainings ?? 0}</span>}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        disabled={busy === l.id}
                        onClick={() => decide(l.id, "delete")}
                        className="rounded-full px-3 py-1 text-xs text-slate-400 ring-1 ring-inset ring-white/10 transition hover:bg-rose-500/10 hover:text-rose-200 hover:ring-rose-400/30"
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
