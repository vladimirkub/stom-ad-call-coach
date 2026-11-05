"use client";

import { useState } from "react";
import { useAuth } from "../auth-gate";
import { PageHeader, Shell } from "../ui";
import { StatsPanel, StatsScope, type StatsView } from "../admin/stats";
import { ClinicSettings } from "./settings";
import { ClinicSetup } from "./setup";

// The clinic manager's cabinet: their team's statistics, each administrator and each call, PDF reports; and the
// clinic's settings (directions, legend facts) sent to Stom AD for approval. Only their own clinic: the data comes
// from /api/clinic, which checks the clinic on the server. The manager trains on /app and /call like the
// administrators; their own calls stay out of the team's figures.
export default function ClinicCabinet() {
  const auth = useAuth();
  const [nav, setNav] = useState<StatsView | null>(null);
  const [tab, setTab] = useState<"team" | "settings">("team");
  // Autonomous clinics set themselves up (lib/clinic-setup.ts); the others propose changes to Stom AD.
  const [manual, setManual] = useState(false);
  if (auth.status !== "user") return null;
  const { user } = auth;
  if (user.role !== "manager" || !user.clinic) {
    return (
      <Shell>
        <PageHeader title="Нет доступа">Кабинет клиники доступен руководителю клиники.</PageHeader>
      </Shell>
    );
  }
  const home: StatsView = { view: "clinic", id: user.clinic.id };
  // There is no overview of all clinics here: "back to the overview" means back to the clinic.
  const go = (v: StatsView) => {
    setNav(v.view === "overview" ? home : v);
    setTab("team");
    window.scrollTo({ top: 0 });
  };
  return (
    <Shell width="max-w-6xl">
      <PageHeader eyebrow={`Кабинет клиники · ${user.clinic.legalName}`} title={tab === "team" ? "Как тренируется команда" : "Настройки клиники"}>
        {tab === "team"
          ? "Звонки администраторов, их баллы и частые ошибки. Нажмите на администратора или звонок, чтобы открыть подробности. Ваши собственные тренировки в статистику команды не входят."
          : manual
            ? "Направления и факты о клинике, на которых строятся тренировки. Изменения вступают в силу после утверждения Stom AD."
            : "Сайты, пожелания и врачи, на которых строятся тренировки. Заполните шаги и пересоберите легенду: утверждать у Stom AD не нужно."}
      </PageHeader>
      <div role="tablist" aria-label="Разделы кабинета" className="mb-5 flex w-fit gap-1 rounded-full bg-white/[0.03] p-1 ring-1 ring-white/[0.07]">
        {(
          [
            ["team", "Команда"],
            ["settings", "Настройки клиники"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => (key === "team" ? go(home) : setTab(key))}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${tab === key ? "bg-accent text-ink-950" : "text-slate-300 hover:bg-white/[0.06]"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "team" ? (
        <StatsScope api="/api/clinic" overview={false}>
          <StatsPanel nav={nav ?? home} go={go} />
        </StatsScope>
      ) : (
        manual ? <ClinicSettings /> : <ClinicSetup onManual={() => setManual(true)} />
      )}
    </Shell>
  );
}
