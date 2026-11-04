// ДАЛАЛЫҚ ЖУРНАЛ — қабатқа сай жазба түрлері мен өрістері (FieldSeeker үлгісі).
// SQL check-тері (supabase/migrations/20261105_map_tools.sql) осы тізімдермен
// бірдей болуы керек — fieldJournal.test.ts тексереді.

import { validateRing, ringCentroid, type LngLat } from "./areaGeo";
import { pointInPolygon, ATYRAU_OBLAST } from "./firms";

export const JOURNAL_UNAVAILABLE = "Далалық журнал кестесі қолжетімсіз — миграция қолданылмаған болуы мүмкін";

export const JOURNAL_LAYERS = ["green", "waste", "mosquito", "air", "water", "soil", "oil", "nature", "fire", "general"] as const;
export type JournalLayer = typeof JOURNAL_LAYERS[number];
export const JOURNAL_KINDS = ["planting", "dump", "breeding_site", "larvicide", "trap", "sample", "observation", "inspection"] as const;
export type JournalKind = typeof JOURNAL_KINDS[number];
export const JOURNAL_STATUSES = ["planned", "open", "done", "failed", "cancelled"] as const;
export type JournalStatus = typeof JOURNAL_STATUSES[number];

export interface FieldSpec {
  key: string;
  label: string;
  type: "number" | "text" | "select";
  unit?: string;
  options?: string[];
  required?: boolean;
  min?: number;
  max?: number;
}

export interface KindSpec {
  kind: JournalKind;
  label: string;
  layers: JournalLayer[];
  geometry: "point" | "polygon" | "either";
  statuses: JournalStatus[];
  statusLabels: Partial<Record<JournalStatus, string>>;
  fields: FieldSpec[];
}

export const KIND_SPECS: KindSpec[] = [
  {
    kind: "planting", label: "Көгалдандыру: отырғызу", layers: ["green"], geometry: "either",
    statuses: ["planned", "open", "done", "failed", "cancelled"],
    statusLabels: { planned: "жоспар", open: "отырғызылды", done: "тамыр алды", failed: "қурады", cancelled: "болмады" },
    fields: [
      { key: "species", label: "Түрі", type: "text", required: true },
      { key: "count", label: "Саны", type: "number", unit: "дана", min: 1, max: 1_000_000, required: true },
      { key: "irrigation", label: "Суару", type: "select", options: ["тамшылатып", "арық", "қолмен", "жоқ"] },
      { key: "responsible", label: "Жауапты ұйым", type: "text" },
    ],
  },
  {
    kind: "dump", label: "Қоқыс үйіндісі", layers: ["waste"], geometry: "either",
    statuses: ["open", "done", "cancelled"],
    statusLabels: { open: "анықталды", done: "тазаланды", cancelled: "расталмады" },
    fields: [
      { key: "volume_m3", label: "Көлемі", type: "number", unit: "м³", min: 0, max: 100_000 },
      { key: "waste_type", label: "Түрі", type: "select", options: ["тұрмыстық", "құрылыс", "шина", "мұнай қалдығы", "медициналық", "аралас"], required: true },
    ],
  },
  {
    kind: "breeding_site", label: "Маса көбею орны", layers: ["mosquito"], geometry: "either",
    statuses: ["open", "done", "cancelled"],
    statusLabels: { open: "белсенді", done: "жойылды/құрғады", cancelled: "расталмады" },
    fields: [
      { key: "water_type", label: "Су түрі", type: "select", options: ["тұрақты су", "батпақ", "қамыс", "арық", "подвал/жертөле", "басқа"], required: true },
      { key: "larvae_per_dip", label: "Личинка / ожау", type: "number", unit: "дана", min: 0, max: 1000 },
    ],
  },
  {
    kind: "larvicide", label: "Личинкаға қарсы өңдеу", layers: ["mosquito"], geometry: "either",
    statuses: ["planned", "done", "cancelled"],
    statusLabels: { planned: "жоспар", done: "өңделді", cancelled: "болмады" },
    fields: [
      { key: "product", label: "Препарат", type: "text", required: true },
      { key: "dose", label: "Мөлшері", type: "number", min: 0, max: 100_000 },
      { key: "dose_unit", label: "Бірлігі", type: "select", options: ["кг/га", "л/га", "г/м²", "кг", "л"] },
    ],
  },
  {
    kind: "trap", label: "Маса тұзағы", layers: ["mosquito"], geometry: "point",
    statuses: ["done"], statusLabels: { done: "жиналды" },
    fields: [
      { key: "trap_type", label: "Тұзақ түрі", type: "select", options: ["CDC light", "BG-Sentinel", "CO₂", "басқа"], required: true },
      { key: "count", label: "Ұсталған масалар", type: "number", unit: "дана", min: 0, max: 100_000, required: true },
      { key: "nights", label: "Түн саны", type: "number", min: 1, max: 14 },
      { key: "genus", label: "Негізгі туыс", type: "select", options: ["Culex", "Aedes", "Anopheles", "анықталмады"] },
    ],
  },
  {
    kind: "sample", label: "Сынама (зертхана)", layers: ["air", "water", "soil", "oil"], geometry: "point",
    statuses: ["open", "done"], statusLabels: { open: "зертханада", done: "нәтиже бар" },
    fields: [
      { key: "parameter", label: "Параметр", type: "text", required: true },
      { key: "value", label: "Мәні", type: "number" },
      { key: "unit", label: "Бірлігі", type: "text" },
      { key: "lab", label: "Зертхана", type: "text" },
      { key: "method", label: "Әдіс / стандарт", type: "text" },
    ],
  },
  {
    kind: "observation", label: "Бақылау", layers: ["nature", "green", "water", "general"], geometry: "either",
    statuses: ["done"], statusLabels: { done: "тіркелді" },
    fields: [
      { key: "subject", label: "Нысан (түр, құбылыс)", type: "text", required: true },
      { key: "count", label: "Саны", type: "number", min: 0, max: 1_000_000 },
    ],
  },
  {
    kind: "inspection", label: "Инспекция", layers: ["air", "water", "soil", "oil", "fire", "waste", "general"], geometry: "either",
    statuses: ["planned", "open", "done", "cancelled"],
    statusLabels: { planned: "жоспар", open: "жүріп жатыр", done: "аяқталды", cancelled: "болмады" },
    fields: [
      { key: "object", label: "Тексерілетін нысан", type: "text", required: true },
      { key: "finding", label: "Нәтиже", type: "select", options: ["бұзушылық жоқ", "бұзушылық анықталды", "қосымша тексеру керек"] },
      { key: "act_no", label: "Акт нөмірі", type: "text" },
    ],
  },
];

