"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Site, Alert } from "@/types/site";
import { buildAlert } from "@/lib/alerts";

interface SitesState {
  userSites: Site[];
  alerts: Alert[];
  hiddenSeedIds: string[];
  selectedSiteId: string | null;
  addSite: (site: Site) => void;
  updateSite: (site: Site) => void;
  removeSite: (site: Site) => void;
  resolveAlert: (id: string) => void;
  toggleFlag: (id: string) => void;
  selectSite: (id: string | null) => void;
  allSites: () => Site[];
}

export const useSitesStore = create<SitesState>()(
  persist(
    (set, get) => ({
      userSites: [],
      alerts: [],
      hiddenSeedIds: [],
      selectedSiteId: null,
      // Deleting: user sites are removed; seed sites are hidden by id.
      // Related alerts are cleaned up either way.
      removeSite: (site) =>
        set((s) => ({
          userSites: s.userSites.filter((x) => x.id !== site.id),
          hiddenSeedIds: site.isSeed ? [...s.hiddenSeedIds, site.id] : s.hiddenSeedIds,
          alerts: s.alerts.filter((a) => a.siteId !== site.id),
          selectedSiteId: null,
        })),
      addSite: (site) =>
        set((s) => {
          const alert = buildAlert(site);
          return {
            userSites: [site, ...s.userSites],
            alerts: alert ? [alert, ...s.alerts] : s.alerts,
            selectedSiteId: site.id,
          };
        }),
      // Re-analysis result: replace if site exists in userSites, otherwise
      // store as an override (seed sites get superseded by id)
      updateSite: (site) =>
        set((s) => {
          const exists = s.userSites.some((x) => x.id === site.id);
          const alert = buildAlert(site);
          return {
            userSites: exists
              ? s.userSites.map((x) => (x.id === site.id ? site : x))
              : [site, ...s.userSites],
            alerts: alert && !s.alerts.some((a) => a.id === alert.id) ? [alert, ...s.alerts] : s.alerts,
          };
        }),
      resolveAlert: (id) =>
        set((s) => ({
          alerts: s.alerts.map((a) => (a.id === id ? { ...a, status: "resolved" as const } : a)),
        })),
      toggleFlag: (id) =>
        set((s) => ({
          userSites: s.userSites.map((x) => (x.id === id ? { ...x, flagged: !x.flagged } : x)),
        })),
      selectSite: (id) => set({ selectedSiteId: id }),
      allSites: () => get().userSites,
    }),
    {
      name: "ecowatch-sites",
      partialize: (s) => ({ userSites: s.userSites, alerts: s.alerts, hiddenSeedIds: s.hiddenSeedIds }),
    }
  )
);

export function getSiteById(id: string | null): Site | undefined {
  if (!id) return undefined;
  return useSitesStore.getState().userSites.find((s) => s.id === id);
}
