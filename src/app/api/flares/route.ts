import { NextResponse } from "next/server";

// Live gas-flare / thermal-anomaly detection over the Atyrau oil region.
// Source: NASA FIRMS (VIIRS 375m active-fire product) — real near-real-time
// satellite detections. Oil-field gas flares show up as persistent hotspots.
// Needs a free FIRMS MAP_KEY (firms.modaps.eosdis.nasa.gov/api/map_key).

export const revalidate = 3600;

// Atyrau region bbox: west,south,east,north
const AREA = "49,46,55,49";

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
    }).filter((f) => !isNaN(f.lat) && !isNaN(f.lng));

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
