import { NextResponse } from "next/server";
import {
  attributePollution, CITY as SRC_CITY,
  type Receptor, type WindHour, type Station,
} from "@/lib/pollutionSource";
import { getRegion, hasModule, moduleUnavailable } from "@/data/regions";
import {
  parseSelection, isSelectionError, meteoUrl, airUrl, hourIndex, formatKz,
  MAX_DAYS_BACK,
} from "@/lib/pollutionTime";
import { buildTimeline, type AirHour } from "@/lib/pollutionTimeline";

// Нақты жердегі стансалар (Qazhydromet — WAQI/aqicn желісі). Токен болса ғана.
// Атырау облысының шектелген аймағындағы барлық постты тартады.
async function fetchStations(): Promise<Station[]> {
  const token = process.env.WAQI_TOKEN;
  if (!token) return [];
  // Timeout: WAQI баяу болса да негізгі жауапты бөгемейді (3.5с)
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3500);
  try {
    const res = await fetch(
      `https://api.waqi.info/map/bounds/?latlng=46.0,49.2,48.8,54.8&token=${token}`,
      { next: { revalidate: 900 }, signal: ctrl.signal }
    );
    if (!res.ok) return [];
    const j = await res.json();
    if (j.status !== "ok" || !Array.isArray(j.data)) return [];
    return j.data
      .map((s: { lat: number; lon: number; aqi: string; station?: { name?: string } }) => ({
        lat: s.lat,
        lng: s.lon,
        aqi: parseInt(s.aqi, 10),
        name: s.station?.name,
      }))
      .filter((s: Station) => Number.isFinite(s.aqi)); // "-" (дерексіз) постты алып тастау
  } catch (err) {
    console.error("WAQI stations error:", err);
    return []; // қате/timeout → станссыз жалғасады (қабат бос қалмайды)
  } finally {
    clearTimeout(timer);
  }
}

// Ластану көзін анықтау (Pollution Source Detection).
// Тірі деректер: Copernicus CAMS (SO₂/NO₂/PM) + Open-Meteo (жел бағыты/жылдамдығы).
// Ешбір дерек ойдан жасалмайды — дереккөз қолжетімсіз болса, қате қайтарамыз.

export const revalidate = 1800; // 30 мин

// CAMS қабылдағыш торы (қаланы қоршаған нүктелер)
const LATS = [46.6, 47.0, 47.11, 47.4, 47.8];
const LNGS = [51.2, 51.6, 51.9, 52.3, 52.8];
const gridPoints: { lat: number; lng: number }[] = [];
for (const lat of LATS) for (const lng of LNGS) gridPoints.push({ lat, lng });

// Қала орталығы кітапханадан оқылады — бұрын екі файлда әртүрлі
// координата тұрған (51.90 мен 51.92, ~1,5 км айырма).
const CITY = SRC_CITY;

// ЖЕЛ ӨРІСІ — тордың ӘР НҮКТЕСІНДЕ.
//
// ⚠️ Бұрын жел тек қала орталығында алынып, бүкіл торға таралатын.
// Ал тор ~130 × 120 км: Каспий жағасында теңіз бризі бар, атыраудағы
// жел қаладағыдан жиі өзгеше болады. Ол атрибуцияға тікелей әсер етеді
// (көз желдің КЕЛГЕН жағынан ізделеді). Енді әр қабылдағыштың өз желі.
//
// Бірінші нүкте — қала орталығы, сағаттық тарих пен «алға қарау» содан алынады.
const METEO_POINTS = [CITY, ...gridPoints];

// URL-дер енді таңдалған уақытқа қарай құрылады (@/lib/pollutionTime):
// тірі режимде `current` + past_days, архив режимінде start_date/end_date.

// Кэш уақыт таңдауы бойынша БӨЛЕК — әйтпесе бір сағаттың жауабы
// екіншісіне беріліп кетеді.
const cache = new Map<string, { at: number; data: unknown }>();
const CACHE_MS = 1800_000;
/** Архив өзгермейді — оны ұзағырақ ұстауға болады */
const ARCHIVE_CACHE_MS = 12 * 3600_000;

