// ІЗДЕУГЕ ЖАРАМДЫ ОРЫНДАР ТІЗІЛІМІ.
//
// Барлық координата — ашық дереккөздерден. Ойдан орын жасалмаған.
// Дәлдігі белгісіз орындарда `approx: true` тұрады.
//
// Іздеу үш нәрсені табады:
//   1. Өнеркәсіп нысандары (facilities.ts-тен автоматты қосылады)
//   2. Елді мекендер мен аудандар (осы файлда)
//   3. Координата — «47.11, 51.88» түрінде тікелей енгізуге болады

import { FACILITIES } from "./facilities";

export type PlaceKind = "facility" | "city" | "district" | "water" | "coords";

export interface Place {
  id: string;
  name: string;
  /** Іздеу үшін қосымша атаулар (орысша, ағылшынша, қысқартулар) */
  aliases: string[];
  kind: PlaceKind;
  lat: number;
  lng: number;
  /** Ұсынылатын масштаб */
  zoom: number;
  hint?: string;
  approx?: boolean;
  /** Объект картасы бар болса — соның идентификаторы */
  objectId?: string;
}

const SETTLEMENTS: Place[] = [
  {
    id: "atyrau",
    name: "Атырау",
    aliases: ["Atyrau", "Атырау қаласы", "Гурьев"],
    kind: "city",
    lat: 47.1167, lng: 51.8833, zoom: 11,
    hint: "Облыс орталығы",
  },
  {
    id: "makhambet",
    name: "Махамбет",
    aliases: ["Makhambet", "Махамбет ауданы"],
    kind: "district",
    lat: 47.6667, lng: 51.5833, zoom: 11,
  },
  {
    id: "inder",
    name: "Индербор",
    aliases: ["Inderbor", "Индер", "Индер ауданы"],
    kind: "district",
    lat: 48.5500, lng: 51.7833, zoom: 11,
  },
  {
    id: "kulsary",
    name: "Құлсары",
    aliases: ["Kulsary", "Кульсары", "Жылыой"],
    kind: "city",
    lat: 46.9500, lng: 54.0167, zoom: 11,
  },
  {
    id: "dossor",
    name: "Доссор",
    aliases: ["Dossor"],
    kind: "district",
    lat: 47.5333, lng: 52.9833, zoom: 11,
  },
  {
    id: "makat",
    name: "Мақат",
    aliases: ["Makat", "Макат"],
    kind: "district",
    lat: 47.6500, lng: 53.3333, zoom: 11,
  },
  {
    id: "ganyushkino",
    name: "Ганюшкино (Құрманғазы)",
    aliases: ["Ganyushkino", "Курмангазы", "Құрманғазы"],
    kind: "district",
    lat: 46.6000, lng: 49.2667, zoom: 11,
  },
  {
    id: "miyaly",
    name: "Мияли (Қызылқоға)",
    aliases: ["Miyaly", "Кызылкога", "Қызылқоға"],
    kind: "district",
    lat: 47.9333, lng: 53.7167, zoom: 11,
    approx: true,
  },
  {
    id: "zhaiyk-delta",
    name: "Жайық атырауы",
    aliases: ["Ural delta", "Жайық сағасы", "дельта"],
    kind: "water",
    lat: 46.8500, lng: 51.7500, zoom: 10,
    hint: "Каспийге құяр сағасы",
  },
  {
    id: "zhaiyk-river",
    name: "Жайық өзені (қала тұсы)",
    aliases: ["Урал", "Ural river", "өзен"],
    kind: "water",
    lat: 47.1000, lng: 51.9000, zoom: 12,
  },
];

/** Өнеркәсіп нысандары — facilities.ts-тен */
const FACILITY_PLACES: Place[] = FACILITIES.map((f) => ({
  id: `fac-${f.id}`,
  name: f.name,
  aliases: [f.short, f.kind],
  kind: "facility" as const,
  lat: f.lat,
  lng: f.lng,
  zoom: 14,
  hint: f.kind,
  approx: f.approx,
  objectId: f.id,
}));

export const PLACES: Place[] = [...FACILITY_PLACES, ...SETTLEMENTS];

/** «47.11, 51.88» немесе «47.11 51.88» түріндегі координатаны тану */
export function parseCoords(q: string): Place | null {
  const m = q.trim().match(/^(-?\d{1,2}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)$/);
  if (!m) return null;
  const lat = parseFloat(m[1].replace(",", "."));
  const lng = parseFloat(m[2].replace(",", "."));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return {
    id: `coords-${lat}-${lng}`,
    name: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    aliases: [],
    kind: "coords",
    lat, lng, zoom: 14,
    hint: "Координата",
  };
}

/** Қарапайым, диакритикасыз іздеу */
function norm(s: string): string {
  return s.toLowerCase().replace(/[ёе]/g, "е").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function searchPlaces(query: string, limit = 8): Place[] {
  const q = norm(query);
  if (q.length < 2) return [];

  const coords = parseCoords(query);
  const scored = PLACES.map((p) => {
    const hay = [p.name, ...p.aliases].map(norm);
    let score = 0;
    for (const h of hay) {
      if (h === q) score = Math.max(score, 100);
      else if (h.startsWith(q)) score = Math.max(score, 80);
      else if (h.includes(q)) score = Math.max(score, 60);
    }
    // Өнеркәсіп нысандары сәл жоғары тұрсын — прокуратура үшін негізгі мақсат
    if (score > 0 && p.kind === "facility") score += 5;
    return { p, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.p);

  return coords ? [coords, ...scored].slice(0, limit) : scored;
}

export const KIND_KZ: Record<PlaceKind, string> = {
  facility: "Кәсіпорын",
  city: "Қала",
  district: "Аудан",
  water: "Су нысаны",
  coords: "Координата",
};
