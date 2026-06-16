import { NextResponse } from "next/server";
import { computeSPI, droughtClass, DROUGHT_KZ, DROUGHT_COLOR } from "@/lib/spi";

// Атырау бойынша нақты 3-айлық SPI (Standardized Precipitation Index, McKee 1993).
// Дереккөз: Open-Meteo архиві (ERA5, 1991-ден бері) — тегін, кілтсіз.
// Климатология: бір күнтізбелік айдың әртүрлі жылдардағы 3-айлық жиынтығына
// гамма үлестірім сәйкестендіріледі. Жалған дерек жоқ.

export const revalidate = 86400; // тәулігіне бір

const LAT = 47.1167;
const LNG = 51.8833;
const START = "1991-01-01";

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

let cache: { at: number; data: unknown } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.at < 86400_000) {
    return NextResponse.json(cache.data);
  }
  try {
    const end = isoDaysAgo(7); // архивте ~5 күн кідіріс
    const url =
      `https://archive-api.open-meteo.com/v1/archive?latitude=${LAT}&longitude=${LNG}` +
      `&start_date=${START}&end_date=${end}&daily=precipitation_sum&timezone=auto`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const j = await res.json();

    const time: string[] = j.daily?.time ?? [];
    const precip: number[] = j.daily?.precipitation_sum ?? [];
    if (time.length < 365) throw new Error("жеткіліксіз тарих");

    // Айлық жиынтық (YYYY-MM → мм)
    const monthly = new Map<string, number>();
    time.forEach((t, i) => {
      const ym = t.slice(0, 7);
      monthly.set(ym, (monthly.get(ym) ?? 0) + (precip[i] ?? 0));
    });
    const keys = [...monthly.keys()].sort();

    // 3-айлық жылжымалы жиынтық
    const roll3 = new Map<string, number>();
    for (let i = 2; i < keys.length; i++) {
      const sum =
        (monthly.get(keys[i]) ?? 0) +
        (monthly.get(keys[i - 1]) ?? 0) +
        (monthly.get(keys[i - 2]) ?? 0);
      roll3.set(keys[i], sum);
    }

    // Соңғы толық ай = тізбектегі соңғы кілт
    const latestKey = keys[keys.length - 1];
    const latestMonth = Number(latestKey.slice(5, 7)); // 1–12
    const current = roll3.get(latestKey);
    if (current == null) throw new Error("ағымдағы кезең жоқ");

    // Сол күнтізбелік айдың барлық жылдардағы 3-айлық жиынтығы (климатология)
    const history: number[] = [];
    for (const [k, v] of roll3) {
      if (Number(k.slice(5, 7)) === latestMonth) history.push(v);
    }

    const spi = computeSPI(history, current);
    if (spi == null) throw new Error("SPI есептелмеді");
    const cls = droughtClass(spi);

    const data = {
      fetchedAt: new Date().toISOString(),
      source: "Open-Meteo архиві (ERA5) · SPI-3 (McKee 1993, WMO)",
      lat: LAT,
      lng: LNG,
      period: latestKey,
      timescaleMonths: 3,
      yearsOfRecord: history.length,
      spi,
      precip3m: +current.toFixed(1),
      droughtClass: cls,
      droughtLabel: DROUGHT_KZ[cls],
      droughtColor: DROUGHT_COLOR[cls],
    };
    cache = { at: Date.now(), data };
    return NextResponse.json(data);
  } catch (err) {
    console.error("Drought SPI error:", err);
    return NextResponse.json(
      { error: "Құрғақшылық деректері уақытша қолжетімсіз. Дереккөз: Open-Meteo архиві." },
      { status: 503 }
    );
  }
}
