import type { Metadata } from "next";
import "./globals.css";
import brand from "@/lib/brand.json";

export const metadata: Metadata = {
  title: brand.name,
  description: `${brand.tagline}: голосовые переговоры с ИИ-пациентами, оценка по чек-листу и разбор звонков из CRM.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen antialiased">
        {children}
        <footer className="mx-auto max-w-3xl px-5 pb-8 pt-2 text-center text-xs text-slate-600">
          Учебный симулятор: ИИ-пациенты и виртуальный оператор это симуляция. Продукт не даёт медицинских, юридических и финансовых рекомендаций. Оценки и советы генерирует языковая модель и могут быть неточными.
        </footer>
      </body>
    </html>
  );
}
