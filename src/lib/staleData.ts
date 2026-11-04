// P3.6: age label for data served from the offline cache.
export function staleAge(cachedAt: number, now: number): { value: number; unit: "min" | "h" | "d" } {
  const min = Math.max(0, Math.round((now - cachedAt) / 60e3));
  if (min < 60) return { value: min, unit: "min" };
  const h = Math.round(min / 60);
  if (h < 48) return { value: h, unit: "h" };
  return { value: Math.round(h / 24), unit: "d" };
}

/** Keeps the OLDEST cache time per page view: the banner must not understate staleness. */
export function oldest(current: number | null, next: number): number {
  return current === null ? next : Math.min(current, next);
}
