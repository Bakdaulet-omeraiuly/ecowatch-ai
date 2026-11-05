import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

// Бет `"use client"` болғандықтан `metadata` экспорттай алмайды —
// сондықтан метадерек осы сервер компонентінде тұрады.
export const metadata: Metadata = pageMeta({
  title: "Тәуекел ескертулері",
  description:
    "Осы браузерде AI талдауы жоғары тәуекел деп бағалаған нүктелер тізімі (валидацияланбаған бағалау). Органдарға автоматты жіберілмейді.",
  path: "/alerts",
  keywords: ["ескерту", "тәуекел", "AI талдау"],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
