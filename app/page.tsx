import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import site from "@/lib/landing.json";
import scenarios from "@/lib/scenarios-public.json";
import { Calculator } from "./landing/calculator";
import { Dashboard } from "./landing/dashboard";
import { TrainerDemo } from "./landing/demo";
import { HeroCall } from "./landing/hero-call";
import { Cta, Nav, Reveal, Tagline } from "./landing/motion";
import { Patients, type SituationType } from "./landing/patients";
import { Personalize } from "./landing/personal";
import { ProblemCards } from "./landing/problem";

// The public site at the root of coach.stom-ad.com, built along SPIN: situation, problem, implication, need-payoff,
// then the free trial. Every call to action opens the Telegram chat with Stom AD (no form, no personal data here).
// Texts, dates and links live in lib/landing.json. The page is re-rendered hourly, so the free-trial offer switches
// to the regular one by itself once the date in the config has passed.

export const revalidate = 3600;

const manrope = Manrope({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600", "700"], display: "swap" });

const TITLE = "Stom AD Call Coach — ИИ-тренажёр звонков для администраторов стоматологий";
const DESCRIPTION =
  "Администраторы тренируются на виртуальных пациентах: записывают, отрабатывают возражения, разбирают претензии. Оценка каждого звонка по 100-балльной шкале и кабинет руководителя.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  metadataBase: new URL("https://coach.stom-ad.com"),
  alternates: { canonical: "/" },
  openGraph: { title: "Stom AD Call Coach", description: DESCRIPTION, locale: "ru_RU", type: "website", url: "/" },
};

const LINKS = [
  { href: "#problem", label: "Проблема" },
  { href: "#calculator", label: "Калькулятор" },
  { href: "#trainer", label: "Тренажёр" },
  { href: "#patients", label: "Пациенты" },
  { href: "#manager", label: "Руководителю" },
  { href: "#trial", label: "Тарифы" },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="inline-flex rounded-full bg-white/[0.05] px-3 py-1 text-xs font-medium text-flame ring-1 ring-inset ring-white/[0.06]">{children}</p>;
}

function Lines({ text }: { text: string | string[] }) {
  return Array.isArray(text) ? text.map((l) => <span key={l} className="block">{l}</span>) : text;
}

function Section({ id, eyebrow, title, text, children }: { id?: string; eyebrow: string; title: string | string[]; text?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 px-4 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="mt-5 max-w-[880px] text-3xl font-semibold tracking-tight text-balance text-white sm:text-5xl">
            <Lines text={title} />
          </h2>
          {text && <p className="mt-5 max-w-[640px] text-lg text-pretty text-mist">{text}</p>}
        </Reveal>
        <Reveal className="mt-12 sm:mt-16" delay={120}>
          {children}
        </Reveal>
      </div>
    </section>
  );
}

export default function Home() {
  const promoOn = Date.now() <= Date.parse(site.promo.until);
  const offer = promoOn ? site.promo.active : site.promo.after;
  const cta = site.ctaUrl;

  // Only the counts leave the patient list: names, characters and reasons stay inside the trainer.
  const counts = {
    total: scenarios.length,
    inbound: scenarios.filter((s) => !("outboundOnly" in s && s.outboundOnly)).length,
    outbound: scenarios.filter((s) => !("inboundOnly" in s && s.inboundOnly)).length,
  };

  return (
    <div className={`${manrope.className} relative isolate bg-graphite text-white`}>
      <a href="#main" className="sr-only rounded-full bg-flame px-4 py-2 font-semibold text-graphite focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50">
        К содержанию
      </a>
      <Nav links={LINKS} cta={{ href: cta, label: offer.heroCta, short: offer.navShort }} login={site.loginUrl} />

      <main id="main">
        {/* 1. Situation */}
        <section id="top" className="px-4 pt-32 pb-20 sm:pt-40 sm:pb-28">
          <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
            <div>
              <div className="site-in">
                <Eyebrow>{site.hero.eyebrow}</Eyebrow>
              </div>
              <h1
                className="site-in mt-6 max-w-[680px] bg-gradient-to-r from-white to-[#9b9b9b] bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl lg:text-6xl"
                style={{ animationDelay: "80ms" }}
              >
                <Lines text={site.hero.title} />
              </h1>
              <p className="site-in mt-6 max-w-[600px] text-lg text-pretty text-mist" style={{ animationDelay: "160ms" }}>
                {site.hero.subtitle}
              </p>
              <div className="site-in mt-10 flex flex-wrap items-center gap-x-5 gap-y-4" style={{ animationDelay: "240ms" }}>
                <Cta href={cta} event="hero_cta_click" place="hero">
                  {offer.heroCta}
                </Cta>
                <p className="flex items-center gap-2 text-sm text-mist">
                  <span className="h-1.5 w-1.5 rounded-full bg-pulse" />
                  {offer.heroNote}
                </p>
              </div>
            </div>
            <div className="site-in" style={{ animationDelay: "320ms" }}>
              <HeroCall />
            </div>
          </div>
        </section>

        {/* 2. Problem */}
        <Section id="problem" eyebrow={site.problem.eyebrow} title={site.problem.title} text={site.problem.text}>
          <ProblemCards cases={site.problem.cases} stages={site.problem.stages} />
        </Section>

        <section className="px-4 py-24 sm:py-40">
          <div className="mx-auto max-w-6xl">
            <Tagline lines={site.problem.tagline} />
          </div>
        </section>

        {/* 3. Implication */}
        <Section id="calculator" eyebrow={site.calculator.eyebrow} title={site.calculator.title} text={site.calculator.text}>
          <Calculator {...site.calculator} />
        </Section>

        {/* 4. Need-payoff: the demo stays in place on wide screens while the three advantages scroll past it. */}
        <section id="trainer" className="scroll-mt-24 px-4 py-24 sm:py-32">
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <Eyebrow>{site.solution.eyebrow}</Eyebrow>
              <h2 className="mt-5 max-w-[880px] text-3xl font-semibold tracking-tight text-balance text-white sm:text-5xl">
                <Lines text={site.solution.title} />
              </h2>
            </Reveal>
            <div className="mt-12 grid grid-cols-1 items-start gap-12 sm:mt-16 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
              <div className="lg:sticky lg:top-28">
                <Reveal>
                  <TrainerDemo demos={site.solution.demos as never} label={site.solution.demoLabel} empty={site.solution.demoEmpty} />
                </Reveal>
              </div>
              <ol className="grid gap-10 lg:gap-32 lg:py-16">
                {site.solution.benefits.map(([t, d], i) => (
                  <li key={t}>
                    <Reveal>
                      <span className="font-mono text-sm text-flame">0{i + 1}</span>
                      <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{t}</h3>
                      <p className="mt-3 text-base text-pretty text-mist">{d}</p>
                    </Reveal>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* 5. Patients */}
        <Section id="patients" eyebrow={site.patients.eyebrow} title={site.patients.title} text={site.patients.text}>
          <Patients types={site.patients.types as SituationType[]} counts={counts} labels={site.patients} />
        </Section>

        {/* 6. Tailored to the clinic */}
        <Section eyebrow={site.personal.eyebrow} title={site.personal.title}>
          <Personalize steps={site.personal.steps as [string, string][]} site={site.personal.site} facts={site.personal.facts} call={site.personal.call} />
        </Section>

        {/* 7. Manager */}
        <Section id="manager" eyebrow={site.dashboard.eyebrow} title={site.dashboard.title} text={site.dashboard.text}>
          <Dashboard />
        </Section>

        {/* 8. Free trial */}
        <section id="trial" className="scroll-mt-24 px-4 py-24 sm:py-32">
          <Reveal className="mx-auto max-w-6xl">
            <div className="rounded-[2.5rem] bg-flame/[0.06] p-2 ring-1 ring-inset ring-flame/25">
              <div className="grid grid-cols-1 gap-10 rounded-[2rem] bg-graphite-800 p-6 sm:p-12 lg:grid-cols-[1.4fr_1fr] lg:items-end lg:p-16">
                <div>
                  <Eyebrow>Тарифы</Eyebrow>
                  <h2 className="mt-5 max-w-[680px] text-3xl font-semibold tracking-tight text-balance text-white sm:text-5xl">{offer.finalTitle}</h2>
                  <p className="mt-6 max-w-[560px] text-lg text-pretty text-mist">{offer.finalText}</p>
                  <div className="mt-10">
                    <Cta href={cta} place="final">
                      {offer.finalCta}
                    </Cta>
                  </div>
                </div>
                <div className="rounded-3xl bg-graphite p-6 ring-1 ring-inset ring-white/[0.06]">
                  {promoOn && (
                    <p className="text-5xl font-semibold tracking-tight text-flame sm:text-6xl">
                      Бесплатно
                      <span className="mt-2 block text-2xl text-white sm:text-3xl">до 30 ноября</span>
                    </p>
                  )}
                  <ul className={`grid gap-3 ${promoOn ? "mt-8" : ""}`}>
                    {offer.finalPoints.map((p) => (
                      <li key={p} className="flex items-center gap-3 text-base text-white/90">
                        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-pulse" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="m5 12 5 5 9-10" />
                        </svg>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="px-4 pt-8 pb-12">
        <div className="mx-auto max-w-6xl">
          <p className="max-w-[680px] text-3xl font-semibold tracking-tight text-balance text-white/90 sm:text-4xl">Каждый звонок — возможность стать лучше.</p>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white/[0.03] px-5 py-4 text-sm text-mist ring-1 ring-inset ring-white/[0.05]">
            <p>© 2026 Stom AD · Маркетинг и обучение для стоматологий</p>
            <div className="flex gap-5">
              <a href={site.loginUrl} className="transition-colors duration-300 hover:text-white">
                Войти
              </a>
              <a href={cta} target="_blank" rel="noopener" className="transition-colors duration-300 hover:text-white">
                Telegram
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
