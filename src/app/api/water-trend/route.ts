import { NextResponse } from "next/server";
import { getRegion, hasModule, moduleUnavailable } from "@/data/regions";
import { getRiver } from "@/data/riverPoints";

// Су деңгейінің өзгерісі — өзен ағыны, 2020 → қазір.
// Дереккөз: GloFAS (Copernicus Global Flood Awareness) — Open-Meteo Flood API.
// river_discharge (m³/s) — өзен деңгейі/көлемінің нақты өлшенген прокси-көрсеткіші.
// Ешбір дерек ойдан жасалмайды.
//
// ⚠️ Аймақтың өзен нүктесі тізілімде болмаса — Жайықтың трендісі БАСҚА
// қалаға телінбейді, «бұл аймақта жоқ» деп қайтарылады.

export async function GET(req: Request) {
  const region = getRegion(new URL(req.url).searchParams.get("region"));
  const river = getRiver(region.id);
  if (!hasModule(region, "riverFlow") || !river) {
    return NextResponse.json(moduleUnavailable(region, "riverFlow"));
  }
  const { lat, lng } = river.trendPoint;

  const today = new Date().toISOString().slice(0, 10);
  const url =
    `https://flood-api.open-meteo.com/v1/flood?latitude=${lat}&longitude=${lng}` +
    `&daily=river_discharge&start_date=2020-01-01&end_date=${today}`;

  try {
    const res = await fetch(url, { next: { revalidate: 86400 } }); // тәулігіне
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const d = await res.json();
    const times: string[] = d.daily?.time ?? [];
    const flow: (number | null)[] = d.daily?.river_discharge ?? [];

    // Жылдық орташа ағын
    const byYear = new Map<string, { sum: number; n: number }>();
    times.forEach((t, i) => {
      const y = t.slice(0, 4);
      const v = flow[i];
      if (v == null) return;
      const b = byYear.get(y) ?? { sum: 0, n: 0 };
      b.sum += v; b.n += 1;
      byYear.set(y, b);
    });
    const yearly = [...byYear.entries()]
      .map(([year, b]) => ({ year, discharge: +(b.sum / b.n).toFixed(1) }))
      .sort((a, b) => a.year.localeCompare(b.year));

    if (yearly.length < 2) throw new Error("insufficient data");

    const first = yearly[0], last = yearly[yearly.length - 1];
    const changePct = +(((last.discharge - first.discharge) / first.discharge) * 100).toFixed(1);

    return NextResponse.json({
      available: true as const,
      fetchedAt: new Date().toISOString(),
      source: "GloFAS (Copernicus) — Open-Meteo Flood API",
      region: { id: region.id, name: region.name },
      river: river.river,
      unit: "m³/s",
      yearly,
      changePct, // + = ағын артты, - = азайды
      trend: changePct > 5 ? "артты" : changePct < -5 ? "азайды" : "тұрақты",
    });
  } catch (err) {
    console.error("Water trend error:", err);
    return NextResponse.json(
      { error: "Су деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді." },
      { status: 503 }
    );
  }
}
