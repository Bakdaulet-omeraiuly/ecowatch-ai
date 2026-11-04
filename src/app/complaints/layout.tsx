import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Тұрғындардың шағымдары",
  description: "Тұрғын шағымдары — аспаптық өлшем емес. Жалобы жителей — не инструментальные измерения.",
  path: "/complaints",
  noindex: false,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

