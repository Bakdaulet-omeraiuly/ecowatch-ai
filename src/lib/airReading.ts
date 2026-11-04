// Ауа көрсеткішінің бірыңғай жазбасы (SPEC §13, PLAN P1.1).
//
// ЕРЕЖЕ: `satellite-column` мәні (mol/m²) ЕШҚАШАН концентрация ретінде
// көрсетілмейді — бұл типте бірлік тек баған бірлігі болады. Бұл құрылым
// осыны ұстап тұрады: спутниктік бағанды µg/m³ деп белгілеу мүмкін емес.

export type Pollutant = "so2" | "co" | "no2" | "h2s" | "no" | "pm25" | "pm10";

/** 🛰 жерүсті станса / 📊 модель / 🛰 спутник баған / «дерек жоқ» */
export type ReadingKind = "ground" | "model" | "satellite-column" | "none";

/** Бірлік — тек шартта көрсетілген мәндердің бірі. */
export type Unit = "µg/m³" | "mg/m³" | "ppm" | "ppb" | "mol/m²";

export interface AirReading {
  pollutant: Pollutant;
  kind: ReadingKind;
  /** Мән; дерек жоқ болса null (нөлмен толтырылмайды) */
  value: number | null;
  unit: Unit | null;
  /** Дереккөз идентификаторы және атауы (көрсету үшін) */
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  /** Өлшенген / модельденген уақыт (ISO). Белгісіз болса null */
  observedAt: string | null;
  /** Біз деректі алған уақыт (ISO) */
  fetchedAt: string;
  /** Жаңарту жиілігі — адам оқуы үшін мәтін ключі */
  updateInterval: "hourly" | "unknown";
  /** Орташалау кезеңі: тек салыстыруға рұқсат етілген кезеңдер.
   *  "daily" — соңғы 24 сағаттық мәндердің орташасы (≥ 18 сағат бар болса, EU 2008/50/EC VII қосымша, 75%). */
  averaging: "hourly" | "daily" | "unknown";
  /** Сапа белгісі */
  quality: "ground-unvalidated" | "model-unvalidated" | "none";
  /** Белгісіздік: бағаланбаған, немесе сан (±, unit) */
  uncertainty: { kind: "not-estimated" } | { kind: "absolute"; value: number; unit: Unit };
  /** Мән жоқ болса — себеп (ашық мәтін үшін кілт) */
  missingReason?: "no-verified-source" | "no-station" | "source-unavailable" | "no-model-field" | "stale-ground";
  /** Станса туралы қосымша (ground үшін) */
  station?: { name: string; distanceKm: number | null };
}
