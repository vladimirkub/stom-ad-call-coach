import brand from "@/lib/brand.json";
import { ArrowUpRight } from "./icons";

// The owner's agency, STOM AD, on the workspace for every trainee: patients for high-margin dental services from VK ads.
// A solid mint block, the one light surface on the dark workspace, so it is the first thing the eye lands on.
// `agencyUrl` in brand.json is the agency's Telegram until the main site exists.
export default function AgencyBanner({ className = "" }: { className?: string }) {
  return (
    <a
      href={brand.agencyUrl}
      target="_blank"
      rel="noopener"
      className={`rise group relative flex items-center gap-4 overflow-hidden rounded-[1.5rem] bg-accent p-3 pl-5 text-ink-950 shadow-[0_8px_32px_-12px] shadow-accent/50 transition duration-500 ease-[var(--ease-spring)] hover:-translate-y-0.5 hover:brightness-105 low:py-2 low:pl-4 ${className}`}
      style={{ animationDelay: "90ms" }}
    >
      <div className="relative min-w-0 flex-1">
        <p className="text-[11px] font-medium tracking-wide text-ink-950/70">STOM AD · маркетинг стоматологий</p>
        <p className="mt-0.5 line-clamp-2 text-[15px] font-semibold leading-snug low:text-[13px] low:leading-tight tracking-tight text-balance text-ink-950 short:text-sm">
          Пациенты на имплантацию, ортопедию и&nbsp;ортодонтию из&nbsp;ВКонтакте
        </p>
      </div>
      <span className="relative flex shrink-0 items-center gap-2 rounded-full bg-ink-950 py-1.5 pr-1.5 pl-4 text-sm font-semibold text-slate-50 transition duration-500 ease-[var(--ease-spring)] group-active:scale-[0.98]">
        Обсудить
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-ink-950 transition duration-500 ease-[var(--ease-spring)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </span>
    </a>
  );
}
