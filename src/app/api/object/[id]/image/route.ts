import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { FACILITIES } from "@/data/facilities";
import { historicalImageUrl, satelliteImageUrl } from "@/lib/mapbox";

// Нысанның спутник суретіне бағыттауыш (redirect).
//
// Неге прокси: сурет URL-і Mapbox токенін қамтиды. Оны клиентке беруге
// болады (ол NEXT_PUBLIC), бірақ бір жерден басқарған дұрыс: жыл өзгергенде
// қай дереккөз қолданылатыны осында шешіледі.
//
// zoom=16 — зауыт аумағы толық сыятын, бірақ детальді көрінетін масштаб.

export const revalidate = 86400;

const CURRENT_YEAR = new Date().getFullYear();

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const fac = FACILITIES.find((f) => f.id === id);
  if (!fac) return NextResponse.json({ error: "Нысан табылмады" }, { status: 404 });

  const yearParam = req.nextUrl.searchParams.get("year");
  const zoom = Number(req.nextUrl.searchParams.get("zoom") ?? 16);
  const year = yearParam ? parseInt(yearParam, 10) : CURRENT_YEAR;

  const url =
    year >= CURRENT_YEAR - 1
      ? satelliteImageUrl(fac.lat, fac.lng, Math.min(18, Math.max(10, zoom)))
      : historicalImageUrl(fac.lat, fac.lng, year);

  return NextResponse.redirect(url, 302);
}
