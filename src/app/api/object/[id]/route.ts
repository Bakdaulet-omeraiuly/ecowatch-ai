import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { FACILITIES } from "@/data/facilities";
import { checkCompliance } from "@/lib/compliance";
import { LEGAL_DISCLAIMER } from "@/data/legalNorms";

// ОБЪЕКТ КАРТАСЫ — бір өнеркәсіп нысанының толық экологиялық кескіні.
//
// Прокуратура/эколог үшін ең маңызды бөлік. Қайтарады:
//   1. Жалпы ақпарат (координата, түрі, координата дәлдігі)
//   2. Экологиялық көрсеткіштер — сол НҮКТЕДЕГІ тірі ауа сапасы
//   3. Заңға сәйкестік — ҚР/WHO/EU нормаларымен салыстыру
//   4. Дәлелдер тізбегі — әр сан қай спутниктен/модельден, қай уақытта
//   5. Спутник суреттерінің уақыт шкаласы (2016 → бүгін)
//   6. Маңайдағы жылу аномалиялары (FIRMS)
//
// ⚠️ Мұнда AI ЖОҚ. Барлығы — өлшем немесе ресми модель.
// ⚠️ Ластану көзін АНЫҚТАМАЙДЫ: нүктедегі ауа сапасы — сол нысанның
//    шығарындысы деген сөз емес. Жел басқа жақтан әкелген болуы мүмкін.
//    Бұл жүйеде ашық жазылған.

export const revalidate = 1800;

const HISTORY_YEARS = [2016, 2018, 2020, 2022, 2024, new Date().getFullYear()];

