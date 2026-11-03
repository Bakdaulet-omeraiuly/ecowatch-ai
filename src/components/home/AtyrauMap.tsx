"use client";

import { useLang } from "@/lib/i18n";

// Атырау картасы — статикалық Mapbox суреті (интерактивті карта /map бетінде).
// Тек орталық белгі. Мәндер картада көрсетілмейді — олар панельде, дереккөзімен бірге.
const LNG = 51.8833;
const LAT = 47.1167;

export function AtyrauMap() {
  const { t } = useLang();
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

  if (!token) {
    return (
      <div
        role="status"
        className="flex min-h-[260px] items-center justify-center rounded-md border border-dashed border-neutral-500 bg-neutral-50 p-4 text-center text-sm text-neutral-800"
      >
        {t("home.mapNoToken")}
      </div>
    );
  }

  const src =
    `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/` +
    `pin-s+0b3a6b(${LNG},${LAT})/${LNG},${LAT},10,0/800x480@2x?access_token=${encodeURIComponent(token)}`;

  return (
    <figure className="m-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={t("home.mapAlt")}
        width={800}
        height={480}
        className="h-auto w-full rounded-md border border-neutral-300 bg-neutral-100"
      />
      <figcaption className="mt-2 text-sm text-neutral-600">{t("home.mapLegend")}</figcaption>
    </figure>
  );
}
