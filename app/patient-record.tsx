"use client";

import { Panel } from "./ui";

export type TreatmentRecord = {
  patient: string;
  visits: { date: string; work: string; tooth: string; warranty?: string; doctor?: string }[];
  rules: string;
};

/**
 * The clinic's database for a patient with call variants (Viktor, Sergey): closed until the administrator looks the patient up, then
 * the treatment history to compare the complaint with. Opening it is part of what the call is scored on.
 */
export function PatientRecord({ record, open, onOpen }: { record: TreatmentRecord | null; open: boolean; onOpen: () => void }) {
  const withDoctor = record?.visits.some((v) => v.doctor);
  return (
    <Panel delay={160} innerClassName="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">База клиники</p>
          <p className="mt-0.5 text-sm text-slate-300">{!open ? "Найдите пациента, чтобы сверить жалобу с историей лечения." : record ? record.patient : "Ищем в базе…"}</p>
        </div>
        {!open && (
          <button type="button" onClick={onOpen} className="btn btn-light shrink-0 px-4 py-2 text-xs">
            Найти пациента в базе
          </button>
        )}
      </div>
      {open && record && (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-1.5 pr-4 font-medium">Дата</th>
                  <th className="py-1.5 pr-4 font-medium">Что делали</th>
                  <th className="py-1.5 pr-4 font-medium">Зуб</th>
                  <th className="py-1.5 font-medium">{withDoctor ? "Врач" : "Гарантия"}</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {record.visits.map((v) => (
                  <tr key={`${v.date}-${v.work}`} className="border-t border-white/[0.06] align-top">
                    <td className="py-2 pr-4 whitespace-nowrap tabular-nums">{v.date}</td>
                    <td className="py-2 pr-4">{v.work}</td>
                    <td className="py-2 pr-4">{v.tooth}</td>
                    <td className="py-2">{withDoctor ? v.doctor : v.warranty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-pretty text-slate-500">{record.rules}</p>
        </>
      )}
    </Panel>
  );
}
