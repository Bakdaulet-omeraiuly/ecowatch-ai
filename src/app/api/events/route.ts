import { NextResponse } from "next/server";
import { ECO_LAYERS } from "@/data/ecoLayers";
import { LEGAL_DISCLAIMER } from "@/data/legalNorms";
import type { ComplianceLevel } from "@/lib/compliance";
import { getRegion, hasModule, missingModules, MODULE_KZ } from "@/data/regions";

// ОҚИҒАЛАР ТАСПАСЫ (Environmental Event Feed)
//
// Оқиға — бұл ЖАҢАЛЫҚ ЕМЕС, нақты дерек нүктесі. Әр оқиға:
//   · нақты уақыты (дереккөздің өз уақыты, біздің ойлап тапқанымыз емес)
//   · нақты саны және өлшем бірлігі
//   · дереккөзі және қай қабатқа қатысты екені
//   · ауырлық деңгейі — заңнамалық нормаға сүйеніп
//
// ЖАЛҒАН ОҚИҒА ЖАСАЛМАЙДЫ. Дереккөз қолжетімсіз болса — сол тектегі
// оқиға тізімде мүлдем болмайды. «Мониторинг жаңартылды» деген бос
// жазба да қосылмайды: ол ақпарат емес.

export const revalidate = 900; // 15 минут

export type Severity = "critical" | "warning" | "notice" | "info";

export interface EcoEvent {
  id: string;
  /** Оқиға болған нақты уақыт (ISO, UTC) */
  time: string;
  severity: Severity;
  layer: string;
  layerEmoji: string;
  title: string;
  /** Нақты сан — оқиғаның негізі */
  value: string | null;
  detail: string;
  source: string;
  /** Заңнамалық негізі болса */
  legal?: string;
  /** Оқиға тіркелген координата (болса) */
  coords?: [number, number];
}

const SEV_ORDER: Record<Severity, number> = { critical: 0, warning: 1, notice: 2, info: 3 };

const LAYER_META = new Map(ECO_LAYERS.map((l) => [l.key, l]));

function meta(key: string) {
  const l = LAYER_META.get(key as never);
  return { layer: l?.name ?? key, layerEmoji: l?.emoji ?? "•" };
}

