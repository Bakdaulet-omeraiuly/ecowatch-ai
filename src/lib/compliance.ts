// Заңнамалық сәйкестікті бағалау қозғалтқышы.
//
// Кіріс: өлшенген/есептелген мән + индикатор идентификаторы.
// Шығыс: әр норма бойынша күй + жалпы қорытынды.
//
// ЕҢ МАҢЫЗДЫ ЕРЕЖЕ: бастапқы құқықтық актіден расталмаған норма бойынша
// «заң бұзылды» деген тұжырым ШЫҒАРЫЛМАЙДЫ. Ондай норма тек «алдын ала
// белгі» деңгейінде қалады. Себебі жаңылыс шек бойынша шығарылған тұжырым
// прокуратура үшін де, кәсіпорын үшін де әділетсіз болар еді.

import {
  ACTS, AVERAGING_KZ, LEGAL_DISCLAIMER, normsFor,
  type LegalAct, type LegalNorm,
} from "@/data/legalNorms";

export type ComplianceLevel =
  | "ok" // нормадан төмен
  | "approaching" // нормаға жақындады (≥80%)
  | "exceeded" // расталған норма асқан — заңдық белгі
  | "exceeded-unverified" // норма асқан, бірақ шек расталмаған — алдын ала белгі
  | "unknown"; // дерек жоқ

export interface NormCheck {
  norm: LegalNorm;
  act: LegalAct;
  averagingKz: string;
  ratio: number; // мән / шек
  level: ComplianceLevel;
  /** Асу еселігі — «ШРК-дан 2.4 есе жоғары» деп жазу үшін */
  timesOver: number | null;
}

export interface ComplianceResult {
  indicatorId: string;
  value: number | null;
  checks: NormCheck[];
  /** Ең ауыр күй */
  worst: ComplianceLevel;
  /** ҚР заңнамасы бойынша расталған асу бар ма — дашбордтағы ескерту осыған сүйенеді */
  kzViolation: boolean;
  /** Қысқа қазақша тұжырым */
  summary: string;
  disclaimer: string;
}

const SEVERITY: Record<ComplianceLevel, number> = {
  unknown: 0,
  ok: 1,
  approaching: 2,
  "exceeded-unverified": 3,
  exceeded: 4,
};

export const LEVEL_KZ: Record<ComplianceLevel, string> = {
  ok: "норма шегінде",
  approaching: "нормаға жақындады",
  exceeded: "НОРМА АСҚАН",
  "exceeded-unverified": "норма асқан (шек расталмаған)",
  unknown: "дерек жоқ",
};

/** Түс кодтары — ақ/жасыл қалыпты, сары ескерту, қызыл заң бұзушылық. */
export const LEVEL_COLOR: Record<ComplianceLevel, string> = {
  ok: "text-emerald-300 border-emerald-400/30 bg-emerald-500/10",
  approaching: "text-amber-300 border-amber-400/30 bg-amber-500/10",
  exceeded: "text-red-300 border-red-400/40 bg-red-500/15",
  "exceeded-unverified": "text-orange-300 border-orange-400/30 bg-orange-500/10",
  unknown: "text-neutral-400 border-white/10 bg-white/5",
};

/**
 * ДЕҢГЕЙЛЕРДІҢ МАҒЫНАСЫ — түсті белгі не білдіретіні.
 *
 * Пайдаланушы «сары» мен «қызылдың» айырмасын болжап отырмауы керек:
 * әр деңгейдің нақты анықтамасы мен ҚОЛДАНЫСЫ жазылады. Әсіресе
 * «расталмаған» деңгей маңызды — ол заңдық тұжырым ЕМЕС.
 */
export const LEVEL_MEANING: Record<ComplianceLevel, { short: string; full: string; action: string }> = {
  ok: {
    short: "норма шегінде",
    full: "Өлшенген мән қолданыстағы шектен төмен (шектің 80%-ынан аз).",
    action: "Әрекет қажет емес — бақылау жалғасады.",
  },
  approaching: {
    short: "нормаға жақындады",
    full: "Мән шектің 80%-ынан асты, бірақ әлі аспады. Ауа райы нашарласа (жел басылса, инверсия болса) шектен шығуы мүмкін.",
    action: "Назарда ұстау. Сезімтал топтарға (балалар, егде адамдар, тыныс алу ауруы барлар) ескерту берген жөн.",
  },
  exceeded: {
    short: "НОРМА АСҚАН",
    full: "Мән РАСТАЛҒАН нормативтік шектен асты. Норманың мәтіні бастапқы актімен тексерілген.",
    action: "Тексеру тағайындауға негіз бар. Бірақ спутник/модель дерегі өз алдына сот дәлелі емес — жердегі аспаптық өлшеммен расталуы тиіс.",
  },
  "exceeded-unverified": {
    short: "норма асқан (шек расталмаған)",
    full: "Мән жүйедегі шектен асты, БІРАҚ сол шектің саны бастапқы құқықтық актімен әлі тексерілмеген.",
    action: "Тек АЛДЫН АЛА белгі. «Заң бұзылды» деген тұжырым ШЫҒАРЫЛМАЙДЫ — алдымен норманың мәтінін растау қажет.",
  },
  unknown: {
    short: "дерек жоқ",
    full: "Көрсеткіш өлшенбеді немесе дереккөз қолжетімсіз болды.",
    action: "Бос орын болжаммен толтырылмайды. «Дерек жоқ» — «бәрі тыныш» дегенді БІЛДІРМЕЙДІ.",
  },
};

