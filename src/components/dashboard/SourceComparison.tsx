"use client";

import { useEffect, useState } from "react";
import { Radio, Satellite, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { aqiCategory } from "@/lib/airQuality";
import { useLang } from "@/lib/i18n";

// Атырау қаласы бойынша ЕКІ дереккөзді қатар салыстыру:
//  • CAMS моделі (біздің, ~11км орташа)  • Qazhydromet нақты жердегі датчигі
// Барлық дерек шынайы. Датчик деректері WAQI_TOKEN болғанда шығады.

const ATYRAU = { lat: 47.1167, lng: 51.8833 };

interface Cams { aqi: number | null; pm2_5: number | null; pm10: number | null; so2: number | null; no2: number | null }
interface Station {
  found: boolean; station?: string; distanceKm?: number | null; time?: string | null;
  aqi?: number | null; iaqi?: { pm25: number | null; pm10: number | null; no2: number | null; so2: number | null };
}

function usAqiColor(a: number): string {
  return a <= 50 ? "#22c55e" : a <= 100 ? "#eab308" : a <= 150 ? "#f97316" : a <= 200 ? "#ef4444" : a <= 300 ? "#a855f7" : "#7f1d1d";
}
function usAqiName(a: number): string {
  return a <= 50 ? "Жақсы" : a <= 100 ? "Қалыпты" : a <= 150 ? "Сезімталдарға" : a <= 200 ? "Нашар" : "Өте нашар";
}

export function SourceComparison() {
  const { tr } = useLang();
  const [cams, setCams] = useState<Cams | null>(null);
  const [station, setStation] = useState<Station | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      fetch(`/api/point-air?lat=${ATYRAU.lat}&lng=${ATYRAU.lng}`).then((r) => r.json()),
      fetch(`/api/station-air?lat=${ATYRAU.lat}&lng=${ATYRAU.lng}`).then((r) => r.json()),
    ]).then(([c, s]) => {
      if (c.status === "fulfilled" && c.value && !c.value.error) setCams(c.value);
      if (s.status === "fulfilled" && s.value?.found) setStation(s.value);
      setLoading(false);
    });
  }, []);

  return (
    <Card className="border-white/10 bg-white/[0.03]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-white">
          {tr("Дереккөздерді салыстыру — Атырау")}
        </CardTitle>
        <p className="text-[11px] text-neutral-400">
          {tr("Біздің модель (CAMS) мен нақты жердегі датчик (Qazhydromet) — қатар")}
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-neutral-400">
            <Loader2 className="h-4 w-4 animate-spin" /> {tr("Жүктелуде…")}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {/* CAMS моделі */}
            <div className="rounded-lg border border-sky-500/30 bg-sky-500/[0.06] p-3">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-sky-300">
                <Satellite className="h-3.5 w-3.5" /> {tr("Модель · CAMS")}
              </div>
              {cams?.aqi != null ? (
                <div className="mb-2">
                  <span className="text-2xl font-bold" style={{ color: aqiCategory(cams.aqi).color }}>
                    {Math.round(cams.aqi)}
                  </span>
                  <span className="ml-1 text-[11px] text-neutral-400">
                    EU AQI · {tr(aqiCategory(cams.aqi).name)}
                  </span>
                </div>
              ) : (
                <p className="mb-2 text-[11px] text-neutral-500">{tr("Қолжетімсіз")}</p>
              )}
              <div className="space-y-0.5 text-[11px] text-neutral-300">
                {cams?.so2 != null && <div className="flex justify-between"><span className="text-neutral-500">SO₂</span><span>{cams.so2.toFixed(1)}</span></div>}
                {cams?.no2 != null && <div className="flex justify-between"><span className="text-neutral-500">NO₂</span><span>{cams.no2.toFixed(1)}</span></div>}
                {cams?.pm2_5 != null && <div className="flex justify-between"><span className="text-neutral-500">PM₂.₅</span><span>{cams.pm2_5.toFixed(1)}</span></div>}
                {cams?.pm10 != null && <div className="flex justify-between"><span className="text-neutral-500">PM₁₀</span><span>{cams.pm10.toFixed(1)}</span></div>}
              </div>
              <p className="mt-1.5 text-[8px] text-neutral-500">µg/m³ · {tr("~11км орташа")}</p>
            </div>

            {/* Qazhydromet нақты датчик */}
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-3">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300">
                <Radio className="h-3.5 w-3.5" /> {tr("Датчик · Qazhydromet")}
              </div>
              {station?.found && station.aqi != null ? (
                <>
                  <div className="mb-2">
                    <span className="text-2xl font-bold" style={{ color: usAqiColor(station.aqi) }}>
                      {station.aqi}
                    </span>
                    <span className="ml-1 text-[11px] text-neutral-400">
                      US AQI · {tr(usAqiName(station.aqi))}
                    </span>
                  </div>
                  <div className="space-y-0.5 text-[11px] text-neutral-300">
                    {station.iaqi?.so2 != null && <div className="flex justify-between"><span className="text-neutral-500">SO₂</span><span>{station.iaqi.so2}</span></div>}
                    {station.iaqi?.no2 != null && <div className="flex justify-between"><span className="text-neutral-500">NO₂</span><span>{station.iaqi.no2}</span></div>}
                    {station.iaqi?.pm25 != null && <div className="flex justify-between"><span className="text-neutral-500">PM₂.₅</span><span>{station.iaqi.pm25}</span></div>}
                    {station.iaqi?.pm10 != null && <div className="flex justify-between"><span className="text-neutral-500">PM₁₀</span><span>{station.iaqi.pm10}</span></div>}
                  </div>
                  <p className="mt-1.5 text-[8px] text-neutral-500">
                    {tr("AQI индексі")} · {station.station}
                    {station.time ? ` · ${station.time.slice(11, 16)}` : ""}
                  </p>
                </>
              ) : (
                <p className="text-[11px] text-neutral-500">
                  {tr("Нақты датчик қолжетімсіз (WAQI_TOKEN керек) — жалған дерек көрсетілмейді.")}
                </p>
              )}
            </div>
          </div>
        )}

        {!loading && (
          <p className="mt-2 text-[9px] leading-snug text-neutral-500">
            {tr("Ескерту: EU AQI мен US AQI — бөлек шкала. Датчик нүктелік нақты өлшеу, модель ~11км орташа — сондықтан сандар әрдайым бірдей емес.")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
