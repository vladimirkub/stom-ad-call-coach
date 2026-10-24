// Client-only attempt history, stored in this browser's localStorage (no backend, no accounts).
import type { Scores } from "./scoring";

export type HistoryEntry = {
  id: string;
  ts: number;
  scenarioId: string;
  patient: string;
  total: number;
  scores: Scores;
  appointmentBooked: boolean;
};

const KEY = "dealbreaker:history";

export function getHistory(): HistoryEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addEntry(entry: HistoryEntry): HistoryEntry[] {
  const all = getHistory();
  if (all.some((e) => e.id === entry.id)) return all;
  const next = [...all, entry].slice(-200);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  return next;
}
