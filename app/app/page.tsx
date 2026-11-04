import Link from "next/link";
import PatientGrid, { GroupTabs, PatientStats } from "../patient-grid";
import AgencyBanner from "../agency-banner";
import { Brand } from "../ui";
import { ArrowUpRight, Calculator, Phone } from "../icons";
import { FEATURES } from "@/lib/features";
import scenarios from "@/lib/scenarios-public.json";
import { RememberHome } from "../home-link";
import DirectionHeader from "../direction-header";

const TOOLS = [
  { href: "/analyze", title: "Оценить реальный звонок", text: "Звонок из CRM или запись: оценка по чек-листу.", Icon: Phone, on: FEATURES.realCalls },
  { href: "/calculator", title: "Калькулятор потерь", text: "Сколько выручки теряется на записи и неявках.", Icon: Calculator, on: FEATURES.calculator },
];
// The patients' grid has 5 x 3 cells on desktop: switched-off tools only fill the cells the patients leave free.
const GRID_CELLS = 15;
const SHOWN_TOOLS = [...TOOLS.filter((t) => t.on), ...TOOLS.filter((t) => !t.on)].slice(0, Math.max(TOOLS.filter((t) => t.on).length, GRID_CELLS - scenarios.length));

/** A switched-off section's card: greyed out, not a link, «Скоро» instead of the action. */
function Soon() {
  return <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-xs font-medium text-slate-500">Скоро</span>;
}

// Workspace: everything fits one screen on desktop (nav + headline + bento that fills the height). Below `lg` it stacks and scrolls.
// The page grid is the patients' 5 columns, with the same gap, so edges line up: the agency banner spans the headline row
// over the last 2 columns; the headline keeps to the first 3.
export default function Workspace() {
  return (
    <main className="mx-auto flex w-full max-w-[1440px] min-[1800px]:max-w-[1680px] flex-1 flex-col gap-5 px-4 pt-4 pb-3 lg:gap-4 lg:h-[max(560px,calc(100dvh-34px))] low:gap-3 lg:flex-none lg:overflow-hidden lg:px-6">
      <RememberHome home="/app" />
      <nav className="rise flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <Brand />
        <PatientStats />
      </nav>

      <div className="grid min-h-0 flex-1 gap-x-3 gap-y-4 low:gap-y-3 lg:grid-cols-[repeat(5,minmax(0,1fr))] lg:grid-rows-[auto_minmax(0,1fr)]">
        <section aria-labelledby="trainer" className="flex min-h-0 flex-col gap-4 lg:col-span-5 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:grid lg:grid-rows-subgrid">
          <header className="rise flex flex-wrap items-end justify-between gap-x-6 gap-y-2" style={{ animationDelay: "60ms" }}>
            <div className="max-w-[60ch] lg:max-w-[calc(60%-15px)]">
              <DirectionHeader />
              <div className="mt-2.5 low:mt-2">
                <GroupTabs />
              </div>
            </div>
          </header>
          <PatientGrid>
            {SHOWN_TOOLS.map((t, i) =>
              t.on ? (
                <Link
                  key={t.href}
                  href={t.href}
                  style={{ animationDelay: `${720 + i * 60}ms` }}
                  className="rise group flex min-h-0 rounded-[1.5rem] bg-accent/[0.06] p-[0.3125rem] ring-1 ring-inset ring-accent/30 transition duration-500 ease-[var(--ease-spring)] hover:-translate-y-1 hover:ring-accent/60 active:scale-[0.99]"
                >
                  <article className="fit-card bezel-core flex min-h-0 flex-1 flex-col overflow-hidden p-4 transition-colors duration-500 group-hover:bg-ink-700 lg:p-3.5 low:p-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-ink-950 lg:h-9 lg:w-9 short:h-8 short:w-8">
                      <t.Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-4 text-[17px] font-semibold leading-snug tracking-tight text-balance text-slate-50 lg:mt-2.5 lg:text-[15px] low:mt-1.5 low:text-sm">{t.title}</h3>
                    <p className="fit-desc mt-2 text-[13px] leading-relaxed text-pretty text-slate-400 lg:mt-1.5 lg:text-[12.5px]">{t.text}</p>
                    <span className="mt-auto flex items-center justify-between pt-3 text-sm font-medium text-slate-300 transition-colors duration-500 group-hover:text-accent lg:pt-2 low:pt-1">
                      Открыть
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] transition duration-500 ease-[var(--ease-spring)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:bg-accent group-hover:text-ink-950 low:h-6 low:w-6">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </span>
                    </span>
                  </article>
                </Link>
              ) : (
                <div key={t.href} aria-disabled="true" title="Раздел временно недоступен" style={{ animationDelay: `${720 + i * 60}ms` }} className="rise bezel flex min-h-0 cursor-default">
                  <article className="fit-card bezel-core flex min-h-0 flex-1 flex-col overflow-hidden p-4 opacity-55 lg:p-3.5 low:p-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-slate-500 ring-1 ring-white/10 lg:h-9 lg:w-9 short:h-8 short:w-8">
                      <t.Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-4 text-[17px] font-semibold leading-snug tracking-tight text-balance text-slate-300 lg:mt-2.5 lg:text-[15px] low:mt-1.5 low:text-sm">{t.title}</h3>
                    <p className="fit-desc mt-2 text-[13px] leading-relaxed text-pretty text-slate-500 lg:mt-1.5 lg:text-[12.5px]">{t.text}</p>
                    <span className="mt-auto flex items-center justify-between pt-3 text-sm font-medium text-slate-500 lg:pt-2 low:pt-1">
                      Временно недоступно
                      <Soon />
                    </span>
                  </article>
                </div>
              ),
            )}
          </PatientGrid>
        </section>

        <AgencyBanner className="z-10 lg:col-start-4 lg:col-end-6 lg:row-start-1 lg:self-stretch" />
      </div>
    </main>
  );
}
