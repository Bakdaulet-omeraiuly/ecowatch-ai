import { NextResponse } from "next/server";
import { getRegion } from "@/data/regions";
import { ATYRAU_OBLAST, fetchFirmsWindow, FirmsKeyError, pointInPolygon, VIIRS_NRT_SOURCES } from "@/lib/firms";
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
    // VIIRS NRT — ҮШ спутник (Suomi-NPP, NOAA-20, NOAA-21), соңғы 2 күн.
    // Бір спутник тәулігіне ~2 рет өтеді; үшеуі бірге ~6 рет — қысқа жанған
    // алауды жіберіп алу ықтималдығы азаяды. Әр детекция — бөлек бақылау
    // (бір алауды екі спутник көрсе, екі жол болады: саны «оқиға» емес,
    // «детекция»). Бір спутник жауап бермесе — қалғандары көрсетіледі де,
    // қайсысы жоқ екені `satellites` өрісінде жазылады.
    const settled = await Promise.allSettled(
      VIIRS_NRT_SOURCES.map((s) =>
        fetchFirmsWindow({ key, source: s.id, bbox: region.bbox, days: 2, revalidate: 3600 })
      )
    );
    const keyErr = settled.find((r) => r.status === "rejected" && r.reason instanceof FirmsKeyError);
    if (keyErr) throw (keyErr as PromiseRejectedResult).reason;
    const firstErr = settled.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
    if (settled.every((r) => r.status === "rejected")) throw firstErr!.reason;

    const satellites = VIIRS_NRT_SOURCES.map((s, i) => {
      const r = settled[i];
      return r.status === "fulfilled"
        ? { satellite: s.satellite, ok: true as const, detections: 0 }
        : { satellite: s.satellite, ok: false as const, detections: 0 };
    });
    const rows = settled.flatMap((r, i) =>
      r.status === "fulfilled"
        ? r.value.map((f) => ({ ...f, satellite: VIIRS_NRT_SOURCES[i].satellite as string }))
        : []
    );
    const anomalies = rows
      .filter((f) => pointInPolygon(f.lng, f.lat, ATYRAU_OBLAST))
      .sort((a, b) => `${b.acqDate}${b.acqTime}`.localeCompare(`${a.acqDate}${a.acqTime}`))
      .map((f) => {
        const c = classifyAnomaly(f.lat, f.lng);
        return {
          lat: f.lat,
          lng: f.lng,
          brightness: f.brightness,
          frp: f.frp,
          confidence: f.confidence,
          acqDate: f.acqDate,
          acqTime: f.acqTime,
          satellite: f.satellite,
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

    for (const a of anomalies) {
      const s = satellites.find((x) => x.satellite === a.satellite);
      if (s) s.detections += 1;
    }
    const okNames = satellites.filter((s) => s.ok).map((s) => s.satellite);

    const data = {
      fetchedAt: new Date().toISOString(),
      source: `NASA FIRMS — VIIRS 375 м NRT (${okNames.join(", ")}; соңғы 2 күн)`,
      count: anomalies.length,
      byCategory,
      // Қай спутник жауап берді және әрқайсысы неше детекция берді.
      satellites,
      partial: okNames.length < satellites.length,
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
