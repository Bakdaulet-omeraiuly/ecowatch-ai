import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

// Бет `"use client"` болғандықтан `metadata` экспорттай алмайды —
// сондықтан метадерек осы сервер компонентінде тұрады.
export const metadata: Metadata = pageMeta({
  title: "Каспий теңізі — Атырау ауа сапасы",
  description:
    "Каспий теңізі туралы анықтама және жағалаудағы Атырау қаласының тірі ауа сапасы (Copernicus CAMS, ҚР нормативтері мен WHO 2021).",
  path: "/caspian",
  keywords: ["Каспий", "Атырау", "ауа сапасы"],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
