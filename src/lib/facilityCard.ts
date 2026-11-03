// НЫСАН КАРТОЧКАСЫ — P2.1 (SPEC §2).
//
// ЕРЕЖЕЛЕР:
//   · Әр өріс — нақты дерек бар болса мән, жоқ болса null. Нөл/ойдан шығару ЖОҚ.
//   · «Көздер саны» (emissionSources.count) мен «шығарынды массасы»
//     (emissionMass) — БӨЛЕК өрістер. Көздер санын массаға айналдыру мүмкін емес.
//   · Масса тек бірлік + есептік кезең + дереккөз/күн бар болғанда көрсетіледі.
//   · Заттар тізімі тек дереккөзі мен күні бар жазбаларды қамтиды.
//   · Жұмыс жасайтын UI үшін мәтін ключі — `DEREK_JOQ` (қазақша «Дерек жоқ»).

import type { Cited, Facility, FacilityRecord } from "@/data/facilities";

export const DEREK_JOQ = "Дерек жоқ";

export interface CardField<T> {
  value: T | null;
  /** Жоқ болса — мәтін «Дерек жоқ» (UI үшін қолайлы түрде) */
  label: string;
}

export interface FacilityCard {
  id: string;
  name: string;
  /** Өндіріс түрі (мәтін) */
  productionType: CardField<string>;
  coords: {
    lat: number;
    lng: number;
    /** Ондық таңба саны (4 ≈ 10 м). approx болса — жуық */
    precision: CardField<string>;
    source: CardField<string>;
    approx: boolean;
  };
  /** Шығарынды көздерінің САНЫ (дана). Масса емес. */
  emissionSources: CardField<{ count: number } & Cited>;
  /** Шығарынды МАССАСЫ (бірлік + кезең). Көздер санынан бөлек. */
  emissionMass: CardField<{ value: number; unit: string; period: string } & Cited>;
  /** Дереккөзі мен күні бар заттар ғана */
  substances: ({ name: string; amount: number; unit: string; period: string } & Cited)[];
  monitoringPosts: ({ name: string } & Cited)[];
  verifiedEvents: ({ description: string } & Cited)[];
  /** Координата дереккөзі (атауы) */
  source: CardField<string>;
  /** Координата дереккөзінің күні. Белгісіз болса — «Дерек жоқ». */
  sourceDate: CardField<string>;
  /** Толтырылмаған өрістердің кілттері (тест/көрсету үшін) */
  missing: string[];
}

const hasCitation = (c: { source?: string; date?: string } | undefined): c is Cited =>
  !!c && typeof c.source === "string" && c.source.trim() !== "" &&
  typeof c.date === "string" && c.date.trim() !== "";

const field = <T>(value: T | null): CardField<T> => ({
  value,
  label: value == null ? DEREK_JOQ : "",
});

/** Координата дәлдігі: ондық таңба саны + жуық белгісі */
export function coordPrecision(approx: boolean): CardField<string> {
  if (approx) return { value: "жуық (нақты бекітілмеген)", label: "" };
  return { value: "ажыратымдылық ≈11 м (4 ондық таңба)", label: "" };
}

export function buildFacilityCard(fac: Facility): FacilityCard {
  const r: FacilityRecord = fac.record ?? {};
  const emSrc = hasCitation(r.emissionSources) && Number.isInteger(r.emissionSources.count) && r.emissionSources.count >= 0
    ? r.emissionSources
    : null;
  const mass = hasCitation(r.emissionMass) && Number.isFinite(r.emissionMass.value) && r.emissionMass.unit && r.emissionMass.period
    ? r.emissionMass
    : null;
  const substances = (r.substances ?? []).filter(
    (s) => hasCitation(s) && Number.isFinite(s.amount) && s.unit && s.period && s.name
  );
  const monitoringPosts = (r.monitoringPosts ?? []).filter((m) => hasCitation(m) && m.name);
  const verifiedEvents = (r.verifiedEvents ?? []).filter((e) => hasCitation(e) && e.description);

  const coordSource = fac.coordSource ?? null;
  const card: FacilityCard = {
    id: fac.id,
    name: fac.name,
    productionType: field(fac.kind || null),
    coords: {
      lat: fac.lat,
      lng: fac.lng,
      precision: coordPrecision(Boolean(fac.approx)),
      source: field(coordSource),
      approx: Boolean(fac.approx),
    },
    emissionSources: emSrc
      ? { value: { count: emSrc.count, source: emSrc.source, date: emSrc.date }, label: "" }
      : { value: null, label: DEREK_JOQ },
    emissionMass: mass
      ? { value: { value: mass.value, unit: mass.unit, period: mass.period, source: mass.source, date: mass.date }, label: "" }
      : { value: null, label: DEREK_JOQ },
    substances,
    monitoringPosts,
    verifiedEvents,
    source: field(coordSource),
    sourceDate: field(fac.coordDate?.trim() ? fac.coordDate.trim() : null),
    missing: [],
  };

  // Толтырылмаған өрістер тізімі — UI «Дерек жоқ» деп белгілейді
  if (!card.productionType.value) card.missing.push("productionType");
  if (!emSrc) card.missing.push("emissionSources");
  if (!mass) card.missing.push("emissionMass");
  if (substances.length === 0) card.missing.push("substances");
  if (monitoringPosts.length === 0) card.missing.push("monitoringPosts");
  if (verifiedEvents.length === 0) card.missing.push("verifiedEvents");
  if (!coordSource) card.missing.push("source");
  if (!card.sourceDate.value) card.missing.push("sourceDate");
  return card;
}
