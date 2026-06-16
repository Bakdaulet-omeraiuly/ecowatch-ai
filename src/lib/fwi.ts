// Canadian Forest Fire Weather Index (FWI) System
// — van Wagner & Pickett (1985), Copernicus EFFIS-те қолданылатын ресми әдістеме.
// Барлық теңдеулер ғылыми; жалған дерек жоқ. Кіріс — нақты Open-Meteo ауа райы.
//
// Тізбек: FFMC → DMC → DC → ISI + BUI → FWI. Әр код алдыңғы күннің мәнінен
// есептеледі, сондықтан тарихи тізбек («spin-up») қажет.

// Айлық күн ұзақтығы факторлары (солтүстік жарты шар)
const DMC_DAY_LENGTH = [6.5, 7.5, 9.0, 12.8, 13.9, 13.9, 12.4, 10.9, 9.4, 8.0, 7.0, 6.0];
const DC_DAY_LENGTH  = [-1.6, -1.6, -1.6, 0.9, 3.8, 5.8, 6.4, 5.0, 2.4, 0.4, -1.6, -1.6];

export interface DayWeather {
  /** Түскі (12:00) температура, °C */
  temp: number;
  /** Түскі салыстырмалы ылғалдылық, % */
  rh: number;
  /** Түскі жел жылдамдығы, км/сағ */
  wind: number;
  /** 24 сағаттық жауын-шашын, мм */
  rain: number;
  /** Ай нөмірі 0–11 (күн ұзақтығы факторы үшін) */
  month: number;
}

export interface FwiState {
  ffmc: number; // Fine Fuel Moisture Code
  dmc: number;  // Duff Moisture Code
  dc: number;   // Drought Code
}

export interface FwiResult extends FwiState {
  isi: number;  // Initial Spread Index
  bui: number;  // Buildup Index
  fwi: number;  // Fire Weather Index
}

// Стандартты бастапқы («startup») мәндер
export const FWI_STARTUP: FwiState = { ffmc: 85, dmc: 6, dc: 15 };

function fineFuelMoistureCode(prev: number, w: DayWeather): { ffmc: number; m: number } {
  const { temp: T, rh: H, wind: W, rain: ro } = w;
  let mo = (147.2 * (101 - prev)) / (59.5 + prev);

  if (ro > 0.5) {
    const rf = ro - 0.5;
    let mr =
      mo +
      42.5 * rf * Math.exp(-100 / (251 - mo)) * (1 - Math.exp(-6.93 / rf));
    if (mo > 150) mr += 0.0015 * Math.pow(mo - 150, 2) * Math.sqrt(rf);
    mo = Math.min(mr, 250);
  }

  const Ed =
    0.942 * Math.pow(H, 0.679) +
    11 * Math.exp((H - 100) / 10) +
    0.18 * (21.1 - T) * (1 - Math.exp(-0.115 * H));

  let m: number;
  if (mo > Ed) {
    const ko =
      0.424 * (1 - Math.pow(H / 100, 1.7)) +
      0.0694 * Math.sqrt(W) * (1 - Math.pow(H / 100, 8));
    const kd = ko * 0.581 * Math.exp(0.0365 * T);
    m = Ed + (mo - Ed) * Math.pow(10, -kd);
  } else {
    const Ew =
      0.618 * Math.pow(H, 0.753) +
      10 * Math.exp((H - 100) / 10) +
      0.18 * (21.1 - T) * (1 - Math.exp(-0.115 * H));
    if (mo < Ew) {
      const kl =
        0.424 * (1 - Math.pow((100 - H) / 100, 1.7)) +
        0.0694 * Math.sqrt(W) * (1 - Math.pow((100 - H) / 100, 8));
      const kw = kl * 0.581 * Math.exp(0.0365 * T);
      m = Ew - (Ew - mo) * Math.pow(10, -kw);
    } else {
      m = mo;
    }
  }

  const ffmc = (59.5 * (250 - m)) / (147.2 + m);
  return { ffmc: Math.max(0, Math.min(101, ffmc)), m };
}

