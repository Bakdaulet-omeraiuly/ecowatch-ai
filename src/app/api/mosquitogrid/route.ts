import { NextResponse } from "next/server";
import { type GridPoint } from "@/lib/regionGrid";
import { getRegion, hasModule, moduleUnavailable } from "@/data/regions";
import { ATYRAU_DISTRICTS, ATYRAU_OBLAST_SETTLEMENTS } from "@/data/atyrauDistricts";
import { fetchFloodPulse, hydroDaysAt, pulseAt, reedAt } from "@/lib/floodPulse";
import {
  EGG_READY, emergencePeak, integrateFpeb, normalizeAdults, tauDays,
  type DayDriver,
} from "@/lib/fpeb";

// Live mosquito environmental-suitability grid for the Atyrau region.
// Methodology: climate-driven suitability (the approach used by WHO/ECDC/VECTRI
// when field-trap data is unavailable). We combine LIVE weather variables from
// Open-Meteo into a suitability index 0-100. No field data is invented.
//
// Index = 100 * (Wt * tempSuit) * (Wr * rainFactor + Wh * humidityFactor + Ws * soilFactor)
// normalised; each factor is grounded in published vector-ecology relationships.

export const revalidate = 3600;

// НҮКТЕЛЕР.
//
// dense=true → қала нүктесі (иконкалар тығыз шоғырланады);
// dense=false → облыстық тор ұяшығы (иконкалар кең таралады).
//
// ⚠️ АТЫРАУ ТОРЫ: облыстық 5×5 тор (25 нүкте) + қаланың 65 нүктелік
// тізілімі + қала сыртындағы 7 елді мекен = 97 нүкте. Аймақ ауысатын болғанда бұл
// тор жалпы `buildGrid`-ке ауысып, 37 нүктеге дейін азайып кеткен еді —
// сол қате қайтарылды. MRI-дің бүкіл мәні қала ІШІНДЕГІ айырмада,
// оны 5×5 тор жасырып жібереді.
//
// Басқа қалаларда бұл тізілім ЖОҚ, сондықтан «Маса» қабаты сол жерде
// «жоқ» деп көрсетіледі — жуықтап есептелген индекс JAIYQ-MRI емес.

// Атыраудың облыстық торы — бұрынғы қалпында (шеттері қоса алынады)
const ATYRAU_BBOX = { latMin: 46.0, latMax: 48.8, lngMin: 49.2, lngMax: 54.8, n: 5 };

function atyrauPoints(): GridPoint[] {
  const pts: GridPoint[] = [];
  const { latMin, latMax, lngMin, lngMax, n } = ATYRAU_BBOX;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      pts.push({
        lat: +(latMin + ((latMax - latMin) * i) / (n - 1)).toFixed(4),
        lng: +(lngMin + ((lngMax - lngMin) * j) / (n - 1)).toFixed(4),
        dense: false,
      });
    }
  }
  for (const d of ATYRAU_DISTRICTS) pts.push({ ...d, dense: true });
  // Қала сыртындағы аудан орталықтары мен кенттер. `dense: true` — себебі
  // бұлар да АТЫ БАР нақты нүктелер (тор ұяшығы емес), сондықтан рейтингте
  // өз атымен көрінуі керек.
  for (const s of ATYRAU_OBLAST_SETTLEMENTS) pts.push({ ...s, dense: true });
  return pts;
}

// Settlements: cities concentrate breeding habitat (containers, tires, drains,
// irrigation) independent of rainfall — a documented urban amplification of
// mosquito density. Stored with a weight (bigger town = stronger boost).
const SETTLEMENTS: { lat: number; lng: number; w: number }[] = [
  { lat: 47.1167, lng: 51.8833, w: 1.0 }, // Atyrau city (largest)
  { lat: 46.98, lng: 54.02, w: 0.6 }, // Kulsary
  { lat: 47.65, lng: 53.31, w: 0.4 }, // Makat
  { lat: 47.53, lng: 52.98, w: 0.35 }, // Dossor
  { lat: 48.55, lng: 51.78, w: 0.4 }, // Inderbor
  { lat: 47.67, lng: 51.58, w: 0.35 }, // Makhambet
  { lat: 46.6, lng: 49.27, w: 0.3 }, // Ganyushkino
  { lat: 47.0, lng: 51.18, w: 0.3 }, // Akkystau
];

