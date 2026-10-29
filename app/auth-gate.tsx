"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { SessionUser } from "@/lib/auth";
import { Keyhole, Waveform } from "./icons";
import brand from "@/lib/brand.json";

type State = { status: "loading" } | { status: "guest" } | { status: "user"; user: SessionUser };
const AuthContext = createContext<State>({ status: "loading" });

// Pages that must stay reachable without a session.
const OPEN_PATHS = ["/setup"];

/**
 * Wraps the whole portal. Until someone signs in, a login window that cannot be closed covers the page.
 * The real check is on the server (proxy.ts): any API call answered with 401 brings this window back.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<State>({ status: "loading" });

  const refresh = useCallback(async () => {
    const res = await fetch("/api/auth/me", { cache: "no-store" }).catch(() => null);
    const body = res?.ok ? await res.json().catch(() => null) : null;
    setState(body?.user ? { status: "user", user: body.user } : { status: "guest" });
  }, []);

  useEffect(() => {
    refresh();
    // A session can end mid-use (access disabled, password reset): show the login window on the next refused call.
    const original = window.fetch;
    window.fetch = async (...args) => {
      const res = await original(...args);
      const url = typeof args[0] === "string" ? args[0] : args[0] instanceof URL ? args[0].href : args[0].url;
      if (res.status === 401 && url.includes("/api/") && !url.includes("/api/auth/")) setState({ status: "guest" });
      return res;
    };
    return () => {
      window.fetch = original;
    };
  }, [refresh]);

  const open = OPEN_PATHS.some((p) => pathname?.startsWith(p));
  return (
    <AuthContext.Provider value={state}>
      {children}
      {!open && state.status === "guest" && <LoginWindow />}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

function LoginWindow() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, password }),
    }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (res?.ok) {
      // Reload so every block that was refused before sign-in (knowledge base, stats) fetches again.
      window.location.reload();
    } else {
      setError(body.error || "Не удалось войти. Проверьте соединение.");
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-title"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink-950/75 px-4 py-8 backdrop-blur-md"
    >
      <div className="rise bezel w-full max-w-sm">
        <form onSubmit={submit} className="bezel-core flex flex-col gap-4 p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-ink-950">
              <Waveform className="h-[18px] w-[18px]" />
            </span>
            <span className="text-sm font-semibold tracking-tight">{brand.name}</span>
          </div>
          <div>
            <h2 id="login-title" className="text-2xl font-semibold tracking-[-0.02em]">Вход в тренажёр</h2>
            <p className="mt-1 text-sm text-pretty text-slate-400">Логин и пароль выдаёт Stom AD. Если их нет, обратитесь к своему менеджеру.</p>
          </div>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-400">
            Логин
            <input
              id="login-name"
              className="field"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="ivanova.stomlux"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-400">
            Пароль
            <input
              id="login-password"
              className="field"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && (
            <p role="alert" className="alert alert-error">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            <Keyhole className="h-4 w-4" />
            {busy ? "Проверяем…" : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}

/** Name, admin link for the owner, and sign-out; sits next to the brand pill. */
export function AccountChip() {
  const state = useAuth();
  if (state.status !== "user") return null;
  const { user } = state;
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    window.location.href = "/app";
  }
  return (
    <div className="flex items-center gap-1 rounded-full bg-white/[0.03] p-1 pl-3 text-sm ring-1 ring-white/[0.07]">
      <span className="max-w-[16ch] truncate text-slate-300" title={user.clinic?.legalName}>
        {user.firstName} {user.lastName}
      </span>
      {user.role === "owner" && (
        <Link href="/admin" className="rounded-full px-3 py-1 font-medium text-accent transition hover:bg-white/[0.06]">
          Админка
        </Link>
      )}
      <button type="button" onClick={logout} className="rounded-full px-3 py-1 text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-100">
        Выйти
      </button>
    </div>
  );
}
