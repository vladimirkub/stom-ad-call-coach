import Link from "next/link";
import brand from "@/lib/brand.json";
import { ArrowLeft, Waveform } from "./icons";
import { AccountChip } from "./auth-gate";

// Shared page chrome for the inner pages: the brand pill, a back link, a headline block and double-bezel panels.

export function Brand() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href="/app" className="flex items-center gap-2.5 rounded-full bg-white/[0.03] p-1.5 pr-4 ring-1 ring-white/[0.07] backdrop-blur-xl transition hover:bg-white/[0.06]">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-ink-950">
          <Waveform className="h-4 w-4" />
        </span>
        <span className="text-sm font-semibold tracking-tight">{brand.name}</span>
      </Link>
      <AccountChip />
    </div>
  );
}

export function Shell({
  children,
  width = "max-w-3xl",
  back = { href: "/app", label: "На главную" },
  className = "",
}: {
  children: React.ReactNode;
  width?: string;
  back?: { href: string; label: string };
  className?: string;
}) {
  return (
    <main className={`mx-auto flex w-full ${width} flex-1 flex-col px-4 pt-4 pb-10 lg:px-6 ${className}`}>
      <nav className="rise flex flex-wrap items-center justify-between gap-3">
        <Brand />
        <Link href={back.href} className="group flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-100">
          <ArrowLeft className="h-4 w-4 transition duration-300 group-hover:-translate-x-0.5" />
          {back.label}
        </Link>
      </nav>
      {children}
    </main>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="rise mt-8 mb-6" style={{ animationDelay: "60ms" }}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1 className="mt-1.5 text-3xl font-semibold leading-[1.08] tracking-[-0.03em] text-balance sm:text-[2.5rem]">{title}</h1>
      {children && <div className="mt-3 max-w-[65ch] text-sm leading-relaxed text-pretty text-slate-400">{children}</div>}
    </header>
  );
}

export function Panel({
  children,
  tone,
  className = "",
  innerClassName = "p-5",
  delay,
  as: Tag = "section",
  ...rest
}: {
  children: React.ReactNode;
  tone?: "accent";
  className?: string;
  innerClassName?: string;
  delay?: number;
  as?: "section" | "div";
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag {...rest} className={`rise bezel ${tone === "accent" ? "bezel-accent" : ""} ${className}`} style={delay !== undefined ? { animationDelay: `${delay}ms` } : undefined}>
      <div className={`bezel-core ${innerClassName}`}>{children}</div>
    </Tag>
  );
}

export function PanelTitle({ icon, children, tone }: { icon?: React.ReactNode; children: React.ReactNode; tone?: "accent" | "bad" }) {
  const color = tone === "accent" ? "text-accent" : tone === "bad" ? "text-rose-300" : "text-slate-50";
  return (
    <h2 className={`flex items-center gap-2.5 text-base font-semibold tracking-tight ${color}`}>
      {icon && <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-current [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
      {children}
    </h2>
  );
}

/** What a switched-off section's page shows instead of itself (lib/features.ts). */
export function Unavailable({ title }: { title: string }) {
  return (
    <Shell>
      <PageHeader eyebrow="Скоро" title={title}>
        Раздел временно недоступен. Остальные режимы тренажёра работают как обычно.
      </PageHeader>
    </Shell>
  );
}
