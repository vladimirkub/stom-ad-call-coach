"use client";

import { useEffect, useRef, useState } from "react";
import { track, type SiteEvent } from "./analytics";

// Shared motion for the public site: sections rise into place once, the tagline lights up word by word, calls to
// action lean towards the cursor. IntersectionObserver only, no scroll listeners; reduced motion gets no movement.

export const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = () => typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;

/** Calls back once when the element first comes into view (immediately for reduced motion). */
export function useInView<T extends Element>(margin = "0px 0px -15% 0px") {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) return setSeen(true);
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return [ref, seen] as const;
}

/** A block that rises 32px and fades in the first time it enters the viewport. */
export function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const [ref, seen] = useInView<HTMLDivElement>("0px 0px -10% 0px");
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:translate-y-0 motion-reduce:transition-opacity ${seen ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"} ${className}`}
    >
      {children}
    </div>
  );
}

/** Large statement whose words turn from muted to white one by one as they cross the middle of the screen. */
export function Tagline({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [lit, setLit] = useState<Set<number>>(new Set());
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const spans = [...el.querySelectorAll<HTMLSpanElement>("[data-word]")];
    if (reducedMotion() || !("IntersectionObserver" in window)) return setLit(new Set(spans.map((_, i) => i)));
    const io = new IntersectionObserver(
      (entries) => {
        const add = entries.filter((e) => e.isIntersecting).map((e) => Number((e.target as HTMLElement).dataset.word));
        if (add.length) setLit((prev) => new Set([...prev, ...add]));
      },
      { rootMargin: "0px 0px -45% 0px" },
    );
    spans.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);
  let n = 0;
  return (
    <p ref={ref} className="max-w-5xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
      {lines.map((line, li) => (
        <span key={li} className="block">
          {line.split(" ").map((w) => {
            const i = n++;
            return (
              <span key={i} data-word={i} className={`transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${lit.has(i) ? "text-white" : "text-white/25"}`}>
                {w}{" "}
              </span>
            );
          })}
        </span>
      ))}
    </p>
  );
}

/**
 * A call to action: opens Telegram in a new tab, reports the click, and on a mouse leans a few pixels towards the
 * cursor ("magnetic"). The trailing arrow sits in its own circle and nudges diagonally on hover.
 */
export function Cta({
  href,
  children,
  event = "lead_form_open",
  place,
  size = "lg",
  tone = "flame",
}: {
  href: string;
  children: React.ReactNode;
  event?: SiteEvent;
  place: string;
  size?: "lg" | "sm";
  tone?: "flame" | "ghost";
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const external = href.startsWith("http");
  const move = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || reducedMotion() || !finePointer()) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5) * 12;
    const y = ((e.clientY - r.top) / r.height - 0.5) * 8;
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  };
  const leave = () => {
    if (ref.current) ref.current.style.transform = "";
  };
  const click = () => {
    track(event, { place });
    if (event !== "lead_form_open" && external) track("lead_form_open", { place });
  };
  const base = size === "lg" ? "gap-3 py-2 pl-5 pr-2 text-base" : "gap-2 py-1.5 pl-3.5 pr-1.5 text-sm";
  const toneCls =
    tone === "flame"
      ? "bg-accent text-ink-950 hover:brightness-110"
      : "text-white ring-1 ring-inset ring-white/15 hover:bg-white/[0.06]";
  return (
    <a
      ref={ref}
      href={href}
      onClick={click}
      onPointerMove={move}
      onPointerLeave={leave}
      {...(external ? { target: "_blank", rel: "noopener" } : {})}
      className={`group inline-flex items-center rounded-full font-semibold transition-[background-color,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent ${base} ${toneCls}`}
    >
      {children}
      <span
        aria-hidden
        className={`flex items-center justify-center rounded-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-px group-hover:translate-x-0.5 group-hover:scale-105 ${size === "lg" ? "h-8 w-8" : "h-6 w-6"} ${tone === "flame" ? "bg-ink-950/10" : "bg-white/10"}`}
      >
        <svg viewBox="0 0 24 24" className={size === "lg" ? "h-4 w-4" : "h-3 w-3"} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 17 17 7M8 7h9v9" />
        </svg>
      </span>
    </a>
  );
}

/** The floating navigation: section links with the current one marked, and a full-height menu on phones. */
export function Nav({ links, cta, login }: { links: { href: string; label: string }[]; cta: { href: string; label: string; short?: string }; login: string }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  useEffect(() => {
    const sections = links.map((l) => document.querySelector(l.href)).filter((s): s is Element => !!s);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setCurrent(`#${e.target.id}`);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [links]);
  return (
    <>
      <nav aria-label="Разделы сайта" className="fixed inset-x-0 top-4 z-40 flex justify-center px-4">
        <div className="flex w-full max-w-6xl items-center justify-between gap-3 rounded-full bg-graphite/70 p-2 pl-4 ring-1 ring-white/[0.08] backdrop-blur-xl">
          <a href="#top" className="flex items-center gap-2 text-sm font-semibold tracking-tight text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-ink-950">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M4 10v4M8 6v12M12 9v6M16 4v16M20 10v4" /></svg>
            </span>
            <span className="sm:hidden">Stom AD CC</span>
            <span className="hidden sm:inline">Stom AD Call Coach</span>
          </a>
          <div className="hidden items-center gap-1 lg:flex">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                aria-current={current === l.href ? "true" : undefined}
                className={`rounded-full px-3 py-2 text-sm transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-white/[0.06] hover:text-white ${current === l.href ? "bg-white/[0.08] text-white" : "text-mist"}`}
              >
                {l.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <a href={login} className="hidden rounded-full px-3 py-2 text-sm font-semibold text-white ring-1 ring-inset ring-white/15 transition duration-300 hover:bg-white/[0.06] sm:inline-flex">
              Войти
            </a>
            <Cta href={cta.href} place="nav" event="hero_cta_click" size="sm">
              <span className="sm:hidden">{cta.short ?? cta.label}</span>
              <span className="hidden sm:inline">{cta.label}</span>
            </Cta>
            <button
              type="button"
              aria-label={open ? "Закрыть меню" : "Открыть меню"}
              aria-expanded={open}
              onClick={() => setOpen(!open)}
              className="relative flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-inset ring-white/15 lg:hidden"
            >
              <span className={`absolute h-0.5 w-4 rounded bg-white transition duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${open ? "rotate-45" : "-translate-y-1"}`} />
              <span className={`absolute h-0.5 w-4 rounded bg-white transition duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${open ? "-rotate-45" : "translate-y-1"}`} />
            </button>
          </div>
        </div>
      </nav>
      <div
        aria-hidden={!open}
        className={`fixed inset-0 z-30 flex flex-col bg-graphite/95 px-6 pt-24 backdrop-blur-2xl transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        {[...links, { href: login, label: "Войти" }, { href: cta.href, label: cta.label }].map((l, i) => (
          <a
            key={l.href + l.label}
            href={l.href}
            tabIndex={open ? 0 : -1}
            onClick={() => {
              setOpen(false);
              if (l.href === cta.href) track("lead_form_open", { place: "menu" });
            }}
            {...(l.href.startsWith("http") ? { target: "_blank", rel: "noopener" } : {})}
            style={{ transitionDelay: open ? `${Math.min(i * 60, 400)}ms` : "0ms" }}
            className={`border-b border-white/[0.06] py-4 text-2xl font-semibold tracking-tight transition duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${open ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"} ${i === links.length + 1 ? "text-accent" : "text-white"}`}
          >
            {l.label}
          </a>
        ))}
      </div>
    </>
  );
}
