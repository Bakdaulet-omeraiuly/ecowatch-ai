import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

// Бет `"use client"` болғандықтан `metadata` экспорттай алмайды —
// сондықтан метадерек осы сервер компонентінде тұрады.
export const metadata: Metadata = pageMeta({
  title: "Аналитика",
  description:
    "Тірі ауа сапасы, өрт қаупі индексі (FWI), құрғақшылық (SPI-3), маса индексі және заңнамалық нормалардан асу — графиктермен және болжаммен.",
  path: "/dashboard",
  keywords: ["аналитика", "дашборд", "FWI", "SPI", "ауа сапасы графигі"],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
