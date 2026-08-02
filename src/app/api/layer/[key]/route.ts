import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { LAYER_BY_KEY, SERIES_BASE, type EcoLayer } from "@/data/ecoLayers";
import { INDICATORS, resolvePath } from "@/data/indicatorRegistry";
import { checkCompliance, aggregate, type ComplianceResult } from "@/lib/compliance";
import { getRegion, hasModule, MODULE_REASON, type Region } from "@/data/regions";

// БІР ЭКО ҚАБАТТЫҢ ТОЛЫҚ КЕСКІНІ.
//
// Қайтарады:
//   · ағымдағы мәндер
//   · ӨТКЕН 24 САҒАТ — нақты өлшенген/модельденген қатар
//   · АЛДАҒЫ 24 САҒАТ — ресми болжам (өз болжамымыз емес)
//   · заңнамалық сәйкестік (ҚР/WHO/EU)
//
// ⚠️ Мұнда AI ЖОҚ. Бұл — таза өлшем мен ресми модель. AI талдауы бөлек
// эндпоинтте (/api/layer-ai) және бөлек батырмамен шақырылады.
//
// Уақыт қатары жоқ қабаттар (мұнай, құрғақшылық) үшін СЕБЕБІ қайтарылады —
// бос орын ойдан толтырылмайды.

export const revalidate = 1800; // 30 минут



interface HourPoint {
  time: string;
  past: boolean;
  values: Record<string, number | null>;
}

const cache = new Map<string, { at: number; data: unknown }>();

