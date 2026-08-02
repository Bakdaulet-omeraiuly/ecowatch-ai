// ӨЗЕН НҮКТЕЛЕРІНІҢ ТІЗІЛІМІ — GloFAS арна ұяшықтарына түсірілген.
//
// ⚠️ Неге тізілім қажет: GloFAS (Copernicus Global Flood Awareness System)
// ағын мәнін ТЕК нақты өзен арнасы өтетін ұяшықта береді. Кез келген
// координатаны сұрау — өзені жоқ жерден «ағын» шығару, яғни ЖАЛҒАН САН.
//
// Сондықтан аймақ үшін нүктелер қолмен тексерілмесе, «Өзен ағыны» модулі
// сол аймақта ЖОҚ деп көрсетіледі (regions.ts → moduleUnavailable).
//
// Жаңа аймақ қосу тәртібі:
//   1. GloFAS/Open-Meteo Flood API-дан нүктені тексеру (мән null емес пе)
//   2. Өзеннің атын және нүктенің орналасқан жерін жазу
//   3. regions.ts ішінде сол аймаққа `extraModules: ["riverFlow"]` қосу

export interface RiverPoint {
  lat: number;
  lng: number;
  name: string;
}

export interface RiverRegistry {
  /** Өзеннің аты — UI-де көрсетіледі */
  river: string;
  /** Ағын бойындағы бақылау нүктелері (жоғары ағыстан төменге қарай) */
  points: RiverPoint[];
  /** Көпжылдық тренд есептелетін бір нүкте */
  trendPoint: RiverPoint;
}

export const RIVERS: Record<string, RiverRegistry> = {
  atyrau: {
    river: "Жайық (Урал)",
    points: [
      { lat: 47.70, lng: 51.50, name: "Жоғары ағыс (Махамбет)" },
      { lat: 47.65, lng: 51.52, name: "Сарайшық маңы" },
      { lat: 47.50, lng: 51.60, name: "Орта ағыс" },
      { lat: 47.1167, lng: 51.8833, name: "Атырау қаласы" },
    ],
    trendPoint: { lat: 47.1167, lng: 51.8833, name: "Атырау қаласы" },
  },
};

export function getRiver(regionId: string): RiverRegistry | null {
  return RIVERS[regionId] ?? null;
}
