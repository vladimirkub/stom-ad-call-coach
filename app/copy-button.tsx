"use client";

import { useState } from "react";

/** The message an administrator gets: where to sign in, the login and the password. */
export const accessText = (u: { login: string; password: string | null }) =>
  `Доступ к тренажёру Stom AD\nСсылка: ${window.location.origin}/app\nЛогин: ${u.login}\nПароль: ${u.password ?? ""}`;

/** Copies the text; where the clipboard is blocked, shows it to copy by hand. */
export function CopyButton({ text, label, primary }: { text: string; label: string; primary?: boolean }) {
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
