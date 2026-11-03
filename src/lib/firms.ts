// NASA FIRMS — ЖАЛҒЫЗ бөлісетін клиент (P4.4). `/api/flares` (NRT) және
// `/api/fire-archive` (архив) осы файлдан оқиды: CSV талдау мен Атырау
// полигоны бір жерде ғана.
//
// ⚠️ Жылу аномалиясы ≠ расталған өрт. Бұл — спутниктің жылу сигналы:
//    өндірістік факел, далалық өрт, күйдірілген шөп немесе жалын — бәрі
//    осылай көрінеді. Осы файлдың нәтижесін «өрт» деп атауға болмайды.

/** Атырау облысының шамамен контуры [lng, lat] — FIRMS bbox-тан кейін сүзіледі */
export const ATYRAU_OBLAST: [number, number][] = [
  [50.2, 47.3], [50.4, 48.2], [51.6, 48.9], [53.4, 48.7], [54.7, 47.9],
  [54.6, 46.9], [53.9, 46.2], [52.2, 45.6], [50.6, 46.3], [50.1, 47.0],
];

export function pointInPolygon(lng: number, lat: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export interface FirmsDetection {
  lat: number;
  lng: number;
  /** bright_ti5 (K) */
  brightness: number;
  /** Fire radiative power (MW) */
  frp: number;
  confidence: string;
  acqDate: string;
  dayNight: string;
}

/** Жарамсыз кілт немесе сұраныс қатесі — FIRMS мәтіндік жауап қайтарады */
export class FirmsKeyError extends Error {}

/**
 * FIRMS `area/csv` жауабын талдау. Кілт жарамсыз болса — FirmsKeyError.
 * Бос жауап (тек тақырып) — бос массив, қате емес.
 */
export function parseFirmsCsv(csv: string): FirmsDetection[] {
  const text = csv.trim();
  if (!text) return [];
  if (text.startsWith("Invalid") || text.includes("Invalid MAP_KEY")) {
    throw new FirmsKeyError("FIRMS кілті жарамсыз");
  }
  const lines = text.split("\n");
  const header = lines[0].split(",");
  const col = (name: string) => header.indexOf(name);
  const iLat = col("latitude"), iLng = col("longitude");
  const iBright = col("bright_ti5"), iFrp = col("frp");
  const iConf = col("confidence"), iDate = col("acq_date"), iDN = col("daynight");
  if (iLat < 0 || iLng < 0) throw new Error("FIRMS CSV тақырыбы күтпеген");

  return lines.slice(1).map((line): FirmsDetection => {
    const c = line.split(",");
    return {
      lat: parseFloat(c[iLat]),
      lng: parseFloat(c[iLng]),
      brightness: parseFloat(c[iBright]) || 0,
      frp: parseFloat(c[iFrp]) || 0,
      confidence: c[iConf] ?? "",
      acqDate: c[iDate] ?? "",
      dayNight: c[iDN] ?? "",
    };
  }).filter((f) => !isNaN(f.lat) && !isNaN(f.lng));
}

/** FIRMS area сұранысы: бір терезе (1..10 күн), `date` — басталу күні (YYYY-MM-DD) */
export async function fetchFirmsWindow(opts: {
  key: string;
  source: string;
  bbox: [number, number, number, number];
  /** Басталу күні; берілмесе — FIRMS соңғы `days` күнді қайтарады */
  date?: string;
  days: number;
  /**
   * Next.js кэш мерзімі (сек). Берілмесе — `no-store` (архив).
   * Тек осы функция FIRMS хостына сұраныс жібереді.
   */
  revalidate?: number;
}): Promise<FirmsDetection[]> {
  const area = opts.bbox.join(",");
  const datePart = opts.date ? `/${opts.date}` : "";
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${opts.key}/${opts.source}/${area}/${opts.days}${datePart}`;
  const init: RequestInit & { next?: { revalidate: number } } =
    opts.revalidate !== undefined
      ? { next: { revalidate: opts.revalidate } }
      : { cache: "no-store" };
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`FIRMS ${res.status}`);
  return parseFirmsCsv(await res.text());
}
