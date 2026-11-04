"use client";

import dynamic from "next/dynamic";
import { useLang } from "@/lib/i18n";

function MapLoading() {
  const { tr } = useLang();
  return <div role="status" className="flex min-h-0 flex-1 items-center justify-center text-neutral-600">{tr("Карта жүктелуде…")}</div>;
}

const MapView = dynamic(() => import("@/components/map/MapView").then((m) => m.MapView), {
  ssr: false,
  loading: MapLoading,
});

export default function MapPage() {
  return <MapView />;
}
