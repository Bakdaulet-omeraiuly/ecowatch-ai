// Dominant-pollutant detection + likely source inference.
// Each pollutant is normalised against a reference level (~WHO/EAQI "moderate"),
// the highest ratio is the dominant one. Sources follow standard air-chemistry.

export interface PollutantReadings {
  pm2_5: number | null;
  pm10: number | null;
  no2: number | null;
  so2: number | null;
  ozone: number | null;
  dust: number | null;
}

const REF: Record<string, number> = {
  pm2_5: 15, // WHO 24h
  pm10: 45,
  no2: 25,
  so2: 40,
  ozone: 100,
  dust: 50,
};

const LABEL: Record<string, string> = {
  pm2_5: "PM2.5 (ұсақ бөлшектер)",
  pm10: "PM10 (ірі бөлшектер)",
  no2: "NO₂ (азот диоксиді)",
  so2: "SO₂ (күкірт диоксиді)",
  ozone: "O₃ (озон)",
  dust: "Шаң",
};

const SOURCE: Record<string, string> = {
  pm2_5: "Жану процестері — көлік, өнеркәсіп, факелдер",
  pm10: "Шаң, құрылыс, жол, табиғи эрозия",
  no2: "Көлік қозғалысы мен өнеркәсіптік жану",
  so2: "Мұнай өңдеу мен өнеркәсіп (Атырауға тән)",
  ozone: "Күн сәулесі + ластаушылардың фотохимиясы",
  dust: "Дала/шөл шаңы, жел эрозиясы",
};

export function dominantPollutant(r: PollutantReadings): {
  key: string;
  label: string;
  source: string;
  value: number;
} | null {
  const entries = Object.entries(r).filter(([, v]) => v != null) as [string, number][];
  if (!entries.length) return null;
  let best: [string, number] | null = null;
  let bestRatio = -1;
  for (const [k, v] of entries) {
    const ratio = v / (REF[k] ?? 1);
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = [k, v];
    }
  }
  if (!best) return null;
  return { key: best[0], label: LABEL[best[0]], source: SOURCE[best[0]], value: best[1] };
}
