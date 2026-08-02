import { NextResponse } from "next/server";
import { INDICATORS, resolvePath } from "@/data/indicatorRegistry";
import { normsFor } from "@/data/legalNorms";
import { aggregate, checkCompliance, type ComplianceResult } from "@/lib/compliance";
import { evaluateAllGroups } from "@/lib/summation";
import type { SubstanceId } from "@/data/summationGroups";
import { getRegion } from "@/data/regions";

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

const cache = new Map<string, { at: number; data: unknown }>();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const region = getRegion(url.searchParams.get("region"));
  const jurisdiction = region.country === "KZ" ? ("KZ" as const) : ("OTHER" as const);

  const hit = cache.get(region.id);
  if (hit && Date.now() - hit.at < revalidate * 1000) {
    return NextResponse.json(hit.data);
  }

  const origin = url.origin;
  const endpoints = [...new Set(CHECKED.map((i) => i.endpoint))];

  const fetched = await Promise.all(
    endpoints.map(async (ep) => {
      try {
        const q = ep.includes("?") ? "&" : "?";
        const r = await fetch(`${origin}${ep}${q}region=${region.id}`, { cache: "no-store" });
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
      ...checkCompliance(ind.id, value, jurisdiction),
      name: ind.name,
      unit: ind.unit,
      section: ind.section,
      tier: ind.tier,
      fetchedAt: src?.d?.fetchedAt,
    };
  });

  const agg = aggregate(results);

  // ЖИНАҚТАЛУ ӘСЕРІ — ҚР ДСМ-70, 3-кесте (2025 ж. № 10 бұйрықпен енгізілген).
  // Әр зат жеке норма шегінде тұрса да, қосындысы 1-ден аспауы керек.
  const byId = new Map(results.map((r) => [r.indicatorId, r.value]));
  const substanceValues: Partial<Record<SubstanceId, number | null>> = {
    no2: byId.get("no2") ?? null,
    so2: byId.get("so2") ?? null,
    co: byId.get("co") ?? null,
    ozone: byId.get("ozone") ?? null,
    pm25: byId.get("pm25") ?? null,
    pm10: byId.get("pm10") ?? null,
  };
  const summation = evaluateAllGroups(substanceValues);

  const data = {
    fetchedAt: new Date().toISOString(),
    region: { id: region.id, name: region.name, country: region.country, jurisdiction },
    checkedCount: results.length,
    withData: results.filter((r) => r.value != null).length,
    worst: agg.worst,
    kzViolations: results.filter((r) => r.kzViolation).length,
    /**
     * ⚠️ АЙЫРМАСЫ МАҢЫЗДЫ:
     *   kzViolations — ҚР актісі бойынша расталған асу (заңдық белгі)
     *   exceededAny  — кез келген РАСТАЛҒАН нормадан асу (WHO/EU да кіреді)
     * Бұрын дашбордта тек `kzViolations` көрсетіліп, оның жанында
     * «НОРМА АСҚАН» деген қызыл белгі тұратын — ал ол белгі `worst`-тан
     * шығатын. Нәтижесінде WHO эталонынан асқанда жоғарыда «0», төменде
     * «НОРМА АСҚАН» деп қайшы жазылатын.
     */
    exceededAny: results.filter((r) => r.worst === "exceeded").length,
    /** Расталмаған шек бойынша алдын ала белгілер */
    preliminary: results.filter((r) => r.worst === "exceeded-unverified").length,
    approaching: results.filter((r) => r.worst === "approaching").length,
    results,
    summation: {
      computable: summation.computable,
      violations: summation.violations,
      groups: summation.results,
      source: summation.source,
      explain:
        "Жинақталу әсері: бірнеше зат бірге әсер еткенде, олардың ШРК-ға " +
        "қатынастарының қосындысы 1-ден аспауы керек. Әр зат жеке-жеке норма " +
        "шегінде тұрып, қосындысы норманы бұзуы мүмкін.",
    },
    note:
      "Норма тізілімі: src/data/legalNorms.ts. Бастапқы құқықтық актіден " +
      "расталмаған шек бойынша заңдық тұжырым шығарылмайды.",
  };

  cache.set(region.id, { at: Date.now(), data });
  return NextResponse.json(data);
}
