import { NextResponse } from "next/server";
import { CASPIAN_REGIONS } from "@/data/regions";
import { checkCompliance } from "@/lib/compliance";

// КАСПИЙ ЖАҒАЛАУЫ — жағалау қалаларының ауа сапасын салыстыру.
//
// Каспий — бес мемлекеттің ортақ жабық су айдыны. Ластану шекара
// танымайды, сондықтан жағалау қалаларын БІР ӘДІСПЕН, БІР ДЕРЕККӨЗДЕН
// салыстыру мағыналы: айырма нақты жағдайдан туындайды, өлшеу әдісінен емес.
//
// ⚠️ ЗАҢНАМА: әр елдің өз гигиеналық нормативі бар, бізде олардың мәтіні
// ЖОҚ. Сондықтан салыстыру ТЕК WHO 2021 нұсқаулықтарымен жүреді — оның
// заңдық күші жоқ, бірақ жаһандық денсаулық эталоны ретінде барлық елде
// қолданылады. Қазақстан қалалары үшін ҚР нормативтері бөлек көрсетіледі.

export const revalidate = 3600;

const AQ_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

let cache: { at: number; data: unknown } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.at < revalidate * 1000) {
    return NextResponse.json(cache.data);
  }

  try {
    // Бір сұраныспен барлық қала — бірдей уақыт, бірдей модель нұсқасы
    const lats = CASPIAN_REGIONS.map((r) => r.lat).join(",");
    const lngs = CASPIAN_REGIONS.map((r) => r.lng).join(",");
    const url =
      `${AQ_URL}?latitude=${lats}&longitude=${lngs}` +
      `&current=european_aqi,pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,ozone,carbon_monoxide` +
      `&timezone=UTC`;

    const res = await fetch(url, { next: { revalidate } });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const raw = await res.json();
    const list = Array.isArray(raw) ? raw : [raw];

    const cities = CASPIAN_REGIONS.map((r, i) => {
      const c = list[i]?.current ?? {};
      const vals = {
        aqi: c.european_aqi ?? null,
        pm25: c.pm2_5 ?? null,
        pm10: c.pm10 ?? null,
        no2: c.nitrogen_dioxide ?? null,
        so2: c.sulphur_dioxide ?? null,
        ozone: c.ozone ?? null,
        co: c.carbon_monoxide ?? null,
      };
      const jur = r.country === "KZ" ? ("KZ" as const) : ("OTHER" as const);
      return {
        id: r.id,
        name: r.name,
        country: r.country,
        countryName: r.countryName,
        lat: r.lat,
        lng: r.lng,
        context: r.context,
        pressure: r.pressure,
        values: vals,
        // Салыстыру — WHO бойынша (барлық елге ортақ), ҚР қалаларында
        // қосымша ұлттық норма да тексеріледі
        compliance: {
          pm25: checkCompliance("pm25", vals.pm25, jur),
          pm10: checkCompliance("pm10", vals.pm10, jur),
          no2: checkCompliance("no2", vals.no2, jur),
          so2: checkCompliance("so2", vals.so2, jur),
        },
        jurisdiction: jur,
      };
    });

    const withAqi = cities.filter((c) => c.values.aqi != null);
    const ranked = [...withAqi].sort((a, b) => (b.values.aqi ?? 0) - (a.values.aqi ?? 0));

    const data = {
      fetchedAt: new Date().toISOString(),
      source: "Copernicus CAMS (Open-Meteo Air Quality API) — барлық қалаға БІР дереккөз",
      method:
        "Бір сұраныспен, бір уақытта, бір модель нұсқасымен алынған. Қалалар " +
        "арасындағы айырма нақты жағдайдан туындайды, өлшеу әдісінен емес.",
      littoralStates: 5,
      citiesTotal: CASPIAN_REGIONS.length,
      citiesWithData: withAqi.length,
      worst: ranked[0]?.name ?? null,
      best: ranked[ranked.length - 1]?.name ?? null,
      cities,
      legalNote:
        "Әр Каспий маңы мемлекетінің өз гигиеналық нормативі бар — бұл жүйеде " +
        "олардың мәтіні ЖОҚ. Сондықтан халықаралық салыстыру тек WHO 2021 " +
        "нұсқаулықтарымен жүргізіледі (заңдық күші жоқ, денсаулық эталоны). " +
        "Қазақстан қалалары үшін қосымша ҚР нормативтері де тексеріледі.",
      caveats: [
        "CAMS — жаһандық модель, тор қадамы ≈40 км. Қала ішіндегі айырма көрінбейді.",
        "Бұл модель шығысы, жер бетіндегі станция өлшемі емес.",
        "Салыстыру бір сәттегі мәнге негізделген — ұзақ мерзімді қорытынды үшін жеткіліксіз.",
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