export const LAYER_LABELS: Record<JournalLayer, string> = {
  green: "Көгалдандыру", waste: "Қоқыс", mosquito: "Маса", air: "Ауа", water: "Су", soil: "Топырақ",
  oil: "Мұнай", nature: "Табиғат", fire: "Өрт", general: "Жалпы",
};

export const kindSpec = (k: string) => KIND_SPECS.find((s) => s.kind === k);
export const kindsFor = (layer: JournalLayer) => KIND_SPECS.filter((s) => s.layers.includes(layer));

export type Geom = { type: "Point"; coordinates: LngLat } | { type: "Polygon"; coordinates: LngLat[][] };

export interface EntryInput {
  layer: JournalLayer;
  kind: JournalKind;
  geom: Geom;
  event_date: string;
  status: JournalStatus;
  fields: Record<string, string | number>;
  note?: string;
}

export type EntryCheck = { ok: true; row: EntryInput & { lat: number; lng: number; area_km2: number | null } } | { ok: false; error: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Жазбаны тексереді: түр↔қабат, геометрия, өрістер, мәртебе. Сервер де, клиент те. */
export function validateEntry(input: unknown, today = new Date()): EntryCheck {
  if (!input || typeof input !== "object") return { ok: false, error: "Жазба жоқ" };
  const e = input as Partial<EntryInput>;
  const spec = kindSpec(String(e.kind));
  if (!spec) return { ok: false, error: "Жазба түрі белгісіз" };
  if (!JOURNAL_LAYERS.includes(e.layer as JournalLayer) || !spec.layers.includes(e.layer as JournalLayer)) return { ok: false, error: "Бұл түр осы қабатқа жатпайды" };
  if (!spec.statuses.includes(e.status as JournalStatus)) return { ok: false, error: "Мәртебе жарамсыз" };
  if (!e.event_date || !DATE.test(e.event_date) || Number.isNaN(Date.parse(e.event_date))) return { ok: false, error: "Күні жарамсыз" };
  const maxDate = new Date(today.getTime() + 366 * 86400_000).toISOString().slice(0, 10);
  if (e.event_date > maxDate) return { ok: false, error: "Күні тым алыс болашақта" };
  if (e.status !== "planned" && e.event_date > today.toISOString().slice(0, 10)) return { ok: false, error: "Болашақ күн тек «жоспар» мәртебесіне" };

  let lat: number, lng: number, area: number | null = null, geom: Geom;
  const g = e.geom as Geom | undefined;
  if (g?.type === "Point" && Array.isArray(g.coordinates)) {
    if (spec.geometry === "polygon") return { ok: false, error: "Бұл түрге аймақ керек" };
    [lng, lat] = g.coordinates.map(Number) as LngLat;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !pointInPolygon(lng, lat, ATYRAU_OBLAST)) return { ok: false, error: "Нүкте Атырау облысының ішінде болуы керек" };
    geom = { type: "Point", coordinates: [+lng.toFixed(6), +lat.toFixed(6)] };
  } else if (g?.type === "Polygon" && Array.isArray(g.coordinates?.[0])) {
    if (spec.geometry === "point") return { ok: false, error: "Бұл түрге нүкте керек" };
    const c = validateRing(g.coordinates[0]);
    if (!c.ok) return { ok: false, error: c.error };
    [lng, lat] = ringCentroid(c.ring);
    area = c.areaKm2;
    const r = c.ring.map(([x, y]) => [+x.toFixed(6), +y.toFixed(6)] as LngLat);
    geom = { type: "Polygon", coordinates: [[...r, r[0]]] };
  } else return { ok: false, error: "Геометрия жоқ" };

  const fields: Record<string, string | number> = {};
  const raw = (e.fields ?? {}) as Record<string, unknown>;
  for (const f of spec.fields) {
    const v = raw[f.key];
    if (v === undefined || v === null || v === "") {
      if (f.required) return { ok: false, error: `Өріс міндетті: ${f.label}` };
      continue;
    }
    if (f.type === "number") {
      const n = Number(v);
      if (!Number.isFinite(n) || (f.min != null && n < f.min) || (f.max != null && n > f.max)) return { ok: false, error: `Өріс жарамсыз: ${f.label}` };
      fields[f.key] = n;
    } else if (f.type === "select") {
      if (!f.options!.includes(String(v))) return { ok: false, error: `Өріс жарамсыз: ${f.label}` };
      fields[f.key] = String(v);
    } else {
      const s = String(v).trim();
      if (s.length > 200) return { ok: false, error: `Өріс тым ұзын: ${f.label}` };
      fields[f.key] = s;
    }
  }
  const note = e.note?.toString().trim();
  if (note && note.length > 2000) return { ok: false, error: "Ескерту 2000 таңбадан аспауы керек" };
  return { ok: true, row: { layer: e.layer as JournalLayer, kind: spec.kind, geom, event_date: e.event_date, status: e.status as JournalStatus, fields, ...(note ? { note } : {}), lat: lat!, lng: lng!, area_km2: area } };
}

