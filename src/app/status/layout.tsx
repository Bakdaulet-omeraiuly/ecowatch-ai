import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Дереккөздер күйі",
  description: "Jaiyq дереккөздерінің (CAMS, OpenAQ, FIRMS, Open-Meteo, OSM, Sentinel, WorldPop) қазіргі күйі және деректің уақыты.",
  alternates: { canonical: "/status" },
};

export default function StatusLayout({ children }: { children: React.ReactNode }) {
  return children;
}
