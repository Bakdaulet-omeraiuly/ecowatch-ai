"use client";

import { create } from "zustand";
import type { FeatureCollection } from "geojson";
import type { LngLat } from "@/lib/areaGeo";

// Карта құралдарының ортақ күйі: панель (ToolsPanel) мен карта (MapView)
// арасындағы жалғыз байланыс. Карта басуды `pick` бойынша осында жазады,
// құралдар нәтижесін `overlay` арқылы картаға салады.

export type ToolKey = "area" | "trajectory" | "journal" | "review" | "watch" | "priority";
export type PickMode = "none" | "polygon" | "point";

interface MapToolsState {
  tool: ToolKey;
  pick: PickMode;
  ring: LngLat[];
  point: LngLat | null;
  overlay: FeatureCollection | null;
  /** картаны осы нүктеге/шекараға апару сұранысы */
  focus: { bbox?: [number, number, number, number]; center?: LngLat; at: number } | null;
  setTool: (t: ToolKey) => void;
  setPick: (p: PickMode) => void;
  addVertex: (p: LngLat) => void;
  setRing: (r: LngLat[]) => void;
  setPoint: (p: LngLat | null) => void;
  setOverlay: (fc: FeatureCollection | null) => void;
  focusOn: (f: { bbox?: [number, number, number, number]; center?: LngLat }) => void;
  clear: () => void;
}

export const useMapToolsStore = create<MapToolsState>()((set) => ({
  tool: "area",
  pick: "none",
  ring: [],
  point: null,
  overlay: null,
  focus: null,
  setTool: (tool) => set({ tool, pick: "none", overlay: null }),
  setPick: (pick) => set({ pick }),
  addVertex: (p) => set((s) => ({ ring: [...s.ring, p] })),
  setRing: (ring) => set({ ring }),
  setPoint: (point) => set({ point }),
  setOverlay: (overlay) => set({ overlay }),
  focusOn: (f) => set({ focus: { ...f, at: Date.now() } }),
  clear: () => set({ ring: [], point: null, overlay: null, pick: "none" }),
}));
