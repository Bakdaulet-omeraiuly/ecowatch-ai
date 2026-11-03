import { NextResponse } from "next/server";
import { CASPIAN_FACTS, DEFAULT_REGION_ID, getRegion } from "@/data/regions";
import { checkCompliance, HOURLY_BASIS } from "@/lib/compliance";

// КАСПИЙ АНЫҚТАМАСЫ — жағалаудағы Атырау қаласының ауа сапасы.
//
// 2026-11: жүйе тек Атырау мен Каспий теңізіне шектелді. Бұл эндпоинт
// Каспий бетіне ЖАҒАЛАУДАҒЫ жалғыз қаланың (Атырау) тірі ауа деректерін береді.
//
// ⚠️ Теңіз деңгейі мен су сапасы бойынша дереккөз ЖАЛҒАНБАҒАН — олар үшін
// ешқандай мән ойдан шығарылмайды.
//
// Атырау — Қазақстан аумағы: ҚР нормативтері де, WHO 2021 де тексеріледі.

export const revalidate = 3600;

const AQ_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

let cache: { at: number; data: unknown } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.at < revalidate * 1000) {
    return NextResponse.json(cache.data);
  }

  try {
    const r = getRegion(DEFAULT_REGION_ID);
    const url =
      `${AQ_URL}?latitude=${r.lat}&longitude=${r.lng}` +
      `&current=european_aqi,pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,ozone,carbon_monoxide` +
      `&timezone=UTC`;

    const res = await fetch(url, { next: { revalidate } });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const raw = await res.json();

    const c = raw?.current ?? {};
    const vals = {
      aqi: c.european_aqi ?? null,
      pm25: c.pm2_5 ?? null,
      pm10: c.pm10 ?? null,
      no2: c.nitrogen_dioxide ?? null,
      so2: c.sulphur_dioxide ?? null,
      ozone: c.ozone ?? null,
      co: c.carbon_monoxide ?? null,
    };
    const jur = "KZ" as const;
    const city = {
      id: r.id,
      name: r.name,
      country: r.country,
      countryName: r.countryName,
      lat: r.lat,
      lng: r.lng,
      context: r.context,
      pressure: r.pressure,
      values: vals,
      compliance: {
        pm25: checkCompliance("pm25", vals.pm25, jur, HOURLY_BASIS),
        pm10: checkCompliance("pm10", vals.pm10, jur, HOURLY_BASIS),
        no2: checkCompliance("no2", vals.no2, jur, HOURLY_BASIS),
        so2: checkCompliance("so2", vals.so2, jur, HOURLY_BASIS),
      },
      jurisdiction: jur,
    };

    const data = {
      fetchedAt: new Date().toISOString(),
      source: "Copernicus CAMS (Open-Meteo Air Quality API)",
      method:
        "Copernicus CAMS модель шығысы — Атырау қаласы орталығының нүктесі, сағат сайын жаңарады.",
      littoralStates: CASPIAN_FACTS.littoralStates,
      city,
      legalNote:
        "Атырау — Қазақстан аумағы, сондықтан ҚР нормативтері мен WHO 2021 нұсқаулықтары бірге тексеріледі.",
      caveats: [
        "CAMS — жаһандық модель, тор қадамы ≈40 км. Қала ішіндегі айырма көрінбейді.",
        "Бұл модель шығысы, жер бетіндегі станция өлшемі емес.",
        "Бір сәттегі мән — ұзақ мерзімді қорытынды үшін жеткіліксіз.",
      ],
    };

    cache = { at: Date.now(), data };
    return NextResponse.json(data);
  } catch (err) {
    console.error("caspian error:", err);
    return NextResponse.json(
      { error: "Каспий деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді" },
      { status: 503 }
    );
  }
}
