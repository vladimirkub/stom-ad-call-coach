"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import scenarios from "@/lib/scenarios-public.json";
import { getHistory } from "@/lib/history";
import { setHome } from "@/lib/home";
import { Brand } from "../ui";
import { Phone } from "../icons";

/** The patient for the next call: one tried least often in this browser, never the last one, random among the rest. */
function pickPatient(): string {
  const history = getHistory();
  const last = history[history.length - 1]?.scenarioId;
  const tries = (id: string) => history.filter((h) => h.scenarioId === id).length;
  const pool = scenarios.filter((s) => s.id !== last);
  const least = Math.min(...pool.map((s) => tries(s.id)));
  const fresh = pool.filter((s) => tries(s.id) === least);
  return fresh[Math.floor(Math.random() * fresh.length)].id;
}

// The simplified start page: after sign-in the administrator sees one button. It picks a patient and starts a voice call
// right away; the call screen and the results lead back here.
export default function SimpleCall() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  useEffect(() => setHome("/call"), []);

  async function call() {
    setBusy(true);
    // Ask for the microphone inside the tap, so phones show the permission prompt; the call screen explains a refusal.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {}
    router.push(`/challenge/${pickPatient()}?start=voice`);
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-4 pb-6 lg:px-6">
      <nav className="rise">
        <Brand />
      </nav>

      <section className="flex flex-1 flex-col items-center justify-center gap-10 py-12 text-center">
        <button
          type="button"
          onClick={call}
          disabled={busy}
          aria-label="Звонок пациенту"
          className="rise group relative flex h-64 w-64 flex-col items-center justify-center gap-4 rounded-full bg-accent text-ink-950 transition duration-500 ease-[var(--ease-spring)] hover:scale-[1.03] active:scale-[0.97] disabled:opacity-80 sm:h-72 sm:w-72"
          style={{ animationDelay: "80ms" }}
        >
          <span aria-hidden className="ring-pulse absolute inset-0 rounded-full" />
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-ink-950/10 transition duration-500 ease-[var(--ease-spring)] group-hover:-rotate-12 group-hover:scale-105">
            <Phone className="h-9 w-9" />
          </span>
          <span className="max-w-[9ch] text-2xl leading-tight font-semibold tracking-[-0.02em] text-balance sm:text-[1.75rem]">
            {busy ? "Набираем…" : "Звонок пациенту"}
          </span>
        </button>

        <p className="rise max-w-[40ch] text-sm leading-relaxed text-pretty text-slate-400" style={{ animationDelay: "160ms" }}>
          Позвонит случайный пациент из тех, с кем вы говорили реже. Запишите его на приём примерно за 3 минуты. После звонка получите оценку.
        </p>
      </section>
    </main>
  );
}