// 0..1 urban factor: peaks at a settlement centre, fades out ~25 km
function urbanFactor(lat: number, lng: number): number {
  let max = 0;
  for (const s of SETTLEMENTS) {
    const dLat = (lat - s.lat) * 111;
    const dLng = (lng - s.lng) * 111 * Math.cos((lat * Math.PI) / 180);
    const distKm = Math.sqrt(dLat * dLat + dLng * dLng);
    max = Math.max(max, s.w * Math.max(0, 1 - distKm / 35));
  }
  return max;
}

// HYDROLOGY — the dominant real driver in Atyrau. The Zhaiyk (Ural) river
// floodplain and the marshy Caspian delta (reed beds, irrigation ditches,
// standing flood pools) are the region's main mosquito breeding habitat.
const ZHAIYK_PATH: [number, number][] = [
  [47.85, 51.5], [47.6, 51.55], [47.35, 51.7], [47.1167, 51.8833], // Atyrau city
  [46.95, 51.85], [46.75, 51.75], [46.55, 51.55], // delta toward Caspian
];

function distToPolylineKm(lat: number, lng: number, path: [number, number][]): number {
  let min = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const [aLat, aLng] = path[i];
    const [bLat, bLng] = path[i + 1];
    // sample the segment
    for (let t = 0; t <= 1; t += 0.2) {
      const pLat = aLat + (bLat - aLat) * t;
      const pLng = aLng + (bLng - aLng) * t;
      const dLat = (lat - pLat) * 111;
      const dLng = (lng - pLng) * 111 * Math.cos((lat * Math.PI) / 180);
      min = Math.min(min, Math.sqrt(dLat * dLat + dLng * dLng));
    }
  }
  return min;
}

// 0..1 БЕЙІМДІЛІК (susceptibility) — «қай жер су басуға бейім».
//
// ⚠️ Бұл — географиялық тұрақты шама, «бүгін су басты ма» ЕМЕС.
// Су басу оқиғасы бөлек өлшенеді: src/lib/floodPulse.ts (Sentinel-1 + GloFAS).
// Модельдегі нақты `flood` = бейімділік × импульс.
function floodplainFactor(lat: number, lng: number): number {
  // proximity to the river/floodplain (within ~20 km)
  const riverKm = distToPolylineKm(lat, lng, ZHAIYK_PATH);
  const river = Math.max(0, 1 - riverKm / 20);
  // the Caspian delta marshes (south, lat < 47.0) — broad wetland zone
  const delta = lat < 47.0 && lng > 50.8 && lng < 52.4 ? Math.max(0, (47.0 - lat) / 0.8) : 0;
  return Math.min(1, Math.max(river, 0.85 * Math.min(1, delta)));
}

// past 7 days (rolling-rain context) + next 7 days (the forecast animation)

// SPIN-UP ТЕРЕЗЕСІ — FPEB интеграциясының драйвері.
//
// Негізгі сұраныс сағаттық деректі қысқа терезеде алады (төмендегі
// HOURLY_PAST/HOURLY_FORECAST). Ал динамикалық модельге 30 күндік
// «жүгіріс» керек — сондықтан ТЕК ТӘУЛІКТІК температура бөлек, жеңіл
// сұраныспен алынады (97 × 44 × 2 сан).
const SPINUP_PAST = 30;
const SPINUP_FORECAST = 14;
const SPINUP_URL = (points: GridPoint[]) =>
  `https://api.open-meteo.com/v1/forecast` +
  `?latitude=${points.map((p) => p.lat).join(",")}` +
  `&longitude=${points.map((p) => p.lng).join(",")}` +
  `&daily=temperature_2m_max,temperature_2m_min` +
  `&past_days=${SPINUP_PAST}&forecast_days=${SPINUP_FORECAST}&timezone=auto`;

