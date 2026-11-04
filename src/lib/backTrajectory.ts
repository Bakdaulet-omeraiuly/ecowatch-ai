// КЕРІ ТРАЕКТОРИЯ — «бұл нүктеге ауа қайдан келді?» (📊 модель).
//
// Әдіс: Open-Meteo сағаттық 10 м жел өрісі (9×9 тор, ±2°), кеңістікте
// билинеар, уақытта сызықтық интерполяция; кері бағытта RK2 (орта нүкте)
// интегралы, қадам 15 мин. EPA/NOAA HYSPLIT-тің қарапайым 2D аналогы:
// тік қозғалыс, турбуленттік диффузия, шекаралық қабат ЕСКЕРІЛМЕЙДІ —
// сондықтан бұл бағыт көрсеткіш, ластану көзін дәлелдемейді.

export const GRID_N = 9;
export const GRID_HALF_DEG = 2;
export const STEP_MIN = 15;

export interface WindField {
  lats: number[]; // өсу ретімен, GRID_N
  lngs: number[]; // өсу ретімен, GRID_N
  times: number[]; // unix ms, өсу ретімен
  /** [timeIdx][latIdx][lngIdx] — u, v (м/с, ауа БАРАТЫН бағыт: u шығысқа, v солтүстікке) */
  u: number[][][];
  v: number[][][];
}

/** Метеорологиялық бағыт (қайдан соғады, °) + жылдамдық → u, v */
export function toUV(speedMs: number, dirFromDeg: number): [number, number] {
  const r = (dirFromDeg * Math.PI) / 180;
  return [-speedMs * Math.sin(r), -speedMs * Math.cos(r)];
}

export function gridAxes(lat: number, lng: number) {
  const step = (2 * GRID_HALF_DEG) / (GRID_N - 1);
  const axis = (c: number) => Array.from({ length: GRID_N }, (_, i) => +(c - GRID_HALF_DEG + i * step).toFixed(4));
  return { lats: axis(lat), lngs: axis(lng) };
}

function bracket(xs: number[], x: number): [number, number, number] | null {
  if (x < xs[0] || x > xs[xs.length - 1]) return null;
  for (let i = 0; i < xs.length - 1; i++) {
    if (x <= xs[i + 1]) return [i, i + 1, xs[i + 1] === xs[i] ? 0 : (x - xs[i]) / (xs[i + 1] - xs[i])];
  }
  return [xs.length - 1, xs.length - 1, 0];
}

/** Нүкте мен уақыттағы жел; тордан/уақыттан тыс болса null */
export function sampleWind(f: WindField, lat: number, lng: number, t: number): [number, number] | null {
  const bi = bracket(f.lats, lat), bj = bracket(f.lngs, lng), bt = bracket(f.times, t);
  if (!bi || !bj || !bt) return null;
  const at = (arr: number[][][], k: number) => {
    const [i0, i1, fi] = bi, [j0, j1, fj] = bj;
    const a = arr[k][i0][j0] * (1 - fj) + arr[k][i0][j1] * fj;
    const b = arr[k][i1][j0] * (1 - fj) + arr[k][i1][j1] * fj;
    return a * (1 - fi) + b * fi;
  };
  const [k0, k1, ft] = bt;
  const u = at(f.u, k0) * (1 - ft) + at(f.u, k1) * ft;
  const v = at(f.v, k0) * (1 - ft) + at(f.v, k1) * ft;
  return Number.isFinite(u) && Number.isFinite(v) ? [u, v] : null;
}

export interface TrajPoint { lat: number; lng: number; t: number; hoursBack: number }

/** Келу нүктесінен кері интеграл. Тордан шықса — тоқтайды (ұзартылмайды). */
export function integrateBack(f: WindField, lat: number, lng: number, arrival: number, hours: number): { points: TrajPoint[]; truncated: boolean } {
  const dt = STEP_MIN * 60; // с
  const mPerDegLat = 111_320;
  const move = (la: number, ln: number, u: number, v: number, s: number): [number, number] => [
    la - (v * s) / mPerDegLat,
    ln - (u * s) / (mPerDegLat * Math.cos((la * Math.PI) / 180)),
  ];
  const points: TrajPoint[] = [{ lat, lng, t: arrival, hoursBack: 0 }];
  let la = lat, ln = lng, t = arrival;
  const steps = Math.round((hours * 60) / STEP_MIN);
  for (let k = 1; k <= steps; k++) {
    const w1 = sampleWind(f, la, ln, t);
    if (!w1) return { points, truncated: true };
    const [mla, mln] = move(la, ln, w1[0], w1[1], dt / 2);
    const w2 = sampleWind(f, mla, mln, t - (dt * 1000) / 2);
    if (!w2) return { points, truncated: true };
    [la, ln] = move(la, ln, w2[0], w2[1], dt);
    t -= dt * 1000;
    if (k % (60 / STEP_MIN) === 0) points.push({ lat: la, lng: ln, t, hoursBack: (k * STEP_MIN) / 60 });
  }
  return { points, truncated: false };
}

/** Нүктенің сынық сызыққа дейінгі ең жақын қашықтығы (км) және сол жердегі уақыт (сағ бұрын) */
export function nearestOnPath(points: TrajPoint[], lat: number, lng: number): { km: number; hoursBack: number } {
  const kx = 111.32 * Math.cos((lat * Math.PI) / 180), ky = 111.32;
  let best = { km: Infinity, hoursBack: 0 };
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const ax = (a.lng - lng) * kx, ay = (a.lat - lat) * ky, bx = (b.lng - lng) * kx, by = (b.lat - lat) * ky;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const s = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    const km = Math.hypot(ax + s * dx, ay + s * dy);
    if (km < best.km) best = { km, hoursBack: a.hoursBack + s * (b.hoursBack - a.hoursBack) };
  }
  if (points.length === 1) best = { km: Math.hypot((points[0].lng - lng) * kx, (points[0].lat - lat) * ky), hoursBack: 0 };
  return best;
}

export const TRAJECTORY_CAVEATS = [
  "📊 Модель: Open-Meteo 10 м жел өрісі бойынша 2D кері траектория. Тік қозғалыс, турбуленттілік, шекаралық қабат ескерілмейді.",
  "Бұл ластану көзін ДӘЛЕЛДЕМЕЙДІ — тек ауа массасы қай бағыттан келгенін көрсетеді. Қателік уақыт өткен сайын өседі.",
  "Маршрутқа жақын нысан — тексеруге басымдық, кінә емес. Расталған тұжырым үшін өлшем (бекет, сынама) керек.",
];
