"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_REGION_ID, getRegion, type Region } from "@/data/regions";

// Таңдалған аймақ — жүйенің бүкіл географиясы осыдан оқылады.
//
// Сақталады (localStorage): пайдаланушы бір рет таңдағаннан кейін әр
// кіргенде қайта сұралмайды.
//
// `chosen` — пайдаланушы саналы түрде таңдады ма. Алғаш кіргенде таңдау
// терезесі осыған қарап шығады.

interface RegionState {
  regionId: string;
  chosen: boolean;
  setRegion: (id: string) => void;
  region: () => Region;
}

export const useRegionStore = create<RegionState>()(
  persist(
    (set, get) => ({
      regionId: DEFAULT_REGION_ID,
      chosen: false,
      setRegion: (id) => set({ regionId: id, chosen: true }),
      region: () => getRegion(get().regionId),
    }),
    { name: "jaiyq-region" }
  )
);

/** Компоненттерде ыңғайлы болу үшін */
export function useRegion(): Region {
  const id = useRegionStore((s) => s.regionId);
  return getRegion(id);
}
