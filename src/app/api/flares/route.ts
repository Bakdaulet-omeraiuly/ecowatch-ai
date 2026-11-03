import { NextResponse } from "next/server";
import { getRegion } from "@/data/regions";
import { ATYRAU_OBLAST, fetchFirmsWindow, FirmsKeyError, pointInPolygon } from "@/lib/firms";
import { classifyAnomaly, ANOMALY_LABEL } from "@/lib/fireClassify";

// NRT жылу аномалиялары — Атырау бойынша, соңғы 2 тәулік (NASA FIRMS, VIIRS 375м).
//
// ⚠️ Бұл — ЖЫЛУ АНОМАЛИЯСЫ, расталған өрт емес. Әр нүкте `classifyAnomaly`
// арқылы жіктеледі (архивпен бірдей ереже): нысан контурының ішінде →
// «өндірістік алау», басқа жағдайда → «жылу аномалиясы (расталмаған)».
// Архив — /api/fire-archive. Кілт жоқ/жарамсыз немесе FIRMS қолжетімсіз —
// 503 + себебі (мок жоқ).
// Needs a free FIRMS MAP_KEY (firms.modaps.eosdis.nasa.gov/api/map_key).

export const revalidate = 3600;

const DISCLAIMER = {
  kk: "Жылу аномалиясы — спутниктің жылу сигналы. Ол расталған өрт емес: өндірістік факел, далалық өрт, күйдірілген алқап немесе жалын болуы мүмкін.",
  ru: "Тепловая аномалия — это сигнал теплового датчика спутника. Это не подтверждённый пожар: может быть промышленный факел, полевой пожар, выжженный участок или пламя.",
};

const cache = new Map<string, { at: number; data: unknown }>();

export async function GET(req: Request) {
  const region = getRegion(new URL(req.url).searchParams.get("region"));
  const key = process.env.FIRMS_MAP_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "FIRMS кілті бапталмаған", reason: "FIRMS_MAP_KEY жоқ", configured: false },
      { status: 503 }
    );
  }
  const hit = cache.get(region.id);
  if (hit && Date.now() - hit.at < 3600_000) return NextResponse.json(hit.data);
  try {
    // VIIRS S-NPP NRT, соңғы 2 күн. Кэш — Next.js (3600 с); FIRMS сұранысы — firms.ts ішінде.
    const rows = await fetchFirmsWindow({
      key, source: "VIIRS_SNPP_NRT", bbox: region.bbox, days: 2, revalidate: 3600,
    });
    const anomalies = rows
      .filter((f) => pointInPolygon(f.lng, f.lat, ATYRAU_OBLAST))
      .map((f) => {
        const c = classifyAnomaly(f.lat, f.lng);
        return {
          lat: f.lat,
          lng: f.lng,
          brightness: f.brightness,
          frp: f.frp,
          confidence: f.confidence,
          acqDate: f.acqDate,
          dayNight: f.dayNight,
          category: c.category,
          label: ANOMALY_LABEL[c.category],
          facilityId: c.facilityId,
          facilityName: c.facilityName,
          distanceToFootprintKm: c.distanceToFootprintKm,
        };
      });
    const byCategory = {
      industrial_flare: anomalies.filter((a) => a.category === "industrial_flare").length,
      unconfirmed_anomaly: anomalies.filter((a) => a.category === "unconfirmed_anomaly").length,
    };

    const data = {
      fetchedAt: new Date().toISOString(),
      source: "NASA FIRMS — VIIRS S-NPP 375m (соңғы 2 күн)",
      count: anomalies.length,
      byCategory,
      disclaimer: DISCLAIMER,
      flares: anomalies,
    };
    cache.set(region.id, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof FirmsKeyError) {
      return NextResponse.json(
        { error: "FIRMS кілті жарамсыз", reason: err.message },
        { status: 503 }
      );
    }
    console.error("Flares error:", err);
    return NextResponse.json(
      {
        error: "FIRMS деректері уақытша қолжетімсіз",
        reason: err instanceof Error ? err.message : String(err),
      },
      { status: 503 }
    );
  }
}
