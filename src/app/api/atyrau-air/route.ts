import { NextResponse } from "next/server";
import { getRegion } from "@/data/regions";
import {
  buildGroundReadings, buildModelReadings, buildDailyModelReadings, assessRisk, camsAgeHours, POLLUTANTS,
  type CamsCurrent, type CamsHourly, type GroundValue,
} from "@/lib/atyrauAir";
import type { AirReading } from "@/lib/airReading";

// Атырау ауа панелі: CAMS модель (📊) + OpenAQ жерүсті станса (🛰 өлшем).
// Спутниктік баған (mol/m²) бұл эндпоинтте ЕШҚАШАН концентрация ретінде
// берілмейді. Деректер қолжетімсіз болса — мән null, қате күйі ашық.

export const revalidate = 900;

const CAMS_FIELDS = "pm2_5,pm10,sulphur_dioxide,nitrogen_dioxide,carbon_monoxide";

export async function GET(req: Request) {
  const region = getRegion("atyrau");
  const fetchedAt = new Date().toISOString();

  // 1) CAMS модель — Атырау орталығы
  let cams: CamsCurrent | null = null;
  let camsHourly: CamsHourly | null = null;
  let camsOk = false;
  let camsError: string | null = null;
  try {
    const url =
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${region.lat}&longitude=${region.lng}` +
      `&current=${CAMS_FIELDS}&hourly=${CAMS_FIELDS}&past_days=1&forecast_days=1&timezone=auto`;
    // Жоғарғы көз кешіксе бүкіл бет күтпеуі үшін — уақыт шегі (CI-да 40 с+ кешігу байқалды)
    const res = await fetch(url, { next: { revalidate: 900 }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`cams ${res.status}`);
    const j = (await res.json()) as { current?: CamsCurrent; hourly?: CamsHourly };
    camsHourly = j.hourly ?? null;
    if (j.current) {
      cams = j.current;
      camsOk = true;
    } else {
      camsError = "CAMS жауабында ағымдағы мән жоқ";
    }
  } catch (err) {
    camsError = err instanceof Error ? err.message : "CAMS қолжетімсіз";
    console.error("atyrau-air CAMS:", err);
  }

  // 2) OpenAQ жерүсті стансалар — жергілікті ground-stations маршруты арқылы
  let groundValues: GroundValue[] | null = null;
  let groundState: "ok" | "unavailable" | "no-station" = "unavailable";
  let stationCount = 0;
  let groundNote: string | null = null;
  // `req.url` try-дан ТЫС оқылады: Next.js динамикалық маршрут белгісін (DynamicServerError)
  // осы жерде лақтырады, оны catch ұстап алса «станса қолжетімсіз» деген жалған лог шығады.
  const gUrl = new URL(`/api/ground-stations?region=atyrau`, req.url);
  try {
    const res = await fetch(gUrl, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    const j = (await res.json()) as {
      available?: boolean;
      stationCount?: number;
      note?: string;
      error?: string;
      stations?: {
        name: string | null; distanceKm: number | null;
        values: { parameter: string | null; value: number; unit: string | null; atUtc: string | null }[];
      }[];
    };
    if (!res.ok || j.available === false) {
      groundState = "unavailable";
      groundNote = j.error ?? "Жерүсті станса деректері қолжетімсіз";
    } else if (!j.stations || j.stations.length === 0) {
      groundState = "no-station";
      stationCount = j.stationCount ?? 0;
      groundNote = j.note ?? null;
    } else {
      groundState = "ok";
      stationCount = j.stationCount ?? j.stations.length;
      groundValues = j.stations.flatMap((s) =>
        s.values
          .filter((v) => v.parameter)
          .map((v) => ({
            parameter: v.parameter as string,
            value: v.value,
            unit: v.unit,
            atUtc: v.atUtc,
            stationName: s.name ?? "Белгісіз станса",
            distanceKm: s.distanceKm,
          }))
      );
    }
  } catch (err) {
    groundState = "unavailable";
    groundNote = "Жерүсті станса деректері қолжетімсіз";
    console.error("atyrau-air ground:", err);
  }

  const modelReadings = buildModelReadings(cams, fetchedAt, camsOk);
  // Тәуліктік нормалар үшін: соңғы 24 сағаттың CAMS орташасы (болжам сағаттары кірмейді)
  const dailyReadings = camsOk ? buildDailyModelReadings(camsHourly, cams?.time, fetchedAt) : [];
  const groundReadings = buildGroundReadings(groundValues, fetchedAt, groundState);

  // Әр көрсеткіш үшін «негізгі» мән: станса өлшемі бар болса — соны, жоқ болса модель.
  // Станса мәні тек БІРЛІГІ танылғанда ғана негізгі болады: `buildGroundReadings`
  // танылмаған бірлікке `unit: null` қояды — ондай санды көрсетуге де, нормамен
  // салыстыруға да болмайды, әрі ол жарамды CAMS мәнін жасырмауы керек.
  const primary: AirReading[] = POLLUTANTS.map((p) => {
    const g = groundReadings.find((r) => r.pollutant === p)!;
    const m = modelReadings.find((r) => r.pollutant === p)!;
    return g.value != null && g.unit != null ? g : m;
  });

  return NextResponse.json({
    fetchedAt,
    region: { id: region.id, name: region.name, lat: region.lat, lng: region.lng },
    cams: {
      ok: camsOk, error: camsError, time: cams?.time ?? null,
      // Модель деректің жасы (сағат) — ескіру белгісі осыған қарап қойылады
      ageH: camsAgeHours(cams?.time, Date.parse(fetchedAt)),
      source: "Copernicus CAMS (Open-Meteo)",
    },
    ground: { state: groundState, stationCount, note: groundNote, source: "OpenAQ" },
    readings: { ground: groundReadings, model: modelReadings, daily: dailyReadings, primary },
    risk: assessRisk(primary, dailyReadings),
  });
}
