// АЙМАҚТЫҢ ТОРЫН ҚҰРУ.
//
// Карта қабаттары (ауа, маса, топырақ, жел) аймақ бойынша тор нүктелерінде
// сұралады. Бұрын тор Атырау облысына қатып қалған еді — қала ауысқанда
// деректер сол күйінде қалатын.
//
// Енді тор аймақтың `bbox`-ынан құрылады, сондықтан Алматыны таңдағанда
// Алматының үстінде тор пайда болады.
//
// Тор өлшемі: cols × rows. Тым тығыз болса Open-Meteo сұранысы ұзарады
// (әр нүкте — жеке есептеу), тым сирек болса карта «дөрекі» көрінеді.

import { getRegion, type Region } from "@/data/regions";

export interface GridPoint {
  lat: number;
  lng: number;
  dense: boolean;
  name?: string;
}

/**
 * Аймақтың bbox-ынан біркелкі тор жасайды.
 * Шеттерден сәл шегініп жасалады — тор нүктелері дәл шекарада тұрмауы үшін.
 */
export function buildGrid(region: Region, cols = 6, rows = 5): GridPoint[] {
  const [w, s, e, n] = region.bbox;
  const dx = (e - w) / (cols + 1);
  const dy = (n - s) / (rows + 1);
  const pts: GridPoint[] = [];
  for (let i = 1; i <= cols; i++) {
    for (let j = 1; j <= rows; j++) {
      pts.push({
        lat: +(s + dy * j).toFixed(4),
        lng: +(w + dx * i).toFixed(4),
        dense: false,
      });
    }
  }
  return pts;
}

/**
 * Қала маңындағы тығыз нүктелер — орталықтың айналасында.
 * Қала ішіндегі айырманы көрсету үшін (жалпы тор тым сирек).
 */
export function cityPoints(region: Region, ring = 0.045): GridPoint[] {
  const { lat, lng, name } = region;
  return [
    { lat, lng, dense: true, name: `${name} — орталық` },
    { lat: +(lat + ring).toFixed(4), lng, dense: true, name: `${name} — солтүстік` },
    { lat: +(lat - ring).toFixed(4), lng, dense: true, name: `${name} — оңтүстік` },
    { lat, lng: +(lng + ring).toFixed(4), dense: true, name: `${name} — шығыс` },
    { lat, lng: +(lng - ring).toFixed(4), dense: true, name: `${name} — батыс` },
  ];
}

/** Аймақ бойынша толық нүктелер жиыны: сирек тор + қала маңы */
export function regionPoints(regionId?: string | null, cols = 6, rows = 5): {
  region: Region;
  points: GridPoint[];
} {
  const region = getRegion(regionId);
  return { region, points: [...buildGrid(region, cols, rows), ...cityPoints(region)] };
}
