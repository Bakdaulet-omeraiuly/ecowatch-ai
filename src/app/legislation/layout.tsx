import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

// Бет `"use client"` болғандықтан `metadata` экспорттай алмайды —
// сондықтан метадерек осы сервер компонентінде тұрады.
export const metadata: Metadata = pageMeta({
  title: "Заңнама және норма тізілімі",
  description:
    "ҚР ДСМ-70 гигиеналық нормативтері, Экологиялық кодекс, ӘҚБтК, WHO 2021 және EU 2008/50/EC нормалары. Әр норманың растау күйі көрсетілген.",
  path: "/legislation",
  keywords: ["ШРК", "ДСМ-70", "экологиялық кодекс", "заңнама", "WHO нормасы"],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
