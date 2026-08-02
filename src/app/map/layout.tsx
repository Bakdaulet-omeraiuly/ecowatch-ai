import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

// Бет `"use client"` болғандықтан `metadata` экспорттай алмайды —
// сондықтан метадерек осы сервер компонентінде тұрады.
export const metadata: Metadata = pageMeta({
  title: "Экологиялық карта",
  description:
    "Атырау мен Каспий жағалауының тірі экологиялық картасы: ауа сапасы, өзен ағыны, топырақ, өрт қаупі, жылу аномалиялары, маса тәуекелі және ластану көзін анықтау.",
  path: "/map",
  keywords: ["карта", "ауа сапасы картасы", "ластану көзі", "жылу аномалиясы"],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
