"use client";

import { useLang } from "@/lib/i18n";
import { AQI_CATEGORIES } from "@/lib/airQuality";
import { fireDangerClass, FIRE_DANGER_KZ, FIRE_DANGER_COLOR } from "@/lib/fwi";
import { droughtClass, DROUGHT_KZ, DROUGHT_COLOR } from "@/lib/spi";

// ЭКО ҚАБАТ ПАНЕЛІНДЕГІ ТҮСІНДІРМЕ — картаның сол жағында, ӘРҚАШАН көрінеді.
//
// Панельде сан тұр («FWI 24», «SPI −1.3», «AQI 46»), бірақ ол сан нені
// білдіретіні мен деңгейлері жазылмаса — пайдаланушы болжап отырады.
// Мұнда екеуі де тұрақты көрінеді:
//   · индекс не өлшейді (бір-екі сөйлем)
//   · деңгейлердің шкаласы (сан → атау → түс)
//
// ⚠️ ШЕКАРАЛАР МЕН АТАУЛАР ҚАЙТА ЖАЗЫЛМАЙДЫ.
// Олар кодтағы бар функциялардан оқылады (fireDangerClass, droughtClass,
// AQI_CATEGORIES). Сондықтан панельдегі шкала мен есептеудегі шкала
// ешқашан алшақтамайды — бұл бұрын маса түстерінде болған қате.

export interface Band {
  label: string;
  color: string;
  range: string;
}

/** Шекара массивінен жолақтар жасау: [0, 5.2, 11.2, …] → аралықтар */
function bandsFrom(
  bounds: number[],
  labelAt: (mid: number) => string,
  colorAt: (mid: number) => string,
  fmt: (n: number) => string = (n) => String(n)
): Band[] {
  const out: Band[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const a = bounds[i];
    const b = bounds[i + 1];
    const mid = Number.isFinite(b) ? (a + b) / 2 : a + 1;
    out.push({
      label: labelAt(mid),
      color: colorAt(mid),
      range: Number.isFinite(b) ? `${fmt(a)}–${fmt(b)}` : `${fmt(a)}+`,
    });
  }
  return out;
}

interface IndexDef {
  /** Индекстің аты — панель тақырыбынан бөлек, нақты */
  title: string;
  /** Не өлшейді */
  what: string;
  bands: Band[];
  /** Ең маңызды шектеу — бір сөйлем */
  caveat?: string;
}

// ── Ауа сапасы: EU AQI ──────────────────────────────────────────────────
const AIR: IndexDef = {
  title: "EU AQI (0–100+)",
  what:
    "Еуропалық ауа сапасы индексі. PM₂.₅, PM₁₀, NO₂, O₃, SO₂ ішінен ЕҢ " +
    "нашарының деңгейін алады — сондықтан бір ластаушы асып кетсе, жалпы " +
    "индекс те көтеріледі.",
  bands: AQI_CATEGORIES.map((c) => ({
    label: c.name,
    color: c.color,
    range: c.range[1] >= 1000 ? `${c.range[0]}+` : `${c.range[0]}–${c.range[1]}`,
  })),
  caveat: "CAMS моделі — тор қадамы ~40 км, қала ішіндегі айырма толық көрінбейді.",
};

// ── Өрт қаупі: FWI ──────────────────────────────────────────────────────
const FIRE: IndexDef = {
  title: "FWI — Fire Weather Index",
  what:
    "Ауа райы бойынша есептелген өрт қаупі: температура, ылғал, жел және " +
    "жауын жинақталып, жанғыш материалдың құрғақтығын береді.",
  bands: bandsFrom(
    [0, 5.2, 11.2, 21.3, 38, 50, Infinity],
    (m) => FIRE_DANGER_KZ[fireDangerClass(m)],
    (m) => FIRE_DANGER_COLOR[fireDangerClass(m)]
  ),
  caveat: "Бұл — ҚАУІП көрсеткіші, өрттің бар-жоғы емес. Нақты жану нүктелері «Мұнай» қабатында (VIIRS).",
};

// ── Құрғақшылық: SPI-3 ──────────────────────────────────────────────────
const DROUGHT: IndexDef = {
  title: "SPI-3 (σ бірлігі)",
  what:
    "Соңғы 3 айдағы жауынның көпжылдық нормадан ауытқуы. Нөл — норма, " +
    "минус — құрғақ, плюс — ылғалды. Бірлігі — стандартты ауытқу.",
  bands: bandsFrom(
    [-3, -2, -1.5, -1, 1, 1.5, 2, 3],
    (m) => DROUGHT_KZ[droughtClass(m)],
    (m) => DROUGHT_COLOR[droughtClass(m)],
    (n) => (n <= -3 ? "≤−3" : n >= 3 ? "≥3" : String(n).replace("-", "−"))
  ),
  caveat: "Тек жауынға негізделген — температура мен буланудың әсері ескерілмейді.",
};

