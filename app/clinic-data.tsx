"use client";

import { useEffect, useState } from "react";

export type ClinicData = { legendVersion: number | null; memo: string[]; leads: Record<string, string> };

// One request per page load, shared by every component that needs the clinic's memo or patient cards.
let pending: Promise<ClinicData | null> | null = null;

/** The signed-in trainee's clinic: memo and patient card texts fitted to its legend. Null while loading. */
export function useClinicData(): ClinicData | null {
  const [data, setData] = useState<ClinicData | null>(null);
  useEffect(() => {
    pending ??= fetch("/api/me/clinic", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<ClinicData>) : null))
      .catch(() => null);
    let live = true;
    pending.then((d) => {
      if (!d) pending = null; // signed out or offline: ask again next time
      if (live) setData(d);
    });
    return () => {
      live = false;
    };
  }, []);
  return data;
}
