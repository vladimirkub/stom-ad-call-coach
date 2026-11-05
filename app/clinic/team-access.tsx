"use client";

import { useCallback, useEffect, useState } from "react";
import { Panel, PanelTitle } from "../ui";
import { CopyButton, accessText } from "../copy-button";

// The clinic manager gives their administrators access and takes it away (app/api/clinic/users). A removed administrator
// can no longer sign in and leaves the manager's lists; their past calls stay in the clinic's figures.

type Admin = { id: number; firstName: string; lastName: string; login: string; password: string | null; active: boolean };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json" } });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || `Ошибка ${res.status}`);
  return out as T;
}

export function TeamAccess({ onChanged }: { onChanged: () => void }) {
  const [users, setUsers] = useState<Admin[]>([]);
  const [form, setForm] = useState({ firstName: "", lastName: "" });
  const [fresh, setFresh] = useState<{ login: string; password: string } | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);
  // The administrator whose name is being corrected, with the draft name.
  const [renaming, setRenaming] = useState<{ id: number; firstName: string; lastName: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setUsers((await api<{ users: Admin[] }>("/api/clinic/users")).users);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { user } = await api<{ user: { login: string; password: string } }>("/api/clinic/users", { method: "POST", body: JSON.stringify(form) });
      setFresh(user);
      setForm({ firstName: "", lastName: "" });
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function rename(e: React.FormEvent) {
    e.preventDefault();
    if (!renaming) return;
    setError("");
    try {
      await api(`/api/clinic/users/${renaming.id}`, { method: "POST", body: JSON.stringify({ action: "rename", firstName: renaming.firstName, lastName: renaming.lastName }) });
      setRenaming(null);
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function act(u: Admin, action: "reset" | "remove" | "restore") {
    if (action === "remove" && !window.confirm(`Удалить ${u.lastName} ${u.firstName}? Доступ закроется сразу, прошлые звонки останутся в статистике клиники.`)) return;
    setError("");
    try {
      const r = await api<{ password?: string }>(`/api/clinic/users/${u.id}`, { method: "POST", body: JSON.stringify({ action }) });
      if (r.password) setFresh({ login: u.login, password: r.password });
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const active = users.filter((u) => u.active);
  const removed = users.filter((u) => !u.active);
  const button = "rounded-full px-3 py-1 text-xs ring-1 ring-inset transition hover:bg-white/[0.06]";

  return (
    <Panel innerClassName="p-0">
      <div className="px-5 pt-5">
        <PanelTitle>Доступы администраторов</PanelTitle>
        <p className="mt-1 text-xs text-pretty text-slate-500">
          Добавьте сотрудника, который отвечает на звонки или звонит пациентам: тренажёр выдаст логин и пароль, их можно сразу скопировать и отправить.
        </p>
        <form onSubmit={add} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-400">
            Имя
            <input id="team-first" className="field" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required maxLength={60} />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-400">
            Фамилия
            <input id="team-last" className="field" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required maxLength={60} />
          </label>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Добавляем…" : "Добавить администратора"}</button>
        </form>
        {fresh && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-ink-950/60 p-3 ring-1 ring-inset ring-accent/30">
            <p className="text-sm">
              Логин <b className="font-mono">{fresh.login}</b> · пароль <b className="font-mono">{fresh.password}</b>
            </p>
            <CopyButton text={accessText(fresh)} label="Скопировать для отправки" primary />
          </div>
        )}
        {error && <p role="alert" className="alert alert-error mt-3">{error}</p>}
      </div>

      {active.length === 0 ? (
        <p className="p-5 text-sm text-slate-400">Администраторов пока нет: добавьте первого.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="px-5 py-2.5 font-medium">Администратор</th>
                <th className="px-3 py-2.5 font-medium">Логин</th>
                <th className="px-3 py-2.5 font-medium">Пароль</th>
                <th className="px-5 py-2.5 text-right font-medium">Доступ</th>
              </tr>
            </thead>
            <tbody>
              {active.map((u) => (
                <tr key={u.id} className="border-t border-white/[0.06]">
                  <td className="px-5 py-3">
                    {renaming?.id === u.id ? (
                      <form onSubmit={rename} className="flex flex-wrap items-center gap-1.5">
                        <input aria-label="Фамилия" className="field w-32 py-1.5 text-[13px]" value={renaming.lastName} maxLength={60} required autoFocus onChange={(e) => setRenaming({ ...renaming, lastName: e.target.value })} />
                        <input aria-label="Имя" className="field w-28 py-1.5 text-[13px]" value={renaming.firstName} maxLength={60} required onChange={(e) => setRenaming({ ...renaming, firstName: e.target.value })} />
                        <button type="submit" className={`${button} text-accent ring-accent/40`}>Сохранить</button>
                        <button type="button" className={`${button} text-slate-400 ring-white/10`} onClick={() => setRenaming(null)}>Отмена</button>
                      </form>
                    ) : (
                      <>{u.lastName} {u.firstName}</>
                    )}
                  </td>
                  <td className="px-3 py-3 font-mono text-[13px]">{u.login}</td>
                  <td className="px-3 py-3 font-mono text-[13px]">{u.password ?? "—"}</td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <CopyButton text={accessText(u)} label="Скопировать" />
                      <button type="button" className={`${button} text-slate-300 ring-white/10`} onClick={() => setRenaming({ id: u.id, firstName: u.firstName, lastName: u.lastName })}>
                        Изменить имя
                      </button>
                      <button type="button" className={`${button} text-slate-300 ring-white/10`} onClick={() => act(u, "reset")}>Новый пароль</button>
                      <button type="button" className={`${button} text-rose-300 ring-rose-400/30`} onClick={() => act(u, "remove")}>Удалить</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {removed.length > 0 && (
        <div className="border-t border-white/[0.06] px-5 py-3">
          <button type="button" className="text-xs text-slate-400 hover:text-slate-200" onClick={() => setShowRemoved(!showRemoved)}>
            {showRemoved ? "Скрыть удалённых" : `Удалённые: ${removed.length}`}
          </button>
          {showRemoved && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {removed.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 text-sm text-slate-500">
                  <span>{u.lastName} {u.firstName} <span className="font-mono text-[13px]">· {u.login}</span></span>
                  <button type="button" className={`${button} text-accent ring-accent/40`} onClick={() => act(u, "restore")}>Вернуть доступ</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Panel>
  );
}
