import { NextResponse } from "next/server";
import { INDICATORS, resolvePath } from "@/data/indicatorRegistry";
import { normsFor } from "@/data/legalNorms";
import { aggregate, checkCompliance, type ComplianceResult } from "@/lib/compliance";

// ЗАҢНАМАЛЫҚ СӘЙКЕСТІК — тірі деректі ҚР/WHO/EU нормаларымен салыстыру.
//
// Тізілімде нормасы бар көрсеткіштер ғана тексеріледі. Нәтижесі:
//  · әр норма бойынша күй (норма шегінде / жақындады / асқан)
//  · ҚР бойынша РАСТАЛҒАН асу бар ма (дашбордтағы қызыл ескерту осыған сүйенеді)
//  · заңдық ескерту мәтіні (спутник өлшемі — заңдық дәлел емес)
//
// Жалған дерек жоқ: дереккөз қолжетімсіз болса сол көрсеткіш «дерек жоқ»
// болып қалады, ешқандай тұжырым шығарылмайды.

export const revalidate = 900; // 15 минут

const CHECKED = INDICATORS.filter((i) => normsFor(i.id).length > 0);

let cache: { at: number; data: unknown } | null = null;

export async function GET(req: Request) {
  if (cache && Date.now() - cache.at < revalidate * 1000) {
    return NextResponse.json(cache.data);
  }

  const origin = new URL(req.url).origin;
  const endpoints = [...new Set(CHECKED.map((i) => i.endpoint))];

  const fetched = await Promise.all(
    endpoints.map(async (ep) => {
      try {
        const r = await fetch(`${origin}${ep}`, { cache: "no-store" });
        return { ep, ok: r.ok, d: r.ok ? await r.json() : null };
      } catch {
        return { ep, ok: false, d: null };
      }
    })
  );
  const byEp = new Map(fetched.map((f) => [f.ep, f]));

  const results: (ComplianceResult & {
    name: string;
    unit: string;
    section: string;
    tier: string;
    fetchedAt?: string;
  })[] = CHECKED.map((ind) => {
    const src = byEp.get(ind.endpoint);
    const value = src?.ok ? resolvePath(src.d, ind.path) : null;
    return {
      ...checkCompliance(ind.id, value),
      name: ind.name,
      unit: ind.unit,
      section: ind.section,
      tier: ind.tier,
      fetchedAt: src?.d?.fetchedAt,
    };
  });

  const agg = aggregate(results);

  const data = {
    fetchedAt: new Date().toISOString(),
    checkedCount: results.length,
    withData: results.filter((r) => r.value != null).length,
    worst: agg.worst,
    kzViolations: results.filter((r) => r.kzViolation).length,
    /** Расталмаған шек бойынша алдын ала белгілер */
    preliminary: results.filter((r) => r.worst === "exceeded-unverified").length,
    approaching: results.filter((r) => r.worst === "approaching").length,
    results,
    note:
      "Норма тізілімі: src/data/legalNorms.ts. Бастапқы құқықтық актіден " +
      "расталмаған шек бойынша заңдық тұжырым шығарылмайды.",
  };

  cache = { at: Date.now(), data };
  return NextResponse.json(data);
}
