import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Шағымдарды қарау",
  description: "Тұрғын шағымдары — аспаптық өлшем емес. Жалобы жителей — не инструментальные измерения.",
  path: "/complaints/review",
  noindex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