/** Отырғызу тексеруі: отырғызуға дейінгі жаз vs соңғы толық жаз (NDVI медианасы) */
export function plantingSeasons(eventDate: string, now = new Date()) {
  const plantYear = +eventDate.slice(0, 4);
  const recentYear = now.getUTCFullYear() - (now.getUTCMonth() < 8 ? 1 : 0);
  const season = (y: number) => ({ year: y, from: `${y}-06-01`, to: `${y}-08-31` });
  // Отырғызуға дейінгі соңғы толық жаз: қыркүйектен кейін отырғызылса — сол жылғы жаз
  const baseline = season(eventDate > `${plantYear}-08-31` ? plantYear : plantYear - 1);
  const recent = season(recentYear);
  // Соңғы жаз отырғызудан КЕЙІН басталуы керек
  return { baseline, recent, tooEarly: eventDate >= recent.from };
}

/** NDVI айырмасының шегі — жоба болжамы, жерде валидацияланбаған */
export const PLANTING_DNDVI = 0.05;
export const PLANTING_CAVEATS = [
  "NDVI өсуі ағаштың тамыр алғанын ДӘЛЕЛДЕМЕЙДІ: шөп, суару, жауын да әсер етеді. Жас көшеттер 10 м пиксельде 2–4 жыл көрінбеуі мүмкін.",
  "Шек ±0.05 — жоба болжамы, жерде валидацияланбаған. Растау үшін далалық тексеру керек.",
  "Аймақ кемінде бірнеше Sentinel-2 пикселін (10×10 м) қамтуы керек; жалғыз нүкте үшін тексеру жасалмайды.",
];
