import type { Metadata } from "next";
import { Onest } from "next/font/google";
import "./globals.css";
import brand from "@/lib/brand.json";

const onest = Onest({ subsets: ["latin", "cyrillic"], variable: "--font-onest", display: "swap" });

export const metadata: Metadata = {
  title: brand.name,
  description: `${brand.tagline}: голосовые переговоры с ИИ-пациентами, оценка по чек-листу и разбор звонков из CRM.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={onest.variable}>
      <body className="flex min-h-dvh flex-col antialiased">
        {children}
        <footer className="px-4 py-1.5 text-center text-[11px] leading-tight text-slate-600">
          Учебный симулятор: ИИ-пациенты и виртуальный оператор это симуляция. Не даёт медицинских, юридических и финансовых рекомендаций. Оценки модели могут быть неточными.
        </footer>
      </body>
    </html>
  );
}
