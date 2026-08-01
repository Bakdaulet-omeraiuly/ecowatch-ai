import { NextResponse } from "next/server";
import { csvHeaders, toCsv, withProvenance, type Cell } from "@/lib/csv";
import { FLOOD_ZONES, zoneAreaKm2 } from "@/data/floodZones";
import { cdseToken, hasCdseKeys } from "@/lib/cdse";
import {
  MIN_COVERAGE, RES_M, THRESHOLD_DB,
  baselineWindow, fetchDailyWater, median, pixelAreaKm2,
  type DayStat,
} from "@/lib/floodSar";

// Су басқан аумақ — Sentinel-1 SAR радары бойынша ӨЛШЕНГЕН аудан (км²).
//
// Бұл — болжам емес, модель шығысы да емes: радар суретіндегі су
// пиксельдерінің нақты саны. Эколог есепке қоя алатын сан.
//
// Жалған дерек болмауы үшін:
//  · Кілттер жоқ болса → 503
//  · Спутник қамтуы жеткіліксіз болса (бұлт емес, орбита) → сол аймақ null
//  · Тірек кезең табылмаса → аймақ бойынша тек «жалпы су» беріледі,
//    «су басты» деген қорытынды жасалмайды
//
// `?format=csv` — Excel/есеп үшін.

export const revalidate = 21600; // 6 сағат (S1 қайталау кезеңі ~6 күн)

const CURRENT_WINDOW_DAYS = 14; // соңғы қайталау кезеңін қамтиды

