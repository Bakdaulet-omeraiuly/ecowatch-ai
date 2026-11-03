"use client";

import dynamic from "next/dynamic";

const MapView = dynamic(() => import("@/components/map/MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-0 flex-1 items-center justify-center text-neutral-400">
      Карта жүктелуде…
    </div>
  ),
});

export default function MapPage() {
  return <MapView />;
}
