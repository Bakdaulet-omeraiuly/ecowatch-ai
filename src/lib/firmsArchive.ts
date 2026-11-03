// FIRMS АРХИВІ (P4.4) — 1 жылдық тарихи терезе, 10 күндік бөліктермен.
//
// FIRMS area API бір сұраныста ең көбі 10 күн береді, сондықтан 365 күн =
// 37 сұраныс. Соңғы ~60 күн үшін NRT өнімі (SP әлі жарияланбаған), одан
// ертерек — VIIRS SNPP Standard Processing (SP). Бөліктер бір-бірінен
// тәуелсіз: бір бөлік сәтсіз болса, қалғаны қайтады, `complete: false`.
//
// ⚠️ Кілт жоқ/жарамсыз болса — FirmsKeyError (route 503 + себебі береді).
// ⚠️ Жалған дерек жоқ: нәтиже тек FIRMS-тен келген нүктелерден тұрады.

import { fetchFirmsWindow, FirmsKeyError, pointInPolygon, ATYRAU_OBLAST, type FirmsDetection } from "./firms";

export const ARCHIVE_CHUNK_DAYS = 10;
const NRT_RECENT_DAYS = 60;
const CONCURRENCY = 4;
export const ARCHIVE_TTL_MS = 6 * 3600_000;

export interface ArchiveWindow {
  date: string; // YYYY-MM-DD, басталуы
  days: number;
  source: "VIIRS_SNPP_SP" | "VIIRS_SNPP_NRT";
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400_000);

/** [from, to] аралығын 10 күндік терезелерге бөлу (to — қоса) */
export function archiveWindows(fromISO: string, toISO: string, now = new Date()): ArchiveWindow[] {
  const out: ArchiveWindow[] = [];
  const nrtFrom = addDays(now, -NRT_RECENT_DAYS);
  let cur = new Date(`${fromISO}T00:00:00Z`);
  const end = new Date(`${toISO}T00:00:00Z`);
  while (cur <= end) {
    const left = Math.round((end.getTime() - cur.getTime()) / 86400_000) + 1;
    const days = Math.min(ARCHIVE_CHUNK_DAYS, left);
    out.push({
      date: iso(cur),
      days,
      source: cur >= nrtFrom ? "VIIRS_SNPP_NRT" : "VIIRS_SNPP_SP",
    });
    cur = addDays(cur, days);
  }
  return out;
}

export interface ArchiveResult {
  fetchedAt: string;
  window: { from: string; to: string };
  detections: FirmsDetection[];
  /** Сәтсіз терезелер (дата + себеп) — толық емес деректі көрсету үшін */
  failedWindows: { date: string; reason: string }[];
  complete: boolean;
  windowCount: number;
}

async function runPool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Атырау облысы бойынша FIRMS архивін жинау.
 * @throws FirmsKeyError — кілт жоқ/жарамсыз (барлық терезе бірден сәтсіз болса)
 */
export async function fetchFireArchive(opts: {
  key: string;
  bbox: [number, number, number, number];
  from: string;
  to: string;
  now?: Date;
}): Promise<ArchiveResult> {
  const windows = archiveWindows(opts.from, opts.to, opts.now);
  const failedWindows: { date: string; reason: string }[] = [];
  const seen = new Set<string>();
  const detections: FirmsDetection[] = [];

  type WindowResult =
    | { ok: true; w: ArchiveWindow; rows: FirmsDetection[] }
    | { ok: false; w: ArchiveWindow; error: string };

  const results: WindowResult[] = await runPool<ArchiveWindow, WindowResult>(windows, CONCURRENCY, async (w) => {
    try {
      const rows = await fetchFirmsWindow({ key: opts.key, source: w.source, bbox: opts.bbox, date: w.date, days: w.days });
      return { ok: true, w, rows };
    } catch (e) {
      if (e instanceof FirmsKeyError) throw e;
      return { ok: false, w, error: e instanceof Error ? e.message : String(e) };
    }
  });

  for (const r of results) {
    if (!r.ok) {
      failedWindows.push({ date: r.w.date, reason: r.error });
      continue;
    }
    for (const d of r.rows) {
      // Облыс полигоны + дубликат (терезе шекарасында қайталануы мүмкін)
      if (!pointInPolygon(d.lng, d.lat, ATYRAU_OBLAST)) continue;
      const k = `${d.lat.toFixed(4)}|${d.lng.toFixed(4)}|${d.acqDate}|${d.dayNight}`;
      if (seen.has(k)) continue;
      seen.add(k);
      detections.push(d);
    }
  }

  if (windows.length && failedWindows.length === windows.length) {
    throw new Error(`FIRMS архивінің бірде-бір терезесі жүктелмеді: ${failedWindows[0].reason}`);
  }

  return {
    fetchedAt: new Date().toISOString(),
    window: { from: opts.from, to: opts.to },
    detections: detections.sort((a, b) => a.acqDate.localeCompare(b.acqDate)),
    failedWindows,
    complete: failedWindows.length === 0,
    windowCount: windows.length,
  };
}

const archiveCache = new Map<string, { at: number; data: ArchiveResult }>();

/** Соңғы `days` күн (бүгінгі күн қоса) үшін кэштелген архив */
export async function loadFireArchive(opts: {
  key: string;
  regionId: string;
  bbox: [number, number, number, number];
  days: number;
  now?: Date;
}): Promise<ArchiveResult> {
  const now = opts.now ?? new Date();
  const to = iso(now);
  const from = iso(addDays(now, -(opts.days - 1)));
  const cacheKey = `${opts.regionId}|${from}|${to}`;
  const hit = archiveCache.get(cacheKey);
  if (hit && Date.now() - hit.at < ARCHIVE_TTL_MS) return hit.data;
  const data = await fetchFireArchive({ key: opts.key, bbox: opts.bbox, from, to, now });
  // Толық емес нәтиже қысқа мерзімге кэшіңіз — келесі сұраныс қайта көреді
  archiveCache.set(cacheKey, { at: data.complete ? Date.now() : Date.now() - ARCHIVE_TTL_MS + 600_000, data });
  return data;
}
