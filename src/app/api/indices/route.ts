import { NextResponse } from "next/server";
import { computeIndices } from "@/lib/sentinelStats";

// Нақты спектрлік индекстер (Sentinel-2, Sentinel Hub Statistical API) +
// автоматты қазақша интерпретация. «ML» нәтижесі (GPT-4o Vision-ға қосымша).

export const dynamic = "force-dynamic";

function interpret(ndvi: number, ndwi: number, ndmi: number, ndbi: number) {
  const veg =
    ndvi > 0.5 ? "Қалың, сау өсімдік" :
    ndvi > 0.3 ? "Орташа өсімдік жамылғысы" :
    ndvi > 0.15 ? "Сирек өсімдік" : "Жалаңаш топырақ немесе құрылыс";
  const water =
    ndwi > 0.2 ? "Ашық су беті бар" :
    ndwi > 0 ? "Ылғалды/батпақты" : "Су беті жоқ";
  const moist =
    ndmi > 0.2 ? "Жоғары ылғалдылық" :
    ndmi > -0.1 ? "Орташа ылғалдылық" : "Құрғақ";
  const built =
    ndbi > 0.1 ? "Құрылыс/тас жабын басым" :
    ndbi > 0 ? "Аралас (құрылыс + ашық жер)" : "Табиғи бет";
  return { veg, water, moist, built };
}

export async function POST(req: Request) {
  let lat: number, lng: number, areaKm2: number | undefined;
  try {
    const b = await req.json();
    lat = Number(b.lat); lng = Number(b.lng); areaKm2 = b.areaKm2 ? Number(b.areaKm2) : undefined;
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
    interpretation: interpret(idx.ndvi, idx.ndwi, idx.ndmi, idx.ndbi),
  });
}