function duffMoistureCode(prev: number, w: DayWeather): number {
  const { temp: T, rh: H, rain: ro, month } = w;
  let Po = prev;

  if (ro > 1.5) {
    const re = 0.92 * ro - 1.27;
    const Mo = 20 + Math.exp(5.6348 - Po / 43.43);
    let b: number;
    if (Po <= 33) b = 100 / (0.5 + 0.3 * Po);
    else if (Po <= 65) b = 14 - 1.3 * Math.log(Po);
    else b = 6.2 * Math.log(Po) - 17.2;
    const Mr = Mo + (1000 * re) / (48.77 + b * re);
    Po = Math.max(0, 244.72 - 43.43 * Math.log(Mr - 20));
  }

  const Le = DMC_DAY_LENGTH[month];
  const K = T > -1.1 ? 1.894 * (T + 1.1) * (100 - H) * Le * 1e-6 : 0;
  return Math.max(0, Po + 100 * K);
}

function droughtCode(prev: number, w: DayWeather): number {
  const { temp: T, rain: ro, month } = w;
  let Do = prev;

  if (ro > 2.8) {
    const rd = 0.83 * ro - 1.27;
    const Qo = 800 * Math.exp(-Do / 400);
    const Qr = Qo + 3.937 * rd;
    Do = Math.max(0, 400 * Math.log(800 / Qr));
  }

  const Lf = DC_DAY_LENGTH[month];
  let V = T > -2.8 ? 0.36 * (T + 2.8) + Lf : Lf;
  if (V < 0) V = 0;
  return Math.max(0, Do + 0.5 * V);
}

function initialSpreadIndex(ffmc: number, wind: number): number {
  const m = (147.2 * (101 - ffmc)) / (59.5 + ffmc);
  const fW = Math.exp(0.05039 * wind);
  const fF = 91.9 * Math.exp(-0.1386 * m) * (1 + Math.pow(m, 5.31) / 4.93e7);
  return 0.208 * fW * fF;
}

function buildupIndex(dmc: number, dc: number): number {
  let bui: number;
  if (dmc <= 0.4 * dc) {
    bui = (0.8 * dmc * dc) / (dmc + 0.4 * dc || 1);
  } else {
    bui =
      dmc -
      (1 - (0.8 * dc) / (dmc + 0.4 * dc)) *
        (0.92 + Math.pow(0.0114 * dmc, 1.7));
  }
  return Math.max(0, bui);
}

function fireWeatherIndex(isi: number, bui: number): number {
  const fD =
    bui <= 80
      ? 0.626 * Math.pow(bui, 0.809) + 2
      : 1000 / (25 + 108.64 * Math.exp(-0.023 * bui));
  const B = 0.1 * isi * fD;
  return B > 1 ? Math.exp(2.72 * Math.pow(0.434 * Math.log(B), 0.647)) : B;
}

/** Бір күнді есептеп, жаңа FWI күйін қайтарады. */
export function stepFwi(prev: FwiState, w: DayWeather): FwiResult {
  const { ffmc } = fineFuelMoistureCode(prev.ffmc, w);
  const dmc = duffMoistureCode(prev.dmc, w);
  const dc = droughtCode(prev.dc, w);
  const isi = initialSpreadIndex(ffmc, w.wind);
  const bui = buildupIndex(dmc, dc);
  const fwi = fireWeatherIndex(isi, bui);
  return { ffmc, dmc, dc, isi, bui, fwi };
}

/** Тарихи тізбекті спин-ап жасап, соңғы күннің толық нәтижесін қайтарады. */
export function computeFwiSeries(days: DayWeather[], startup = FWI_STARTUP): FwiResult {
  let state: FwiState = { ...startup };
  let last: FwiResult = { ...startup, isi: 0, bui: 0, fwi: 0 };
  for (const d of days) {
    last = stepFwi(state, d);
    state = { ffmc: last.ffmc, dmc: last.dmc, dc: last.dc };
  }
  return last;
}

// EFFIS өрт қаупі сыныптары (FWI шкаласы)
export type FireDanger = "very_low" | "low" | "moderate" | "high" | "very_high" | "extreme";

export function fireDangerClass(fwi: number): FireDanger {
  if (fwi < 5.2) return "very_low";
  if (fwi < 11.2) return "low";
  if (fwi < 21.3) return "moderate";
  if (fwi < 38.0) return "high";
  if (fwi < 50.0) return "very_high";
  return "extreme";
}

export const FIRE_DANGER_KZ: Record<FireDanger, string> = {
  very_low: "Өте төмен",
  low: "Төмен",
  moderate: "Орташа",
  high: "Жоғары",
  very_high: "Өте жоғары",
  extreme: "Аса қауіпті",
};

export const FIRE_DANGER_COLOR: Record<FireDanger, string> = {
  very_low: "#22c55e",
  low: "#84cc16",
  moderate: "#eab308",
  high: "#f97316",
  very_high: "#ef4444",
  extreme: "#991b1b",
};
