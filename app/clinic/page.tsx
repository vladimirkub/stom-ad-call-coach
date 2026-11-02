"use client";

import { useState } from "react";
import { useAuth } from "../auth-gate";
import { PageHeader, Shell } from "../ui";
import { StatsPanel, StatsScope, type StatsView } from "../admin/stats";

// The clinic manager's cabinet: their team's statistics, each administrator and each call, PDF reports. Only their
// own clinic: the data comes from /api/clinic, which checks the clinic on the server. The manager trains on /app and
// /call like the administrators; their own calls stay out of the team's figures.
export default function ClinicCabinet() {
  const auth = useAuth();
  const [nav, setNav] = useState<StatsView | null>(null);
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
    window.scrollTo({ top: 0 });
  };
  return (
    <Shell width="max-w-6xl">
      <PageHeader eyebrow="Кабинет клиники" title="Как тренируется команда">
        Звонки администраторов, их баллы и частые ошибки. Нажмите на администратора или звонок, чтобы открыть подробности. Ваши собственные тренировки в
        статистику команды не входят.
      </PageHeader>
      <StatsScope api="/api/clinic" overview={false}>
        <StatsPanel nav={nav ?? home} go={go} />
      </StatsScope>
    </Shell>
  );
}
