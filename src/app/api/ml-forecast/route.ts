import { NextResponse } from "next/server";
import { buildFeatures, RAW_KEYS, WINDOW, type RawRow } from "@/lib/ml/features";
import { isTrained, model, predict } from "@/lib/ml/gbt";

// JAIYQ-ML — Атырау ауа сапасының кеңейтілген болжамы.
//
// Не үшін керек: Copernicus CAMS ауа сапасы болжамы ~5 күнмен шектеледі,
// ал ауа райы болжамы 16 күнге дейін жетеді. Модель метеорологиядан
// AQI/PM₂.₅ мәнін қалпына келтіруді үйренген, сондықтан болжамды
// CAMS шегінен әрі — 11 күнге дейін жалғастыра алады.
//
// Барлық кіріс НАҚТЫ: Open-Meteo болжам API (ECMWF) + CAMS.
// Модель оқытылмаған болса — жалған дерек қайтарылмайды, 503 беріледі.

export const revalidate = 3600;

const FORECAST_DAYS = 11;

const WX_URL =
  `https://api.open-meteo.com/v1/forecast` +
  `?latitude=${model.trained ? model.location.lat : 47.1167}` +
  `&longitude=${model.trained ? model.location.lng : 51.8833}` +
  `&hourly=${RAW_KEYS.join(",")}` +
  `&past_days=2&forecast_days=${FORECAST_DAYS}&timezone=UTC`;

const CAMS_URL =
  `https://air-quality-api.open-meteo.com/v1/air-quality` +
  `?latitude=${model.trained ? model.location.lat : 47.1167}` +
  `&longitude=${model.trained ? model.location.lng : 51.8833}` +
  `&hourly=european_aqi,pm2_5&forecast_days=5&timezone=UTC`;

interface HourOut {
  time: string;
  aqi: number;
  pm2_5: number;
  camsAqi: number | null;
  camsPm25: number | null;
  beyondCams: boolean;
}

interface DayOut {
  date: string;
  aqiAvg: number;
  aqiMax: number;
  pm25Avg: number;
  beyondCams: boolean;
}

let cache: { at: number; data: unknown } | null = null;

export async function GET() {
  if (!isTrained(model)) {
    return NextResponse.json(
      {
        error: "Модель әлі оқытылмаған — жалған дерек көрсетілмейді",
        detail: model.note,
      },
      { status: 503 }
    );
  }

  if (cache && Date.now() - cache.at < 3600_000) {
    return NextResponse.json(cache.data);
  }

  try {
    const [wxRes, camsRes] = await Promise.all([
      fetch(WX_URL, { next: { revalidate: 3600 } }),
      fetch(CAMS_URL, { next: { revalidate: 3600 } }).catch(() => null),
    ]);
    if (!wxRes.ok) throw new Error(`upstream ${wxRes.status}`);

    const wx = (await wxRes.json()) as {
      hourly?: Record<string, (number | null)[] | string[]>;
    };
    const times = (wx.hourly?.time as string[] | undefined) ?? [];
    if (times.length < WINDOW + 24) throw new Error("ауа райы болжамы толық емес");

    const rows: RawRow[] = times.map((t, i) => {
      const row: RawRow = { time: t };
      for (const k of RAW_KEYS) {
        const col = wx.hourly?.[k] as (number | null)[] | undefined;
        row[k] = col?.[i] ?? null;
      }
      return row;
    });

    const { X, times: featTimes } = buildFeatures(rows);

    // CAMS болжамы — салыстыру үшін (5 күн). Қолжетімсіз болса null қалады.
    const cams = new Map<string, { aqi: number | null; pm25: number | null }>();
    let camsLast = "";
    if (camsRes?.ok) {
      const cj = (await camsRes.json()) as {
        hourly?: { time?: string[]; european_aqi?: (number | null)[]; pm2_5?: (number | null)[] };
      };
      const ct = cj.hourly?.time ?? [];
      ct.forEach((t, i) => {
        cams.set(t, {
          aqi: cj.hourly?.european_aqi?.[i] ?? null,
          pm25: cj.hourly?.pm2_5?.[i] ?? null,
        });
      });
      camsLast = ct[ct.length - 1] ?? "";
    }

    const aqiSpec = model.targets["european_aqi"];
    const pmSpec = model.targets["pm2_5"];
    if (!aqiSpec || !pmSpec) throw new Error("модельде қажетті мақсат жоқ");

    // Open-Meteo `timezone=UTC` кезінде "2026-08-01T13:00" түрінде қайтарады
    const asUtc = (t: string) => new Date(/[Zz]|[+-]\d\d:?\d\d$/.test(t) ? t : `${t}Z`);

    const nowMs = Date.now() - 3600_000;
    const hours: HourOut[] = [];
    for (let i = 0; i < X.length; i++) {
      const t = featTimes[i];
      if (asUtc(t).getTime() < nowMs) continue; // өткен сағаттарды тастаймыз
      const c = cams.get(t);
      hours.push({
        time: t,
        aqi: Math.max(0, Math.round(predict(aqiSpec, X[i]))),
        pm2_5: Math.max(0, Math.round(predict(pmSpec, X[i]) * 10) / 10),
        camsAqi: c?.aqi ?? null,
        camsPm25: c?.pm25 ?? null,
        beyondCams: !camsLast || t > camsLast,
      });
    }

    if (!hours.length) throw new Error("болжам жолдары бос");

    // Күндік жинақтау
    const byDay = new Map<string, HourOut[]>();
    for (const h of hours) {
      const d = h.time.slice(0, 10);
      const list = byDay.get(d);
      if (list) list.push(h);
      else byDay.set(d, [h]);
    }
    const daily: DayOut[] = [...byDay.entries()].map(([date, hs]) => ({
      date,
      aqiAvg: Math.round(hs.reduce((a, h) => a + h.aqi, 0) / hs.length),
      aqiMax: Math.max(...hs.map((h) => h.aqi)),
      pm25Avg: Math.round((hs.reduce((a, h) => a + h.pm2_5, 0) / hs.length) * 10) / 10,
      beyondCams: hs.every((h) => h.beyondCams),
    }));

    const data = {
      fetchedAt: new Date().toISOString(),
      model: {
        name: model.name,
        version: model.version,
        trainedAt: model.generatedAt,
        trainPeriod: model.trainPeriod,
        features: model.features.length,
        metrics: {
          european_aqi: aqiSpec.metrics,
          pm2_5: pmSpec.metrics,
        },
      },
      location: model.location,
      camsHorizonEnd: camsLast || null,
      camsAvailable: cams.size > 0,
      hours,
      daily,
      source: `Болжам кірісі: Open-Meteo ECMWF (ауа райы) + Copernicus CAMS (салыстыру). Модель: ${model.source}`,
      disclaimer: model.disclaimer,
    };

    cache = { at: Date.now(), data };
    return NextResponse.json(data);
  } catch (err) {
    console.error("ML forecast error:", err);
    return NextResponse.json(
      { error: "Болжам деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді" },
      { status: 503 }
    );
  }
}
