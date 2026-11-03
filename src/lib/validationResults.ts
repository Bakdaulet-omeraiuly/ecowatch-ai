// Валидация нәтижелері — validation/*/results.json файлдарын ОҚИДЫ (жазбайды).
//
// Әр модуль мен әр газ ЖЕКЕ тармақ. Шектер (THRESHOLDS) validation/*/PROTOCOL.md-ден
// көшірілген: нәтижеге дейін бекітілген шек. Оны тек протоколда өзгерту керек;
// validationResults.test.ts протоколда осы жолдардың бар екенін тексереді.
//
// ЕРЕЖЕ: нәтижесі жоқ немесе салыстыруға болмайтын көрсеткіш «0%» емес, «—» болып
// көрінеді. Мәтіндер — i18n кілттері (val.*), сөздігі src/lib/i18n.tsx-те.

import air from "../../validation/air/results.json";
import kazhydromet from "../../validation/kazhydromet/results.json";
import s5p from "../../validation/s5p/results.json";
import firms from "../../validation/firms/results.json";
import { KZH_PERIOD } from "../data/kazhydrometAtyrau";

export type CheckStatus = "passed" | "failed" | "descriptive" | "not-comparable";

export interface ValidationMetric {
  /** Техникалық белгі (n, NMB, NME, r, POD, FAR) немесе i18n кілті (val.m.*) */
  label: string;
  /** Пішімделген мән */
  value: string;
  /** Протоколдан көшірілген шек (THRESHOLDS); шек жоқ болса null */
  threshold: string | null;
  /** Шек мәтіні протоколдан сөзбе-сөз (қазақша) болса — көрсету үшін аударма кілті */
  thresholdKey?: string;
  /** true — шекке жетті, false — жетпеді, null — шек жоқ (сипаттама) */
  pass: boolean | null;
  /** Air деңгейі: goal (мақсат) / criteria (тек критерий) / fail */
  level?: "goal" | "criteria" | "fail";
}

export interface ValidationCheck {
  id: string;
  /** i18n кілті — тексеру атауы */
  titleKey: string;
  /** Газ / көрсеткіш белгісі (техникалық, аударылмайды); children үшін бос */
  pollutant: string;
  methodKey?: string;
  referenceKey?: string;
  period: string;
  n: number | null;
  nmb: number | null;
  nme: number | null;
  r: number | null;
  metrics: ValidationMetric[];
  status: CheckStatus;
  /** Жалпы өту: passed → true, failed → false, басқасы → null */
  pass: boolean | null;
  noteKeys: string[];
  knownErrorKeys: string[];
  gapKeys: string[];
  /** Хаттама нұсқасы (results.json-дан) және файл жолдары */
  protocol: string;
  generatedAt: string;
  protocolPath: string;
  resultsPath: string;
  children?: ValidationCheck[];
}

export interface NotYetValidated {
  /** i18n кілті */
  name: string;
  /** i18n кілті */
  reference: string;
}

// ── Шектер: protocol-дан дәлме-дәл көшірілген (parity тесті тексереді) ──
export const THRESHOLDS = {
  // validation/air/PROTOCOL.md §5 (PM₂.₅, 24 сағаттық)
  airNmbGoal: "< ±10%",
  airNmbCriteria: "< ±30%",
  airNmeGoal: "< 35%",
  airNmeCriteria: "< 50%",
  airRGoal: "> 0.70",
  airRCriteria: "> 0.40",
  // validation/air/PROTOCOL.md §6 (норма асу скринингі)
  airPod: "POD ≥ 0.5",
  airFar: "FAR ≤ 0.5",
  // validation/kazhydromet/PROTOCOL.md §4
  kzNmb: "|NMB| < 30%",
  kzNme: "NME < 50%",
  // validation/s5p/PROTOCOL.md §4 (H3/H4)
  s5pDelta: "Δ > 0",
  s5pCi: "95% СА төменгі шегі > 0",
  s5pDays: "жарамды күн ≥ 100",
  // validation/firms/PROTOCOL.md §4 (H1/H2)
  firmsDays: "≥ 12",
  firmsDensity: "≥ 10",
  firmsPrecision: "≥ 0.80",
} as const;