export async function GET(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  const layer = LAYER_BY_KEY.get(key as EcoLayer["key"]);
  if (!layer) {
    return NextResponse.json({ error: `Белгісіз қабат: ${key}` }, { status: 404 });
  }

  // Аймақ — таңдалған қаланың координатасы. ҚР-дан тыс аймақта ҚР
  // нормативтері ҚОЛДАНЫЛМАЙДЫ (checkCompliance-ке jurisdiction беріледі).
  const region = getRegion(req.nextUrl.searchParams.get("region"));
  const LAT = region.lat;
  const LNG = region.lng;
  const jurisdiction = region.country === "KZ" ? ("KZ" as const) : ("OTHER" as const);

  const cacheKey = `${key}:${region.id}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < revalidate * 1000) {
    return NextResponse.json(hit.data);
  }

  const origin = new URL(req.url).origin;

  try {
    const [current, series] = await Promise.all([
      fetchCurrent(origin, layer, region.id),
      fetchSeries(layer, region, LAT, LNG),
    ]);

    // --- Заңнамалық сәйкестік ---
    const compliance: (ComplianceResult & { name: string; unit: string })[] = [];
    for (const id of layer.indicatorIds) {
      const ind = INDICATORS.find((i) => i.id === id);
      if (!ind) continue;
      // Мәнді алдымен қабаттың өз жауабынан, болмаса тиісті эндпоинттен іздейміз
      let value: number | null = null;
      if (current.ok && ind.endpoint === layer.currentEndpoint) {
        value = resolvePath(current.data, ind.path);
      } else if (current.extra?.[ind.endpoint]) {
        value = resolvePath(current.extra[ind.endpoint], ind.path);
      }
      compliance.push({ ...checkCompliance(id, value, jurisdiction), name: ind.name, unit: ind.unit });
    }
    const agg = aggregate(compliance);

    const data = {
      key: layer.key,
      name: layer.name,
      emoji: layer.emoji,
      what: layer.what,
      fetchedAt: new Date().toISOString(),
      location: { lat: LAT, lng: LNG, name: region.name, country: region.country, regionId: region.id },

      current: current.ok ? current.data : null,
      currentError: current.ok ? null : current.error,
      // Модуль бұл аймақта жоқ болса — БАСҚА қаланың саны алынбайды.
      // UI «жоқ» деп көрсетеді, себебі осы жерде жазылады.
      moduleMissing: current.missing ?? null,

      series: series.available
        ? {
            available: true as const,
            unit: null,
            vars: layer.vars,
            past24: series.past24,
            next24: series.next24,
            note: series.note ?? null,
          }
        : {
            available: false as const,
            reason: layer.noSeriesReason ?? series.reason ?? "Уақыт қатары қолжетімсіз",
          },

      compliance: {
        results: compliance,
        worst: agg.worst,
        kzViolations: compliance.filter((c) => c.kzViolation).length,
        checked: compliance.length,
      },

      sources: layer.sources,
      // AI мұнда ЖОҚ — бұл өріс UI-ге еске салу үшін
      aiIncluded: false,
      note:
        "Бұл жауапта жасанды интеллект қолданылмаған. Барлық сан — өлшем немесе " +
        "ресми атмосфералық/гидрологиялық модель шығысы.",
    };

    cache.set(cacheKey, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (err) {
    console.error(`layer ${key} error:`, err);
    return NextResponse.json(
      { error: "Қабат деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді" },
      { status: 503 }
    );
  }
}

// ---------------------------------------------------------------------------

async function fetchCurrent(origin: string, layer: EcoLayer, regionId: string) {
  const extra: Record<string, unknown> = {};
  try {
    const q = layer.currentEndpoint.includes("?") ? "&" : "?";
    const res = await fetch(`${origin}${layer.currentEndpoint}${q}region=${regionId}`, { cache: "no-store" });
    const data = res.ok ? await res.json() : null;

    // Эндпоинт «бұл аймақта модуль жоқ» деп қайтарса (200 + available:false)
    // — оны дерек деп қабылдамаймыз.
    const body = data as { available?: boolean; error?: string; reason?: string } | null;
    if (body && body.available === false) {
      return {
        ok: false as const,
        error: body.error ?? "модуль қолжетімсіз",
        missing: { error: body.error ?? "", reason: body.reason ?? "" },
        extra,
      };
    }

    // Қабатта басқа эндпоинттегі көрсеткіштер де болса — соларды да аламыз
    const others = new Set(
      layer.indicatorIds
        .map((id) => INDICATORS.find((i) => i.id === id)?.endpoint)
        .filter((e): e is string => Boolean(e) && e !== layer.currentEndpoint)
    );
    await Promise.all(
      [...others].map(async (ep) => {
        try {
          const eq = ep.includes("?") ? "&" : "?";
          const r = await fetch(`${origin}${ep}${eq}region=${regionId}`, { cache: "no-store" });
          if (r.ok) extra[ep] = await r.json();
        } catch {
          /* қолжетімсіз — сол көрсеткіш «дерек жоқ» болып қалады */
        }
      })
    );

    return res.ok
      ? { ok: true as const, data, extra }
      : { ok: false as const, error: `${layer.currentEndpoint} → ${res.status}`, extra };
  } catch {
    return { ok: false as const, error: "дереккөзге қосылу мүмкін болмады", extra };
  }
}

async function fetchSeries(layer: EcoLayer, region: Region, LAT: number, LNG: number): Promise<
  | { available: true; past24: HourPoint[]; next24: HourPoint[]; note?: string }
  | { available: false; reason: string }
> {
  if (layer.seriesApi === "none" || !layer.vars.length) {
    return { available: false, reason: layer.noSeriesReason ?? "Уақыт қатары қарастырылмаған" };
  }

  // GloFAS ағынды ТЕК нақты өзен арнасында береді. Аймақ орталығының
  // координатасын беру — өзені жоқ жерден «ағын» шығару, яғни жалған сан.
  if (layer.seriesApi === "flood" && !hasModule(region, "riverFlow")) {
    return { available: false, reason: MODULE_REASON.riverFlow };
  }

  const base = SERIES_BASE[layer.seriesApi];
  const varNames = layer.vars.map((v) => v.api);

  // GloFAS тәуліктік — бөлек өңделеді
  if (layer.seriesApi === "flood") {
    const url =
      `${base}?latitude=${LAT}&longitude=${LNG}` +
      `&daily=${varNames.join(",")}&past_days=7&forecast_days=7`;
    const res = await fetch(url, { next: { revalidate } });
    if (!res.ok) return { available: false, reason: `GloFAS → ${res.status}` };
    const j = (await res.json()) as { daily?: Record<string, (number | null)[] | string[]> };
    const times = (j.daily?.time as string[]) ?? [];
    if (!times.length) return { available: false, reason: "GloFAS бос жауап қайтарды" };
    const today = new Date().toISOString().slice(0, 10);
    const pts: HourPoint[] = times.map((t, i) => ({
      time: t,
      past: t < today,
      values: Object.fromEntries(
        varNames.map((v) => [v, ((j.daily?.[v] as (number | null)[]) ?? [])[i] ?? null])
      ),
    }));
    return {
      available: true,
      past24: pts.filter((p) => p.past),
      next24: pts.filter((p) => !p.past),
      note: "GloFAS тәуліктік дәлдікте береді — сағаттық қатар жоқ. Соңғы 7 және алдағы 7 тәулік.",
    };
  }

  const url =
    `${base}?latitude=${LAT}&longitude=${LNG}` +
    `&hourly=${varNames.join(",")}&past_days=1&forecast_days=2&timezone=UTC`;
  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) return { available: false, reason: `Open-Meteo → ${res.status}` };

  const j = (await res.json()) as { hourly?: Record<string, (number | null)[] | string[]> };
  const times = (j.hourly?.time as string[]) ?? [];
  if (!times.length) return { available: false, reason: "Open-Meteo бос жауап қайтарды" };

  const nowMs = Date.now();
  const all: HourPoint[] = times.map((t, i) => {
    const ms = new Date(`${t}Z`).getTime();
    return {
      time: t,
      past: ms <= nowMs,
      values: Object.fromEntries(
        varNames.map((v) => [v, ((j.hourly?.[v] as (number | null)[]) ?? [])[i] ?? null])
      ),
    };
  });

  const past = all.filter((p) => p.past).slice(-24);
  const next = all.filter((p) => !p.past).slice(0, 24);

  if (!past.length && !next.length) {
    return { available: false, reason: "Уақыт аралығында дерек табылмады" };
  }
  return { available: true, past24: past, next24: next };
}
