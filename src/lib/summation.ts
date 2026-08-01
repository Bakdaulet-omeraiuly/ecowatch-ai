// ЖИНАҚТАЛУ (СУММАЦИЯ) ӘСЕРІН ЕСЕПТЕУ.
//
// Заңдық негізі: ҚР ДСМ-70 бұйрығына 1-қосымша, 3-кесте
// (ҚР ДСМ 2025 ж. 18 ақпандағы № 10 бұйрығымен енгізілген, тіркеу № 35741).
//
//     Σ (Cᵢ / ШРКᵢ)  ≤  1
//
// Бұл — жүйенің ең өзгеше мүмкіндігі. Әр зат ЖЕКЕ-ЖЕКЕ норма шегінде тұрып,
// бірге алғанда норманы БҰЗУЫ мүмкін. Мысалы: NO₂ = 0.6 ШРК, SO₂ = 0.6 ШРК —
// екеуі де «жасыл», ал қосындысы 1.2 > 1 → бұзушылық.
//
// ⚠️ РАСТАУ ЕРЕЖЕСІ САҚТАЛАДЫ: қосындыға кіретін заттардың біреуінің ШРК
// шамасы бастапқы актіден расталмаған болса, қорытынды да «алдын ала белгі»
// болып қалады. Расталмаған санға сүйеніп «заң бұзылды» деу — жарамсыз.

import { NORMS } from "@/data/legalNorms";
import {
  DOMINANCE_LIMITS, SUBSTANCES, SUMMATION_GROUPS, SUMMATION_SOURCE,
  type SubstanceId, type SummationGroup,
} from "@/data/summationGroups";
import type { ComplianceLevel } from "@/lib/compliance";

export interface SummationComponent {
  id: SubstanceId;
  name: string;
  /** Өлшенген мән (µg/m³) — жүйеде жоқ болса null */
  value: number | null;
  /** Қолданылған ШРК (максималды бір реттік) */
  limit: number | null;
  /** Cᵢ / ШРКᵢ */
  ratio: number | null;
  /** ШРК бастапқы актіден расталған ба */
  normVerified: boolean;
  /** Неге есептелмегені */
  missingReason?: string;
}

export interface SummationResult {
  groupNo: number;
  components: SummationComponent[];
  /** Барлық компонент өлшенді ме — толық емес қосынды заңдық тұжырым бермейді */
  complete: boolean;
  /** Есептелген қосынды (толық болса) */
  sum: number | null;
  /** Барлық ШРК расталған ба */
  allNormsVerified: boolean;
  /** Үстемдік ережесі бойынша есептен шығарылды ма */
  excludedByDominance: boolean;
  dominanceNote?: string;
  level: ComplianceLevel;
  summary: string;
}

/** Заттың максималды бір реттік ҚР ШРК-сын табу */
function kzMaxSingle(id: SubstanceId): { limit: number; verified: boolean } | null {
  const n = NORMS.find(
    (x) => x.indicatorId === id && x.actId === "kzAir" && x.averaging === "max-single"
  );
  return n ? { limit: n.limit, verified: n.status === "verified" } : null;
}

/**
 * Бір топты бағалау.
 * @param values өлшенген мәндер: { no2: 45, so2: 12, ... }
 */
