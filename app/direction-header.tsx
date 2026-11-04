"use client";

import { DirectionSwitch, useDirection } from "./direction-switch";

const TEXT = {
  outbound: {
    title: "Позвоните пациенту и запишите на приём",
    lead: "Пациента играет ИИ. Отработайте возражение голосом или текстом, а после звонка получите оценку по чек-листу.",
  },
  inbound: {
    title: "Примите звонок пациента и запишите на приём",
    lead: "Пациент сам звонит в клинику после рекламы или сайта. Возьмите трубку, узнайте имя и запрос, а после звонка получите оценку по чек-листу.",
  },
};

/** The workspace headline with the call-direction switch; the patient cards then open calls in the chosen direction. */
export default function DirectionHeader() {
  const [direction, setDirection] = useDirection();
  const t = TEXT[direction];
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <p className="text-xs font-medium text-accent">Вы {direction === "inbound" ? "администратор" : "оператор"}</p>
        <DirectionSwitch value={direction} onChange={setDirection} compact />
      </div>
      <h1 id="trainer" className="mt-1.5 text-3xl font-semibold leading-[1.05] tracking-[-0.03em] text-balance lg:text-[min(2.25rem,2.4vw)] short:text-[min(1.75rem,2.4vw)] low:mt-1">
        {t.title}
      </h1>
      <p className="mt-2 text-sm text-pretty text-slate-400 short:mt-1 short:text-[13px] low:text-xs">{t.lead}</p>
    </>
  );
}
