"use client";

import { useEffect, useState } from "react";
import { PageHeader, Panel, Shell } from "../ui";

// One-time owner setup: opened through the link from scripts/owner-setup.mjs. The owner picks the password here.
export default function Setup() {
  const [token, setToken] = useState("");
  const [form, setForm] = useState({ firstName: "", lastName: "", password: "", repeat: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => setToken(new URLSearchParams(window.location.search).get("token") ?? ""), []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.repeat) return setError("Пароли не совпадают");
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, firstName: form.firstName, lastName: form.lastName, password: form.password }),
    }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (res?.ok) window.location.href = "/admin";
    else setError(body.error || "Не удалось сохранить. Проверьте соединение.");
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <Shell width="max-w-md">
      <PageHeader eyebrow="Первый запуск" title="Доступ владельца">
        Логин владельца <b className="text-slate-200">admin</b>. Придумайте пароль не короче 12 символов: через админку видны пароли всех пользователей.
      </PageHeader>
      <Panel>
        {!token ? (
          <p className="alert alert-warn">Откройте эту страницу по ссылке, которую выдал скрипт настройки на сервере.</p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-400">
                Имя
                <input id="setup-first" className="field" value={form.firstName} onChange={set("firstName")} required />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-400">
                Фамилия
                <input id="setup-last" className="field" value={form.lastName} onChange={set("lastName")} />
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-400">
              Пароль
              <input id="setup-password" className="field" type="password" autoComplete="new-password" minLength={12} value={form.password} onChange={set("password")} required />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-400">
              Пароль ещё раз
              <input id="setup-repeat" className="field" type="password" autoComplete="new-password" minLength={12} value={form.repeat} onChange={set("repeat")} required />
            </label>
            {error && <p role="alert" className="alert alert-error">{error}</p>}
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Сохраняем…" : "Сохранить и войти"}
            </button>
          </form>
        )}
      </Panel>
    </Shell>
  );
}
