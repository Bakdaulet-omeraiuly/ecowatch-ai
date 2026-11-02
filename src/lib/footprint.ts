// Нүкте мен нысан контурының арақашықтығы (км).
//
// Жылу аномалиясын нысанға телудің ЖАЛҒЫЗ ережесі осы файлда. Бұрын
// `/api/object/[id]` 10 км радиусты қолданатын — validation/firms
// көрсеткендей, ол АМӨЗ-ге телінген детекциялардың 96%-ын қате телитін.

/** Жергілікті тең-аралық проекция: [lng, lat] → км (шағын аумақ үшін жеткілікті) */
function project(lat0: number) {
  const kx = 111.32 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 110.574;
  return ([lng, lat]: [number, number]): [number, number] => [lng * kx, lat * ky];
}

function inside(p: [number, number], ring: [number, number][]): boolean {
  let res = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) res = !res;
  }
  return res;
}

/** Контурға дейінгі қашықтық, км. Нүкте контур ішінде болса — 0. */
export function distanceToFootprintKm(lat: number, lng: number, footprint: [number, number][]): number {
  const toXY = project(lat);
  const ring = footprint.map(toXY);
  const p = toXY([lng, lat]);
  if (inside(p, ring)) return 0;
  let best = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1e-12;
    const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / len2));
    best = Math.min(best, Math.hypot(p[0] - (ax + t * dx), p[1] - (ay + t * dy)));
  }
  return best;
}