// ── СҰРАНЫС ТЕРЕЗЕЛЕРІ ───────────────────────────────────────────────────
//
// ⚠️ НЕГЕ САҒАТТЫҚ ПЕН ТӘУЛІКТІК БӨЛЕК СҰРАЛАДЫ
//
// Бұрын екеуі БІР сұраныста, `past_days=7&forecast_days=7` терезесімен
// алынатын. Open-Meteo-да `past_days` сағаттыққа да, тәуліктікке де
// БІРДЕЙ қолданылады, ал екеуінің қажеттігі әртүрлі:
//   · тәуліктік — 7 күн артқа (жинақталған жаңбыр) + 7 күн алға (болжам)
//   · сағаттық  — тек 48 сағат (өткен 24 + алдағы 24)
// Нәтижесінде сағаттық дерек 336 сағатқа сұралып, 48-і ғана
// пайдаланылатын — ЖЕТІ ЕСЕ артық жүктеме.
//
// Салдары: 97 нүкте × 4 айнымалы × 336 сағат ≈ 130 000 сан. Open-Meteo
// тегін лимиті сұранысты локация × айнымалы × күн бойынша салмақтайды,
// сондықтан бір ғана сұраныс минуттық шекті тауысып, 429 қайтаратын —
// қабат «Тірі ауа райы деректері уақытша қолжетімсіз» деп тұратын.
//
// Енді екі бөлек сұраныс: сағаттық ЖЕҢІЛ терезеде, тәуліктік бұрынғы
// қалпында. Модель ештеңе жоғалтпайды — 48 сағаттық терезе бәрібір
// толық сыяды. Үстіне `precipitation` сағаттық айнымалысы алынып
// тасталды: ол сұралатын, бірақ ЕШҚАЙДА қолданылмайтын (жаңбыр
// тәуліктік `precipitation_sum`-нан алынады).
const HOURLY_PAST = 2;
const HOURLY_FORECAST = 2;
const DAILY_PAST = 7;
const DAILY_FORECAST = 7;

const SRC_URL = (points: GridPoint[]) =>
  `https://api.open-meteo.com/v1/forecast` +
  `?latitude=${points.map((p) => p.lat).join(",")}` +
  `&longitude=${points.map((p) => p.lng).join(",")}` +
  `&current=relative_humidity_2m,soil_moisture_0_to_1cm` +
  `&hourly=temperature_2m,relative_humidity_2m,soil_moisture_0_to_1cm` +
  `&past_days=${HOURLY_PAST}&forecast_days=${HOURLY_FORECAST}&timezone=auto`;

const DAILY_URL = (points: GridPoint[]) =>
  `https://api.open-meteo.com/v1/forecast` +
  `?latitude=${points.map((p) => p.lat).join(",")}` +
  `&longitude=${points.map((p) => p.lng).join(",")}` +
  `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum` +
  `&past_days=${DAILY_PAST}&forecast_days=${DAILY_FORECAST}&timezone=auto`;

// ── ТЕМПЕРАТУРА ГЕЙТІ Φ_T ────────────────────────────────────────────────
//
// Mordecai т.б. 2019 (PLoS NTD, 10.1371/journal.pntd.0006451) Батыс Нил
// вирусы жүйесі үшін жариялаған термиялық шектер:
//     T₀ = 16.8 °C (төменгі шек), Tm = 34.9 °C (жоғарғы шек)
// Симметриялы (квадрат) түрде шыңы (T₀+Tm)/2 = 25.9 °C — мақалада
// хабарланған ~25 °C оптимумына сәйкес келеді.
//
// НЕГЕ ӨЗГЕРТІЛДІ: бұрын шектер қолмен таңдалған еді (15/36, «оптимум 28»),
// әрі нормалау бөлгіші қате болатын — қисықтың шын шыңы 25.5 °C-та жатып,
// 24–27 аралығында 1-ден асып қиылатын. Яғни түсініктемедегі «оптимум
// 28 °C» кодтағы мінез-құлыққа сәйкес келмейтін. Енді шектер жарияланған
// зерттеуден алынды, ал нормалау шыңда дәл 1 береді.
//
// ⚠️ ШЕКТЕУІ: бұл — БАСЫМ түрдің (Culex modestus, аулауда 56%) жүйесіне
// калибрленген қисық. Aedes caspius суыққа төзімдірек әрі көктемде
// 16.8 °C-тан төмен де белсенді бола алады — ол үшін жарияланған
// термиялық фит табылмады, сондықтан бөлек қисық жасалмады.
export const THERMAL = { t0: 16.8, tm: 34.9 };

