"use client";

import { Panel } from "./ui";
import { TRIAGE_COLUMNS, TRIAGE_ROWS } from "@/lib/triage";

/** The symptom table for patients with a toothache to sort out (lib/triage.ts), folded until the administrator opens it. */
export function TriageHint() {
  return (
    <Panel delay={160} innerClassName="p-4">
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
          <span>
            <span className="block text-xs font-medium text-slate-500">Подсказка по симптомам</span>
            <span className="mt-0.5 block text-sm text-slate-300">Кариес, пульпит или периодонтит: на что похожа жалоба и что предложить. Диагноз ставит врач.</span>
          </span>
          <span className="btn btn-ghost shrink-0 px-4 py-2 text-xs">
            <span className="group-open:hidden">Открыть</span>
            <span className="hidden group-open:inline">Скрыть</span>
          </span>
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-1.5 pr-4 font-medium">Признак</th>
                {TRIAGE_COLUMNS.map((c) => (
                  <th key={c} className="py-1.5 pr-4 font-medium">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="text-slate-200">
              {TRIAGE_ROWS.map((r) => (
                <tr key={r.sign} className="border-t border-white/[0.06] align-top">
                  <td className="py-2 pr-4 text-slate-400">{r.sign}</td>
                  {r.cells.map((cell, i) => (
                    <td key={i} className="py-2 pr-4">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Panel>
  );
}
