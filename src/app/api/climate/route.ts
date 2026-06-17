import { NextResponse } from "next/server";

// Атырау бойынша болашақ климат проекциясы — CMIP6 HighResMIP (MRI_AGCM3_2_S).
// Дереккөз: Open-Meteo Climate API (тегін, кілтсіз) — IPCC CMIP6 даунскейлингі.
// Жалған дерек жоқ: API қолжетімсіз болса, қате қайтарылады.

export const revalidate = 604800; // аптасына бір

const LAT = 47.1167;
const LNG = 51.8833;
const MODEL = "MRI_AGCM3_2_S"; // CMIP6 HighResMIP, ~20 км даунскейлинг

const URL =
  `https://climate-api.open-meteo.com/v1/climate?latitude=${LAT}&longitude=${LNG}` +
  `&start_date=2000-01-01&end_date=2050-12-31&models=${MODEL}` +
  `&daily=temperature_2m_mean,precipitation_sum`;

let cache: { at: number; data: unknown } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.at < 604800_000) {
    return NextResponse.json(cache.data);
  }
  try {
    const res = await fetch(URL, { next: { revalidate: 604800 } });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const j = await res.json();
    const time: string[] = j.daily?.time ?? [];
    const temp: (number | null)[] = j.daily?.temperature_2m_mean ?? [];
    const prcp: (number | null)[] = j.daily?.precipitation_sum ?? [];
    if (time.length < 365) throw new Error("жеткіліксіз дерек");

    // Жылдық агрегация: орташа температура + жиынтық жауын-шашын
    const byYear = new Map<number, { t: number[]; p: number }>();
    time.forEach((d, i) => {
      const y = Number(d.slice(0, 4));
      if (!byYear.has(y)) byYear.set(y, { t: [], p: 0 });
      const b = byYear.get(y)!;
      if (temp[i] != null) b.t.push(temp[i]!);
      if (prcp[i] != null) b.p += prcp[i]!;
    });
    const years = [...byYear.entries()]
      .map(([year, b]) => ({
        year,
        temp: +(b.t.reduce((a, c) => a + c, 0) / (b.t.length || 1)).toFixed(2),
        precip: +b.p.toFixed(0),
      }))
      .filter((y) => y.year >= 2000 && y.year <= 2050)
      .sort((a, b) => a.year - b.year);

    const mean = (arr: number[]) => arr.reduce((a, c) => a + c, 0) / (arr.length || 1);
    const baseT = mean(years.filter((y) => y.year <= 2020).map((y) => y.temp));
    const futT = mean(years.filter((y) => y.year >= 2040).map((y) => y.temp));
    const baseP = mean(years.filter((y) => y.year <= 2020).map((y) => y.precip));
    const futP = mean(years.filter((y) => y.year >= 2040).map((y) => y.precip));

    const data = {
      fetchedAt: new Date().toISOString(),
      source: "Open-Meteo Climate · IPCC CMIP6 HighResMIP (MRI-AGCM3-2-S)",
      model: MODEL,
      years,
      baseline: { period: "2000–2020", temp: +baseT.toFixed(1), precip: Math.round(baseP) },
      future: { period: "2040–2050", temp: +futT.toFixed(1), precip: Math.round(futP) },
      tempDelta: +(futT - baseT).toFixed(1),
      precipDeltaPct: +(((futP - baseP) / baseP) * 100).toFixed(0),
    };
    cache = { at: Date.now(), data };
    return NextResponse.json(data);
  } catch (err) {
    console.error("Climate CMIP6 error:", err);
    return NextResponse.json(
      { error: "Климат проекциясы уақытша қолжетімсіз. Дереккөз: Open-Meteo Climate (CMIP6)." },
      { status: 503 }
    );
  }
}
