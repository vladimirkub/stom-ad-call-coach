"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getHome, setHome, type Home } from "@/lib/home";

/** The tab's start page (lib/home.ts); "/app" until read on the client. */
export function useHome(): Home {
  const [home, set] = useState<Home>("/app");
  useEffect(() => set(getHome()), []);
  return home;
}

/** A link to the tab's start page. */
export function HomeLink(props: Omit<React.ComponentProps<typeof Link>, "href">) {
  return <Link href={useHome()} {...props} />;
}

/** Marks the page it sits on as this tab's start page. */
export function RememberHome({ home }: { home: Home }) {
  useEffect(() => setHome(home), [home]);
  return null;
}
