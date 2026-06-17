import { NextResponse } from "next/server";

// Атырау бойынша жер су қорының трендісі (GRACE баламасы).
// GRACE-тің тегін нүктелік API-ы жоқ, сондықтан ERA5 топырақ су қоры
// (0–100 см, көп жылдық) қолданылады — нақты, нүктелік, жер су қорының
// ұзақмерзімді азаю/көбею динамикасын көрсетеді. Жалған дерек жоқ.

export const revalidate = 604800;

const LAT = 47.1167;
const LNG = 51.8833;

function isoAgo(days: number): string {
  return new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
}

const URL =
  `https://archive-api.open-meteo.com/v1/archive?latitude=${LAT}&longitude=${LNG}` +
  `&start_date=1995-01-01&end_date=${isoAgo(7)}` +
  `&daily=soil_moisture_0_to_100cm_mean&timezone=auto`;

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
    const sm: (number | null)[] = j.daily?.soil_moisture_0_to_100cm_mean ?? [];
    if (time.length < 365) throw new Error("жеткіліксіз дерек");

    const byYear = new Map<number, number[]>();
    time.forEach((d, i) => {
      const y = Number(d.slice(0, 4));
      if (!byYear.has(y)) byYear.set(y, []);
      if (sm[i] != null) byYear.get(y)!.push(sm[i]!);
    });
    const years = [...byYear.entries()]
      .map(([year, arr]) => ({
        year,
        sm: +(arr.reduce((a, c) => a + c, 0) / (arr.length || 1)).toFixed(3),
      }))
      .filter((y) => y.sm > 0)
      .sort((a, b) => a.year - b.year);
    if (years.length < 5) throw new Error("жеткіліксіз жыл");

    // Сызықтық тренд (ең кіші квадраттар) — жылына өзгеріс
    const n = years.length;
    const mx = years.reduce((a, y) => a + y.year, 0) / n;
    const my = years.reduce((a, y) => a + y.sm, 0) / n;
    let num = 0, den = 0;
    for (const y of years) { num += (y.year - mx) * (y.sm - my); den += (y.year - mx) ** 2; }
    const slope = num / den; // м³/м³ жылына
    const totalChange = slope * (years[n - 1].year - years[0].year);
    const pctPerDecade = (slope * 10 / my) * 100;

    const base = years.filter((y) => y.year <= 2005).reduce((a, c) => a + c.sm, 0) /
      (years.filter((y) => y.year <= 2005).length || 1);
    const recent = years.slice(-5).reduce((a, c) => a + c.sm, 0) / Math.min(5, n);

    const data = {
      fetchedAt: new Date().toISOString(),
      source: "ERA5 топырақ су қоры (0–100 см) · Open-Meteo архиві · GRACE баламасы",
      years,
      slopePerDecadePct: +pctPerDecade.toFixed(1),
      totalChange: +totalChange.toFixed(3),
      baseline: +base.toFixed(3),
      recent: +recent.toFixed(3),
      trend: pctPerDecade < -1 ? "drying" : pctPerDecade > 1 ? "wetting" : "stable",
    };
    cache = { at: Date.now(), data };
    return NextResponse.json(data);
  } catch (err) {
    console.error("Water storage error:", err);
    return NextResponse.json(
      { error: "Су қоры деректері уақытша қолжетімсіз. Дереккөз: Open-Meteo архиві (ERA5)." },
      { status: 503 }
    );
  }
}
