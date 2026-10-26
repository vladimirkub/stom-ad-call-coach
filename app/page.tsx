import Link from "next/link";
import brand from "@/lib/brand.json";
import { ArrowUpRight } from "./icons";

// First page: the product banner. A click anywhere on it opens the working app with all features.
export default function Landing() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 px-3 py-4 sm:px-6">
      <Link
        href="/app"
        aria-label={`${brand.name}: открыть приложение`}
        className="rise bezel group block w-full max-w-[1672px] transition duration-700 ease-[var(--ease-spring)] hover:-translate-y-1 hover:shadow-[inset_0_0_0_1px_oklch(0.84_0.12_168/0.45)]"
      >
        <span className="block overflow-hidden rounded-[calc(1.5rem-0.3125rem)] shadow-[0_30px_80px_-30px_rgb(2_6_23/0.9)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hero.webp"
            alt={`${brand.name}: AI-тренажёр телефонных разговоров для администраторов стоматологических клиник. Реалистичные AI-пациенты, честная оценка навыков, конкретные рекомендации.`}
            width={1672}
            height={941}
            className="h-auto w-full transition duration-700 ease-[var(--ease-spring)] group-hover:scale-[1.01]"
          />
        </span>
      </Link>
      <Link href="/app" className="rise btn btn-primary group/btn py-1.5 pr-1.5 pl-6 sm:hidden" style={{ animationDelay: "120ms" }}>
        Открыть приложение
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-950/10 transition duration-500 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5">
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </Link>
    </main>
  );
}
