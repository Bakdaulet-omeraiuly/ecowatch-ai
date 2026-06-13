import { NextResponse } from "next/server";

// Live gas-flare / thermal-anomaly detection over the Atyrau oil region.
// Source: NASA FIRMS (VIIRS 375m active-fire product) — real near-real-time
// satellite detections. Oil-field gas flares show up as persistent hotspots.
// Needs a free FIRMS MAP_KEY (firms.modaps.eosdis.nasa.gov/api/map_key).

export const revalidate = 3600;

// FIRMS query bbox (must be rectangular): west,south,east,north
const AREA = "49.5,45.5,55,49";

// Approximate Atyrau oblast boundary [lng, lat] — flares outside it are dropped
// so neighbouring oblasts (Mangystau, West Kazakhstan, Astrakhan) are excluded.
const ATYRAU_OBLAST: [number, number][] = [
  [50.2, 47.3], [50.4, 48.2], [51.6, 48.9], [53.4, 48.7], [54.7, 47.9],
  [54.6, 46.9], [53.9, 46.2], [52.2, 45.6], [50.6, 46.3], [50.1, 47.0],
];

function pointInPolygon(lng: number, lat: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

interface Flare {
  lat: number;
  lng: number;
  brightness: number; // bright_ti5 (K)
  frp: number; // fire radiative power (MW)
  confidence: string;
  acqDate: string;
  dayNight: string;
}

let cache: { at: number; data: unknown } | null = null;

export async function GET() {
  const key = process.env.FIRMS_MAP_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "FIRMS кілті бапталмаған", configured: false },
      { status: 503 }
    );
  }
  if (cache && Date.now() - cache.at < 3600_000) {
    return NextResponse.json(cache.data);
  }
  try {
    // VIIRS S-NPP, last 2 days
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/VIIRS_SNPP_NRT/${AREA}/2`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const csv = await res.text();
    if (csv.startsWith("Invalid") || csv.includes("Invalid MAP_KEY")) {
      return NextResponse.json({ error: "FIRMS кілті жарамсыз" }, { status: 502 });
    }

    const lines = csv.trim().split("\n");
    const header = lines[0].split(",");
    const col = (name: string) => header.indexOf(name);
    const iLat = col("latitude"), iLng = col("longitude");
    const iBright = col("bright_ti5"), iFrp = col("frp");
    const iConf = col("confidence"), iDate = col("acq_date"), iDN = col("daynight");

    const flares: Flare[] = lines.slice(1).map((line) => {
      const c = line.split(",");
      return {
        lat: parseFloat(c[iLat]),
        lng: parseFloat(c[iLng]),
        brightness: parseFloat(c[iBright]) || 0,
        frp: parseFloat(c[iFrp]) || 0,
        confidence: c[iConf] ?? "",
        acqDate: c[iDate] ?? "",
        dayNight: c[iDN] ?? "",
      };
    }).filter(
      (f) => !isNaN(f.lat) && !isNaN(f.lng) && pointInPolygon(f.lng, f.lat, ATYRAU_OBLAST)
    );

    const data = {
      fetchedAt: new Date().toISOString(),
      source: "NASA FIRMS — VIIRS S-NPP 375m (соңғы 2 күн)",
      count: flares.length,
      flares,
    };
    cache = { at: Date.now(), data };
    return NextResponse.json(data);
  } catch (err) {
    console.error("Flares error:", err);
    return NextResponse.json({ error: "FIRMS деректері уақытша қолжетімсіз" }, { status: 503 });
  }
}
