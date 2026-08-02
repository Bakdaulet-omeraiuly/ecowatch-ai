// ТАСҚЫН ИМПУЛЬСІ (flood pulse) — JAIYQ-MRI моделінің L1 қабаты.
//
// НЕГЕ КЕРЕК:
// JAIYQ-MRI жобасының басты тезисі — Атырауда маса саны ең алдымен
// КӨКТЕМГІ ТАСҚЫН функциясы. Жұмыртқа банкі құрғақ жатады да, су
// БАСҚАНДА жарылады. Яғни модельдің ажыратқышы — су басу оқиғасы.
//
// Бұған дейін кодта `flood` айнымалысы Жайықтың қатып қалған сызығына
// дейінгі ҚАШЫҚТЫҚ қана болатын. Ол «қай жер су басуға бейім» дегенді
// көрсетеді, бірақ «БҮГІН су басты ма» дегенді көрсетпейді — сәуірде де,
// қаңтарда да бірдей сан беретін. Модельдің ең өзгеше бөлігі жұмыс
// істемей тұрған еді.
//
// Енді екеуі бөлінеді:
//   БЕЙІМДІЛІК (susceptibility) — географиядан, тұрақты
//   ИМПУЛЬС     (pulse)          — өлшемнен, уақытпен өзгереді
//   flood = бейімділік × импульс
//
// ДЕРЕККӨЗДЕР (екеуі де жобада бұрыннан бар):
//   🛰 Sentinel-1 SAR — /api/flood-extent → тірек кезеңмен салыстырғандағы
//      АРТЫҚ су ауданы (км² және аймақ ауданының %-ы). Бұл — ӨЛШЕМ.
//   📊 GloFAS — /api/flood → өзен ағынының өз терезесіндегі қатынасы.
//      Бұл — модель, бірақ SAR өтуі болмаған күні де қолжетімді.
//
// ⚠️ АДАЛДЫҚ ЕРЕЖЕЛЕРІ:
//   1. Спутник өтуі болмаса (status ≠ "ok") — ол аймақ үшін SAR импульсі
//      НӨЛ деп алынбайды. Өлшемнің болмауы судың болмауы емес.
//      Сол жағдайда GloFAS-қа шегінеміз.
//   2. Екі дереккөз де қолжетімсіз болса — импульс `null`. Модель ескі
//      режимде (тек бейімділік) жұмыс істейді, бірақ ол жауапта АШЫҚ
//      жазылады. Жасырын деградация болмайды.
//   3. Ешбір сан ойдан жасалмайды.

import { FLOOD_ZONES } from "@/data/floodZones";

/** SAR: аймақ ауданының қанша %-ы су басса — импульс толық (1.0) деп саналады */
const SAR_FULL_PCT = 5;

export interface ZoneHabitat {
  id: string;
  bbox: [number, number, number, number];
  /** 0..1 — қамыс мекенінің қолайлылығы (Sentinel-2 NDVI). null — өлшенбеген */
  reed: number | null;
}

