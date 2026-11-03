import { NextResponse } from "next/server";
import { getRegion } from "@/data/regions";
import { FirmsKeyError } from "@/lib/firms";
import { loadFireArchive } from "@/lib/firmsArchive";
import { classifyAnomaly, ANOMALY_LABEL } from "@/lib/fireClassify";

// FIRMS АРХИВІ — Атырау бойынша жылу аномалиялары (P4.4 / P4.6).
//
// ⚠️ Бұл — ЖЫЛУ АНОМАЛИЯСЫ, расталған өрт емес. Әр нүкте өндірістік алау
// (контур ішінде) немесе «жылу аномалиясы (расталмаған)» ретінде жіктеледі.
// ⚠️ Кілт жоқ/жарамсыз немесе архив жүктелмесе — 503 + себебі. Мок жоқ.
//
// Параметрлер: ?region=atyrau&days=365 (1..365). Уақыт сүзгісі клиентте
// `acqDate` бойынша жүреді, сондықтан бір сұраныс бәрін қамтиды.

export const revalidate = 3600;

const TEXT = {
  disclaimer: {
    kk: "Жылу аномалиясы — спутниктің жылу сигналы. Ол расталған өрт емес: өндірістік факел, далалық өрт, күйдірілген алқап немесе жалын болуы мүмкін.",
    ru: "Тепловая аномалия — это сигнал теплового датчика спутника. Это не подтверждённый пожар: может быть промышленный факел, полевой пожар, выжженный участок или пламя.",
  },
  source: "NASA FIRMS — VIIRS SNPP (архив: Standard Processing; соңғы ~60 күн — NRT)",
};

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const region = getRegion(sp.get("region"));
  const days = Math.min(365, Math.max(1, Math.round(Number(sp.get("days") ?? 365)) || 365));
  const key = process.env.FIRMS_MAP_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "FIRMS кілті бапталмаған — архив қолжетімсіз. Жалған дерек көрсетілмейді.", reason: "FIRMS_MAP_KEY жоқ", configured: false },
      { status: 503 }
    );
  }
  try {
    const archive = await loadFireArchive({ key, regionId: region.id, bbox: region.bbox, days });
    const anomalies = archive.detections.map((d) => {
      const c = classifyAnomaly(d.lat, d.lng);
      return {
        lat: d.lat,
        lng: d.lng,
        frp: d.frp,
        brightness: d.brightness,
        confidence: d.confidence,
        acqDate: d.acqDate,
        dayNight: d.dayNight,
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
    return NextResponse.json({
      fetchedAt: archive.fetchedAt,
      source: TEXT.source,
      days,
      window: archive.window,
      complete: archive.complete,
      failedWindows: archive.failedWindows,
      windowCount: archive.windowCount,
      count: anomalies.length,
      byCategory,
      disclaimer: TEXT.disclaimer,
      anomalies,
    });
  } catch (err) {
    if (err instanceof FirmsKeyError) {
      return NextResponse.json({ error: "FIRMS кілті жарамсыз", reason: err.message }, { status: 503 });
    }
    console.error("Fire archive error:", err);
    return NextResponse.json(
      { error: "FIRMS архиві уақытша қолжетімсіз — жалған дерек көрсетілмейді", reason: err instanceof Error ? err.message : String(err) },
      { status: 503 }
    );
  }
}
