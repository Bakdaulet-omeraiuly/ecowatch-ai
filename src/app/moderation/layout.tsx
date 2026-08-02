import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

// ҚЫЗМЕТТІК БЕТ — іздеу жүйелеріне берілмейді (robots.ts-те де жабық).
export const metadata: Metadata = pageMeta({
  title: "Модерация",
  description: "Азаматтық хабарламаларды тексеру — қызметтік бет.",
  path: "/moderation",
  noindex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
