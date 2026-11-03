// /api/airgrid торының бір нүктесін CAMS `current` жауабынан құрастыру (P1.3).
//
// ЕРЕЖЕ: H₂S және NO-ға ЕШБІР мән басқа газдан шығарылмайды. CAMS-тың
// `nitrogen_monoxide` өрісі бұл жолда ОҚЫЛМАЙДЫ: NO-ға валидацияланған модель
// көзі жоқ (`atyrauAir.ts` — `no-model-field`), ал NO₂-ні NO деп көрсету —
// қате. Сондықтан `no` әрқашан null, себебі көрсетіледі.

import type { AirReading } from "@/lib/airReading";

/** Жауапта `null` мәнімен бірге беріліп, себебі көрсетілетін газдар. */
export const AIRGRID_UNAVAILABLE: Partial<Record<"h2s" | "no", NonNullable<AirReading["missingReason"]>>> = {
  h2s: "no-model-field",
  no: "no-model-field",
};

/** Open-Meteo `current` жауабының газ өрістері (тек қажеттісі). */
export interface AirgridCurrent {
  european_aqi?: number | null;
  pm2_5?: number | null;
  pm10?: number | null;
  nitrogen_dioxide?: number | null;
  sulphur_dioxide?: number | null;
  ozone?: number | null;
  dust?: number | null;
  methane?: number | null;
  carbon_monoxide?: number | null;
  /** Оқылмайды: NO модель көзі жоқ (қараңыз — файлдың басы) */
  nitrogen_monoxide?: number | null;
  ammonia?: number | null;
  aerosol_optical_depth?: number | null;
  uv_index?: number | null;
}

/** Бір нүктенің газ/көрсеткіш мәндері (AirGridPoint-тің құрамдас бөлігі). */
export interface AirgridValues {
  aqi: number | null;
  pm2_5: number | null;
  pm10: number | null;
  no2: number | null;
  so2: number | null;
  ozone: number | null;
  dust: number | null;
  ch4: number | null;
  co: number | null;
  /** Әрқашан null — NO модель көзі жоқ; себебі `AIRGRID_UNAVAILABLE`-да */
  no: null;
  nh3: number | null;
  aod: number | null;
  uv: number | null;
}

const orNull = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

export function airgridValues(c: AirgridCurrent | null | undefined): AirgridValues {
  return {
    aqi: orNull(c?.european_aqi),
    pm2_5: orNull(c?.pm2_5),
    pm10: orNull(c?.pm10),
    no2: orNull(c?.nitrogen_dioxide),
    so2: orNull(c?.sulphur_dioxide),
    ozone: orNull(c?.ozone),
    dust: orNull(c?.dust),
    ch4: orNull(c?.methane),
    co: orNull(c?.carbon_monoxide),
    no: null,
    nh3: orNull(c?.ammonia),
    aod: orNull(c?.aerosol_optical_depth),
    uv: orNull(c?.uv_index),
  };
}