const cache = new Map<string, { at: number; data: unknown }>();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const region = getRegion(url.searchParams.get("region"));

  const hit = cache.get(region.id);
  if (hit && Date.now() - hit.at < revalidate * 1000) {
    return NextResponse.json(hit.data);
  }

  const origin = url.origin;
  const events: EcoEvent[] = [];
  const failed: string[] = [];

  const get = async (path: string) => {
    try {
      const r = await fetch(`${origin}${path}`, { cache: "no-store" });
      if (!r.ok) {
        failed.push(path);
        return null;
      }
      return await r.json();
    } catch {
      failed.push(path);
      return null;
    }
  };

  const rq = `?region=${region.id}`;
  const [compliance, flares, flood, mosquito] = await Promise.all([
    get(`/api/compliance${rq}`),
    get(`/api/flares${rq}`),
    // Су басқан аумақ тек тізілімі бар аймақта өлшенеді — басқа қалада
    // Атыраудың терезелері сұралмайды
    hasModule(region, "floodExtent") ? get(`/api/flood-extent${rq}`) : null,
    get(`/api/mosquitogrid${rq}`),
  ]);

  // ---------- 1. Заңнамалық асулар ----------
  if (compliance?.results) {
    type R = {
      indicatorId: string; name: string; unit: string; value: number | null;
      worst: ComplianceLevel; kzViolation: boolean; summary: string; section: string;
      fetchedAt?: string;
      checks: { act: { jurisdiction: string; number: string }; averagingKz: string; timesOver: number | null; level: ComplianceLevel }[];
    };
    for (const r of compliance.results as R[]) {
      if (r.value == null) continue;
      if (r.worst === "ok") continue;

      const worstCheck = r.checks
        .filter((c) => c.level === "exceeded" || c.level === "exceeded-unverified")
        .sort((a, b) => (b.timesOver ?? 0) - (a.timesOver ?? 0))[0];

      const severity: Severity =
        r.worst === "exceeded" ? "critical" : r.worst === "exceeded-unverified" ? "warning" : "notice";

      const m = meta(sectionToLayer(r.section));
      events.push({
        id: `norm-${r.indicatorId}`,
        time: r.fetchedAt ?? compliance.fetchedAt,
        severity,
        ...m,
        title:
          r.worst === "approaching"
            ? `${r.name} нормаға жақындады`
            : `${r.name} нормадан асты`,
        value: `${r.value} ${r.unit}`,
        detail: r.summary,
        source: "Copernicus CAMS (Open-Meteo арқылы)",
        legal: worstCheck
          ? `${worstCheck.act.jurisdiction === "KZ" ? "ҚР" : worstCheck.act.jurisdiction} ${worstCheck.act.number} · ${worstCheck.averagingKz}`
          : undefined,
      });
    }
  }

  // ---------- 2. Жылу аномалиялары (нақты детекциялар) ----------
  if (flares?.flares?.length) {
    type F = { lat: number; lng: number; frp: number; brightness: number; acqDate: string; confidence: string; dayNight: string };
    const list = (flares.flares as F[])
      .slice()
      .sort((a, b) => (b.frp ?? 0) - (a.frp ?? 0))
      .slice(0, 8);
    const m = meta("oil");
    for (const f of list) {
      events.push({
        id: `flare-${f.lat.toFixed(3)}-${f.lng.toFixed(3)}-${f.acqDate}`,
        time: new Date(f.acqDate).toISOString(),
        severity: f.frp >= 20 ? "warning" : "notice",
        ...m,
        title: "Жылу аномалиясы тіркелді",
        value: `FRP ${Math.round(f.frp)} МВт`,
        detail:
          `Координата ${f.lat.toFixed(4)}, ${f.lng.toFixed(4)} · сенімділік: ${f.confidence} · ` +
          `${f.dayNight === "N" ? "түнгі" : "күндізгі"} өту. ` +
          "Газ факелі мен дала өртін VIIRS ажыратпайды — жердегі тексеру қажет.",
        source: "NASA FIRMS · VIIRS SNPP",
        coords: [f.lat, f.lng],
      });
    }
  }

  // ---------- 3. Су басқан аумақ ----------
  if (flood?.zones) {
    type Z = { id: string; name: string; floodedKm2: number | null; zoneAreaKm2: number; latestDate: string | null; floodedPctOfZone: number | null; status: string };
    const m = meta("water");
    for (const z of (flood.zones as Z[]).filter((z) => z.status === "ok" && (z.floodedKm2 ?? 0) > 1)) {
      events.push({
        id: `flood-${z.id}-${z.latestDate}`,
        time: z.latestDate ? `${z.latestDate}T00:00:00Z` : flood.fetchedAt,
        severity: (z.floodedPctOfZone ?? 0) > 5 ? "warning" : "notice",
        ...m,
        title: `${z.name}: су басқан аумақ анықталды`,
        value: `${z.floodedKm2} км²`,
        detail:
          `Аймақ ауданының ${z.floodedPctOfZone}%-ы. Тірек кезеңмен салыстырғандағы артық су. ` +
          "Sentinel-1 радары бұлт арқылы өлшейді.",
        source: "Copernicus Sentinel-1 SAR",
      });
    }
  }

  // ---------- 4. Маса индексі ----------
  if (typeof mosquito?.avgIndex === "number") {
    const m = meta("mosquito");
    const idx = mosquito.avgIndex as number;
    if (idx >= 50) {
      events.push({
        id: `mri-${mosquito.fetchedAt?.slice(0, 13) ?? "now"}`,
        time: mosquito.fetchedAt ?? new Date().toISOString(),
        severity: idx >= 70 ? "warning" : "notice",
        ...m,
        title: "Маса белсенділігіне қолайлы жағдай",
        value: `MRI ${idx}/100`,
        detail:
          `${region.name} бойынша орташа индекс. Ең жоғары нүкте: ${mosquito.maxIndex ?? "—"}. ` +
          "Бұл — климаттық қолайлылық көрсеткіші, маса саны емес. " +
          (mosquito.amplificationNote ?? ""),
        source: "JAIYQ-MRI · Open-Meteo",
      });
    }
  }

  events.sort((a, b) => {
    const s = SEV_ORDER[a.severity] - SEV_ORDER[b.severity];
    return s !== 0 ? s : b.time.localeCompare(a.time);
  });

  const missing = missingModules(region);

  const data = {
    fetchedAt: new Date().toISOString(),
    region: { id: region.id, name: region.name },
    count: events.length,
    bySeverity: {
      critical: events.filter((e) => e.severity === "critical").length,
      warning: events.filter((e) => e.severity === "warning").length,
      notice: events.filter((e) => e.severity === "notice").length,
    },
    events,
    /** Қолжетімсіз дереккөздер — ашық көрсетеміз, оқиға жоқтығы «тыныш» дегенді білдірмейді */
    unavailable: failed,
    /** Бұл аймақта МОДУЛЬ ретінде жоқ бөліктер — сондықтан оқиға да шықпайды */
    missingModules: missing.map((m) => ({ key: m, name: MODULE_KZ[m] })),
    disclaimer: LEGAL_DISCLAIMER,
    note:
      "Әр оқиға — нақты дерек нүктесі, жаңалық емес. Дереккөз қолжетімсіз болса " +
      "сол тектегі оқиға тізімде БОЛМАЙДЫ — бұл «бәрі тыныш» дегенді білдірмейді. " +
      (missing.length
        ? `${region.name} үшін әлі жоқ модульдер: ${missing.map((m) => MODULE_KZ[m]).join(", ")}.`
        : ""),
  };

  cache.set(region.id, { at: Date.now(), data });
  return NextResponse.json(data);
}

/** indicatorRegistry бөлімін эко-қабат кілтіне сәйкестендіру */
function sectionToLayer(section: string): string {
  switch (section) {
    case "Ауа сапасы": return "air";
    case "Су режимі": return "water";
    case "Өрт қаупі": return "fire";
    case "Құрғақшылық": return "drought";
    case "Биологиялық қауіп": return "mosquito";
    default: return "air";
  }
}