function tempSuitability(t: number): number {
  const { t0, tm } = THERMAL;
  if (t <= t0 || t >= tm) return 0;
  // Шыңында дәл 1 болатындай нормалау: ((tm−t0)/2)²
  const half = (tm - t0) / 2;
  return Math.max(0, Math.min(1, ((t - t0) * (tm - t)) / (half * half)));
}

function humidityFactor(rh: number): number {
  // survival rises sharply above ~60% RH
  return Math.max(0, Math.min(1, (rh - 40) / 45));
}

function rainFactor(weekPrecipMm: number): number {
  // recent standing water; saturates around 25mm over a week
  return Math.max(0, Math.min(1, weekPrecipMm / 25));
}

function soilFactor(soilMoisture: number | null): number {
  if (soilMoisture == null) return 0.3;
  // m³/m³, typically 0..0.5; standing-water proxy
  return Math.max(0, Math.min(1, soilMoisture / 0.4));
}

// ── JAIYQ-MRI · FPEB ядросы (Flood-Pulse Egg-Bank, қос түр) ──────────────────
// Тасқын-импульс жұмыртқа банкін жарады → дернәсіл → ересек. Aedes caspius
// (тасқын-су) мен Culex modestus (тұрақты-су) бөлек, айлық динамикалық салмақпен.
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
// Динамикалық салмақ: көктем → Aedes (су), жаз ортасы → Culex (WNV)
const AEDES_W = [0.2, 0.2, 0.4, 0.85, 0.9, 0.85, 0.7, 0.5, 0.4, 0.3, 0.2, 0.2];
const CULEX_W = [0.1, 0.1, 0.15, 0.3, 0.5, 0.7, 0.9, 0.95, 0.7, 0.4, 0.15, 0.1];

function fpebIndex(o: {
  t: number; rh: number; soil: number | null; rain: number;
  flood: number; urban: number; month: number;
  /** Су кемінде қанша күн тұрды (SAR өлшемі). null — өлшенбеген */
  hydroDays: number | null;
  /** Қамыс мекенінің қолайлылығы 0..1 (S2 NDVI). null — өлшенбеген */
  reed: number | null;
  /**
   * FPEB интеграциясынан шыққан ересек Aedes индексі 0..1.
   * null — интеграция мүмкін болмады, лездік жуықтау қолданылады.
   */
  aedesDynamic?: number | null;
}): number {
  const phiT = tempSuitability(o.t); // температура гейті (Mordecai)
  if (phiT <= 0) return 0;

  // AEDES ТАРМАҒЫ — тасқын-су түрі.
  //
  // Мәні динамикалық FPEB интеграциясынан келеді (src/lib/fpeb.ts):
  // су басу → жұмыртқа жарылады → дернәсіл τ(T) күн дамиды → ересек.
  // Яғни бұл санда ТАСҚЫННАН КЕЙІНГІ КІДІРІС бар.
  //
  // Интеграция мүмкін болмаса (GloFAS күндік қатары жоқ) — бұрынғы
  // лездік жуықтауға шегінеміз, ол жауапта белгіленеді.
  const hydroProxy = clamp01(0.6 * soilFactor(o.soil) + 0.4 * o.flood);
  const hydro =
    o.hydroDays == null
      ? hydroProxy
      : Math.max(clamp01(o.hydroDays / tauDays(o.t)), 0.5 * hydroProxy);
  const aedes =
    o.aedesDynamic != null
      ? o.aedesDynamic
      : EGG_READY[o.month] *
        clamp01(0.5 * o.flood + 0.3 * soilFactor(o.soil) + 0.2 * rainFactor(o.rain)) *
        hydro;
  // CULEX ТАРМАҒЫ (тұрақты су, WNV тасымалдаушысы).
  //
  // Модель құжаты бойынша Culex modestus үшін ЕҢ КҮШТІ мекен предикторы —
  // қамыс алқаптары. Ол Sentinel-2 NDVI-мен өлшенген болса, басты салмақ
  // соған беріледі; өлшенбесе бұрынғы прокси (су + қала дренажы) қалады.
  //
  // ⚠️ Салмақтар әдебиетке негізделген, жергілікті есеппен калибрленбеген —
  // басқа параметрлер сияқты (tizilim: indicatorRegistry → mri).
  const culexHabitat =
    o.reed == null
      ? clamp01(0.5 * o.flood + 0.5 * o.urban)
      : clamp01(0.55 * o.reed + 0.3 * o.flood + 0.15 * o.urban);
  const culex = culexHabitat * humidityFactor(o.rh);
  const species = clamp01(AEDES_W[o.month] * aedes + CULEX_W[o.month] * culex);
  const amplified = 100 * phiT * (0.15 + 0.85 * species) * (1 + 0.4 * o.urban + 0.5 * o.flood);
  return Math.round(Math.min(100, amplified));
}

