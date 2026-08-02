import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

// Бет `"use client"` болғандықтан `metadata` экспорттай алмайды —
// сондықтан метадерек осы сервер компонентінде тұрады.
export const metadata: Metadata = pageMeta({
  title: "Азаматтық хабарлау",
  description:
    "Экологиялық мәселені фотосуретпен хабарлау: картадан жер таңдап, суретті жүктеу.",
  path: "/report",
  keywords: ["хабарлау", "азаматтық бақылау"],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
