// Нысан бойынша Sentinel-5P NO₂ ығындағы сигнал (validation/s5p, PROTOCOL.md §3–§4, §6).
// ОҚИДЫ ғана. Нәтиже жоқ нысан — «тексерілмеген», ешқашан 0% емес.

import anpz from "../../validation/s5p/results.json";
import others from "../../validation/s5p/results_facilities.json";

interface H3 { valid_days: number; mean_delta_mol_m2?: number; ci95?: number[]; mean_upwind_mol_m2?: number; pass: boolean }
interface FacilityRun { center: [number, number]; neighbours_in_ring: { id: string; km: number }[]; H3: H3 }

export type S5pStatus = "detected" | "not-detected" | "untested";

export interface FacilityNo2Signal {
  status: S5pStatus;
  /** (ығындағы − жел жақтағы) / жел жақтағы, % */
  relativePct: number | null;
  /** 95% СА төменгі шегі, % (жел жақтағы орташаға қатысты) */
  ciLowPct: number | null;
  validDays: number | null;
  /** TROPOMI пикселінде бөлек көрінбейтін көз тобы (i18n кілті) */
  clusterKey: string | null;
  /** 5–20 км сақинадағы тізілімдегі көрші нысандар */
  neighbours: { id: string; km: number }[];
}

/** ЖЭО АМӨЗ-ден ~1.7 км — АМӨЗ орталық дискісінде (§6), бөлек тестілеу мағынасыз. */
const CLUSTER: Record<string, string> = { anpz: "anpz", tets: "anpz" };
const CLUSTER_KEY = "* АМӨЗ + ЖЭО + қаланың шығыс бөлігі (спутник бөлек көрмейді)";

export function signalFrom(h: H3 | undefined, neighbours: { id: string; km: number }[], clusterKey: string | null): FacilityNo2Signal {
  if (!h || !h.mean_upwind_mol_m2 || h.mean_delta_mol_m2 == null || !h.ci95) {
    return { status: "untested", relativePct: null, ciLowPct: null, validDays: h?.valid_days ?? null, clusterKey, neighbours };
  }
  const up = h.mean_upwind_mol_m2;
  return {
    status: h.pass ? "detected" : "not-detected",
    relativePct: Math.round((h.mean_delta_mol_m2 / up) * 100),
    ciLowPct: Math.round((h.ci95[0] / up) * 100),
    validDays: h.valid_days,
    clusterKey,
    neighbours,
  };
}

export function facilityNo2Signal(id: string): FacilityNo2Signal {
  if (CLUSTER[id] === "anpz") return signalFrom(anpz.H3 as H3, [], CLUSTER_KEY);
  const run = (others.facilities as Record<string, FacilityRun | undefined>)[id];
  return signalFrom(run?.H3, run?.neighbours_in_ring ?? [], null);
}