const cache = new Map<string, { at: number; data: unknown }>();

export async function GET(req: Request) {
  // JAIYQ-MRI — Атыраудың нүктелік тізіліміне, Жайық жайылмасына және
  // елді мекен салмақтарына сүйенеді. Ол тізілімсіз есептелген сан
  // JAIYQ-MRI емес — сондықтан басқа қалада «жоқ» деп қайтарылады.
  const region = getRegion(new URL(req.url).searchParams.get("region"));
  if (!hasModule(region, "mosquito")) {
    return NextResponse.json(moduleUnavailable(region, "mosquito"));
  }
  const points = atyrauPoints();

  const hit = cache.get(region.id);
  if (hit && Date.now() - hit.at < 3600_000) return NextResponse.json(hit.data);
  try {
    // L1 — ТАСҚЫН ИМПУЛЬСІ. Метеорологиямен қатар сұралады, сондықтан
    // қосымша кідіріс бермейді. Қолжетімсіз болса `value: null` қайтады
    // да, модель әлсіретілген режимде жұмыс істеп, ол ашық жазылады.
    const origin = new URL(req.url).origin;
    const [res, dailyRes, spinRes, pulse] = await Promise.all([
      fetch(SRC_URL(points), { next: { revalidate: 3600 } }),
      fetch(DAILY_URL(points), { next: { revalidate: 3600 } }),
      fetch(SPINUP_URL(points), { next: { revalidate: 3600 } }),
      fetchFloodPulse(origin, region.id),
    ]);
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    if (!dailyRes.ok) throw new Error(`upstream daily ${dailyRes.status}`);
    const arr = await res.json();
    const list = Array.isArray(arr) ? arr : [arr];

    // Тәуліктік дерек БӨЛЕК сұраныстан келеді (жоғарыдағы түсініктемені
    // қара). Нүкте реті екі жауапта да бірдей — сұраныстағы координаталар
    // тізбегі бірдей. Оны әр нүктенің өз нысанына қосамыз, сонда төмендегі
    // талдау коды бұрынғыдай `d.daily` арқылы оқи береді.
    const dailyArr = await dailyRes.json();
    const dailyList = Array.isArray(dailyArr) ? dailyArr : [dailyArr];
    for (let i = 0; i < list.length; i++) list[i].daily = dailyList[i]?.daily;
    const month = new Date().getMonth(); // FPEB айлық фенология салмағы үшін

    // Spin-up тәуліктік температурасы (нүкте бойынша)
    const spinArr = spinRes.ok ? await spinRes.json() : null;
    const spinList: {
      daily?: { time?: string[]; temperature_2m_max?: (number | null)[]; temperature_2m_min?: (number | null)[] };
    }[] = spinArr ? (Array.isArray(spinArr) ? spinArr : [spinArr]) : [];

    // Күндік тасқын импульсі (GloFAS) — күні бойынша индекс
    const pulseByDate = new Map(pulse.dailyPulse.map((d) => [d.date, d.ratio]));
    const today = new Date().toISOString().slice(0, 10);

    const grid = list.map(
      (
        d: {
        latitude: number;
        longitude: number;
        utc_offset_seconds?: number;
        current?: { relative_humidity_2m?: number; soil_moisture_0_to_1cm?: number };
        hourly?: {
          time?: string[];
          temperature_2m?: (number | null)[];
          relative_humidity_2m?: (number | null)[];
          soil_moisture_0_to_1cm?: (number | null)[];
        };
        daily?: {
          time?: string[];
          temperature_2m_max?: (number | null)[];
          temperature_2m_min?: (number | null)[];
          precipitation_sum?: (number | null)[];
        };
      },
        idx: number
      ) => {
        const meta = points[idx] ?? { dense: false };
        const rh = d.current?.relative_humidity_2m ?? 0;
        const soil = d.current?.soil_moisture_0_to_1cm ?? null;
        const urban = urbanFactor(d.latitude, d.longitude);
        // Бейімділік × өлшенген импульс. Импульс жоқ болса — бейімділік
        // жалғыз қалады (ескі мінез-құлық), бұл жауапта белгіленеді.
        const susceptibility = floodplainFactor(d.latitude, d.longitude);
        const pulseHere = pulseAt(pulse, d.latitude, d.longitude);
        const flood = pulseHere == null ? susceptibility : susceptibility * pulseHere;
        // Гидропериод тек өлшенген бақылау терезесінде болады
        const hydroDays = hydroDaysAt(pulse, d.latitude, d.longitude);
        // Қамыс мекені — Culex тармағының басты предикторы
        const reed = reedAt(pulse, d.latitude, d.longitude);

        // ── L2 ДИНАМИКАСЫ: FPEB интеграциясы ────────────────────────
        // Драйверлер: GloFAS күндік тасқыны × осы нүктенің бейімділігі,
        // тәуліктік температура, гидропериодтан шыққан тірі қалу.
        const spin = spinList[idx]?.daily;
        let fpebSim: { date: string; adults: number }[] | null = null;
        if (spin?.time?.length && pulseByDate.size) {
          const drivers: DayDriver[] = [];
          for (let k = 0; k < spin.time.length; k++) {
            const date = spin.time[k];
            const ratio = pulseByDate.get(date);
            if (ratio == null) continue; // GloFAS қамтымаған күн — қалдырамыз
            const tmax = spin.temperature_2m_max?.[k];
            const tmin = spin.temperature_2m_min?.[k];
            if (tmax == null || tmin == null) continue;
            const tday = (tmax + tmin) / 2;
            drivers.push({
              date,
              temp: tday,
              flood: clamp01(ratio * susceptibility),
              // Гидропериод бір ғана ағымдағы өлшем — терезе бойында
              // тұрақты деп алынады (S1 қайталауы 6 күн)
              survival:
                hydroDays == null
                  ? clamp01(0.6 * soilFactor(soil) + 0.4 * susceptibility * ratio)
                  : clamp01(hydroDays / tauDays(tday)),
            });
          }
          if (drivers.length >= 20) {
            const startMonth = new Date(drivers[0].date).getUTCMonth();
            fpebSim = integrateFpeb(drivers, startMonth).map((x) => ({
              date: x.date,
              adults: normalizeAdults(x.adults),
            }));
          }
        }
        const adultsOn = (date: string): number | null =>
          fpebSim?.find((x) => x.date === date)?.adults ?? null;
        const peak = fpebSim
          ? emergencePeak(
              fpebSim.map((x) => ({ date: x.date, adults: x.adults, larvae: 0, eggs: 0 })),
              today
            )
          : null;

        const times = d.daily?.time ?? [];
        const tmax = d.daily?.temperature_2m_max ?? [];
        const tmin = d.daily?.temperature_2m_min ?? [];
        const precip = d.daily?.precipitation_sum ?? [];
        // Бүгін тәуліктік массивте DAILY_PAST орнында тұрады
        // (past_days=N → бүгін = offset N). Тұрақтыға байланған:
        // терезе өзгерсе, ығысу да өзімен бірге өзгереді.
        const todayIdx = DAILY_PAST;

        const dayIndex = (i: number) => {
          const t = ((tmax[i] ?? 0) + (tmin[i] ?? 0)) / 2;
          // rolling 7-day rain ending on day i (standing-water buildup)
          let rain = 0;
          for (let k = Math.max(0, i - 6); k <= i; k++) rain += precip[k] ?? 0;
          return {
            index: fpebIndex({
              t, rh, soil, rain, flood, urban, month, hydroDays, reed,
              aedesDynamic: adultsOn(times[i] ?? ""),
            }),
            temp: +t.toFixed(1),
            rainMm: +rain.toFixed(1),
          };
        };

        // Бүгіннен бастап DAILY_FORECAST күндік болжам
        const days = Array.from({ length: DAILY_FORECAST }, (_, k) => {
          const i = todayIdx + k;
          const calc = dayIndex(i);
          return { date: times[i] ?? "", ...calc };
        });

        // САҒАТТЫҚ индекс — бүгінгі 24 сағат (past_days=7 → бүгін 00:00 = offset 168).
        // Температура тәуліктік ырғағы (түн салқын+ылғал → жоғары) иконка шоғырын
        // сағат сайын жылжытады. Жаңбыр/тасқын/қала — тұрақты контекст.
        const hTime = d.hourly?.time ?? [];
        const hTemp = d.hourly?.temperature_2m ?? [];
        const hRh = d.hourly?.relative_humidity_2m ?? [];
        const hSoil = d.hourly?.soil_moisture_0_to_1cm ?? [];
        // ӨТКЕН 24 САҒАТ + АЛДАҒЫ 24 САҒАТ — барлығы 48 нүкте, ортасы «қазір».
        //
        // Бұрын тек бүгінгі 00:00–23:00 берілетін: түн ортасында ашсаң,
        // алдағы бір сағаттан басқа ештеңе көрінбейтін. Енді терезе
        // ағымдағы сағатқа ОРТАЛЫҚТАНҒАН, басқа эко қабаттармен бірдей.
        //
        // Open-Meteo `timezone=auto` → уақыттар ЖЕРГІЛІКТІ (офсетсіз),
        // сондықтан «қазірді» де сол белдеуге ауыстырамыз.
        const offsetMs = (d.utc_offset_seconds ?? 0) * 1000;
        const nowLocal = Date.now() + offsetMs;
        let cur = hTime.findIndex((t) => new Date(t).getTime() > nowLocal);
        // Қамтылмаса — бүгін 00:00 (сағаттық массивте HOURLY_PAST × 24 орны)
        cur = cur < 0 ? HOURLY_PAST * 24 : Math.max(0, cur - 1);
        const from = Math.max(0, Math.min(cur - 24, Math.max(0, hTime.length - 48)));
        const count = Math.min(48, Math.max(0, hTime.length - from));
        const nowIndex = cur - from;

        const dayRain = days[0].rainMm;
        const hours = Array.from({ length: count }, (_, k) => {
          const i = from + k;
          const t = hTemp[i] ?? days[0].temp;
          const hrh = hRh[i] ?? rh;
          const hsoil = hSoil[i] ?? soil;
          const date = (hTime[i] ?? "").slice(0, 10);
          return {
            time: hTime[i] ?? "",
            /** Осы сағат өтіп кетті ме — UI-де өткен/болжам болып бөлінеді */
            past: k < nowIndex,
            index: fpebIndex({
              t, rh: hrh, soil: hsoil, rain: dayRain, flood, urban, month, hydroDays, reed,
              // Тәуліктік ересек саны — сағат ішінде өзгермейді; сағаттық
              // ырғақты Φ_T(сағаттық температура) береді. Күні бойынша
              // алынады, сондықтан 48 сағат екі-үш тәулікті қамтиды.
              aedesDynamic: adultsOn(date),
            }),
            temp: +t.toFixed(1),
          };
        });

        return {
          lat: meta.lat ?? d.latitude,   // нақты координата (Open-Meteo snap емес)
          lng: meta.lng ?? d.longitude,
          dense: meta.dense,
          name: meta.name,
          urban: +urban.toFixed(2),
          flood: +flood.toFixed(2),
          // Екеуін бөлек береміз — «бейім, бірақ бүгін құрғақ» пен
          // «бейім әрі су басқан» айырмасы UI-де көрінуі үшін
          floodSusceptibility: +susceptibility.toFixed(2),
          floodPulse: pulseHere == null ? null : +pulseHere.toFixed(2),
          /** Су кемінде қанша күн тұрды (SAR). null — өлшенбеген */
          hydroperiodDays: hydroDays,
          /** Қамыс мекені 0..1 (S2 NDVI). null — өлшенбеген */
          reedHabitat: reed,
          /** FPEB динамикасы қолданылды ма */
          dynamic: fpebSim != null,
          /** `hours` ішіндегі «қазір» индексі (өткен/алдағы шекарасы) */
          nowIndex,
          /** Массалық шығу шыңы (болжам терезесінде) */
          emergencePeak: peak,
          index: days[0].index, // today (back-compat)
          temperature: days[0].temp,
          humidity: rh,
          weekRainMm: days[0].rainMm,
          days,
          hours,
        };
      }
    );

    // Облыс бойынша орташа — эко-паспортқа жиынтық көрсеткіш ретінде керек
    const idx = grid.map((g) => g.index).filter((v): v is number => Number.isFinite(v));
    const avgIndex = idx.length
      ? Math.round(idx.reduce((a, b) => a + b, 0) / idx.length)
      : null;

    const data = {
      fetchedAt: new Date().toISOString(),
      source: "JAIYQ-MRI · FPEB (Flood-Pulse Egg-Bank) · Open-Meteo (live) + Mordecai термиялық гейт + қос түр (Aedes/Culex)",
      region: { id: region.id, name: region.name },
      /**
       * L2 ДИНАМИКАСЫ — қанша нүктеде FPEB интеграциясы жүрді.
       * Барлығында жүрмесе, қалғандары лездік жуықтаумен есептелген.
       */
      dynamics: {
        available: grid.filter((g) => g.dynamic).length > 0,
        pointsWithOde: grid.filter((g) => g.dynamic).length,
        pointsTotal: grid.length,
        emergencePeak: (() => {
          const peaks = grid.map((g) => g.emergencePeak).filter(Boolean) as { date: string; value: number }[];
          if (!peaks.length) return null;
          return peaks.reduce((a, b) => (b.value > a.value ? b : a));
        })(),
        note:
          "Модель су басудан кейінгі КІДІРІСТІ есептейді: жұмыртқа жарылады → " +
          "дернәсіл τ(T) күн дамиды → ересек шығады. Сондықтан шың тасқынмен " +
          "бір күні емес, одан кейін болады. Параметрлер әдебиеттен, " +
          "жергілікті калибрлеу жоқ — сан салыстыруға жарайды, абсолют емес.",
      },
      amplification: "registry",
      amplificationNote:
        "Жайық жайылмасы мен елді мекендер тізілімі қолданылды " +
        "(қалалық + гидрологиялық күшейту).",
      // L1 — тасқын импульсі (Sentinel-1 SAR + GloFAS)
      floodSignal: {
        available: pulse.value != null,
        value: pulse.value,
        source: pulse.source,
        sarZonesOk: pulse.sarZonesOk,
        sarPctMax: pulse.sarPct,
        glofasRatio: pulse.glofasRatio,
        /** Терезелердегі ең ұзақ гидропериод (күн, «кемінде») */
        hydroperiodDaysMax:
          pulse.byZone.map((z) => z.hydroDays).filter((d): d is number => d != null).length
            ? Math.max(...pulse.byZone.map((z) => z.hydroDays ?? 0))
            : null,
        /** Қамыс мекені өлшенген терезелер саны және ең тығызы */
        reedZonesOk: pulse.reedZonesOk,
        reedMax: pulse.habitat.length
          ? Math.max(...pulse.habitat.map((h) => h.reed ?? 0))
          : null,
        note: pulse.note,
      },
      avgIndex,
      maxIndex: idx.length ? Math.max(...idx) : null,
      gridPoints: grid.length,
      grid,
    };
    cache.set(region.id, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (err) {
    console.error("Mosquito grid error:", err);
    return NextResponse.json({ error: "Тірі ауа райы деректері уақытша қолжетімсіз" }, { status: 503 });
  }
}
