import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

// Бет `"use client"` болғандықтан `metadata` экспорттай алмайды —
// сондықтан метадерек осы сервер компонентінде тұрады.
export const metadata: Metadata = pageMeta({
  title: "Каспий жағалауы — бес елдің салыстыруы",
  description:
    "Атырау, Ақтау, Баку, Сумқайыт, Астрахань, Махачкала, Түрікменбашы және Энзели қалаларының ауа сапасын бір модельмен салыстыру.",
  path: "/caspian",
  keywords: ["Каспий", "Баку", "Астрахань", "Ақтау", "салыстыру"],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
