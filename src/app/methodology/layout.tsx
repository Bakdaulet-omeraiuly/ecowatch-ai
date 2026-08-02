import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

// Бет `"use client"` болғандықтан `metadata` экспорттай алмайды —
// сондықтан метадерек осы сервер компонентінде тұрады.
export const metadata: Metadata = pageMeta({
  title: "Әдістеме және валидация күйі",
  description:
    "Сайттағы әр санның қайдан келетіні, қалай есептелетіні және НЕ ТЕКСЕРІЛМЕГЕНІ. Валидацияланбаған көрсеткіштер ашық белгіленеді.",
  path: "/methodology",
  keywords: ["әдістеме", "валидация", "методология"],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
