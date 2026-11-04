"use client";

import { useState } from "react";
import Map, { Marker, type MapMouseEvent } from "react-map-gl/mapbox";
import { MapPin } from "lucide-react";
import { useLang } from "@/lib/i18n";

const ATYRAU = { latitude: 47.1167, longitude: 51.8833, zoom: 9 };

export function LocationPicker({
  lat,
  lng,
  onPick,
  labels,
}: {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
  labels?: { unavailable: string; pick: string; selected: string };
}) {
  const { tr } = useLang();
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const [hover, setHover] = useState(false);

  if (!token) {
    return (
      <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-neutral-600">
        {labels?.unavailable ?? "Mapbox токені жоқ — координатты қолмен енгізіңіз."}
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-300">
      <div className="h-64 w-full">
        <Map
          mapboxAccessToken={token}
          initialViewState={
            lat != null && lng != null ? { latitude: lat, longitude: lng, zoom: 12 } : ATYRAU
          }
          mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
          onClick={(e: MapMouseEvent) => onPick(e.lngLat.lat, e.lngLat.lng)}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          cursor="crosshair"
        >
          {lat != null && lng != null && (
            <Marker latitude={lat} longitude={lng} anchor="bottom">
              <MapPin className="h-7 w-7 fill-red-500/30 text-red-800 drop-shadow" />
            </Marker>
          )}
        </Map>
      </div>
      <div className="bg-white/80 px-3 py-1.5 text-[13px] text-neutral-600">
        {lat != null && lng != null
          ? labels ? `${labels.selected}: ${lat.toFixed(5)}, ${lng.toFixed(5)}` : `Таңдалды: ${lat.toFixed(5)}, ${lng.toFixed(5)} — басқа жерді басып өзгертуге болады`
          : labels ? labels.pick : hover
            ? tr("Мәселе байқалған нақты жерді басыңыз")
            : tr("Картадан мәселе орнын басып белгілеңіз")}
      </div>
    </div>
  );
}
