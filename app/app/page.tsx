import Link from "next/link";
import PatientGrid, { PatientStats } from "../patient-grid";
import KbBadge from "../kb-badge";
import { Brand } from "../ui";
import { ArrowUpRight, Calculator, Phone, Spark } from "../icons";

const TOOLS = [
  { href: "/analyze", title: "Оценить реальный звонок", text: "Звонок из CRM или запись: оценка по чек-листу.", Icon: Phone },
  { href: "/calculator", title: "Калькулятор потерь", text: "Сколько выручки теряется на записи и неявках.", Icon: Calculator },
];

// Workspace: everything fits one screen on desktop (nav + headline + bento that fills the height). Below `lg` it stacks and scrolls.
// The two tools close the 4×3 patient grid; the virtual operator lines up with the grid, beside the headline row left empty.
export default function Workspace() {
  return (
    <main className="mx-auto flex w-full max-w-[1440px] min-[1800px]:max-w-[1680px] flex-1 flex-col gap-5 px-4 pt-4 pb-3 lg:gap-4 lg:h-[max(560px,calc(100dvh-34px))] low:gap-3 lg:flex-none lg:overflow-hidden lg:px-6">
      <nav className="rise w-fit">
        <Brand />
      </nav>

      <div className="grid min-h-0 flex-1 gap-x-5 gap-y-4 low:gap-y-3 lg:grid-cols-12 lg:grid-rows-[auto_minmax(0,1fr)]">
        <section aria-labelledby="trainer" className="flex min-h-0 flex-col gap-4 lg:col-span-9 lg:row-span-2 lg:grid lg:grid-rows-subgrid">
          <header className="rise flex flex-wrap items-end justify-between gap-x-6 gap-y-2" style={{ animationDelay: "60ms" }}>
            <div className="max-w-[60ch] lg:max-w-none">
              <p className="text-xs font-medium text-accent">Режим 1 · вы оператор</p>
              <h1 id="trainer" className="mt-1.5 text-3xl font-semibold leading-[1.05] tracking-[-0.03em] text-balance lg:text-[2.25rem] short:text-[1.75rem] low:mt-1 low:text-2xl">
                Позвоните пациенту и запишите на приём
              </h1>
              <p className="mt-2 text-sm text-pretty text-slate-400 short:hidden">
                Пациента играет ИИ. Отработайте возражение голосом или текстом, а после звонка получите оценку по чек-листу.
              </p>
            </div>
            <PatientStats />
          </header>
          <PatientGrid>
            {TOOLS.map((t, i) => (
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
                  <h3 className="mt-4 text-[17px] font-semibold leading-snug tracking-tight text-balance text-slate-50 lg:mt-2.5 lg:text-[15px] low:text-sm">{t.title}</h3>
                  <p className="fit-desc mt-2 text-[13px] leading-relaxed text-pretty text-slate-400 lg:mt-1.5 lg:text-[12.5px]">{t.text}</p>
                  <span className="mt-auto flex items-center justify-between pt-3 text-sm font-medium text-slate-300 transition-colors duration-500 group-hover:text-accent lg:pt-2">
                    Открыть
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] transition duration-500 ease-[var(--ease-spring)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:bg-accent group-hover:text-ink-950 low:h-6 low:w-6">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </span>
                  </span>
                </article>
              </Link>
            ))}
          </PatientGrid>
        </section>

        <section aria-label="Виртуальный оператор и база знаний" className="flex min-h-0 flex-col gap-4 lg:col-span-3 lg:row-span-2 lg:grid lg:grid-rows-subgrid">
          <div className="grid min-h-0 flex-1 gap-3 lg:row-start-2 lg:grid-rows-[1fr_auto] low:gap-2.5">
            <Link
              href="/operator"
              className="rise bezel group flex min-h-0 transition duration-500 ease-[var(--ease-spring)] hover:-translate-y-1 active:scale-[0.99]"
              style={{ animationDelay: "180ms" }}
            >
              <div className="bezel-core relative flex min-h-0 flex-1 flex-col justify-between gap-4 overflow-hidden p-5 lg:p-4 short:gap-3 low:p-3.5">
                <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-accent/[0.12] blur-3xl" />
                <div className="relative flex items-center gap-3">
                  <span className="ring-pulse flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-ink-950 short:h-10 short:w-10">
                    <Phone className="h-5 w-5" />
                  </span>
                  <div className="leading-tight">
                    <p className="text-xs font-medium text-accent">Режим 2 · вы пациент</p>
                    <p className="mt-0.5 text-sm font-medium text-slate-100">Входящий от ИИ-оператора</p>
                  </div>
                </div>

                <div aria-hidden className="relative flex min-h-8 flex-1 items-center justify-center gap-[3px] opacity-80">
                  {Array.from({ length: 40 }, (_, i) => (
                    <span
                      key={i}
                      className="wave-bar w-[3px] rounded-full bg-accent/70"
                      style={{ height: `${22 + ((i * 37) % 34)}px`, animationDelay: `${(i % 9) * 0.13}s`, animationDuration: `${1 + (i % 5) * 0.18}s` }}
                    />
                  ))}
                </div>

                <div className="relative">
                  <h3 className="text-2xl font-semibold leading-tight tracking-[-0.02em] text-balance lg:text-xl tall:text-2xl short:text-lg">Примите звонок и сыграйте любого пациента</h3>
                  <p className="mt-2 text-sm leading-relaxed lg:line-clamp-4 text-pretty text-slate-400 short:line-clamp-3 short:text-[13px] low:hidden">
                    Роли меняются: звонит ИИ, а пациента играете вы. Соглашайтесь, сомневайтесь, торгуйтесь или откажитесь. После звонка получите разбор, а удачные приёмы попадут в базу знаний.
                  </p>
                </div>

                <span className="relative flex w-full items-center justify-between rounded-full bg-accent py-1.5 pr-1.5 pl-5 text-sm font-semibold text-ink-950 transition duration-500 ease-[var(--ease-spring)] group-active:scale-[0.98]">
                  Принять звонок
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-950/10 transition duration-500 ease-[var(--ease-spring)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:scale-105">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </span>
              </div>
            </Link>

            <Link
              href="/knowledge"
              className="rise bezel group flex transition duration-500 ease-[var(--ease-spring)] hover:-translate-y-1 active:scale-[0.99]"
              style={{ animationDelay: "240ms" }}
            >
              <div className="bezel-core flex flex-1 items-center justify-between gap-4 p-4 transition-colors duration-500 group-hover:bg-ink-700 low:p-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Spark className="h-3.5 w-3.5 text-accent" />
                    База знаний оператора
                  </p>
                  <div className="mt-1.5">
                    <KbBadge />
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-pretty text-slate-500 short:hidden">Что работает и чего избегать. Подставляется в каждый новый звонок.</p>
                </div>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-slate-300 transition duration-500 ease-[var(--ease-spring)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:bg-accent group-hover:text-ink-950">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
