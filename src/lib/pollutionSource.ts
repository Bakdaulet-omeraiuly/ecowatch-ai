// Ластану көзін анықтау (Pollution Source Detection)
// -----------------------------------------------------------------------------
// Әдіс: жеңілдетілген CWT (Concentration Weighted Trajectory) + көп-қабылдағыш
// жел-кері триангуляция + алға Gaussian-plume таралуы.
//
// Ғылыми негіз: CWT/PSCF — HYSPLIT кері-траекторияларына негізделген receptor
// модельдері (TraPSA). Біз Vercel serverless шектеуіне бола ТҮЗУ-СЫЗЫҚТЫ
// жеңілдетілген нұсқасын қолданамыз — бұл жергілікті масштабта (<100 км)
// қабылданған жуықтау. Ешбір дерек ойдан жасалмайды: концентрация CAMS-тен,
// жел Open-Meteo-дан, координаттар — ашық өнеркәсіптік деректер.

import { FACILITIES, PLACES, type Facility, type PollutantKey } from "@/data/facilities";

// Тірі өлшенетін ластаушылар (voc CAMS-те жоқ, тек профильде қолданылады)
type MeasuredKey = "so2" | "no2" | "pm";

// --- Геометрия ---------------------------------------------------------------

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Бағыт (bearing) A→B: солтүстіктен сағат тілі бойымен 0..360°
export function bearing(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const φ1 = (aLat * Math.PI) / 180;
  const φ2 = (bLat * Math.PI) / 180;
  const Δλ = ((bLng - aLng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

// Екі бағыт арасындағы ең кіші айырма 0..180°
export function angularDelta(a: number, b: number): number {
  const d = Math.abs(((a - b + 540) % 360) - 180);
  return d;
}

// Бұрыштық сәйкестік: айырма 0° → 1, ~40°-та ~0.4, алыс → 0 (Гаусс)
function alignment(delta: number, sigma = 35): number {
  return Math.exp(-((delta / sigma) ** 2));
}

// Қашықтық факторы: жақын көз ықтималдырақ, ~60 км-де жартылай сөнеді
function distanceFactor(km: number): number {
  return Math.exp(-km / 60);
}

const compass = ["С", "ССШ", "СШ", "ШСШ", "Ш", "ШОШ", "ОШ", "ООШ", "О", "ООБ", "ОБ", "БОБ", "Б", "БСБ", "СБ", "ССБ"];
export function bearingLabel(deg: number): string {
  return compass[Math.round(deg / 22.5) % 16];
}

// --- Кірістер ----------------------------------------------------------------

export interface Receptor {
  lat: number;
  lng: number;
  so2: number | null;
  no2: number | null;
  pm: number | null; // pm10
}

// Нақты жердегі бақылау стансасы (Qazhydromet/WAQI)
export interface Station {
  lat: number;
  lng: number;
  aqi: number; // жалпы US AQI
  name?: string;
}

export interface WindHour {
  fromBearing: number; // жел КЕЛЕТІН бағыт (метеорологиялық), 0..360
  speed: number; // км/сағ
  so2: number | null; // сол сағаттағы қалалық концентрация (уақыттық CWT үшін)
  no2: number | null;
  pm: number | null;
  time?: string; // ISO — уақыт-анимация кадры үшін
}

// Уақыт-анимация кадры: сол сағаттағы желмен есептелген plume конусы
export interface PlumeFrame {
  time: string;
  hour: string; // "14:00" — көрсету үшін
  fromLabel: string;
  toBearing: number;
  speed: number;
  cone: [number, number][];
}

// Ластаушылардың облыстық базалық деңгейі (µg/m³) — асуын өлшеу үшін
const BASELINE: Record<PollutantKey, number> = { so2: 5, no2: 12, pm: 20, voc: 0 };
const SCALE: Record<PollutantKey, number> = { so2: 40, no2: 60, pm: 60, voc: 1 };

function elevation(value: number | null, key: PollutantKey): number {
  if (value == null) return 0;
  return Math.max(0, Math.min(1, (value - BASELINE[key]) / SCALE[key]));
}

// --- Нәтиже ------------------------------------------------------------------

export interface SourceCandidate {
  id: string;
  name: string;
  short: string;
  lat: number;
  lng: number;
  confidence: number; // 0..100 — белгілі көздер ішіндегі салыстырмалы ықтималдық
  distanceKm: number;
  bearingFromCity: number;
  approx?: boolean; // координата жуық
}

export interface PlumeStep {
  name: string;
  lat: number;
  lng: number;
  relConc: number; // 0..1 салыстырмалы концентрация (алыстаған сайын кемиді)
}

// Болжам қадамы: бұлт N сағаттан кейін қай жерде болады (болжам желімен)
export interface DispersionStep {
  label: string; // "30 мин", "1 сағ", "3 сағ"
  hoursAhead: number;
  lat: number; // бұлт орталығының болжамды орны
  lng: number;
  radiusKm: number; // диффузиямен өскен footprint радиусы
  reached: string[]; // осы уақытта жететін елді мекендер
}

export interface ForecastWind {
  fromBearing: number;
  speed: number; // км/сағ
}

export interface SourceResult {
  detected: boolean; // елеулі ластану бар ма (әйтпесе көз анықталмайды)
  pollutant: PollutantKey;
  pollutantLabel: string;
  signalStrength: number; // 0..100 — ластану қаншалық жоғары
  wind: { fromBearing: number; fromLabel: string; speed: number; toBearing: number };
  candidates: SourceCandidate[];
  top: SourceCandidate | null;
  plume: PlumeStep[];
  cone: [number, number][]; // Gaussian дисперсия конусы (GeoJSON сақина, [lng,lat])
  frames: PlumeFrame[]; // соңғы сағаттардағы желмен конустың қозғалысы (анимация)
  forecast: DispersionStep[]; // бұлттың алдағы 30мин/1сағ/3сағ болжамды орны
  stations: Station[]; // ескерілген нақты жердегі стансалар (картада көрсету)
  groundStations: number; // елеулі сигнал берген станса саны
  method: string;
  note: string;
}

const POLLUTANT_LABEL: Record<PollutantKey, string> = {
  so2: "SO₂ (күкірт диоксиді)",
  no2: "NO₂ (азот диоксиді)",
  pm: "PM₁₀ (қатты бөлшектер)",
  voc: "Ұшпа қосылыстар",
};

// Қала орталығы (қабылдағыш анықтамасы)
const CITY = { lat: 47.11, lng: 51.92 };

// Басым ластаушыны таңдау: тор бойынша ең жоғары асуы бар ластаушы
function dominantPollutant(receptors: Receptor[]): { key: MeasuredKey; strength: number } {
  const keys: MeasuredKey[] = ["so2", "no2", "pm"];
  let best: { key: MeasuredKey; strength: number } = { key: "so2", strength: 0 };
  for (const key of keys) {
    let maxEl = 0;
    for (const r of receptors) maxEl = Math.max(maxEl, elevation(r[key], key));
    if (maxEl > best.strength) best = { key, strength: maxEl };
  }
  return best;
}

/**
 * Ластану көзін анықтау. Бәрі нақты деректен:
 *  - receptors: CAMS тор нүктелеріндегі ағымдағы концентрация
 *  - windNow: ағымдағы жел, windHistory: уақыттық CWT үшін
 */
export function attributePollution(
  receptors: Receptor[],
  windNow: { fromBearing: number; speed: number },
  windHistory: WindHour[],
  stations: Station[] = [],
  forecastWind: ForecastWind[] = []
): SourceResult {
  const { key: pollutant, strength: signal } = dominantPollutant(receptors);
  const toBearing = (windNow.fromBearing + 180) % 360;

  // Нақты жердегі станса сигналы (AQI 20..150 → 0..1). Датчик модель жаппаған
  // нүктелік шыңды ұстайды — сондықтан бөлек, күшті дереккөз.
  const stationEl = (aqi: number) => Math.max(0, Math.min(1, (aqi - 20) / 130));
  const stationSignal = stations.length ? Math.max(0, ...stations.map((st) => stationEl(st.aqi))) : 0;

  // 1) КЕҢІСТІКТІК ТЕРМИН — көп-қабылдағыш триангуляция.
  // Әр қабылдағыштан жоғарылаған концентрация желдің КЕЛГЕН жағына (fromBearing)
  // қарай проекцияланады; сол бағытта тұрған кәсіпорын жоғары ұпай алады.
  // Бірнеше қабылдағыш бір көзге сілтесе — қиылыс табиғи түрде күшейеді.
  const spatial: Record<string, number> = {};
  for (const f of FACILITIES) spatial[f.id] = 0;
  for (const r of receptors) {
    const el = elevation(r[pollutant], pollutant);
    if (el <= 0) continue;
    for (const f of FACILITIES) {
      const brg = bearing(r.lat, r.lng, f.lat, f.lng);
      const align = alignment(angularDelta(brg, windNow.fromBearing));
      const dist = distanceFactor(haversineKm(r.lat, r.lng, f.lat, f.lng));
      spatial[f.id] += el * align * dist;
    }
  }

  // 2) УАҚЫТТЫҚ ТЕРМИН — жеңілдетілген CWT.
  // Соңғы сағаттарда концентрация жоғары болған кездерде қай көз тұрақты
  // «жел жағында» тұрғанын жинақтаймыз (тұрақтылық = сенімділік).
  const temporal: Record<string, number> = {};
  for (const f of FACILITIES) temporal[f.id] = 0;
  let tWeight = 0;
  for (const h of windHistory) {
    const el = elevation(h[pollutant], pollutant);
    if (el <= 0) continue;
    tWeight += el;
    for (const f of FACILITIES) {
      const brg = bearing(CITY.lat, CITY.lng, f.lat, f.lng);
      const align = alignment(angularDelta(brg, h.fromBearing));
      temporal[f.id] += el * align;
    }
  }

  // 3) НАҚТЫ ЖЕРДЕГІ СТАНСА ТЕРМИНІ — датчик деректері (болса).
  // Жоғары AQI көрсеткен станса: (а) желмен көзге проекцияланады,
  // (ә) зауытқа жақын тұрса — тікелей растайды. Модельден күштірек дереккөз.
  const ground: Record<string, number> = {};
  for (const f of FACILITIES) ground[f.id] = 0;
  for (const st of stations) {
    const el = stationEl(st.aqi);
    if (el <= 0) continue;
    for (const f of FACILITIES) {
      const km = haversineKm(st.lat, st.lng, f.lat, f.lng);
      const brg = bearing(st.lat, st.lng, f.lat, f.lng);
      const upwind = alignment(angularDelta(brg, windNow.fromBearing)) * distanceFactor(km);
      const near = Math.max(0, 1 - km / 8); // ≤8км — тікелей растау
      ground[f.id] += el * (upwind + 0.8 * near);
    }
  }
  const hasGround = stations.length > 0 && FACILITIES.some((f) => ground[f.id] > 0);

  // Нормалау
  const maxSpatial = Math.max(1e-9, ...FACILITIES.map((f) => spatial[f.id]));
  const maxTemporal = Math.max(1e-9, ...FACILITIES.map((f) => temporal[f.id]));
  const maxGround = Math.max(1e-9, ...FACILITIES.map((f) => ground[f.id]));

  const raw: Record<string, number> = {};
  for (const f of FACILITIES) {
    const s = spatial[f.id] / maxSpatial;
    const t = tWeight > 0 ? temporal[f.id] / maxTemporal : 0;
    const g = ground[f.id] / maxGround;
    const profileMatch = f.profile[pollutant] ?? 0.3;
    // Нақты датчик болса — оған үлкен салмақ (0.4); болмаса — тек CAMS
    raw[f.id] = hasGround
      ? 0.3 * s + 0.15 * t + 0.4 * g + 0.15 * profileMatch
      : 0.55 * s + 0.3 * t + 0.15 * profileMatch;
  }

  const rawSum = Math.max(1e-9, FACILITIES.reduce((a, f) => a + raw[f.id], 0));

  const candidates: SourceCandidate[] = FACILITIES.map((f) => ({
    id: f.id,
    name: f.name,
    short: f.short,
    lat: f.lat,
    lng: f.lng,
    confidence: Math.round((raw[f.id] / rawSum) * 100),
    distanceKm: Math.round(haversineKm(CITY.lat, CITY.lng, f.lat, f.lng)),
    bearingFromCity: Math.round(bearing(CITY.lat, CITY.lng, f.lat, f.lng)),
    approx: f.approx,
  }))
    .sort((a, b) => b.confidence - a.confidence);

  // Модель ТЕ станса елеулі болса — анықталды (датчик модель жаппаған шыңды ұстайды)
  const combinedSignal = Math.max(signal, stationSignal);
  const detected = combinedSignal >= 0.12;
  // top әрқашан ең ықтимал көз (ластану төмен болса — жел бойынша ықтимал бағыт).
  // Осылай конус/анимация/болжам үнемі көрінеді; detected тек нақты оқиғаны белгілейді.
  const top = candidates[0] ?? null;

  return {
    detected,
    pollutant,
    pollutantLabel: POLLUTANT_LABEL[pollutant],
    signalStrength: Math.round(combinedSignal * 100),
    wind: {
      fromBearing: Math.round(windNow.fromBearing),
      fromLabel: bearingLabel(windNow.fromBearing),
      speed: +windNow.speed.toFixed(1),
      toBearing: Math.round(toBearing),
    },
    candidates,
    top,
    plume: top ? plumePath(top, toBearing) : [],
    cone: top ? plumeCone(top, toBearing, windNow.speed) : [],
    frames: top ? buildFrames(top, windHistory) : [],
    forecast: top ? dispersionForecast(top, forecastWind, windNow) : [],
    stations,
    groundStations: hasGround ? stations.filter((st) => stationEl(st.aqi) > 0).length : 0,
    method: hasGround
      ? "Жеңілдетілген CWT + нақты жердегі станса (Qazhydromet) + Gaussian-plume"
      : "Жеңілдетілген CWT + көп-қабылдағыш триангуляция + Gaussian-plume (жергілікті масштаб)",
    note: !detected
      ? "Ластану деңгейі төмен — көз сенімді анықталмайды. Жалған дерек көрсетілмейді."
      : hasGround
        ? "Нақты жердегі датчиктер ескерілді — сенімділік модельден дәлірек (салыстырмалы ықтималдық)."
        : "Сенімділік — белгілі көздер ішіндегі САЛЫСТЫРМАЛЫ ықтималдық (өлшенген факт емес, болжам).",
  };
}

// --- Алға Gaussian plume: көзден желмен таралу жолы -------------------------
// Көзден toBearing бағытымен қадамдап жүріп, әр елді мекенді plume конусы
// (бүйірлік Гаусс жайылу) ішінде ме — тексеріп, концентрациясымен қайтарамыз.
export function plumePath(source: { lat: number; lng: number }, toBearing: number): PlumeStep[] {
  const steps: PlumeStep[] = [];
  const maxKm = 45;
  for (const p of PLACES) {
    const dist = haversineKm(source.lat, source.lng, p.lat, p.lng);
    if (dist > maxKm || dist < 0.5) continue;
    const brg = bearing(source.lat, source.lng, p.lat, p.lng);
    const off = angularDelta(brg, toBearing); // желден бұрыштық ауытқу
    if (off > 60) continue; // конустан тыс
    // бүйірлік жайылу (Гаусс) × ұзындық бойынша сұйылу
    const lateral = Math.exp(-((off / 30) ** 2));
    const axial = Math.exp(-dist / 30);
    const relConc = lateral * axial;
    if (relConc < 0.05) continue;
    steps.push({ name: p.name, lat: p.lat, lng: p.lng, relConc: +relConc.toFixed(2) });
  }
  return steps.sort((a, b) => {
    const da = haversineKm(source.lat, source.lng, a.lat, a.lng);
    const db = haversineKm(source.lat, source.lng, b.lat, b.lng);
    return da - db;
  });
}

// Уақыт-анимация кадрлары: соңғы сағаттардағы НАҚТЫ желмен конустың қалай
// қозғалғанын көрсетеді (көз тұрақты, тек жел бағыты өзгереді). Соңғы 24 сағат.
function buildFrames(top: { lat: number; lng: number }, windHistory: WindHour[]): PlumeFrame[] {
  const withTime = windHistory.filter((h) => h.time);
  const recent = withTime.slice(-24);
  return recent.map((h) => {
    const toB = (h.fromBearing + 180) % 360;
    const hour = h.time ? h.time.slice(11, 16) : "";
    return {
      time: h.time!,
      hour,
      fromLabel: bearingLabel(h.fromBearing),
      toBearing: Math.round(toB),
      speed: +h.speed.toFixed(1),
      cone: plumeCone(top, toB, h.speed),
    };
  });
}

// Берілген нүктеден bearing бағытымен distKm қашықтықтағы нүкте (жергілікті жуықтау)
function destPoint(lat: number, lng: number, bearingDeg: number, distKm: number): [number, number] {
  const b = (bearingDeg * Math.PI) / 180;
  const dLat = (distKm / 111) * Math.cos(b);
  const dLng = (distKm / (111 * Math.cos((lat * Math.PI) / 180))) * Math.sin(b);
  return [lng + dLng, lat + dLat]; // [lng, lat] — GeoJSON реті
}

// ДИСПЕРСИЯ БОЛЖАМЫ: бұлт алдағы 30мин/1сағ/3сағ-та қай жерде болады.
// Қазір шыққан ауа бөлігін БОЛЖАМ желімен алға жылжытамыз (advection),
// диффузиямен footprint радиусын өсіреміз. Жел деректері нақты (Open-Meteo болжам).
function dispersionForecast(
  origin: { lat: number; lng: number },
  forecastWind: ForecastWind[],
  windNow: { fromBearing: number; speed: number }
): DispersionStep[] {
  // Болжам желі жоқ болса — ағымдағы желмен тұрақты деп есептейміз
  const winds = forecastWind.length ? forecastWind : [windNow, windNow, windNow];
  const horizons: { label: string; h: number }[] = [
    { label: "30 мин", h: 0.5 },
    { label: "1 сағ", h: 1 },
    { label: "3 сағ", h: 3 },
  ];

  return horizons.map(({ label, h }) => {
    // Желді сағат бойынша интегралдап, бұлт орталығының орнын табамыз
    let lat = origin.lat, lng = origin.lng, remaining = h;
    for (let i = 0; i < winds.length && remaining > 0; i++) {
      const w = winds[Math.min(i, winds.length - 1)];
      const dt = Math.min(1, remaining);
      const to = (w.fromBearing + 180) % 360;
      [lng, lat] = destPoint(lat, lng, to, w.speed * dt);
      remaining -= dt;
    }
    // Диффузия: footprint уақытпен өседі (~√t сипатты, жеңілдетілген сызықты)
    const radiusKm = +(2 + 1.6 * h).toFixed(1);
    // Осы уақытта footprint ішіне түсетін елді мекендер
    const reached = PLACES
      .filter((p) => haversineKm(lat, lng, p.lat, p.lng) <= radiusKm)
      .map((p) => p.name);
    return { label, hoursAhead: h, lat: +lat.toFixed(4), lng: +lng.toFixed(4), radiusKm, reached };
  });
}

// Алға Gaussian дисперсия конусы: көзден желмен таралу аймағы (GeoJSON сақина).
// Жел қатты болса — конус ұзын әрі жіңішке; баяу болса — қысқа әрі жалпақ.
export function plumeCone(
  source: { lat: number; lng: number },
  toBearing: number,
  windSpeed: number
): [number, number][] {
  const lengthKm = Math.max(15, Math.min(45, 15 + windSpeed * 3)); // жел қатты → алысқа
  const halfAngle = Math.max(14, 30 - windSpeed * 1.2); // жел қатты → тар конус
  const ring: [number, number][] = [[source.lng, source.lat]];
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    const ang = toBearing - halfAngle + (2 * halfAngle * i) / steps;
    ring.push(destPoint(source.lat, source.lng, ang, lengthKm));
  }
  ring.push([source.lng, source.lat]); // сақинаны жабу
  return ring;
}

export type { Facility };
