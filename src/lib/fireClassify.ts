// ЖЫЛУ АНОМАЛИЯСЫН ЖІКТЕУ (P4.6).
//
// Ереже (бір ғана):
//   · нүкте нысанның контур + FOOTPRINT_BUFFER_KM ішінде → «өндірістік алау»
//   · басқа жағдайда (контур жоқ нысандар да) → «жылу аномалиясы (расталмаған)»
//
// ⚠️ Бұл — ӨРТ ДЕГЕН ҚОРЫТЫНДЫ ЕМЕС. Ешбір категория «расталған өрт» деп
// аталмайды. Контурдан тыс аномалия «өрт» емес, «өртке ұқсас сигнал» — және
// оның ішінде өндірістік факел де болуы мүмкін (контур дәл болмауы ықтимал).

import { FACILITIES, FOOTPRINT_BUFFER_KM, type Facility } from "@/data/facilities";
import { distanceToFootprintKm } from "./footprint";

export type AnomalyCategory = "industrial_flare" | "unconfirmed_anomaly";

export const ANOMALY_LABEL: Record<AnomalyCategory, { kk: string; ru: string }> = {
  industrial_flare: { kk: "өндірістік алау", ru: "промышленный факел" },
  unconfirmed_anomaly: { kk: "жылу аномалиясы (расталмаған)", ru: "тепловая аномалия (не подтверждена)" },
};

export interface AnomalyClass {
  category: AnomalyCategory;
  facilityId: string | null;
  facilityName: string | null;
  /** Контурға дейінгі қашықтық (км); контур жоқ/қашық болса null */
  distanceToFootprintKm: number | null;
}

/** Нүктені жіктеу. `facilities` — тест үшін ауыстыруға болады. */
export function classifyAnomaly(
  lat: number,
  lng: number,
  facilities: Facility[] = FACILITIES
): AnomalyClass {
  for (const fac of facilities) {
    if (!fac.footprint) continue;
    const d = distanceToFootprintKm(lat, lng, fac.footprint);
    if (d <= FOOTPRINT_BUFFER_KM) {
      return {
        category: "industrial_flare",
        facilityId: fac.id,
        facilityName: fac.name,
        distanceToFootprintKm: +d.toFixed(3),
      };
    }
  }
  return {
    category: "unconfirmed_anomaly",
    facilityId: null,
    facilityName: null,
    distanceToFootprintKm: null,
  };
}