interface ZoneResult {
  id: string;
  name: string;
  note: string;
  bbox: [number, number, number, number];
  zoneAreaKm2: number;
  latestDate: string | null;
  coverage: number | null;
  observedKm2: number | null;
  waterKm2: number | null;
  baselineKm2: number | null;
  floodedKm2: number | null;
  floodedPctOfZone: number | null;
  baselineDates: number;
  status: "ok" | "no-baseline" | "no-data";
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

function pickLatest(days: DayStat[]): DayStat | null {
  const usable = days.filter((d) => d.coverage >= MIN_COVERAGE);
  return usable.length ? usable[usable.length - 1] : null;
}

let cache: { at: number; data: unknown } | null = null;

export async function GET(req: Request) {
  if (!hasCdseKeys()) {
    return NextResponse.json(
      { error: "Copernicus кілттері бапталмаған — жалған дерек көрсетілмейді" },
      { status: 503 }
    );
  }

  const wantCsv = new URL(req.url).searchParams.get("format") === "csv";

  if (cache && Date.now() - cache.at < revalidate * 1000) {
    return wantCsv ? csvResponse(cache.data as ApiShape) : NextResponse.json(cache.data);
  }

  try {
    const token = await cdseToken();
    const now = new Date();
    const curTo = iso(now);
    const curFrom = iso(new Date(now.getTime() - CURRENT_WINDOW_DAYS * 86400_000));
    const base = baselineWindow(now);

    const zones: ZoneResult[] = await Promise.all(
      FLOOD_ZONES.map(async (z) => {
        const midLat = (z.bbox[1] + z.bbox[3]) / 2;
        const pxKm2 = pixelAreaKm2(midLat);
        const shell = {
          id: z.id, name: z.name, note: z.note, bbox: z.bbox,
          zoneAreaKm2: zoneAreaKm2(z),
        };
        try {
          const [cur, bas] = await Promise.all([
            fetchDailyWater(token, z.bbox, curFrom, curTo),
            fetchDailyWater(token, z.bbox, base.from, base.to),
          ]);

          const latest = pickLatest(cur);
          if (!latest) {
            return { ...shell, latestDate: null, coverage: null, observedKm2: null,
              waterKm2: null, baselineKm2: null, floodedKm2: null,
              floodedPctOfZone: null, baselineDates: 0, status: "no-data" as const };
          }

          const observedKm2 = latest.validPixels * pxKm2;
          const waterKm2 = latest.waterFraction * observedKm2;

          const basUsable = bas.filter((d) => d.coverage >= MIN_COVERAGE);
          if (!basUsable.length) {
            return { ...shell,
              latestDate: latest.date,
              coverage: round(latest.coverage, 3),
              observedKm2: round(observedKm2, 1),
              waterKm2: round(waterKm2, 1),
              baselineKm2: null, floodedKm2: null, floodedPctOfZone: null,
              baselineDates: 0, status: "no-baseline" as const };
          }

          // Тірек — медиана (бір күндік шудан қорғайды).
          // Ауданға айналдыруда ағымдағы бақыланған ауданды қолданамыз —
          // сонда екеуі бірдей аумаққа қатысты болады.
          const baselineFraction = median(basUsable.map((d) => d.waterFraction));
          const baselineKm2 = baselineFraction * observedKm2;
          const floodedKm2 = Math.max(0, waterKm2 - baselineKm2);

          return { ...shell,
            latestDate: latest.date,
            coverage: round(latest.coverage, 3),
            observedKm2: round(observedKm2, 1),
            waterKm2: round(waterKm2, 1),
            baselineKm2: round(baselineKm2, 1),
            floodedKm2: round(floodedKm2, 1),
            floodedPctOfZone: round((floodedKm2 / shell.zoneAreaKm2) * 100, 2),
            baselineDates: basUsable.length,
            status: "ok" as const };
        } catch (e) {
          console.error(`flood-extent ${z.id}:`, e);
          return { ...shell, latestDate: null, coverage: null, observedKm2: null,
            waterKm2: null, baselineKm2: null, floodedKm2: null,
            floodedPctOfZone: null, baselineDates: 0, status: "no-data" as const };
        }
      })
    );

    const ok = zones.filter((z) => z.status === "ok");
    if (!ok.length && zones.every((z) => z.status === "no-data")) {
      throw new Error("ешбір аймақта жарамды спутник өтуі табылмады");
    }

    const data: ApiShape = {
      fetchedAt: new Date().toISOString(),
      source: "Copernicus Sentinel-1 GRD (IW, VV, GAMMA0_TERRAIN) · Sentinel Hub Statistical API",
      method: {
        summary:
          "Радарда тегіс су айнадай шағылысып қайтпайды, сондықтан күңгірт көрінеді. " +
          `VV gamma0 мәні ${THRESHOLD_DB} дБ-дан төмен пиксельдер су деп саналады.`,
        thresholdDb: THRESHOLD_DB,
        resolutionM: RES_M,
        minCoverage: MIN_COVERAGE,
        currentWindow: { from: curFrom, to: curTo },
        baselineWindow: base,
        deltaExplanation:
          "«Су басқан аумақ» = ағымдағы су − тірек кезеңдегі су. Тұрақты су мен " +
          "құрғақ сор екеуінде де бар болғандықтан өзара жойылады.",
      },
      totals: {
        waterKm2: round(sum(ok.map((z) => z.waterKm2!)), 1),
        baselineKm2: round(sum(ok.map((z) => z.baselineKm2!)), 1),
        floodedKm2: round(sum(ok.map((z) => z.floodedKm2!)), 1),
        zonesOk: ok.length,
        zonesTotal: zones.length,
      },
      zones,
      caveats: [
        "Бұл — радар өлшемі, жердегі тексеру нәтижесі емес.",
        "Құрғақ сор, тақыр, асфальт та радарда күңгірт көрінеді. Тірек кезеңмен " +
          "салыстыру олардың басым бөлігін жояды, бірақ жаңбырдан кейінгі ылғал " +
          "сор «су» болып саналуы мүмкін.",
        "Қатты жел кезінде су беті бұдырланып, радарда ашық көрінеді — су ауданы " +
          "кем бағалануы мүмкін.",
        "Бақылау аймақтары — тікбұрышты терезелер, әкімшілік шекара емес.",
        `Sentinel-1 қайталау кезеңі ~6 күн. Соңғы өту күні әр аймақта бөлек көрсетілген.`,
      ],
    };

    cache = { at: Date.now(), data };
    return wantCsv ? csvResponse(data) : NextResponse.json(data);
  } catch (err) {
    console.error("flood-extent error:", err);
    return NextResponse.json(
      { error: "Спутник деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді" },
      { status: 503 }
    );
  }
}

interface ApiShape {
  fetchedAt: string;
  source: string;
  method: {
    summary: string; thresholdDb: number; resolutionM: number; minCoverage: number;
    currentWindow: { from: string; to: string };
    baselineWindow: { from: string; to: string; label: string };
    deltaExplanation: string;
  };
  totals: {
    waterKm2: number; baselineKm2: number; floodedKm2: number;
    zonesOk: number; zonesTotal: number;
  };
  zones: ZoneResult[];
  caveats: string[];
}

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

const STATUS_KZ: Record<ZoneResult["status"], string> = {
  ok: "өлшенді",
  "no-baseline": "тірек кезең жоқ",
  "no-data": "спутник өтуі жоқ",
};

function csvResponse(d: ApiShape): NextResponse {
  const rows: Cell[][] = withProvenance(
    [
      ["Аймақ", "Өлшеу күні", "Аймақ ауданы км2", "Бақыланған км2", "Жалпы су км2",
        "Тірек су км2", "Су басқан км2", "Аймақтан %", "Қамту", "Күй"],
      ...d.zones.map((z) => [
        z.name, z.latestDate ?? "", z.zoneAreaKm2, z.observedKm2 ?? "", z.waterKm2 ?? "",
        z.baselineKm2 ?? "", z.floodedKm2 ?? "", z.floodedPctOfZone ?? "",
        z.coverage ?? "", STATUS_KZ[z.status],
      ]),
      [],
      ["ЖИЫНТЫҚ", "", "", "", d.totals.waterKm2, d.totals.baselineKm2, d.totals.floodedKm2, "", "", ""],
      [],
      ["Табалдырық, дБ", d.method.thresholdDb],
      ["Ажыратымдылық, м", d.method.resolutionM],
      ["Ағымдағы кезең", `${d.method.currentWindow.from} … ${d.method.currentWindow.to}`],
      ["Тірек кезең", d.method.baselineWindow.label],
    ],
    {
      dataset: "Су басқан аумақ — Sentinel-1 SAR",
      tier: "Өлшем",
      source: d.source,
      fetchedAt: d.fetchedAt,
      method: `${d.method.summary} ${d.method.deltaExplanation}`,
      caveats: d.caveats,
    }
  );
  return new NextResponse(toCsv(rows), {
    headers: csvHeaders(`jaiyq-su-tasqyny-${d.fetchedAt.slice(0, 10)}.csv`),
  });
}
