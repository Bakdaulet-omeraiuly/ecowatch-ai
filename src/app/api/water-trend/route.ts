import { NextResponse } from "next/server";

// Су деңгейінің өзгерісі — Жайық (Урал) өзенінің ағыны, 2020 → қазір.
// Дереккөз: GloFAS (Copernicus Global Flood Awareness) — Open-Meteo Flood API.
// river_discharge (m³/s) — өзен деңгейі/көлемінің нақты өлшенген прокси-көрсеткіші.
// Ешбір дерек ойдан жасалмайды.

const LAT = 47.1167, LNG = 51.8833; // Атырау, Жайық өзені

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);
  const url =
    `https://flood-api.open-meteo.com/v1/flood?latitude=${LAT}&longitude=${LNG}` +
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
      fetchedAt: new Date().toISOString(),
      source: "GloFAS (Copernicus) — Open-Meteo Flood API",
      river: "Жайық (Урал)",
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
