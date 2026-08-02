import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

// Бет `"use client"` болғандықтан `metadata` экспорттай алмайды —
// сондықтан метадерек осы сервер компонентінде тұрады.
export const metadata: Metadata = pageMeta({
  title: "Спутник суреттерін салыстыру",
  description:
    "Бір аумақтың әр жылдағы спутник суреттерін қатар қою — жер бетінің өзгерісін көзбен бақылау.",
  path: "/compare",
  keywords: ["спутник", "салыстыру", "тарихи суреттер"],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
