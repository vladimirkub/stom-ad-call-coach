"use client";

import { useEffect, useState } from "react";

function rules(n: number) {
  const d = n % 10, dd = n % 100;
  if (d === 1 && dd !== 11) return "правило";
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return "правила";
  return "правил";
}

// Rule count in the shared knowledge base: a large number with its noun, or a short empty-state line.
export default function KbBadge() {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/knowledge").then((r) => r.json()).then((b) => setN(Array.isArray(b.entries) ? b.entries.length : null)).catch(() => {});
  }, []);
  if (n === null) return <span className="inline-block h-8 w-16 animate-pulse rounded-lg bg-white/[0.05]" />;
  if (n === 0) return <span className="text-sm text-slate-400">пока пуста</span>;
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-3xl font-semibold tabular-nums tracking-tight text-slate-50">{n}</span>
      <span className="text-sm text-slate-400">{rules(n)}</span>
    </span>
  );
}