export async function GET(req: Request) {
  // Ластану көзін анықтау кәсіпорындардың ТЕКСЕРІЛГЕН координаттарына
  // сүйенеді (src/data/facilities.ts — қазір тек Атырау). Тізілімсіз
  // аймақта «көз» көрсету — жалған айыптау болар еді.
  const region = getRegion(new URL(req.url).searchParams.get("region"));
  if (!hasModule(region, "pollutionSource")) {
    return NextResponse.json(moduleUnavailable(region, "pollutionSource"));
  }

  // УАҚЫТ ТАҢДАУЫ: `?at=2026-08-14T15:00` берілсе — архив режимі.
  const sel = parseSelection(new URL(req.url).searchParams.get("at"));
  if (isSelectionError(sel)) {
    return NextResponse.json(sel, { status: 400 });
  }

  const key = `${region.id}:${sel.at ?? "live"}`;
  const ttl = sel.mode === "archive" ? ARCHIVE_CACHE_MS : CACHE_MS;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) {
    return NextResponse.json(hit.data);
  }
  try {
    const [gRes, wRes, aRes, stations] = await Promise.all([
      fetch(airUrl(gridPoints, sel), { next: { revalidate: 1800 } }),
      fetch(meteoUrl(METEO_POINTS, sel), { next: { revalidate: 1800 } }),
      fetch(airUrl([CITY], sel, { hourly: true }), { next: { revalidate: 1800 } }),
      // ⚠️ WAQI тек ҚАЗІРГІ мәнді береді — тарихы жоқ. Сондықтан архив
      // режимінде жердегі стансалар ҚОСЫЛМАЙДЫ, ол жауапта белгіленеді.
      sel.mode === "live" ? fetchStations() : Promise.resolve([] as Station[]),
    ]);
    if (!gRes.ok || !wRes.ok || !aRes.ok) {
      throw new Error(`upstream ${gRes.status}/${wRes.status}/${aRes.status}`);
    }
    const gArr = await gRes.json();
    const wArr = await wRes.json();
    const cityAir = await aRes.json();

    // Жел жауабы — МАССИВ: [0] қала орталығы, [1..] тор нүктелері
    // (WIND_URL сол ретпен сұралады).
    type Hourly = {
      time?: string[];
      wind_speed_10m?: (number | null)[];
      wind_direction_10m?: (number | null)[];
      shortwave_radiation?: (number | null)[];
      cloud_cover?: (number | null)[];
      is_day?: (number | null)[];
    };
    type WindPoint = {
      utc_offset_seconds?: number;
      current?: {
        wind_direction_10m?: number; wind_speed_10m?: number;
        is_day?: number; shortwave_radiation?: number; cloud_cover?: number;
      };
      hourly?: Hourly;
    };
    type AirHourly = {
      time?: string[];
      sulphur_dioxide?: (number | null)[];
      nitrogen_dioxide?: (number | null)[];
      pm10?: (number | null)[];
    };
    const wList: WindPoint[] = Array.isArray(wArr) ? wArr : [wArr];
    const wind = wList[0] ?? {};

    // ── ТАҢДАЛҒАН САҒАТТЫҢ ИНДЕКСІ ───────────────────────────────────────
    // Архив режимінде барлық мән осы индекстен алынады. Табылмаса — дерек
    // ЖОҚ дегенді білдіреді, ойдан толтырылмайды.
    const atIdx = sel.mode === "archive" ? hourIndex(wind.hourly?.time, sel.at!) : -1;
    if (sel.mode === "archive" && atIdx < 0) {
      return NextResponse.json(
        {
          error: `${formatKz(sel.at!)} — бұл сағат үшін метеодерек жоқ`,
          detail:
            `Дереккөз (${sel.useEra5 ? "ECMWF ERA5 архиві" : "Open-Meteo"}) осы сағатты ` +
            `қайтармады. Ойдан дерек жасалмайды. Басқа сағатты таңдап көріңіз.`,
          mode: sel.mode, at: sel.at,
        },
        { status: 404 }
      );
    }

    /** Тірі режимде `current`-тен, архивте сағаттық массивтен алу */
    const pick = (p: WindPoint | undefined, k: keyof Hourly): number | null => {
      if (!p) return null;
      if (sel.mode === "live") {
        const c = p.current as Record<string, number | undefined> | undefined;
        return c?.[k as string] ?? null;
      }
      const i = hourIndex(p.hourly?.time, sel.at!);
      if (i < 0) return null;
      return (p.hourly?.[k] as (number | null)[] | undefined)?.[i] ?? null;
    };

    // 1) Қабылдағыш торы — ӘР НҮКТЕНІҢ ӨЗ ЖЕЛІМЕН
    const gList = Array.isArray(gArr) ? gArr : [gArr];
    const receptors: Receptor[] = gList.map(
      (
        d: {
          latitude: number;
          longitude: number;
          current?: { sulphur_dioxide?: number; nitrogen_dioxide?: number; pm10?: number };
          hourly?: AirHourly;
        },
        i: number
      ) => {
        const w = wList[i + 1]; // [0] — қала, сондықтан +1
        const air = (k: keyof AirHourly): number | null => {
          if (sel.mode === "live") {
            const c = d.current as Record<string, number | undefined> | undefined;
            return c?.[k as string] ?? null;
          }
          const gi = hourIndex(d.hourly?.time, sel.at!);
          if (gi < 0) return null;
          return (d.hourly?.[k] as (number | null)[] | undefined)?.[gi] ?? null;
        };
        return {
          lat: d.latitude,
          lng: d.longitude,
          so2: air("sulphur_dioxide"),
          no2: air("nitrogen_dioxide"),
          pm: air("pm10"),
          windFrom: pick(w, "wind_direction_10m"),
          windSpeed: pick(w, "wind_speed_10m"),
        };
      }
    );

    // 2) Таңдалған сағаттағы жел (қала орталығы) + орнықтылық кірістері
    const windNow = {
      fromBearing: pick(wind, "wind_direction_10m") ?? 0,
      speed: pick(wind, "wind_speed_10m") ?? 0,
    };
    // Pasquill класы үшін: күндіз бе, күн радиациясы, бұлттылық
    const isDayVal = pick(wind, "is_day");
    const airMeteo = {
      isDay: isDayVal == null ? true : isDayVal === 1,
      solarWm2: pick(wind, "shortwave_radiation"),
      cloudPct: pick(wind, "cloud_cover"),
    };

    // 3) Уақыттық тарих (жел + қалалық концентрация сағат бойынша сәйкестендіру)
    const wTimes: string[] = wind.hourly?.time ?? [];
    const wSpeed: (number | null)[] = wind.hourly?.wind_speed_10m ?? [];
    const wDir: (number | null)[] = wind.hourly?.wind_direction_10m ?? [];
    const aTimes: string[] = cityAir.hourly?.time ?? [];
    const aSo2: (number | null)[] = cityAir.hourly?.sulphur_dioxide ?? [];
    const aNo2: (number | null)[] = cityAir.hourly?.nitrogen_dioxide ?? [];
    const aPm: (number | null)[] = cityAir.hourly?.pm10 ?? [];
    // Хронологияға арналған қосымша ластаушылар (тек ҚАЛА нүктесінде —
    // тор нүктелерінде олар сұралмайды, сұраныс салмағын өсірмеу үшін)
    const aPm25: (number | null)[] = cityAir.hourly?.pm2_5 ?? [];
    const aO3: (number | null)[] = cityAir.hourly?.ozone ?? [];
    const aCo: (number | null)[] = cityAir.hourly?.carbon_monoxide ?? [];
    const aDust: (number | null)[] = cityAir.hourly?.dust ?? [];
    const aCh4: (number | null)[] = cityAir.hourly?.methane ?? [];
    const airIdx = new Map<string, number>();
    aTimes.forEach((t, i) => airIdx.set(t, i));

    // ӨТКЕН/АЛДАҒЫ ШЕКАРАСЫ — «тірек сағат».
    //
    // Тірі режимде ол — қазіргі уақыт, одан кейінгісі БОЛЖАМ.
    // Архив режимінде ол — таңдалған сағат, одан кейінгісі ӨЛШЕНГЕН
    // (нақты болған) дерек. Массивтің өзі бірдей, тек МАҒЫНАСЫ басқа —
    // сондықтан жауапта `mode` беріліп, UI жапсырманы ауыстырады.
    //
    // Open-Meteo timezone=auto → жергілікті уақыт (офсетсіз). Дұрыс салыстыру
    // үшін «қазірді» сол жергілікті уақытқа ауыстырамыз (utc_offset_seconds).
    const offsetMs = (wind.utc_offset_seconds ?? 0) * 1000;
    const pivotMs =
      sel.mode === "archive" ? new Date(sel.at!).getTime() : Date.now() + offsetMs;
    const windHistory: WindHour[] = [];
    const forecastWind: { fromBearing: number; speed: number; time: string }[] = [];
    for (let i = 0; i < wTimes.length; i++) {
      if (wDir[i] == null) continue;
      const tMs = new Date(wTimes[i]).getTime();
      if (tMs > pivotMs) {
        // Тірек сағаттан кейінгі 24 сағат (анимация + дисперсия жолы)
        if (forecastWind.length < 24) forecastWind.push({ fromBearing: wDir[i]!, speed: wSpeed[i] ?? 0, time: wTimes[i] });
        continue;
      }
      const ai = airIdx.get(wTimes[i]);
      windHistory.push({
        fromBearing: wDir[i]!,
        speed: wSpeed[i] ?? 0,
        so2: ai != null ? aSo2[ai] ?? null : null,
        no2: ai != null ? aNo2[ai] ?? null : null,
        pm: ai != null ? aPm[ai] ?? null : null,
        time: wTimes[i],
      });
    }


    const result = attributePollution(
      receptors, windNow, windHistory, stations, forecastWind, airMeteo
    );

    // ХРОНОЛОГИЯ — әр сағат бір жол: жел, жел бағытындағы елді мекендер,
    // концентрациялар, норма салыстыруы. Жаңа дерек есептелмейді —
    // жоғарыда есептелгені бір кестеге жиналады.
    const airByTime = new Map<string, AirHour>();
    aTimes.forEach((t, i) => {
      airByTime.set(t, {
        so2: aSo2[i] ?? null, no2: aNo2[i] ?? null, pm: aPm[i] ?? null,
        pm25: aPm25[i] ?? null, ozone: aO3[i] ?? null, co: aCo[i] ?? null,
        dust: aDust[i] ?? null, ch4: aCh4[i] ?? null,
      });
    });
    const pivotIso =
      sel.mode === "archive"
        ? sel.at!
        : (wTimes.find((t) => new Date(t).getTime() > pivotMs) ?? null);
    const timeline = buildTimeline(
      result.frames,
      result.forecastFrames,
      airByTime,
      pivotIso,
      region.country === "KZ" ? "KZ" : "OTHER"
    );

    const data = {
      fetchedAt: new Date().toISOString(),
      // ⚠️ РЕЖИМ — UI мен құжат осыған қарап жапсырманы таңдайды
      mode: sel.mode,
      at: sel.at,
      atLabel: sel.at ? formatKz(sel.at) : null,
      daysAgo: sel.daysAgo,
      maxDaysBack: MAX_DAYS_BACK,
      archiveNote:
        sel.mode === "archive"
          ? `Архив режимі: ${formatKz(sel.at!)}. Тірек сағаттан КЕЙІНГІ мәндер — ` +
            `болжам емес, ӨЛШЕНГЕН дерек. Жердегі стансалар (WAQI) қосылмаған: ` +
            `ол дереккөзде тарих сақталмайды.`
          : null,
      sources: [
        sel.useEra5
          ? "ECMWF ERA5 реанализі (жел, радиация, бұлттылық) — Open-Meteo Archive API"
          : "Open-Meteo (тор бойынша жел өрісі, күн радиациясы, бұлттылық)",
        "Copernicus CAMS (SO₂/NO₂/PM) — Open-Meteo Air Quality API",
        stations.length
          ? "Qazhydromet жердегі стансалары (WAQI)"
          : "Ашық өнеркәсіптік координаттар",
      ],
      timeline,
      ...result,
    };
    cache.set(key, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (err) {
    console.error("Pollution source error:", err);
    return NextResponse.json(
      { error: "Тірі ауа/жел деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді." },
      { status: 503 }
    );
  }
}
