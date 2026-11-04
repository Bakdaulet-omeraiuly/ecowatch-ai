import { NextResponse } from "next/server";

// Нақты ЖЕРДЕГІ бақылау стансасының деректері (Qazhydromet желісі — WAQI/aqicn API).
// Датчик дәлдігі: нүктелік нақты өлшеу, CAMS моделінен әлдеқайда дәл.
// WAQI_TOKEN жоқ болса → {found:false}; клиент CAMS моделіне қайтады.
// Ешбір дерек ойдан жасалмайды — тек нақты станса көрсетіледі.

function distKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = (bLat - aLat) * 111;
  const dLng = (bLng - aLng) * 111 * Math.cos((aLat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/** A "nearby ground station" farther than this is not shown for a point: WAQI's nearest
 *  station to Atyrau is in Baku (~760 km), which says nothing about Atyrau's air. */
const MAX_STATION_KM = 25;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ found: false, error: "bad_coords" }, { status: 400 });
  }

  const token = process.env.WAQI_TOKEN;
  if (!token) {
    // Токен бапталмаған — жердегі станса деректері жоқ (CAMS қолданылады)
    return NextResponse.json({ found: false, reason: "no_token" });
  }

  try {
    const res = await fetch(`https://api.waqi.info/feed/geo:${lat};${lng}/?token=${token}`, {
      next: { revalidate: 900 }, // 15 мин
    });
    const j = await res.json();
    if (j.status !== "ok" || !j.data) {
      return NextResponse.json({ found: false, reason: "no_station" });
    }
    const d = j.data;
    const geo: [number, number] | undefined = d.city?.geo;
    const iaqi = d.iaqi ?? {};
    const v = (k: string): number | null => (typeof iaqi[k]?.v === "number" ? iaqi[k].v : null);

    const distanceKm = geo ? +distKm(lat, lng, geo[0], geo[1]).toFixed(1) : null;
    if (distanceKm == null || distanceKm > MAX_STATION_KM) {
      return NextResponse.json({
        found: false, reason: "no_station_nearby", maxKm: MAX_STATION_KM,
        nearest: { station: d.city?.name ?? null, distanceKm },
      });
    }
    return NextResponse.json({
      found: true,
      // WAQI aggregates many networks; the station name tells which one — not always Kazhydromet.
      source: "WAQI (aqicn.org) желісі",
      station: d.city?.name ?? "Белгісіз пост",
      distanceKm,
      time: d.time?.iso ?? null,
      aqi: typeof d.aqi === "number" ? d.aqi : null, // жалпы US AQI
      dominant: d.dominentpol ?? null,
      // iaqi — ластаушылардың AQI ішкі индекстері (µg/m³ емес, US AQI шкаласы)
      iaqi: {
        pm25: v("pm25"), pm10: v("pm10"), no2: v("no2"),
        so2: v("so2"), o3: v("o3"), co: v("co"),
      },
    });
  } catch (err) {
    console.error("Station air error:", err);
    return NextResponse.json({ found: false, error: true });
  }
}
