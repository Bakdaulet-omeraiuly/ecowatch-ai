// Mosquito Risk Index (MRI) — computed locally, no AI call needed.
// MRI = 40·standingWater + 20·floodplainProximity + 25·seasonFactor + 15·tempFactor

// Zhaiyk (Ural) river approximate path through Atyrau region
const RIVER_POINTS: [number, number][] = [
  [47.7, 51.6],
  [47.4, 51.75],
  [47.1167, 51.9014], // Atyrau city
  [46.9, 51.95],
  [46.7, 52.0], // delta / Caspian
];

function distanceToRiverKm(lat: number, lng: number): number {
  let min = Infinity;
  for (const [rLat, rLng] of RIVER_POINTS) {
    const dLat = (lat - rLat) * 111;
    const dLng = (lng - rLng) * 111 * Math.cos((lat * Math.PI) / 180);
    min = Math.min(min, Math.sqrt(dLat * dLat + dLng * dLng));
  }
  return min;
}

// May–July flood season = peak breeding
const SEASON_FACTOR = [0.05, 0.05, 0.15, 0.5, 0.9, 1.0, 1.0, 0.8, 0.5, 0.2, 0.05, 0.05];
// Avg monthly temps in Atyrau normalized to mosquito-activity factor
const TEMP_FACTOR = [0, 0, 0.1, 0.5, 0.8, 1.0, 1.0, 1.0, 0.7, 0.3, 0, 0];

export function mosquitoRiskIndex(
  lat: number,
  lng: number,
  standingWater: boolean,
  month = new Date().getMonth()
): number {
  const distKm = distanceToRiverKm(lat, lng);
  const floodplain = Math.max(0, 1 - distKm / 15); // within 15km of river
  const mri =
    40 * (standingWater ? 1 : 0.15) +
    20 * floodplain +
    25 * SEASON_FACTOR[month] +
    15 * TEMP_FACTOR[month];
  return Math.round(Math.min(100, mri));
}

export function monthlyMosquitoForecast(
  lat: number,
  lng: number,
  standingWater: boolean
): { month: string; index: number }[] {
  const names = ["Қаң", "Ақп", "Нау", "Сәу", "Мам", "Мау", "Шіл", "Там", "Қыр", "Қаз", "Қар", "Жел"];
  return names.map((month, i) => ({
    month,
    index: mosquitoRiskIndex(lat, lng, standingWater, i),
  }));
}
