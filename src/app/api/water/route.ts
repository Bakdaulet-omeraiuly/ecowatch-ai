import { NextResponse } from "next/server";
import { getRegion } from "@/data/regions";

// Таңдалған аймақ бойынша жер су қорының трендісі (GRACE баламасы).
// GRACE-тің тегін нүктелік API-ы жоқ, сондықтан ERA5 топырақ су қоры
// (0–100 см, көп жылдық) қолданылады — нақты, нүктелік, жер су қорының
// ұзақмерзімді азаю/көбею динамикасын көрсетеді. Жалған дерек жоқ.
//
// ERA5 — ЖАҺАНДЫҚ реанализ, сондықтан кез келген аймақта жұмыс істейді:
// координата аймақтың орталығынан алынады (тізілім қажет емес).

export const revalidate = 604800;

function isoAgo(days: number): string {
  return new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
}

const SRC_URL = (lat: number, lng: number) =>
  `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}` +
  `&start_date=1995-01-01&end_date=${isoAgo(7)}` +
  `&daily=soil_moisture_0_to_100cm_mean&timezone=auto`;

const cache = new Map<string, { at: number; data: unknown }>();

export async function GET(req: Request) {
  const region = getRegion(new URL(req.url).searchParams.get("region"));
  const hit = cache.get(region.id);
  if (hit && Date.now() - hit.at < 604800_000) {
    return NextResponse.json(hit.data);
  }
  try {
    const res = await fetch(SRC_URL(region.lat, region.lng), { next: { revalidate: 604800 } });
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
      available: true as const,
      fetchedAt: new Date().toISOString(),
      source: "ERA5 топырақ су қоры (0–100 см) · Open-Meteo архиві · GRACE баламасы",
      region: { id: region.id, name: region.name },
      years,
      slopePerDecadePct: +pctPerDecade.toFixed(1),
      totalChange: +totalChange.toFixed(3),
      baseline: +base.toFixed(3),
      recent: +recent.toFixed(3),
      trend: pctPerDecade < -1 ? "drying" : pctPerDecade > 1 ? "wetting" : "stable",
    };
    cache.set(region.id, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (err) {
    console.error("Water storage error:", err);
    return NextResponse.json(
      { error: "Су қоры деректері уақытша қолжетімсіз. Дереккөз: Open-Meteo архиві (ERA5)." },
      { status: 503 }
    );
  }
}
