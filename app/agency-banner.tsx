import brand from "@/lib/brand.json";
import { ArrowUpRight } from "./icons";

// The owner's agency, STOM AD, on the workspace for every trainee: patients for high-margin dental services from VK ads.
// A solid mint block, the one light surface on the dark workspace, so it is the first thing the eye lands on. On wider
// screens a slow feed of incoming VK requests shows what the agency does (illustration, no figures).
// `agencyUrl` in brand.json is the agency's Telegram until the main site exists.
const FEED = ["Элайнеры", "Брекеты", "All-on-4 / All-on-6", "Имплантация", "Протезирование", "Все зубы за 1 день"];

export default function AgencyBanner({ className = "" }: { className?: string }) {
  return (
    <a
      href={brand.agencyUrl}
      target="_blank"
      rel="noopener"
      className={`rise group relative flex items-stretch gap-4 overflow-hidden rounded-[1.5rem] bg-accent p-3 pl-5 text-ink-950 shadow-[0_8px_32px_-12px] shadow-accent/50 transition duration-500 ease-[var(--ease-spring)] hover:-translate-y-0.5 hover:brightness-105 low:py-2 low:pl-4 ${className}`}
      style={{ animationDelay: "90ms" }}
    >
      {/* Light from the top left and a fine dot grid, so the mint reads as a surface, not a flat fill. */}
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,rgba(255,255,255,0.45),transparent_55%)]" />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.13] [background-image:radial-gradient(rgba(8,9,13,0.9)_1px,transparent_1px)] [background-size:12px_12px] [mask-image:linear-gradient(90deg,transparent_35%,black)]"
      />

      <div className="relative flex min-w-0 flex-1 flex-col justify-center py-1">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-ink-950/65">
          <span className="relative flex h-1.5 w-1.5">
            <span className="agency-ping absolute inset-0 rounded-full bg-ink-950/60" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-ink-950" />
          </span>
          STOM AD · реклама ВКонтакте для клиник
        </p>
        <p className="mt-1 line-clamp-2 text-[17px] font-semibold leading-[1.15] tracking-[-0.02em] text-balance text-ink-950 short:text-[15px] low:text-[13px] low:leading-tight">
          Приводим пациентов на&nbsp;имплантацию, ортопедию и&nbsp;ортодонтию
        </p>
        <span className="mt-2.5 flex w-max items-center gap-2 rounded-full bg-ink-950 py-1.5 pr-1.5 pl-4 text-sm font-semibold text-slate-50 transition duration-500 ease-[var(--ease-spring)] group-active:scale-[0.98] short:mt-1.5 low:mt-1 low:py-1 low:text-[13px]">
          Обсудить рекламу
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-ink-950 transition duration-500 ease-[var(--ease-spring)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 low:h-6 low:w-6">
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </span>
      </div>

      {/* The request feed: two copies scroll up in a loop; the edges fade into the mint. */}
      <div aria-hidden className="relative hidden w-[9.5rem] shrink-0 overflow-hidden rounded-2xl bg-ink-950/[0.06] ring-1 ring-ink-950/10 [mask-image:linear-gradient(180deg,transparent,black_22%,black_78%,transparent)] sm:block">
        <div className="agency-feed absolute inset-x-0 top-0 flex flex-col gap-1.5 p-1.5">
          {[...FEED, ...FEED].map((service, i) => (
            <div key={i} className="rounded-xl bg-white/70 px-2.5 py-1.5 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_4px_12px_-8px_rgba(8,9,13,0.5)]">
              <p className="flex items-center gap-1 text-[9.5px] font-medium text-ink-950/55">
                <span className="h-1 w-1 rounded-full bg-[#2787f5]" />
                Новая заявка · ВК
              </p>
              <p className="truncate text-[12px] font-semibold leading-tight text-ink-950">{service}</p>
            </div>
          ))}
        </div>
      </div>
    </a>
  );
}
