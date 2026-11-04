import { LOW_VEG, WATER_PRESENT } from "@/data/greenery";
import type { GreenCell, GreenChangeCell } from "./greenNdvi";
import type { GreenContext } from "./osmGreen";

export const ADVICE_TEXT = {
  "no-ndvi": "Ұсыныс жасалмады: бұл ұяшық үшін спутниктік NDVI дерегі жоқ.",
  "residential-low-veg": "Тұрғын аумақта өсімдік жамылғысы аз: көше мен аула ағаштарын отырғызу қарастырылсын.",
  "industrial-buffer": "Өнеркәсіп аумағы: тұрғын үйлерге қарай санитарлық-қорғаныш жасыл белдеуін (ағаш қатарлары) қарастыру.",
  decline: "Жасыл жамылғы азайған: себебін жерде тексеру керек (құрылыс, суарудың тоқтауы, құрғақ жыл).",
  "water-available": "Ұяшықта су көзі бар — суару мүмкіндігін жерде бағалау.",
  "water-not-found": "Ұяшықта су көзі анықталмады — құрғаққа төзімді өсімдіктер мен тамшылатып суару қажет болуы мүмкін.",
  "landuse-unknown": "Жер мақсаты белгісіз (OSM дерегі жоқ) — ұсыныс жер мақсатын ескермейді.",
  none: "Ереже бойынша басым ұсыныс жоқ.",
} as const;
export type AdviceCode = keyof typeof ADVICE_TEXT;
export const ADVICE_FOOTER = "Ереже негізіндегі ұсыныс, AI қолданылмаған. Жобадан бұрын жерде тексеру, топырақ тұздылығы мен жер иелігін анықтау қажет.";

export const LANDUSE_LABELS: Record<string, string> = {
  residential: "Тұрғын аумақ", industrial: "Өнеркәсіп аумағы", commercial: "Коммерциялық аумақ",
  retail: "Сауда аумағы", farmland: "Егістік", mixed: "аралас",
};
export interface CellContext { landuse: Record<string, number>; water: number }
export function assignToCells(cells: GreenCell[], context: GreenContext): Record<string, CellContext> {
  const assigned = Object.fromEntries(cells.map((cell) => [cell.id, { landuse: {}, water: 0 }])) as Record<string, CellContext>;
  // Аудан емес, OSM объектілерінің орталықтары саналады. Ортақ шекара бір рет саналады.
  for (const key of ["landuse", "water"] as const) {
    for (const point of context[key]) {
      const cell = cells.find(({ bbox: [w, s, e, n] }) => point.lng >= w && point.lng <= e && point.lat >= s && point.lat <= n);
      if (!cell) continue;
      const target = assigned[cell.id];
      if (key === "water") target.water++;
      else target.landuse[point.kind] = (target.landuse[point.kind] ?? 0) + 1;
    }
  }
  return assigned;
}

export interface AdviceInput {
  key: string;
  label: string;
  value: string | null;
  source: string;
  kind: "satellite" | "osm" | "missing";
}
export function greeningAdvice(cell: GreenChangeCell, osm: CellContext | null) {
  const landuses = Object.entries(osm?.landuse ?? {}).sort((a, b) => b[1] - a[1]);
  const total = landuses.reduce((sum, [, count]) => sum + count, 0);
  // Екі тең жарты болса басым санат жоқ; картада белгі жоқтығы жер мақсатын анықтамайды.
  const dominant = total === 0 ? null : landuses[0][1] >= total / 2 && landuses[0][1] !== landuses[1]?.[1] ? landuses[0][0] : "mixed";
  const satellite = (key: string, label: string, value: number | null): AdviceInput => ({
    key, label, value: value == null ? null : value.toFixed(1), source: "Sentinel-2", kind: value == null ? "missing" : "satellite",
  });
  const inputs: AdviceInput[] = [
    satellite("recentVeg", "Соңғы өсімдік үлесі (%)", cell.recent ? cell.recent.vegFraction * 100 : null),
    satellite("dVeg", "Өсімдік үлесінің өзгерісі (пайыздық тармақ)", cell.change ? cell.change.dVeg * 100 : null),
    satellite("s2Water", "Sentinel-2 су үлесі (%)", cell.recent ? cell.recent.waterFraction * 100 : null),
    { key: "landuse", label: "Жер мақсаты (OSM объектілер саны бойынша)", value: dominant ? LANDUSE_LABELS[dominant] ?? null : null, source: "OpenStreetMap", kind: dominant ? "osm" : "missing" },
    { key: "osmWater", label: "OSM су объектілерінің саны", value: osm ? String(osm.water) : null, source: "OpenStreetMap", kind: osm ? "osm" : "missing" },
    { key: "soilSalinity", label: "Топырақ тұздылығы", value: null, source: "—", kind: "missing" },
  ];
  const codes: AdviceCode[] = [];
  if (!cell.recent) codes.push("no-ndvi");
  else {
    if (!osm || !dominant) codes.push("landuse-unknown");
    if (osm && dominant === "residential" && cell.recent.vegFraction < LOW_VEG) codes.push("residential-low-veg");
    if (osm && dominant === "industrial") codes.push("industrial-buffer");
    if (cell.change?.trend === "down") codes.push("decline");
    if (cell.recent.waterFraction >= WATER_PRESENT || (osm?.water ?? 0) >= 1) codes.push("water-available");
    else if (osm) codes.push("water-not-found");
    if (!codes.length) codes.push("none");
  }
  return { cellId: cell.id, aiUsed: false as const, inputs, codes };
}
