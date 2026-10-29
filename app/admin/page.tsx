"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth-gate";
import { PageHeader, Panel, PanelTitle, Shell } from "../ui";

type Clinic = { id: number; legalName: string; slug: string; city: string; users: number; activeUsers: number | null };
type Trainee = { id: number; firstName: string; lastName: string; login: string; password: string | null; active: boolean };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" }, cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Ошибка ${res.status}`);
  return body as T;
}

const accessText = (u: { login: string; password: string | null }) =>
  `Доступ к тренажёру Stom AD\nСсылка: ${window.location.origin}/app\nЛогин: ${u.login}\nПароль: ${u.password ?? ""}`;

// Owner-only: clinics, their trainees with generated logins and passwords. Statistics come in the next step.
export default function Admin() {
  const auth = useAuth();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState("");

  const loadClinics = useCallback(async () => {
    try {
      const { clinics } = await api<{ clinics: Clinic[] }>("/api/admin/clinics");
      setClinics(clinics);
      setSelected((s) => s ?? clinics[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    if (auth.status === "user" && auth.user.role === "owner") loadClinics();
  }, [auth, loadClinics]);

  if (auth.status === "user" && auth.user.role !== "owner") {
    return (
      <Shell>
        <PageHeader title="Нет доступа">Этот раздел доступен только владельцу.</PageHeader>
      </Shell>
    );
  }

  const clinic = clinics.find((c) => c.id === selected) ?? null;
  return (
    <Shell width="max-w-6xl">
      <PageHeader eyebrow="Админка" title="Клиники и доступы">
        Заведите клинику, добавьте её администраторов и отправьте каждому логин и пароль. Статистика по тренировкам появится здесь на следующем шаге.
      </PageHeader>
      {error && <p role="alert" className="alert alert-error mb-4">{error}</p>}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel delay={90}>
            <PanelTitle>Клиники</PanelTitle>
            {clinics.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">Пока ни одной клиники. Добавьте первую ниже.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-1">
                {clinics.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(c.id)}
                      aria-current={c.id === selected}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${c.id === selected ? "bg-accent/10 text-slate-50 ring-1 ring-inset ring-accent/40" : "text-slate-300 hover:bg-white/[0.05]"}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{c.legalName}</span>
                        <span className="block text-xs text-slate-500">{c.city} · {c.slug}</span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-slate-400">{c.activeUsers ?? 0}/{c.users}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <NewClinic onCreated={async (id) => { await loadClinics(); setSelected(id); }} />
        </div>
        {clinic ? <ClinicUsers key={clinic.id} clinic={clinic} onChanged={loadClinics} /> : null}
      </div>
    </Shell>
  );
}

function NewClinic({ onCreated }: { onCreated: (id: number) => void }) {
  const [form, setForm] = useState({ legalName: "", slug: "", city: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { id } = await api<{ id: number }>("/api/admin/clinics", { method: "POST", body: JSON.stringify(form) });
      setForm({ legalName: "", slug: "", city: "" });
      onCreated(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel delay={120}>
      <PanelTitle>Новая клиника</PanelTitle>
      <form onSubmit={submit} className="mt-3 flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-400">
          Юридическое название
          <input id="clinic-legal" className="field" placeholder="ООО «Стомлюкс»" value={form.legalName} onChange={set("legalName")} required />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-400">
          Короткое название для логинов
          <input id="clinic-slug" className="field" placeholder="stomlux" autoCapitalize="none" spellCheck={false} value={form.slug} onChange={set("slug")} required />
          <span className="font-normal text-slate-500">Латиница и цифры. Логины будут вида ivanova.{form.slug ? form.slug.toLowerCase().replace(/[^a-z0-9]/g, "") || "stomlux" : "stomlux"}</span>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-400">
          Город
          <input id="clinic-city" className="field" placeholder="Казань" value={form.city} onChange={set("city")} required />
        </label>
        {error && <p role="alert" className="alert alert-error">{error}</p>}
        <button type="submit" className="btn btn-ghost" disabled={busy}>{busy ? "Сохраняем…" : "Добавить клинику"}</button>
      </form>
    </Panel>
  );
}

function ClinicUsers({ clinic, onChanged }: { clinic: Clinic; onChanged: () => void }) {
  const [users, setUsers] = useState<Trainee[]>([]);
  const [form, setForm] = useState({ firstName: "", lastName: "" });
  const [fresh, setFresh] = useState<{ login: string; password: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setUsers((await api<{ users: Trainee[] }>(`/api/admin/users?clinicId=${clinic.id}`)).users);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [clinic.id]);
  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { user } = await api<{ user: { login: string; password: string } }>("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ clinicId: clinic.id, ...form }),
      });
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

  async function act(u: Trainee, action: "reset" | "disable" | "enable") {
    setError("");
    try {
      const r = await api<{ password?: string }>(`/api/admin/users/${u.id}`, { method: "POST", body: JSON.stringify({ action }) });
      if (r.password) setFresh({ login: u.login, password: r.password });
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Panel delay={90} tone="accent">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">{clinic.city}</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-balance">{clinic.legalName}</h2>
            <p className="mt-1 text-xs text-slate-500">Логины: фамилия.{clinic.slug}</p>
          </div>
          <span className="chip">{clinic.activeUsers ?? 0} активных из {clinic.users}</span>
        </div>
        <form onSubmit={create} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-400">
            Имя
            <input id="user-first" className="field" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-400">
            Фамилия
            <input id="user-last" className="field" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
          </label>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Создаём…" : "Выдать доступ"}</button>
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
      </Panel>

      <Panel delay={120} innerClassName="p-0">
        {users.length === 0 ? (
          <p className="p-5 text-sm text-slate-400">В этой клинике пока нет пользователей.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="px-5 py-3 font-medium">Администратор</th>
                  <th className="px-3 py-3 font-medium">Логин</th>
                  <th className="px-3 py-3 font-medium">Пароль</th>
                  <th className="px-5 py-3 text-right font-medium">Доступ</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className={`border-t border-white/[0.06] ${u.active ? "" : "text-slate-500"}`}>
                    <td className="px-5 py-3">
                      {u.lastName} {u.firstName}
                      {!u.active && <span className="chip ml-2">отключён</span>}
                    </td>
                    <td className="px-3 py-3 font-mono text-[13px]">{u.login}</td>
                    <td className="px-3 py-3 font-mono text-[13px]">{u.password ?? "—"}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <CopyButton text={accessText(u)} label="Скопировать" />
                        <button type="button" className="rounded-full px-3 py-1 text-xs text-slate-300 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06]" onClick={() => act(u, "reset")}>
                          Новый пароль
                        </button>
                        <button
                          type="button"
                          className={`rounded-full px-3 py-1 text-xs ring-1 ring-inset transition hover:bg-white/[0.06] ${u.active ? "text-rose-300 ring-rose-400/30" : "text-accent ring-accent/40"}`}
                          onClick={() => act(u, u.active ? "disable" : "enable")}
                        >
                          {u.active ? "Отключить" : "Включить"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function CopyButton({ text, label, primary }: { text: string; label: string; primary?: boolean }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch {
      window.prompt("Скопируйте текст", text);
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className={primary ? "btn btn-primary px-4 py-2 text-xs" : "rounded-full px-3 py-1 text-xs text-slate-300 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06]"}
    >
      {done ? "Скопировано" : label}
    </button>
  );
}
