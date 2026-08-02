import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

// Бет `"use client"` болғандықтан `metadata` экспорттай алмайды —
// сондықтан метадерек осы сервер компонентінде тұрады.
export const metadata: Metadata = pageMeta({
  title: "Ескертулер",
  description:
    "Заңнамалық нормалардан асу мен жоғары тәуекелді нүктелер бойынша ескертулер жүйесі.",
  path: "/alerts",
  keywords: ["ескерту", "норма асуы"],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
