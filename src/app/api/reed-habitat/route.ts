import { NextResponse } from "next/server";
import { FLOOD_ZONES } from "@/data/floodZones";
import { getRegion, hasModule, moduleUnavailable } from "@/data/regions";
import { cdseToken, hasCdseKeys } from "@/lib/cdse";
import {
  NDVI_DENSE, REED_RES_M, REED_SATURATION,
  fetchReed, reedExtent, reedSuitability,
} from "@/lib/reedHabitat";

// ҚАМЫС МЕКЕНІ — Sentinel-2 NDVI бойынша тығыз өсімдік үлесі.
//
// JAIYQ-MRI моделінің L4 қабаты үшін: Culex modestus (WNV тасымалдаушысы)
// қамыс алқаптарында көбейеді. Бақылау терезелері — тасқын аймақтарымен
// бірдей (FLOOD_ZONES), сондықтан екі өлшем бір торда сәйкеседі.
//
// Қамыс баяу өзгереді (маусымдық), сондықтан кэш ұзақ: 24 сағат.
//
// ⚠️ Кілттер жоқ болса — 503, жалған дерек көрсетілмейді.

export const revalidate = 86400;

/** Қамыс жайылымының ең жоғары кезеңін қамту үшін терезе (күн) */
const WINDOW_DAYS = 75;

const iso = (d: Date) => d.toISOString().slice(0, 10);

interface ZoneReed {
  id: string;
  name: string;
  bbox: [number, number, number, number];
  /** Тығыз өсімдік басқан үлес (0..1) */
  denseFraction: number | null;
  /** 0..1 — мекеннің қолайлылық шамасы */
  suitability: number | null;
  observedDate: string | null;
  usableDates: number;
  status: "ok" | "no-data";
}

const cache = new Map<string, { at: number; data: unknown }>();

export async function GET(req: Request) {
  const region = getRegion(new URL(req.url).searchParams.get("region"));
  // Бақылау терезелері тек Атырау үшін анықталған
  if (!hasModule(region, "floodExtent")) {
    return NextResponse.json(moduleUnavailable(region, "floodExtent"));
  }
  if (!hasCdseKeys()) {
    return NextResponse.json(
      { error: "Copernicus кілттері бапталмаған — жалған дерек көрсетілмейді" },
      { status: 503 }
    );
  }

  const hit = cache.get(region.id);
  if (hit && Date.now() - hit.at < revalidate * 1000) {
    return NextResponse.json(hit.data);
  }

  try {
    const token = await cdseToken();
    const now = new Date();
    const to = iso(now);
    const from = iso(new Date(now.getTime() - WINDOW_DAYS * 86400_000));

    const zones: ZoneReed[] = await Promise.all(
      FLOOD_ZONES.map(async (z) => {
        const shell = { id: z.id, name: z.name, bbox: z.bbox };
        try {
          const stats = await fetchReed(token, z.bbox, from, to);
          const ext = reedExtent(stats);
          if (!ext) {
            return { ...shell, denseFraction: null, suitability: null,
              observedDate: null, usableDates: 0, status: "no-data" as const };
          }
          return {
            ...shell,
            denseFraction: ext.fraction,
            suitability: +reedSuitability(ext.fraction).toFixed(3),
            observedDate: ext.date,
            usableDates: ext.dates,
            status: "ok" as const,
          };
        } catch (e) {
          console.error(`reed-habitat ${z.id}:`, e);
          return { ...shell, denseFraction: null, suitability: null,
            observedDate: null, usableDates: 0, status: "no-data" as const };
        }
      })
    );

    const ok = zones.filter((z) => z.status === "ok");
    if (!ok.length) {
      throw new Error("бұлтсыз, қамтуы жеткілікті Sentinel-2 өтуі табылмады");
    }

    const data = {
      available: true as const,
      fetchedAt: new Date().toISOString(),
      source: "Copernicus Sentinel-2 L2A · Sentinel Hub Statistical API",
      region: { id: region.id, name: region.name },
      method: {
        summary:
          `NDVI = (B08 − B04)/(B08 + B04). NDVI > ${NDVI_DENSE} пиксельдер тығыз ` +
          "өсімдік деп саналады. Шөлейт атырауда сондай тығыздық негізінен " +
          "қамыс (Phragmites) пен жайылма шалғынында болады.",
        ndviThreshold: NDVI_DENSE,
        resolutionM: REED_RES_M,
        windowDays: WINDOW_DAYS,
        saturation: REED_SATURATION,
        aggregation:
          "Терезедегі ең ЖОҒАРЫ мән алынады (орташа емес): бұлт пен ішінара " +
          "қамту мәнді жасанды төмендетеді, ал бізге алқаптың максималды жайылымы керек.",
      },
      zones,
      caveats: [
        "Бұл — ПРОКСИ, қамыстың картасы емес: суармалы егіс пен ағаш екпелері де NDVI > 0.4 береді.",
        "Мән маусымдық: қыста қамыс қурап, NDVI төмендейді.",
        "Бұлтты күндер SCL маскасымен алынып тасталады — қамтуы жеткіліксіз күндер есепке кірмейді.",
        "Өлшем табылмаса мән NULL болады, НӨЛ емес: бұлт салдарынан көрінбеу — қамыстың жоқтығы емес.",
      ],
    };

    cache.set(region.id, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (err) {
    console.error("reed-habitat error:", err);
    return NextResponse.json(
      { error: "Қамыс мекені деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді" },
      { status: 503 }
    );
  }
}
