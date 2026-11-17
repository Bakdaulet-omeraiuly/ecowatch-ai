import { describe, expect, it } from "vitest";
import { ARCHIVE_CHUNK_DAYS, archiveWindows } from "./firmsArchive";

// FIRMS area API: DAY_RANGE 1..5 (https://firms.modaps.eosdis.nasa.gov/api/area/).
// 10 күндік терезе сұралғанда продакшнде 37 терезенің 36-сы HTTP 400 қайтарды.
describe("archiveWindows", () => {
  const now = new Date("2026-11-03T12:00:00Z");
  const ws = archiveWindows("2025-11-04", "2026-11-03", now);

  it("әр терезе FIRMS шегінде: 1..5 күн", () => {
    expect(ARCHIVE_CHUNK_DAYS).toBeLessThanOrEqual(5);
    for (const w of ws) {
      expect(w.days).toBeGreaterThanOrEqual(1);
      expect(w.days).toBeLessThanOrEqual(5);
    }
  });

  it("365 күнді бос орынсыз, қайталаусыз жабады", () => {
    expect(ws.reduce((s, w) => s + w.days, 0)).toBe(365);
    for (let i = 1; i < ws.length; i++) {
      const prevEnd = new Date(`${ws[i - 1].date}T00:00:00Z`).getTime() + ws[i - 1].days * 86400_000;
      expect(new Date(`${ws[i].date}T00:00:00Z`).getTime()).toBe(prevEnd);
    }
    expect(ws[0].date).toBe("2025-11-04");
  });

  it("соңғы ~60 күн NRT, ертерегі SP", () => {
    expect(ws[0].source).toBe("VIIRS_SNPP_SP");
    expect(ws[ws.length - 1].source).toBe("VIIRS_SNPP_NRT");
  });
});

describe("FIRMS acq_time", () => {
  it("formats HHMM values with or without leading zeros", async () => {
    const { formatAcqTime, parseFirmsCsv } = await import("./firms");
    expect(formatAcqTime("931")).toBe("09:31");
    expect(formatAcqTime("5")).toBe("00:05");
    expect(formatAcqTime("2245")).toBe("22:45");
    expect(formatAcqTime("2460")).toBe("");
    expect(formatAcqTime(undefined)).toBe("");
    const rows = parseFirmsCsv(
      "latitude,longitude,bright_ti5,frp,confidence,acq_date,acq_time,daynight\n46.2,53.4,300,12.5,n,2026-11-16,2214,N"
    );
    expect(rows[0].acqTime).toBe("22:14");
    expect(parseFirmsCsv("latitude,longitude\n46.2,53.4")[0].acqTime).toBe("");
  });
});
