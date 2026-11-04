import { NextResponse } from "next/server";
import { CLASS_LABEL, FAUNA_CAVEATS, FAUNA_CLASSES, FAUNA_WKT, GBIF_API, toPoints } from "@/lib/fauna";

// P5.5 fauna observations from GBIF (aggregated facets + generalised points).
// 24 h in-memory cache of complete answers only; GBIF failure → 503, never an empty map.
export const revalidate = 86400;
export const maxDuration = 60;
let cache: { at: number; data: unknown } | null = null;
const UA = { "User-Agent": "Jaiyq/1.0 (+https://ecojaiyq.com)" };

async function gbif(path: string) {
  const r = await fetch(`${GBIF_API}${path}`, { headers: UA, cache: "no-store", signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`GBIF HTTP ${r.status}`);
  return r.json();
}

export async function GET() {
  if (cache && Date.now() - cache.at < revalidate * 1000) return NextResponse.json(cache.data);
  try {
    const geo = `geometry=${encodeURIComponent(FAUNA_WKT)}&hasCoordinate=true&hasGeospatialIssue=false`;
    const classes = FAUNA_CLASSES.map((c) => `classKey=${c}`).join("&");
    const [facets, recent] = await Promise.all([
      gbif(`/occurrence/search?${geo}&${classes}&limit=0&facet=classKey&facet=month&facet=speciesKey&speciesKey.facetLimit=15&month.facetLimit=12`),
      gbif(`/occurrence/search?${geo}&${classes}&limit=300&year=2015,2026`),
    ]);
    const facet = (f: string) => (facets.facets as { field: string; counts: { name: string; count: number }[] }[]).find((x) => x.field === f)?.counts ?? [];
    const topSpecies = await Promise.all(facet("SPECIES_KEY").map(async (c) => {
      const sp = await gbif(`/species/${c.name}`);
      return { key: c.name, name: sp.scientificName as string, vernacular: (sp.vernacularName as string | undefined) ?? null, classKey: String(sp.classKey ?? ""), records: c.count };
    }));
    const data = {
      fetchedAt: new Date().toISOString(),
      source: "GBIF.org — occurrence search API", url: "https://www.gbif.org/occurrence/search", area: FAUNA_WKT,
      tier: "observation", label: "Бақылау жазбалары — популяция саны емес",
      total: facets.count as number,
      byClass: facet("CLASS_KEY").map((c) => ({ classKey: c.name, label: CLASS_LABEL[c.name] ?? c.name, records: c.count })),
      byMonth: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, records: facet("MONTH").find((m) => Number(m.name) === i + 1)?.count ?? 0 })),
      topSpecies,
      points: toPoints(recent.results),
      dieOffEvents: { available: false, reason: "Расталған қырылу оқиғаларының ашық ресми тізілімі табылмады — дерек жоқ" },
      license: "Жазбалар CC0 / CC BY / CC BY-NC (әр датасет өз лицензиясымен); GBIF-ке сілтеме міндетті",
      caveats: FAUNA_CAVEATS,
    };
    cache = { at: Date.now(), data };
    return NextResponse.json(data, { headers: { "Cache-Control": "s-maxage=86400, stale-while-revalidate=604800" } });
  } catch (err) {
    console.error("fauna:", err);
    return NextResponse.json({ error: "GBIF деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді", reason: String(err instanceof Error ? err.message : err) },
      { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
