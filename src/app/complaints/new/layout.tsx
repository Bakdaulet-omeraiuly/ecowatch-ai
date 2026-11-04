import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Шағым жіберу",
  description: "Тұрғын шағымдары — аспаптық өлшем емес. Жалобы жителей — не инструментальные измерения.",
  path: "/complaints/new",
  noindex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

