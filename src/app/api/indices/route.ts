import { NextResponse } from "next/server";
import { computeIndices } from "@/lib/sentinelStats";

// Нақты спектрлік индекстер (Sentinel-2, Sentinel Hub Statistical API) +
// автоматты қазақша интерпретация. «ML» нәтижесі (GPT-4o Vision-ға қосымша).

export const dynamic = "force-dynamic";

type Lang = "kk" | "ru" | "en";

// [kk, ru, en] жапсырмалары
const L = {
  veg: {
    dense: ["Қалың, сау өсімдік", "Густая, здоровая растительность", "Dense, healthy vegetation"],
    mid: ["Орташа өсімдік жамылғысы", "Умеренный растительный покров", "Moderate vegetation cover"],
    sparse: ["Сирек өсімдік", "Редкая растительность", "Sparse vegetation"],
    bare: ["Жалаңаш топырақ немесе құрылыс", "Голая почва или застройка", "Bare soil or built-up"],
  },
  water: {
    open: ["Ашық су беті бар", "Есть открытая вода", "Open water present"],
    wet: ["Ылғалды/батпақты", "Влажно/болотисто", "Wet/marshy"],
    none: ["Су беті жоқ", "Поверхностной воды нет", "No surface water"],
  },
  moist: {
    high: ["Жоғары ылғалдылық", "Высокая влажность", "High moisture"],
    mid: ["Орташа ылғалдылық", "Умеренная влажность", "Moderate moisture"],
    dry: ["Құрғақ", "Сухо", "Dry"],
  },
  built: {
    high: ["Құрылыс/тас жабын басым", "Преобладает застройка/камень", "Built-up/rock dominant"],
    mix: ["Аралас (құрылыс + ашық жер)", "Смешанно (застройка + открытая земля)", "Mixed (built + open land)"],
    nat: ["Табиғи бет", "Природная поверхность", "Natural surface"],
  },
};

function interpret(ndvi: number, ndwi: number, ndmi: number, ndbi: number, lang: Lang) {
  const i = lang === "ru" ? 1 : lang === "en" ? 2 : 0;
  const veg = (ndvi > 0.5 ? L.veg.dense : ndvi > 0.3 ? L.veg.mid : ndvi > 0.15 ? L.veg.sparse : L.veg.bare)[i];
  const water = (ndwi > 0.2 ? L.water.open : ndwi > 0 ? L.water.wet : L.water.none)[i];
  const moist = (ndmi > 0.2 ? L.moist.high : ndmi > -0.1 ? L.moist.mid : L.moist.dry)[i];
  const built = (ndbi > 0.1 ? L.built.high : ndbi > 0 ? L.built.mix : L.built.nat)[i];
  return { veg, water, moist, built };
}

export async function POST(req: Request) {
  let lat: number, lng: number, areaKm2: number | undefined, lang: Lang = "kk";
  try {
    const b = await req.json();
    lat = Number(b.lat); lng = Number(b.lng); areaKm2 = b.areaKm2 ? Number(b.areaKm2) : undefined;
    if (b.lang === "ru" || b.lang === "en" || b.lang === "kk") lang = b.lang;
    if (!isFinite(lat) || !isFinite(lng)) throw new Error();
  } catch {
    return NextResponse.json({ error: "Жарамсыз сұраныс" }, { status: 400 });
  }

  const idx = await computeIndices(lat, lng, areaKm2);
  if (!idx) {
    return NextResponse.json(
      { error: "Спектрлік талдау қолжетімсіз (бұлт болуы мүмкін). Жалған дерек көрсетілмейді." },
      { status: 503 }
    );
  }
  return NextResponse.json({
    ...idx,
    source: "Sentinel-2 L2A · Sentinel Hub Statistical API (10 м)",
    interpretation: interpret(idx.ndvi, idx.ndwi, idx.ndmi, idx.ndbi, lang),
  });
}
