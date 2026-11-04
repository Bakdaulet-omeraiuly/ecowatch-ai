import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Кіру",
  description: "Jaiyq аккаунтына кіру және тіркелу.",
  path: "/auth",
  noindex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
