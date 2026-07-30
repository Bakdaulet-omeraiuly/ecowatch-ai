import { NextResponse } from "next/server";

// Берілген нүктенің (мыс. зауыт координатасы) тірі ауа сапасы.
// Дереккөз: Copernicus CAMS (Open-Meteo Air Quality API). Ойдан дерек жоқ —
// дереккөз қолжетімсіз болса, қате қайтарамыз.

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ error: "Жарамсыз координата" }, { status: 400 });
  }

  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}` +
    `&current=pm2_5,pm10,sulphur_dioxide,nitrogen_dioxide,ozone,carbon_monoxide,european_aqi`;

  try {
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const d = await res.json();
    const c = d.current ?? {};
    return NextResponse.json({
      fetchedAt: new Date().toISOString(),
      source: "Copernicus CAMS — Open-Meteo Air Quality API",
      lat,
      lng,
      aqi: c.european_aqi ?? null,
      pm2_5: c.pm2_5 ?? null,
      pm10: c.pm10 ?? null,
      so2: c.sulphur_dioxide ?? null,
      no2: c.nitrogen_dioxide ?? null,
      ozone: c.ozone ?? null,
      co: c.carbon_monoxide ?? null,
    });
  } catch (err) {
    console.error("Point air error:", err);
    return NextResponse.json(
      { error: "Тірі ауа деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді." },
      { status: 503 }
    );
  }
}
