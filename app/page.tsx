import Link from "next/link";
import brand from "@/lib/brand.json";
import PatientGrid from "./patient-grid";
import KbBadge from "./kb-badge";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-10 px-5 py-14">
      <div>
        <p className="mb-3 text-sm font-medium uppercase tracking-widest text-amber-400">{brand.tagline}</p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">{brand.name}</h1>
        <p className="mt-4 text-lg text-slate-300">
          Пациент увидел рекламу, изучил сайт клиники и оставил заявку, а оператор ему перезванивает. Тренируйте живых операторов на ИИ-пациентах или проверяйте и обучайте виртуального оператора.
        </p>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-bold">1. Тренажёр для операторов</h2>
          <p className="text-sm text-slate-400">Вы — оператор колл-центра, пациента играет ИИ. Отработайте возражения, запишите на приём и сделайте так, чтобы человек пришёл.</p>
        </div>
        <PatientGrid />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-bold">2. Виртуальный оператор</h2>
          <p className="text-sm text-slate-400">Наоборот: оператор-ИИ звонит вам, а пациента играете вы без сценария, как в жизни. Каждый звонок разбирается, а лучшие практики копятся в общей базе знаний и применяются в следующих разговорах.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/operator" className="group flex flex-col rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-5 transition hover:border-emerald-400/70 hover:bg-emerald-400/10">
            <span className="mb-2 w-fit rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-xs font-medium text-emerald-300">Голос</span>
            <h3 className="text-lg font-semibold group-hover:text-emerald-300">Принять звонок от виртуального оператора</h3>
            <p className="mt-1 flex-1 text-sm text-slate-300">Ответьте на звонок и поведите себя как угодно: согласитесь, посомневайтесь, поторгуйтесь или откажитесь.</p>
            <span className="mt-3 text-sm font-semibold text-emerald-300">Принять звонок →</span>
          </Link>
          <Link href="/knowledge" className="group flex flex-col rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-emerald-400/60">
            <span className="mb-2 w-fit rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-slate-300">Общая память</span>
            <h3 className="text-lg font-semibold group-hover:text-emerald-300">База знаний оператора</h3>
            <p className="mt-1 flex-1 text-sm text-slate-300">Практики, выделенные из разборов, и то, чего оператор должен избегать.</p>
            <span className="mt-3 text-sm font-semibold text-emerald-300">Открыть → <span className="font-normal text-slate-400"><KbBadge /></span></span>
          </Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link href="/analyze" className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-emerald-400/60">
          <h3 className="font-semibold text-emerald-300">Оценить реальный звонок</h3>
          <p className="mt-1 text-sm text-slate-400">Звонки из CRM, загрузка записи или готовый транскрипт и оценка по чек-листу.</p>
        </Link>
        <Link href="/calculator" className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-emerald-400/60">
          <h3 className="font-semibold text-emerald-300">Калькулятор потерь</h3>
          <p className="mt-1 text-sm text-slate-400">Сколько клиника теряет на неоформленных записях и неявках (с вашими цифрами).</p>
        </Link>
      </section>

      <p className="text-sm text-slate-500">
        Оценка по 20+ критериям в четырёх навыках: выявление потребностей, работа с возражениями, запись на приём, гарантия явки. Нужен микрофон. Прогресс тренажёра хранится только в вашем браузере.
      </p>
    </main>
  );
}
