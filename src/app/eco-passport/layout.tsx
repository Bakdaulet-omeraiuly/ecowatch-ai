import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

// Бет `"use client"` болғандықтан `metadata` экспорттай алмайды —
// сондықтан метадерек осы сервер компонентінде тұрады.
export const metadata: Metadata = pageMeta({
  title: "Эко-паспорт",
  description:
    "Кәсіби құжат: әр экологиялық көрсеткіштің формуласы, есептеу тізбегі, аспабы, дереккөз құжаты және ҚР нормасымен салыстыруы. Басып шығаруға дайын.",
  path: "/eco-passport",
  keywords: ["эко-паспорт", "экологиялық паспорт", "формула", "дереккөз"],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