// ── Су: өзен ағыны ──────────────────────────────────────────────────────
// Шекаралар /api/flood → riskLevel() функциясымен бірдей
const WATER: IndexDef = {
  title: "Ағын қатынасы (0–1)",
  what:
    "Бүгінгі ағынның соңғы 44 тәуліктегі ең жоғары мәнге қатынасы. " +
    "1-ге жақындаса — өзен өз терезесіндегі шыңында.",
  bands: [
    { label: "Қалыпты", color: "#22c55e", range: "0–0.40" },
    { label: "Бақылауда", color: "#eab308", range: "0.40–0.65" },
    { label: "Орташа қауіп", color: "#f97316", range: "0.65–0.85" },
    { label: "Жоғары тасқын қаупі", color: "#ef4444", range: "0.85–1" },
  ],
  caveat: "GloFAS — жаһандық модель. Су басқан нақты аумақ Sentinel-1 радарымен бөлек өлшенеді.",
};

// ── Топырақ ────────────────────────────────────────────────────────────
const SOIL: IndexDef = {
  title: "Құрғау стресі (0–100)",
  what:
    "Топырақтың жоғарғы қабатындағы ылғал тапшылығы. Жоғары мән — жер " +
    "беті құрғақ, шаң көтерілуге және деградацияға бейім.",
  bands: [
    { label: "Ылғалды", color: "#22c55e", range: "0–25" },
    { label: "Қалыпты", color: "#a3e635", range: "25–50" },
    { label: "Құрғақ", color: "#eab308", range: "50–75" },
    { label: "Қатты құрғақ", color: "#ef4444", range: "75–100" },
  ],
  caveat: "ECMWF топырақ моделі — жердегі өлшем емес. Сор мен тақыр табиғи түрде құрғақ.",
};

// ── Жел ────────────────────────────────────────────────────────────────
const WIND: IndexDef = {
  title: "Жел жылдамдығы (км/сағ)",
  what:
    "Ауа сапасын түсіндіретін негізгі фактор: әлсіз жел ластаушыларды " +
    "жинақтайды, күшті жел шашыратады. Бағыты ластану көзін іздеуге керек.",
  bands: [
    { label: "Тынық — ластану жиналады", color: "#ef4444", range: "0–8" },
    { label: "Әлсіз", color: "#eab308", range: "8–20" },
    { label: "Орташа — ауа алмасады", color: "#22c55e", range: "20–35" },
    { label: "Күшті — шаң көтеріледі", color: "#f97316", range: "35+" },
  ],
};

// ── Мұнай / жылу аномалиялары ──────────────────────────────────────────
const OIL: IndexDef = {
  title: "FRP — жылу сәулелену қуаты (МВт)",
  what:
    "Спутник инфрақызыл арнада тіркеген жылу нүктесінің қуаты. Газ факелі " +
    "де, дала өрті де осында түседі.",
  bands: [
    { label: "Әлсіз аномалия", color: "#facc15", range: "0–5" },
    { label: "Орташа", color: "#fb923c", range: "5–20" },
    { label: "Күшті — тексеру қажет", color: "#ef4444", range: "20+" },
  ],
  caveat: "VIIRS факел мен өртті АЖЫРАТПАЙДЫ. FRP — жылу қуаты, ластану мөлшері емес.",
};

const DEFS: Record<string, IndexDef> = {
  air: AIR, fire: FIRE, drought: DROUGHT, water: WATER,
  soil: SOIL, wind: WIND, oil: OIL,
};

/**
 * Қабаттың индексі нені білдіретіні + деңгей шкаласы.
 * Маса қабатының өз аңызы бар (MOS_LEVELS), сондықтан мұнда жоқ.
 */
export function LayerIndexNote({ layer }: { layer: string }) {
  const { tr } = useLang();
  const d = DEFS[layer];
  if (!d) return null;

  return (
    <div className="mt-2 rounded-md border border-white/10 bg-white/5 p-2">
      <div className="text-[12px] font-semibold uppercase tracking-wide text-neutral-400">
        {d.title}
      </div>
      <p className="mt-0.5 text-[12px] leading-snug text-neutral-400">{d.what}</p>

      <div className="mt-1.5 space-y-0.5 border-t border-white/5 pt-1.5">
        {d.bands.map((b) => (
          <div key={b.label} className="flex items-center gap-1.5 text-[12px]">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: b.color }}
            />
            <span className="min-w-0 flex-1 truncate text-neutral-300">{tr(b.label)}</span>
            <span className="shrink-0 font-mono text-neutral-400">{b.range}</span>
          </div>
        ))}
      </div>

      {d.caveat && (
        <p className="mt-1.5 border-t border-white/5 pt-1.5 text-[12px] leading-snug text-amber-200/60">
          ⚠ {d.caveat}
        </p>
      )}
    </div>
  );
}