/** Екі нүкте арасындағы қашықтық (км) — Гаверсин */
function distanceKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const la1 = (a[0] * Math.PI) / 180;
  const la2 = (b[0] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const cache = new Map<string, { at: number; data: unknown }>();

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const fac = FACILITIES.find((f) => f.id === id);
  if (!fac) {
    return NextResponse.json(
      { error: `Нысан табылмады: ${id}`, available: FACILITIES.map((f) => f.id) },
      { status: 404 }
    );
  }

  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < revalidate * 1000) {
    return NextResponse.json(hit.data);
  }

  const origin = new URL(req.url).origin;

  const [air, flares, wind] = await Promise.all([
    fetch(`${origin}/api/point-air?lat=${fac.lat}&lng=${fac.lng}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    fetch(`${origin}/api/flares`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    fetch(`${origin}/api/environment`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ]);

  // --- Заңға сәйкестік (сол нүктедегі мәндер бойынша) ---
  const indicatorMap: { id: string; name: string; unit: string; value: number | null }[] = [
    { id: "pm25", name: "PM₂.₅", unit: "µg/m³", value: air?.pm2_5 ?? null },
    { id: "pm10", name: "PM₁₀", unit: "µg/m³", value: air?.pm10 ?? null },
    { id: "no2", name: "NO₂", unit: "µg/m³", value: air?.no2 ?? null },
    { id: "so2", name: "SO₂", unit: "µg/m³", value: air?.so2 ?? null },
    { id: "ozone", name: "O₃", unit: "µg/m³", value: air?.ozone ?? null },
    { id: "aqi", name: "EU AQI", unit: "", value: air?.aqi ?? null },
  ];
  const compliance = indicatorMap.map((m) => ({
    ...checkCompliance(m.id, m.value),
    name: m.name,
    unit: m.unit,
  }));
  const kzViolations = compliance.filter((c) => c.kzViolation).length;

  // --- Маңайдағы жылу аномалиялары (10 км) ---
  type F = { lat: number; lng: number; frp: number; acqDate: string; confidence: string; dayNight: string };
  const nearby = ((flares?.flares ?? []) as F[])
    .map((f) => ({ ...f, distanceKm: Math.round(distanceKm([fac.lat, fac.lng], [f.lat, f.lng]) * 10) / 10 }))
    .filter((f) => f.distanceKm <= 10)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 10);

  // --- Дәлелдер тізбегі: әр сан қайдан келді ---
  const evidence = [
    air && {
      kind: "Ауа сапасы",
      instrument: "Copernicus CAMS (атмосфералық химия моделі)",
      resolution: "≈40 км тор",
      time: air.fetchedAt,
      values: `EU AQI ${air.aqi ?? "—"} · PM₂.₅ ${air.pm2_5 ?? "—"} · NO₂ ${air.no2 ?? "—"} · SO₂ ${air.so2 ?? "—"} µg/m³`,
      note: "Модель шығысы. Нысанның нақты шығарынды мөлшері емес.",
      tier: "model",
    },
    nearby.length > 0 && {
      kind: "Жылу аномалиясы",
      instrument: "NASA VIIRS (Suomi-NPP), 375 м",
      resolution: "375 м",
      time: nearby[0].acqDate,
      values: `${nearby.length} детекция 10 км радиуста · ең жақыны ${nearby[0].distanceKm} км, FRP ${Math.round(nearby[0].frp)} МВт`,
      note: "Газ факелі мен дала өртін алгоритм АЖЫРАТПАЙДЫ.",
      tier: "measurement",
    },
    wind?.current && {
      kind: "Метеорология",
      instrument: "ECMWF (Open-Meteo арқылы)",
      resolution: "нүктелік",
      time: wind.fetchedAt,
      values: `Жел ${wind.current.windSpeed ?? "—"} км/сағ · ${wind.current.temperature ?? "—"}°C · ылғал ${wind.current.humidity ?? "—"}%`,
      note: "Шлейфтің бағытын анықтауға қажет.",
      tier: "model",
    },
  ].filter(Boolean);

  const data = {
    id: fac.id,
    name: fac.name,
    short: fac.short,
    kind: fac.kind,
    coords: { lat: fac.lat, lng: fac.lng, approx: Boolean(fac.approx) },
    fetchedAt: new Date().toISOString(),

    // 1. Жалпы ақпарат
    general: {
      emissionProfile: fac.profile,
      profileNote:
        "Эмиссия профилі — кәсіпорын түріне тән СИПАТТАМАЛЫ салмақ (0..1), " +
        "нақты өлшенген шығарынды ЕМЕС. Нақты сан алу үшін кәсіпорынның " +
        "эмиссияларға рұқсаты мен есептілігі қажет.",
      coordsNote: fac.approx
        ? "⚠️ Координата ЖУЫҚ — нақты бекітілген ашық дереккөз табылмады."
        : "Координата ашық дереккөздерден тексерілген (объект орталығы).",
    },

    // 2. Экологиялық көрсеткіштер
    air: air
      ? { ...air, note: "Осы координатадағы CAMS модель мәні" }
      : { error: "Тірі ауа деректері қолжетімсіз — жалған дерек көрсетілмейді" },

    // 3. Заңға сәйкестік
    compliance: { results: compliance, kzViolations, checked: compliance.length },

    // 4. Дәлелдер
    evidence,

    // 5. Спутник суреттерінің уақыт шкаласы
    timeline: HISTORY_YEARS.map((y) => ({
      year: y,
      imageUrl: `/api/object/${fac.id}/image?year=${y}`,
      source: y >= 2024 ? "Mapbox Satellite" : "Sentinel-2 мозаикасы (EOX)",
    })),

    // 6. Маңайдағы детекциялар
    nearbyFlares: nearby,

    aiIncluded: false,
    disclaimer: LEGAL_DISCLAIMER,
    causalityWarning:
      "⚠️ МАҢЫЗДЫ: осы нүктедегі ауа сапасы — сол нысанның шығарындысы деген " +
      "сөз ЕМЕС. Жел ластануды басқа жерден әкелген болуы мүмкін. Көзді " +
      "анықтау үшін «Ластану көзі» қабатын және жел бағытын қарау керек, " +
      "ал түпкілікті тұжырым үшін кәсіпорын аумағында өлшеу қажет.",
  };

  cache.set(id, { at: Date.now(), data });
  return NextResponse.json(data);
}
