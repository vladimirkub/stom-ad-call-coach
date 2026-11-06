"use client";

import { useEffect, useRef, useState } from "react";
import { reducedMotion, useInView } from "./motion";

// Screen 5: what kinds of conversations the trainer covers, without describing the patients themselves (names,
// characters and hidden reasons stay inside the product). Two counts by call direction, then six situation types,
// each cycling through a few typical phrases any administrator has heard. Tiles tilt slightly under a mouse.

export type SituationType = [title: string, skill: string, phrases: string[]];
type Counts = { inbound: number; outbound: number; total: number };

export function Patients({ types, counts, labels }: { types: SituationType[]; counts: Counts; labels: Record<"inbound" | "inboundText" | "outbound" | "outboundText" | "totalNote", string> }) {
  return (
    <div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {(
          [
            [counts.inbound, labels.inbound, labels.inboundText, "in"],
            [counts.outbound, labels.outbound, labels.outboundText, "out"],
          ] as const
        ).map(([n, label, text, dir]) => (
          <div key={dir} className="rounded-[2rem] bg-white/[0.03] p-2 ring-1 ring-inset ring-white/[0.07]">
            <div className="flex h-full items-center gap-6 rounded-3xl bg-graphite-800 p-6 sm:p-8">
              <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${dir === "in" ? "bg-pulse/10 text-pulse" : "bg-flame/10 text-flame"}`}>
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
                  <path d={dir === "in" ? "M21 3l-6 6M15 4v5h5" : "M15 9l6-6M16 3h5v5"} />
                </svg>
              </span>
              <div>
                <p className="flex items-baseline gap-3">
                  <span className="text-5xl font-semibold tracking-tight tabular-nums text-white sm:text-6xl">{n}</span>
                  <span className="text-lg font-semibold text-white">{label}</span>
                </p>
                <p className="mt-2 text-base text-pretty text-mist">{text}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-mist/80">{labels.totalNote.replace("{total}", String(counts.total))}</p>

      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {types.map((t, i) => (
          <TypeTile key={t[0]} t={t} index={i} />
        ))}
      </div>
    </div>
  );
}

function TypeTile({ t: [title, skill, phrases], index }: { t: SituationType; index: number }) {
  const [ref, seen] = useInView<HTMLDivElement>("0px 0px -10% 0px");
  const tiltRef = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(0);
  const [hover, setHover] = useState(false);

  // Phrases change by themselves once the tile is on screen, faster while the mouse is over it.
  useEffect(() => {
    if (!seen || reducedMotion()) return;
    const t = setTimeout(() => setK((x) => (x + 1) % phrases.length), hover ? 1400 : 3200 + index * 260);
    return () => clearTimeout(t);
  }, [seen, hover, k, index, phrases.length]);

  const tilt = (e: React.PointerEvent) => {
    const el = tiltRef.current;
    if (!el || e.pointerType !== "mouse" || reducedMotion()) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${(-y * 5).toFixed(2)}deg) rotateY(${(x * 5).toFixed(2)}deg)`;
  };

  return (
    <div ref={ref}>
      <div
        ref={tiltRef}
        onPointerMove={tilt}
        onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
        onPointerLeave={() => {
          if (tiltRef.current) tiltRef.current.style.transform = "";
          setHover(false);
        }}
        className="h-full rounded-[2rem] bg-white/[0.03] p-2 ring-1 ring-inset ring-white/[0.07] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
      >
        <div className="flex h-full min-h-72 flex-col rounded-3xl bg-graphite-800 p-6">
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold text-white">{title}</p>
            <span className="flex gap-1" aria-hidden>
              {phrases.map((_, i) => (
                <span key={i} className={`h-1 w-4 rounded-full transition-colors duration-500 ${i === k ? "bg-flame" : "bg-white/10"}`} />
              ))}
            </span>
          </div>
          <div className="relative mt-6 flex-1">
            {phrases.map((p, i) => (
              <p
                key={p}
                aria-hidden={i !== k}
                className={`absolute inset-x-0 top-0 text-2xl font-semibold tracking-tight text-balance text-white transition ease-[cubic-bezier(0.22,1,0.36,1)] ${i === k ? "translate-y-0 opacity-100 delay-200 duration-500" : "-translate-y-2 opacity-0 duration-200"}`}
              >
                «{p}»
              </p>
            ))}
          </div>
          <div className="mt-6 rounded-xl bg-flame/10 p-3">
            <p className="text-xs font-medium text-flame">Чему учится администратор</p>
            <p className="mt-1 text-sm text-white text-pretty">{skill}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
