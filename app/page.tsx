import Link from "next/link";
import brand from "@/lib/brand.json";

// First page: the product banner. A click anywhere on it opens the working app with all features.
export default function Landing() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4 px-3 py-4 sm:px-6">
      <Link
        href="/app"
        aria-label={`${brand.name}: открыть приложение`}
        className="group block w-full max-w-[1672px] overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/50 transition hover:border-emerald-400/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero.webp"
          alt={`${brand.name}: AI-тренажёр телефонных разговоров для администраторов стоматологических клиник. Реалистичные AI-пациенты, честная оценка навыков, конкретные рекомендации.`}
          width={1672}
          height={941}
          className="h-auto w-full transition duration-300 group-hover:scale-[1.01]"
        />
      </Link>
      <Link href="/app" className="rounded-xl bg-emerald-400 px-6 py-3 text-base font-semibold text-black transition hover:bg-emerald-300 sm:hidden">
        Открыть приложение →
      </Link>
    </main>
  );
}