export interface FloodPulse {
  /** 0..1 аймақ бойынша жалпы импульс; null — сигнал жоқ */
  value: number | null;
  source: "sar+glofas" | "sar" | "glofas" | null;
  /**
   * Аймақ ішіндегі бақылау терезелері бойынша импульс + гидропериод.
   * `hydroDays` — су КЕМІНДЕ қанша күн тұрды (S1 өтулері бойынша).
   */
  byZone: {
    id: string;
    bbox: [number, number, number, number];
    pulse: number;
    hydroDays: number | null;
  }[];
  sarPct: number | null;
  sarZonesOk: number;
  glofasRatio: number | null;
  /** L4 — қамыс мекені (Sentinel-2 NDVI), терезе бойынша */
  habitat: ZoneHabitat[];
  reedZonesOk: number;
  /**
   * L2 динамикасы үшін КҮНДІК драйвер қатары (GloFAS, 0..1).
   * 30 күн өткен + 14 күн болжам. Бос болса модель интегралдай алмайды.
   */
  dailyPulse: { date: string; ratio: number }[];
  /** UI-де көрсетілетін қазақша түсіндірме */
  note: string;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

const NO_SIGNAL: FloodPulse = {
  value: null,
  source: null,
  byZone: [],
  sarPct: null,
  sarZonesOk: 0,
  glofasRatio: null,
  habitat: [],
  reedZonesOk: 0,
  dailyPulse: [],
  note:
    "Тасқын сигналы қолжетімсіз (Sentinel-1 де, GloFAS та жауап бермеді). " +
    "Индекс тек жайылмаға жақындық бойынша есептелді — су басу оқиғасы " +
    "ЕСКЕРІЛМЕГЕН. Бұл — модельдің әлсіретілген режимі.",
};

async function getJson(url: string, timeoutMs: number): Promise<Record<string, unknown> | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    if (!res.ok) return null;
    const j = await res.json();
    // «Бұл аймақта модуль жоқ» жауабы — дерек емес
    if (j?.available === false) return null;
    return j;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Аймақ бойынша тасқын импульсін жинау.
 * @param origin сайттың өз origin-і (ішкі эндпоинттерді шақыру үшін)
 */
export async function fetchFloodPulse(origin: string, regionId: string): Promise<FloodPulse> {
  const rq = `?region=${regionId}`;
  // SAR баяу болуы мүмкін (Sentinel Hub статистикалық API) — бірақ оның өз
  // кэші бар. Уақыт шектеуі картаны бөгемеу үшін.
  const [sar, glofas, reed] = await Promise.all([
    getJson(`${origin}/api/flood-extent${rq}`, 8000),
    getJson(`${origin}/api/flood${rq}`, 5000),
    // L4 — қамыс мекені. Кэші 24 сағат, сондықтан әдетте бірден қайтады
    getJson(`${origin}/api/reed-habitat${rq}`, 8000),
  ]);

  // ── Sentinel-2 қамыс мекені ───────────────────────────────────────────
  const habitat: ZoneHabitat[] = [];
  for (const z of (reed?.zones ?? []) as {
    id: string; status: string; suitability: number | null;
  }[]) {
    if (z.status !== "ok" || z.suitability == null) continue;
    const def = FLOOD_ZONES.find((f) => f.id === z.id);
    if (!def) continue;
    habitat.push({ id: z.id, bbox: def.bbox, reed: z.suitability });
  }

  // ── Sentinel-1 SAR ────────────────────────────────────────────────────
  const byZone: FloodPulse["byZone"] = [];
  let sarPct: number | null = null;
  const zones = (sar?.zones ?? []) as {
    id: string; status: string; floodedPctOfZone: number | null;
    hydroperiodDays: number | null;
  }[];
  for (const z of zones) {
    // Тек өлшенген аймақтар. "no-data"/"no-baseline" → импульс НӨЛ емес,
    // белгісіз: сол терезе GloFAS-пен есептеледі.
    if (z.status !== "ok" || z.floodedPctOfZone == null) continue;
    const def = FLOOD_ZONES.find((f) => f.id === z.id);
    if (!def) continue;
    const pulse = clamp01(z.floodedPctOfZone / SAR_FULL_PCT);
    byZone.push({ id: z.id, bbox: def.bbox, pulse, hydroDays: z.hydroperiodDays ?? null });
    sarPct = Math.max(sarPct ?? 0, z.floodedPctOfZone);
  }

  // ── GloFAS ────────────────────────────────────────────────────────────
  const dailyPulse = (glofas?.dailyPulse ?? []) as { date: string; ratio: number }[];
  const points = (glofas?.points ?? []) as { ratio: number }[];
  const ratios = points.map((p) => p.ratio).filter((r): r is number => Number.isFinite(r));
  const glofasRatio = ratios.length ? Math.max(...ratios) : null;

  const hasSar = byZone.length > 0;
  const hasGlofas = glofasRatio != null;
  if (!hasSar && !hasGlofas) {
    return { ...NO_SIGNAL, habitat, reedZonesOk: habitat.length, dailyPulse };
  }

  // Аймақ бойынша жалпы импульс.
  // SAR — өлшем, сондықтан салмағы басым. GloFAS оны толықтырады
  // (радар өтуі болмаған терезелер үшін).
  const sarValue = hasSar ? Math.max(...byZone.map((z) => z.pulse)) : null;
  let value: number;
  let source: FloodPulse["source"];
  if (sarValue != null && glofasRatio != null) {
    value = clamp01(0.65 * sarValue + 0.35 * glofasRatio);
    source = "sar+glofas";
  } else if (sarValue != null) {
    value = sarValue;
    source = "sar";
  } else {
    value = clamp01(glofasRatio!);
    source = "glofas";
  }

  const parts: string[] = [];
  if (hasSar) {
    const hd = byZone.map((z) => z.hydroDays).filter((d): d is number => d != null);
    parts.push(
      `🛰 Sentinel-1: ${byZone.length} бақылау терезесінде су өлшенді, ` +
        `ең жоғарысы аймақ ауданының ${sarPct!.toFixed(1)}%-ы` +
        (hd.length ? `; су кемінде ${Math.max(...hd)} күн тұр` : "")
    );
  }
  if (hasGlofas) {
    parts.push(`📊 GloFAS: өзен ағыны өз терезесінің ${Math.round(glofasRatio! * 100)}%-ында`);
  }
  if (habitat.length) {
    const best = Math.max(...habitat.map((h) => h.reed ?? 0));
    parts.push(
      `🛰 Sentinel-2: қамыс мекені ${habitat.length} терезеде өлшенді, ` +
        `ең тығызы ${Math.round(best * 100)}%`
    );
  }

  return {
    value: +value.toFixed(3),
    source,
    byZone,
    sarPct,
    sarZonesOk: byZone.length,
    glofasRatio: glofasRatio != null ? +glofasRatio.toFixed(3) : null,
    habitat,
    reedZonesOk: habitat.length,
    dailyPulse,
    note:
      parts.join(" · ") +
      ". Су басу жұмыртқа банкінің жарылуын іске қосады — импульс жоғары болса " +
      "жайылмадағы индекс те көтеріледі.",
  };
}

/** Нүкте қай бақылау терезесінің ішінде — сол терезені қайтарады */
function zoneAt(p: FloodPulse, lat: number, lng: number) {
  for (const z of p.byZone) {
    const [w, s, e, n] = z.bbox;
    if (lng >= w && lng <= e && lat >= s && lat <= n) return z;
  }
  return null;
}

/**
 * Нақты нүкте үшін импульс.
 *
 * Нүкте өлшенген бақылау терезесінің ішінде болса — сол терезенің
 * ӨЛШЕНГЕН мәні алынады (жергілікті дәлдік). Әйтпесе аймақтық мән.
 */
export function pulseAt(p: FloodPulse, lat: number, lng: number): number | null {
  if (p.value == null) return null;
  return zoneAt(p, lat, lng)?.pulse ?? p.value;
}

/**
 * Нүктедегі гидропериод (күн) — су кемінде қанша күн тұрды.
 * Тек ӨЛШЕНГЕН терезелерде болады; басқа жерде null (жуықталмайды).
 */
export function hydroDaysAt(p: FloodPulse, lat: number, lng: number): number | null {
  return zoneAt(p, lat, lng)?.hydroDays ?? null;
}

/**
 * Нүктедегі қамыс мекенінің қолайлылығы (0..1).
 * Өлшенбеген жерде null — жуықталмайды.
 */
export function reedAt(p: FloodPulse, lat: number, lng: number): number | null {
  for (const h of p.habitat) {
    const [w, s, e, n] = h.bbox;
    if (lng >= w && lng <= e && lat >= s && lat <= n) return h.reed;
  }
  return null;
}
