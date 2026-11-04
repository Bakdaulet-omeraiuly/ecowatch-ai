import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Халық денсаулығы — Атырау",
  description: "Ресми жинақталған статистика: тыныс алу және қан айналымы ауруларынан өлім-жітім, 100 000 тұрғынға шаққанда (ҰСБ, Taldau).",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