export function evaluateGroup(
  group: SummationGroup,
  values: Partial<Record<SubstanceId, number | null>>
): SummationResult {
  const components: SummationComponent[] = group.substances.map((id) => {
    const sub = SUBSTANCES[id];
    const norm = kzMaxSingle(id);
    const value = sub.measured ? (values[id] ?? null) : null;

    return {
      id,
      name: sub.name,
      value,
      limit: norm?.limit ?? null,
      ratio: value != null && norm ? value / norm.limit : null,
      normVerified: norm?.verified ?? false,
      missingReason: !sub.measured
        ? (sub.measuredNote ?? "жүйеде өлшенбейді")
        : value == null
          ? "дерек қолжетімсіз"
          : !norm
            ? "ШРК тізілімде жоқ"
            : undefined,
    };
  });

  const complete = components.every((c) => c.ratio != null);
  const allNormsVerified = components.every((c) => c.normVerified);

  if (group.mode === "independent") {
    return {
      groupNo: group.no, components, complete: false, sum: null,
      allNormsVerified, excludedByDominance: false,
      level: "unknown",
      summary:
        "Бұл топта жинақталу әсері жоқ — әр заттың жеке ШРК-сы сақталады " +
        (group.modeNote ? `(${group.modeNote})` : ""),
    };
  }

  if (!complete) {
    const missing = components.filter((c) => c.ratio == null).map((c) => c.name);
    return {
      groupNo: group.no, components, complete: false, sum: null,
      allNormsVerified, excludedByDominance: false,
      level: "unknown",
      summary:
        `Қосынды есептелмеді — ${missing.length} компонент өлшенбейді: ${missing.join(", ")}. ` +
        "Толық бағалау үшін жер бетіндегі зертханалық өлшем қажет.",
    };
  }

  const ratios = components.map((c) => c.ratio!);
  const sumRaw = ratios.reduce((a, b) => a + b, 0);
  const sum = Math.round(sumRaw * 100) / 100;

  // Үстемдік ережесі: құрамында NO₂ және/немесе H₂S бар 2–4 компоненттік
  // қоспаларда бір компоненттің үлесі шектен асса — жинақталу есепке алынбайды
  const n = components.length;
  const hasTrigger = group.substances.includes("no2") || group.substances.includes("h2s");
  const domLimit = DOMINANCE_LIMITS[n];
  let excludedByDominance = false;
  let dominanceNote: string | undefined;

  if (hasTrigger && domLimit != null) {
    const maxRatio = Math.max(...ratios);
    const share = maxRatio / sumRaw;
    if (share > domLimit) {
      excludedByDominance = true;
      const dominant = components[ratios.indexOf(maxRatio)];
      dominanceNote =
        `${dominant.name} үлесі ${Math.round(share * 100)}% — ` +
        `${n} компоненттік қоспа үшін ${Math.round(domLimit * 100)}% шегінен асады. ` +
        "Бұйрық ережесі бойынша жинақталу әсері есепке алынбайды.";
    }
  }

  if (excludedByDominance) {
    return {
      groupNo: group.no, components, complete: true, sum,
      allNormsVerified, excludedByDominance: true, dominanceNote,
      level: "ok",
      summary: `Қосынды ${sum}, бірақ үстемдік ережесі қолданылады — бұзушылық емес`,
    };
  }

  const coef = group.mixCoefficient ?? 1;
  const adjusted = Math.round((sumRaw / coef) * 100) / 100;

  let level: ComplianceLevel;
  if (adjusted > 1) level = allNormsVerified ? "exceeded" : "exceeded-unverified";
  else if (adjusted >= 0.8) level = "approaching";
  else level = "ok";

  const summary =
    adjusted > 1
      ? `Қосынды ${adjusted} > 1 — жинақталу әсері бойынша норма асқан` +
        (allNormsVerified ? "" : " (ШРК-лары расталмаған — алдын ала белгі)")
      : adjusted >= 0.8
        ? `Қосынды ${adjusted} — шекке жақын (1-ден аспауы керек)`
        : `Қосынды ${adjusted} — норма шегінде`;

  return {
    groupNo: group.no, components, complete: true, sum: adjusted,
    allNormsVerified, excludedByDominance: false,
    level, summary,
  };
}

/** Барлық топты бағалау — есептелетіндері бірінші тұрады */
export function evaluateAllGroups(
  values: Partial<Record<SubstanceId, number | null>>
): {
  results: SummationResult[];
  computable: number;
  violations: number;
  source: typeof SUMMATION_SOURCE;
} {
  const results = SUMMATION_GROUPS.map((g) => evaluateGroup(g, values)).sort((a, b) => {
    if (a.complete !== b.complete) return a.complete ? -1 : 1;
    return (b.sum ?? 0) - (a.sum ?? 0);
  });

  return {
    results,
    computable: results.filter((r) => r.complete).length,
    violations: results.filter((r) => r.level === "exceeded").length,
    source: SUMMATION_SOURCE,
  };
}