// ── Сандық шектер: логика осыларды пайдаланады. THRESHOLDS-тағы мәтін осы сандарға
// сәйкес болуы тиіс — validationResults.test.ts соны тексереді (бір шек екі жерде
// бөлек өзгеріп кетпеуі үшін).
export const LIMIT = {
  // validation/kazhydromet/PROTOCOL.md §4: |NMB| < 30% ЖӘНЕ NME < 50%
  kzNmbAbs: 0.3,
  kzNmeMax: 0.5,
  // validation/air/PROTOCOL.md §6: POD ≥ 0.5 және FAR ≤ 0.5
  airPodMin: 0.5,
  airFarMax: 0.5,
  // validation/s5p/PROTOCOL.md §4: Δ > 0; 95% СА төменгі шегі > 0; жарамды күн ≥ 100
  s5pDeltaMin: 0,
  s5pCiLowMin: 0,
  s5pDaysMin: 100,
  // validation/firms/PROTOCOL.md §4: күн/жыл ≥ 12; тығыздық ≥ 10; precision ≥ 0.80
  firmsDaysMin: 12,
  firmsDensityMin: 10,
  firmsPrecisionMin: 0.8,
} as const;

export const REPO_BLOB = "https://github.com/Bakdaulet-omeraiuly/ecowatch-ai/blob/main";

// Модульдер әлі валидацияланбаған (validation/README.md кестесі)
export const NOT_YET_VALIDATED: NotYetValidated[] = [
  { name: "val.nv.sar.name", reference: "val.nv.sar.ref" },
  { name: "val.nv.fwi.name", reference: "val.nv.fwi.ref" },
  { name: "val.nv.spi.name", reference: "val.nv.spi.ref" },
  { name: "val.nv.mri.name", reference: "val.nv.mri.ref" },
];

/** Белгілі қателер (барлық модульдер бойынша) — i18n кілттері */
export const KNOWN_ERRORS: string[] = ["val.err.fixate", "val.err.radius"];

