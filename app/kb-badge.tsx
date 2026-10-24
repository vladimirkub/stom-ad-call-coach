"use client";

import { useEffect, useState } from "react";

export default function KbBadge() {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/knowledge").then((r) => r.json()).then((b) => setN(Array.isArray(b.entries) ? b.entries.length : null)).catch(() => {});
  }, []);
  return <span>{n === null ? "" : n === 0 ? "пока пуста" : `правил: ${n}`}</span>;
}