/** Нормаға жақындау шегі — шектің 80%-ы. */
const APPROACHING = 0.8;

/**
 * @param jurisdiction Аймақтың мемлекеті. ҚР нормативтері ТЕК Қазақстанда
 *   қолданылады — Баку, Астрахань, Түрікменбашы үшін ҚР ШРК-мен салыстыру
 *   заңсыз әрі мағынасыз болар еді. ҚР-дан тыс жерде тек WHO эталоны
 *   қолданылады (заңдық күші жоқ, бірақ жаһандық денсаулық нұсқаулығы).
 */
export function checkCompliance(
  indicatorId: string,
  value: number | null,
  jurisdiction: "KZ" | "OTHER" = "KZ"
): ComplianceResult {
  const all = normsFor(indicatorId);
  // ҚР-дан тыс аймақта ұлттық нормативтер алынып тасталады
  const norms = jurisdiction === "KZ" ? all : all.filter((n) => ACTS[n.actId].jurisdiction !== "KZ");

  if (value == null || !norms.length) {
    return {
      indicatorId,
      value,
      checks: [],
      worst: "unknown",
      kzViolation: false,
      summary:
        value == null
          ? "Дерек жоқ — бағалау жүргізілмеді"
          : jurisdiction !== "KZ"
            ? "Бұл ел үшін тізілімде норматив жоқ — ҚР ШРК қолданылмайды"
            : "Бұл көрсеткіш үшін норма тізілімде жоқ",
      disclaimer: LEGAL_DISCLAIMER,
    };
  }

  const checks: NormCheck[] = norms.map((norm) => {
    const act = ACTS[norm.actId];
    const ratio = value / norm.limit;
    let level: ComplianceLevel;
    if (ratio > 1) {
      // Расталмаған шек бойынша заңдық тұжырым шығармаймыз
      level = norm.status === "verified" ? "exceeded" : "exceeded-unverified";
    } else if (ratio >= APPROACHING) {
      level = "approaching";
    } else {
      level = "ok";
    }
    return {
      norm,
      act,
      averagingKz: AVERAGING_KZ[norm.averaging],
      ratio,
      level,
      timesOver: ratio > 1 ? Math.round(ratio * 10) / 10 : null,
    };
  });

  const worst = checks.reduce<ComplianceLevel>(
    (acc, c) => (SEVERITY[c.level] > SEVERITY[acc] ? c.level : acc),
    "ok"
  );

  const kzViolation =
    jurisdiction === "KZ" &&
    checks.some((c) => c.level === "exceeded" && c.act.jurisdiction === "KZ");

  return {
    indicatorId,
    value,
    checks,
    worst,
    kzViolation,
    summary: buildSummary(checks, worst),
    disclaimer: LEGAL_DISCLAIMER,
  };
}

function buildSummary(checks: NormCheck[], worst: ComplianceLevel): string {
  const over = checks
    .filter((c) => c.level === "exceeded" || c.level === "exceeded-unverified")
    .sort((a, b) => b.ratio - a.ratio);

  if (!over.length) {
    if (worst === "approaching") {
      const near = checks.filter((c) => c.level === "approaching")[0];
      return `Барлық норма шегінде, бірақ ${near.act.jurisdiction === "KZ" ? "ҚР" : near.act.jurisdiction} ${near.averagingKz} шегінің ${Math.round(near.ratio * 100)}%-на жетті`;
    }
    return "Барлық норма шегінде";
  }

  const top = over[0];
  const jur = top.act.jurisdiction === "KZ" ? "ҚР" : top.act.jurisdiction;
  const base = `${jur} ${top.averagingKz} шегінен ${top.timesOver} есе жоғары`;
  return top.level === "exceeded"
    ? `${base} — заңнамалық шек асқан`
    : `${base} — шек бастапқы актіден расталмаған, алдын ала белгі`;
}

/** Бірнеше көрсеткіштің жиынтық күйі — қабат/аймақ ескертуі үшін. */
export function aggregate(results: ComplianceResult[]): {
  worst: ComplianceLevel;
  violations: ComplianceResult[];
  warnings: ComplianceResult[];
} {
  const worst = results.reduce<ComplianceLevel>(
    (acc, r) => (SEVERITY[r.worst] > SEVERITY[acc] ? r.worst : acc),
    "unknown"
  );
  return {
    worst,
    violations: results.filter((r) => r.worst === "exceeded"),
    warnings: results.filter(
      (r) => r.worst === "exceeded-unverified" || r.worst === "approaching"
    ),
  };
}