/** Пішімдеу: бөлшек → таңбалы пайыз (NMB үшін) */
export function fmtPct(v: number): string {
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}${Math.abs(v * 100).toFixed(1)}%`;
}

/** Таңбасыз пайыз (NME, F-қатесі) */
export function fmtAbsPct(v: number): string {
  return `${(Math.abs(v) * 100).toFixed(1)}%`;
}

const SUP: Record<string, string> = {
  "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵",
  "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
};

/** Ғылыми белгі: 1.08 × 10⁻⁵ (S5P баған айырмасы, mol/m²) */
export function fmtSci(v: number): string {
  if (v === 0) return "0";
  const exp = Math.floor(Math.log10(Math.abs(v)));
  const mant = v / Math.pow(10, exp);
  const sup = String(exp).split("").map((c) => SUP[c] ?? c).join("");
  return `${mant.toFixed(2)} × 10${sup}`;
}

function fmtNum(v: number | null | undefined, digits = 2): string {
  return v == null || Number.isNaN(v) ? "—" : v.toFixed(digits);
}

/** goal немесе criteria → өтті; fail → өтпеді */
function levelPass(level: string | undefined): boolean {
  return level === "goal" || level === "criteria";
}

function levelOf(level: string | undefined): "goal" | "criteria" | "fail" {
  return level === "goal" || level === "criteria" ? level : "fail";
}

function statusOf(pass: boolean | null): CheckStatus {
  if (pass === null) return "descriptive";
  return pass ? "passed" : "failed";
}

// ── PM₂.₅: күнделікті, сезондық бөлу және сағаттық ─────────────────────

interface AirBlock {
  n: number;
  nmb: number;
  nme: number;
  r: number;
}
interface AirSeason extends AirBlock {
  verdict: { levels: Record<string, string>; pass: boolean };
}

const AIR_PERIOD = `${air.period[0]} — ${air.period[1]}`;

function airSeasonCheck(id: string, titleKey: string, s: AirSeason): ValidationCheck {
  const lv = s.verdict.levels;
  return {
    id,
    titleKey,
    pollutant: "",
    period: AIR_PERIOD,
    n: s.n,
    nmb: s.nmb,
    nme: s.nme,
    r: s.r,
    metrics: [
      { label: "n", value: String(s.n), threshold: null, pass: null },
      { label: "NMB", value: fmtPct(s.nmb), threshold: THRESHOLDS.airNmbCriteria, pass: levelPass(lv.nmb), level: levelOf(lv.nmb) },
      { label: "NME", value: fmtAbsPct(s.nme), threshold: THRESHOLDS.airNmeCriteria, pass: levelPass(lv.nme), level: levelOf(lv.nme) },
      { label: "r", value: fmtNum(s.r), threshold: THRESHOLDS.airRCriteria, pass: levelPass(lv.r), level: levelOf(lv.r) },
    ],
    status: statusOf(s.verdict.pass),
    pass: s.verdict.pass,
    noteKeys: [],
    knownErrorKeys: [],
    gapKeys: [],
    protocol: air.protocol,
    generatedAt: air.generated_at,
    protocolPath: "validation/air/PROTOCOL.md",
    resultsPath: "validation/air/results.md",
  };
}

function airPm25(): ValidationCheck {
  const d = air.daily;
  const lv = air.daily_verdict.levels as Record<string, string>;
  const h = air.hourly;
  return {
    id: "air-pm25-daily",
    titleKey: "val.mod.air",
    pollutant: "PM₂.₅",
    methodKey: "val.air.method",
    referenceKey: "val.air.ref",
    period: AIR_PERIOD,
    n: d.n,
    nmb: d.nmb,
    nme: d.nme,
    r: d.r,
    metrics: [
      { label: "n", value: String(d.n), threshold: null, pass: null },
      { label: "NMB", value: fmtPct(d.nmb), threshold: `${THRESHOLDS.airNmbGoal} / ${THRESHOLDS.airNmbCriteria}`, pass: levelPass(lv.nmb), level: levelOf(lv.nmb) },
      { label: "NME", value: fmtAbsPct(d.nme), threshold: `${THRESHOLDS.airNmeGoal} / ${THRESHOLDS.airNmeCriteria}`, pass: levelPass(lv.nme), level: levelOf(lv.nme) },
      { label: "r", value: fmtNum(d.r), threshold: `${THRESHOLDS.airRGoal} / ${THRESHOLDS.airRCriteria}`, pass: levelPass(lv.r), level: levelOf(lv.r) },
    ],
    status: statusOf(air.daily_verdict.pass),
    pass: air.daily_verdict.pass,
    noteKeys: [],
    knownErrorKeys: [],
    gapKeys: ["val.air.gap.astana", "val.air.gap.grid", "val.air.gap.forecast", "val.air.gap.qc"],
    protocol: air.protocol,
    generatedAt: air.generated_at,
    protocolPath: "validation/air/PROTOCOL.md",
    resultsPath: "validation/air/results.md",
    children: [
      airSeasonCheck("air-pm25-heating", "val.air.season.heating", air.by_season_daily.heating as AirSeason),
      airSeasonCheck("air-pm25-warm", "val.air.season.warm", air.by_season_daily.warm as AirSeason),
      {
        id: "air-pm25-hourly",
        titleKey: "val.air.season.hourly",
        pollutant: "",
        period: AIR_PERIOD,
        n: h.n,
        nmb: h.nmb,
        nme: h.nme,
        r: h.r,
        metrics: [
          { label: "n", value: String(h.n), threshold: null, pass: null },
          { label: "NMB", value: fmtPct(h.nmb), threshold: null, pass: null },
          { label: "NME", value: fmtAbsPct(h.nme), threshold: null, pass: null },
          { label: "r", value: fmtNum(h.r), threshold: null, pass: null },
        ],
        status: "descriptive",
        pass: null,
        noteKeys: [],
        knownErrorKeys: [],
        gapKeys: [],
        protocol: air.protocol,
        generatedAt: air.generated_at,
        protocolPath: "validation/air/PROTOCOL.md",
        resultsPath: "validation/air/results.md",
      },
    ],
  };
}

/** Норма асу скринингі (protocol §6): POD ≥ 0.5 және FAR ≤ 0.5 */
function airKz35(): ValidationCheck {
  const ex = air.exceedance.kz_daily_35;
  const pass = ex.pod >= LIMIT.airPodMin && ex.far <= LIMIT.airFarMax;
  return {
    id: "air-kz35-screen",
    titleKey: "val.mod.airScreen",
    pollutant: "PM₂.₅ > 35 µg/m³",
    methodKey: "val.air.kz35.method",
    period: AIR_PERIOD,
    n: air.qc.valid_days,
    nmb: null,
    nme: null,
    r: null,
    metrics: [
      { label: "POD", value: fmtNum(ex.pod), threshold: THRESHOLDS.airPod, pass: ex.pod >= LIMIT.airPodMin },
      { label: "FAR", value: fmtNum(ex.far), threshold: THRESHOLDS.airFar, pass: ex.far <= LIMIT.airFarMax },
    ],
    status: statusOf(pass),
    pass,
    noteKeys: [],
    knownErrorKeys: [],
    // Бұл скрининг PM₂.₅ күнделікті қатарымен бірдей деректерде жасалады, сондықтан
    // сол олқылықтар (Астана, тор, болжам, QC) осында да қолданылады.
    gapKeys: ["val.air.gap.astana", "val.air.gap.grid", "val.air.gap.forecast", "val.air.gap.qc"],
    protocol: air.protocol,
    generatedAt: air.generated_at,
    protocolPath: "validation/air/PROTOCOL.md",
    resultsPath: "validation/air/results.md",
  };
}

/** Фиксация аудиті (protocol §7): гипотеза емес, тексеріс — шегі жоқ, сипаттама */
function airFixation(): ValidationCheck {
  const fx = air.fixation_audit;
  return {
    id: "air-fixation-audit",
    titleKey: "val.mod.fixate",
    pollutant: "/api/fixate",
    methodKey: "val.air.fix.method",
    period: "—",
    n: fx.records,
    nmb: null,
    nme: null,
    r: null,
    metrics: [
      {
        label: "val.m.fixrec",
        value: `${fx.hourly_value_vs_longer_averaging_norm} / ${fx.records}`,
        threshold: null,
        pass: null,
      },
      { label: "kz_violations", value: String(fx.kz_violations), threshold: null, pass: null },
    ],
    status: "descriptive",
    pass: null,
    noteKeys: [],
    knownErrorKeys: ["val.err.fixate"],
    gapKeys: [],
    protocol: air.protocol,
    generatedAt: air.generated_at,
    protocolPath: "validation/air/PROTOCOL.md",
    resultsPath: "validation/air/results.md",
  };
}

// ── Қазгидромет: SO₂, CO, NO₂, NO (және H₂S — салыстыруға болмайды) ──────

interface KzSummary {
  n: number;
  nmb: number;
  nme: number;
  r: number;
  median_obs_over_cams: number;
  pass: boolean;
}

function kzCheck(gas: string, id: string, s: KzSummary): ValidationCheck {
  // Шек (protocol §4): |NMB| < 30% ЖӘНЕ NME < 50%. r — тек сипаттама.
  const nmbPass = Math.abs(s.nmb) < LIMIT.kzNmbAbs;
  const nmePass = s.nme < LIMIT.kzNmeMax;
  const pass = nmbPass && nmePass;
  return {
    id,
    titleKey: "val.mod.kz",
    pollutant: gas,
    methodKey: "val.kz.method",
    referenceKey: "val.kz.ref",
    period: `${KZH_PERIOD.from} — ${KZH_PERIOD.to}`,
    n: s.n,
    nmb: s.nmb,
    nme: s.nme,
    r: s.r,
    metrics: [
      { label: "n", value: String(s.n), threshold: null, pass: null },
      { label: "NMB", value: fmtPct(s.nmb), threshold: THRESHOLDS.kzNmb, pass: nmbPass },
      { label: "NME", value: fmtAbsPct(s.nme), threshold: THRESHOLDS.kzNme, pass: nmePass },
      { label: "r", value: fmtNum(s.r), threshold: null, pass: null },
      { label: "val.m.ratio", value: `${fmtNum(s.median_obs_over_cams)}×`, threshold: null, pass: null },
    ],
    status: statusOf(pass),
    pass,
    noteKeys: [],
    knownErrorKeys: [],
    gapKeys: ["val.kz.gap.rounding", "val.kz.gap.jan", "val.kz.gap.posts", "val.kz.gap.cell"],
    protocol: kazhydromet.protocol,
    generatedAt: kazhydromet.generated_at,
    protocolPath: "validation/kazhydromet/PROTOCOL.md",
    resultsPath: "validation/kazhydromet/results.md",
  };
}

function kzH2s(): ValidationCheck {
  const h = kazhydromet.summary.h2s;
  return {
    id: "kz-h2s",
    titleKey: "val.mod.kz",
    pollutant: "H₂S",
    methodKey: "val.kz.h2s.method",
    period: `${KZH_PERIOD.from} — ${KZH_PERIOD.to}`,
    n: h.months,
    nmb: null,
    nme: null,
    r: null,
    metrics: [
      { label: "n", value: String(h.months), threshold: null, pass: null },
      { label: "val.m.h2smax", value: `${fmtNum(h.max_x_pdk_mr_max, 1)}×`, threshold: null, pass: null },
    ],
    status: "not-comparable",
    pass: null,
    noteKeys: ["val.h2s.reason"],
    knownErrorKeys: [],
    gapKeys: [],
    protocol: kazhydromet.protocol,
    generatedAt: kazhydromet.generated_at,
    protocolPath: "validation/kazhydromet/PROTOCOL.md",
    resultsPath: "validation/kazhydromet/results.md",
  };
}

// ── Sentinel-5P: H3 (NO₂), H4 (SO₂, зерттеу) ──────────────────────────

interface S5pTest {
  valid_days: number;
  mean_delta_mol_m2: number;
  ci95: [number, number];
  relative_enhancement: number;
}

const S5P_PERIOD = "2024-01-01 — 2026-10-31";

function s5pCheck(id: string, titleKey: string, pollutant: string, h: S5pTest, noteKey: string): ValidationCheck {
  const deltaOk = h.mean_delta_mol_m2 > LIMIT.s5pDeltaMin;
  const ciOk = h.ci95[0] > LIMIT.s5pCiLowMin;
  const daysOk = h.valid_days >= LIMIT.s5pDaysMin;
  const pass = deltaOk && ciOk && daysOk;
  return {
    id,
    titleKey,
    pollutant,
    methodKey: "val.s5p.method",
    referenceKey: "val.s5p.ref",
    period: S5P_PERIOD,
    n: h.valid_days,
    nmb: null,
    nme: null,
    r: null,
    metrics: [
      { label: "val.m.days", value: String(h.valid_days), threshold: THRESHOLDS.s5pDays, thresholdKey: "val.thr.s5pDays", pass: daysOk },
      { label: "val.m.delta", value: `${fmtSci(h.mean_delta_mol_m2)} mol/m²`, threshold: THRESHOLDS.s5pDelta, pass: deltaOk },
      {
        label: "val.m.ci",
        value: `[${fmtSci(h.ci95[0])}; ${fmtSci(h.ci95[1])}] mol/m²`,
        threshold: THRESHOLDS.s5pCi,
        thresholdKey: "val.thr.s5pCi",
        pass: ciOk,
      },
      { label: "val.m.rel", value: fmtPct(h.relative_enhancement), threshold: null, pass: null },
    ],
    status: statusOf(pass),
    pass,
    noteKeys: [noteKey],
    knownErrorKeys: [],
    gapKeys: ["val.s5p.gap.pixel", "val.s5p.gap.city", "val.s5p.gap.qa", "val.s5p.gap.emission"],
    protocol: s5p.protocol,
    generatedAt: s5p.generated_at,
    protocolPath: "validation/s5p/PROTOCOL.md",
    resultsPath: "validation/s5p/results.md",
  };
}

// ── VIIRS / FIRMS: H1 (анықталу), H2 (телу дәлдігі) ───────────────────

const FIRMS_PERIOD = `${firms.period[0]} — ${firms.period[1]}`;

function firmsH1(): ValidationCheck {
  const h = firms.H1;
  const daysOk = h.days_per_year >= LIMIT.firmsDaysMin;
  const densOk = h.density_ratio >= LIMIT.firmsDensityMin;
  const pass = daysOk && densOk;
  return {
    id: "firms-h1",
    titleKey: "val.mod.firms1",
    pollutant: "VIIRS",
    methodKey: "val.firms.h1.method",
    referenceKey: "val.firms.ref",
    period: FIRMS_PERIOD,
    n: null,
    nmb: null,
    nme: null,
    r: null,
    metrics: [
      { label: "val.m.perYear", value: fmtNum(h.days_per_year), threshold: THRESHOLDS.firmsDays, pass: daysOk },
      { label: "val.m.dens", value: fmtNum(h.density_ratio), threshold: THRESHOLDS.firmsDensity, pass: densOk },
    ],
    status: statusOf(pass),
    pass,
    noteKeys: [],
    knownErrorKeys: [],
    gapKeys: ["val.firms.gap.flare", "val.firms.gap.nodetect", "val.firms.gap.cloud"],
    protocol: firms.protocol,
    generatedAt: firms.generated_at,
    protocolPath: "validation/firms/PROTOCOL.md",
    resultsPath: "validation/firms/results.md",
  };
}

function firmsH2(): ValidationCheck {
  const h = firms.H2;
  const pass = h.precision >= LIMIT.firmsPrecisionMin;
  return {
    id: "firms-h2",
    titleKey: "val.mod.firms2",
    pollutant: "VIIRS",
    methodKey: "val.firms.h2.method",
    referenceKey: "val.firms.ref",
    period: FIRMS_PERIOD,
    n: h.attributed,
    nmb: null,
    nme: null,
    r: null,
    metrics: [
      // Бөлшек мән (0.04) — шектің («≥ 0.80») бірлігімен бірдей. Пайыз емес.
      { label: "val.m.prec", value: fmtNum(h.precision), threshold: THRESHOLDS.firmsPrecision, pass },
      { label: "val.m.attr", value: String(h.attributed), threshold: null, pass: null },
    ],
    status: statusOf(pass),
    pass,
    noteKeys: [],
    knownErrorKeys: ["val.err.radius"],
    gapKeys: [],
    protocol: firms.protocol,
    generatedAt: firms.generated_at,
    protocolPath: "validation/firms/PROTOCOL.md",
    resultsPath: "validation/firms/results.md",
  };
}

/** Барлық тексеру тармақтары. Әр модуль / әр газ — бөлек. */
export function buildValidationChecks(): ValidationCheck[] {
  const kzs = kazhydromet.summary as unknown as Record<"so2" | "co" | "no2" | "no", KzSummary>;
  return [
    airPm25(),
    airKz35(),
    airFixation(),
    kzCheck("SO₂", "kz-so2", kzs.so2),
    kzCheck("CO", "kz-co", kzs.co),
    kzCheck("NO₂", "kz-no2", kzs.no2),
    kzCheck("NO", "kz-no", kzs.no),
    kzH2s(),
    s5pCheck("s5p-no2-h3", "val.mod.s5p3", "NO₂", s5p.H3 as unknown as S5pTest, "val.s5p.note.h3"),
    s5pCheck("s5p-so2-h4", "val.mod.s5p4", "SO₂", s5p.H4 as unknown as S5pTest, "val.s5p.note.h4"),
    firmsH1(),
    firmsH2(),
  ];
}

/** Тізбектегі барлық i18n кілттері (тест және аудит үшін) */
export function collectKeys(checks: ValidationCheck[]): string[] {
  const out = new Set<string>(KNOWN_ERRORS);
  const walk = (c: ValidationCheck) => {
    out.add(c.titleKey);
    if (c.methodKey) out.add(c.methodKey);
    if (c.referenceKey) out.add(c.referenceKey);
    for (const m of c.metrics) if (m.label.startsWith("val.")) out.add(m.label);
    c.noteKeys.forEach((k) => out.add(k));
    c.knownErrorKeys.forEach((k) => out.add(k));
    c.gapKeys.forEach((k) => out.add(k));
    c.children?.forEach(walk);
  };
  checks.forEach(walk);
  return [...out];
}

/** Жиынтық санау (жоғарғы деңгейдегі тармақтар бойынша) */
export function summarize(checks: ValidationCheck[]) {
  const count = (s: CheckStatus) => checks.filter((c) => c.status === s).length;
  return {
    total: checks.length,
    passed: count("passed"),
    failed: count("failed"),
    descriptive: count("descriptive"),
    notComparable: count("not-comparable"),
  };
}
