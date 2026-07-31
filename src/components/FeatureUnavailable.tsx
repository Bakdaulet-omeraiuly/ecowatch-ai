"use client";

import { Construction } from "lucide-react";
import { useLang } from "@/lib/i18n";

// Уақытша өшірілген бөлім (мыс. азаматтық хабарлау, модерация) үшін хабарлама.
export function FeatureUnavailable({ title }: { title: string }) {
  const { tr } = useLang();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-24 text-center">
      <Construction className="h-10 w-10 text-yellow-400" />
      <h1 className="text-xl font-bold text-white">{tr(title)}</h1>
      <p className="text-sm leading-relaxed text-neutral-400">
        {tr(
          "Бұл бөлім уақытша қолжетімсіз. Жүйе жүктемесін реттеу мақсатында азаматтық хабарлау кейінге қалдырылды — жақында қайта қосылады."
        )}
      </p>
    </div>
  );
}
