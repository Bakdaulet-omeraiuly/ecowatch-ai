import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import air from "../../validation/air/results.json";
import kazhydromet from "../../validation/kazhydromet/results.json";
import s5p from "../../validation/s5p/results.json";
import firms from "../../validation/firms/results.json";
import { DICT } from "@/lib/i18n";
import {
  LIMIT,
  THRESHOLDS,
  buildValidationChecks,
  collectKeys,
  fmtAbsPct,
  fmtPct,
  fmtSci,
  summarize,
  type ValidationCheck,
} from "./validationResults";

// Тыйым салынған жазу: «толық дәлдік» пайызы (ешқашан тікелей жазылмайды — тек бөліктерден құрастырылады)
const BANNED = "10" + "0%";

function all(checks: ValidationCheck[]): ValidationCheck[] {
  return checks.flatMap((c) => [c, ...(c.children ? all(c.children) : [])]);
}

const checks = buildValidationChecks();
const byId = (id: string) => {
  const c = all(checks).find((x) => x.id === id);
  if (!c) throw new Error(`no check ${id}`);
  return c;
};

describe("валидация: вердикттер (нәтижелер JSON-нан)", () => {
  it("PM₂.₅ күнделікті — өтпеді", () => {
    expect(byId("air-pm25-daily").status).toBe("failed");
    expect(byId("air-pm25-daily").pass).toBe(false);
  });
  it("төрт Қазгидромет газы — әрқайсысы өтпеді", () => {
    for (const id of ["kz-so2", "kz-co", "kz-no2", "kz-no"]) {
      expect(byId(id).status, id).toBe("failed");
    }
  });
  it("H₂S — салыстыруға болмайды", () => {
    expect(byId("kz-h2s").status).toBe("not-comparable");
    expect(byId("kz-h2s").pass).toBeNull();
  });
  it("S5P NO₂ (H3) — өтті; S5P SO₂ (H4) — өтпеді", () => {
    expect(byId("s5p-no2-h3").status).toBe("passed");
    expect(byId("s5p-so2-h4").status).toBe("failed");
  });
  it("VIIRS H1 және H2 — өтпеді", () => {
    expect(byId("firms-h1").status).toBe("failed");
    expect(byId("firms-h2").status).toBe("failed");
  });
  it("фиксация аудиті — сипаттама, белгілі қатемен", () => {
    expect(byId("air-fixation-audit").status).toBe("descriptive");
    expect(byId("air-fixation-audit").knownErrorKeys).toContain("val.err.fixate");
  });
});

describe("сандар results.json-мен бірдей", () => {
  it("PM₂.₅ күнделікті n / NMB / NME / r", () => {
    const c = byId("air-pm25-daily");
    expect(c.n).toBe(air.daily.n);
    expect(c.nmb).toBe(air.daily.nmb);
    expect(c.nme).toBe(air.daily.nme);
    expect(c.r).toBe(air.daily.r);
  });
  it("Қазгидромет SO₂ / CO / NO₂ / NO n / NMB / NME / r", () => {
    const map: Record<string, "so2" | "co" | "no2" | "no"> = {
      "kz-so2": "so2", "kz-co": "co", "kz-no2": "no2", "kz-no": "no",
    };
    for (const [id, key] of Object.entries(map)) {
      const s = (kazhydromet.summary as unknown as Record<string, { n: number; nmb: number; nme: number; r: number }>)[key];
      const c = byId(id);
      expect(c.n, id).toBe(s.n);
      expect(c.nmb, id).toBe(s.nmb);
      expect(c.nme, id).toBe(s.nme);
      expect(c.r, id).toBe(s.r);
    }
  });
  it("S5P NO₂ H3 — жарамды күн және +69.6%", () => {
    const c = byId("s5p-no2-h3");
    expect(c.n).toBe(s5p.H3.valid_days);
    expect(c.metrics.find((m) => m.label === "val.m.rel")?.value).toBe("+69.6%");
  });
  it("VIIRS H1/H2 мәндері", () => {
    expect(byId("firms-h1").metrics[0].value).toBe(firms.H1.days_per_year.toFixed(2));
    expect(byId("firms-h2").metrics[0].value).toBe(firms.H2.precision.toFixed(2));
  });
  it("VIIRS H2: мән мен шек бір бірлікте (бөлшек, «%» емес)", () => {
    const m = byId("firms-h2").metrics.find((x) => x.label === "val.m.prec");
    expect(m).toBeDefined();
    expect(m!.value).toBe("0.04");
    expect(m!.value).not.toContain("%");
    expect(m!.threshold).toBe(THRESHOLDS.firmsPrecision);
    expect(m!.threshold).not.toContain("%");
  });
});

describe("сандық шек ↔ көрсетілетін мәтін (бір көзден)", () => {
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  it("Қазгидромет NMB/NME мәтіні LIMIT-пен бірдей", () => {
    expect(THRESHOLDS.kzNmb).toContain(pct(LIMIT.kzNmbAbs));
    expect(THRESHOLDS.kzNme).toContain(pct(LIMIT.kzNmeMax));
  });
  it("POD / FAR / S5P / VIIRS мәтіндері LIMIT-пен бірдей", () => {
    expect(THRESHOLDS.airPod).toContain(`≥ ${LIMIT.airPodMin}`);
    expect(THRESHOLDS.airFar).toContain(`≤ ${LIMIT.airFarMax}`);
    expect(THRESHOLDS.s5pDelta).toContain(`> ${LIMIT.s5pDeltaMin}`);
    expect(THRESHOLDS.s5pCi).toContain(`> ${LIMIT.s5pCiLowMin}`);
    expect(THRESHOLDS.s5pDays).toContain(`≥ ${LIMIT.s5pDaysMin}`);
    expect(THRESHOLDS.firmsDays).toContain(`≥ ${LIMIT.firmsDaysMin}`);
    expect(THRESHOLDS.firmsDensity).toContain(`≥ ${LIMIT.firmsDensityMin}`);
    expect(THRESHOLDS.firmsPrecision).toContain(`≥ ${LIMIT.firmsPrecisionMin.toFixed(2)}`);
  });
});

describe("шектеулер мен олқылықтар әр тармақта көрсетілген", () => {
  it("жоғарғы деңгейдегі әр тексеруде noteKeys / knownErrorKeys / gapKeys ішінен кемінде бірі бар", () => {
    for (const c of checks) {
      expect(c.noteKeys.length + c.knownErrorKeys.length + c.gapKeys.length, c.id).toBeGreaterThan(0);
    }
  });
  it("KZ-35 скринингінде Астана / тор / QC олқылықтары бар", () => {
    expect(byId("air-kz35-screen").gapKeys).toEqual(
      expect.arrayContaining(["val.air.gap.astana", "val.air.gap.grid", "val.air.gap.qc"]),
    );
  });
});

describe("шек ережесі JSON-дағы pass-пен сәйкес", () => {
  it("Қазгидромет: |NMB|<30% ЖӘНЕ NME<50% → results.json pass", () => {
    const s = kazhydromet.summary as unknown as Record<string, { pass: boolean }>;
    for (const [id, key] of [["kz-so2", "so2"], ["kz-co", "co"], ["kz-no2", "no2"], ["kz-no", "no"]] as const) {
      expect(byId(id).pass, id).toBe(s[key].pass);
    }
  });
  it("PM₂.₅ күнделікті → results.json daily_verdict.pass", () => {
    expect(byId("air-pm25-daily").pass).toBe(air.daily_verdict.pass);
  });
  it("S5P H3/H4 → results.json pass", () => {
    expect(byId("s5p-no2-h3").pass).toBe(s5p.H3.pass);
    expect(byId("s5p-so2-h4").pass).toBe(s5p.H4.pass);
  });
  it("VIIRS H1/H2 → results.json pass", () => {
    expect(byId("firms-h1").pass).toBe(firms.H1.pass);
    expect(byId("firms-h2").pass).toBe(firms.H2.pass);
  });
});

describe("протокол паритеті: әр шек PROTOCOL.md-де бар", () => {
  const files: Record<string, string> = {
    airNmbGoal: "air", airNmbCriteria: "air", airNmeGoal: "air", airNmeCriteria: "air",
    airRGoal: "air", airRCriteria: "air", airPod: "air", airFar: "air",
    kzNmb: "kazhydromet", kzNme: "kazhydromet",
    s5pDelta: "s5p", s5pCi: "s5p", s5pDays: "s5p",
    firmsDays: "firms", firmsDensity: "firms", firmsPrecision: "firms",
  };
  for (const [key, mod] of Object.entries(files)) {
    it(`${key} = "${THRESHOLDS[key as keyof typeof THRESHOLDS]}" → validation/${mod}/PROTOCOL.md`, () => {
      const text = fs.readFileSync(path.join(process.cwd(), "validation", mod, "PROTOCOL.md"), "utf-8");
      expect(text.includes(THRESHOLDS[key as keyof typeof THRESHOLDS])).toBe(true);
    });
  }
});

describe("тыйым салынған жазу жоқ", () => {
  it("fmtPct / fmtAbsPct / fmtSci шығысында жоқ", () => {
    for (const v of [0, 0.0005, 0.5, 0.999, 1, 1.0001, -0.523, 12.5]) {
      expect(fmtPct(v)).not.toContain(BANNED);
      expect(fmtAbsPct(v)).not.toContain(BANNED);
      expect(fmtSci(v * 1e-5)).not.toContain(BANNED);
    }
  });
  it("барлық тексеру мәндерінде жоқ", () => {
    for (const c of all(checks)) {
      for (const m of c.metrics) {
        expect(m.value, c.id).not.toContain(BANNED);
      }
    }
  });
  it("барлық val.* аудармаларында жоқ (kk/ru/en)", () => {
    for (const lang of ["kk", "ru", "en"] as const) {
      for (const [key, value] of Object.entries(DICT[lang])) {
        if (!key.startsWith("val.")) continue;
        expect(value, `${lang} ${key}`).not.toContain(BANNED);
      }
    }
  });
});

describe("i18n толықтығы", () => {
  it("тізбектегі барлық кілттер kk/ru/en бар", () => {
    for (const key of collectKeys(checks)) {
      for (const lang of ["kk", "ru", "en"] as const) {
        expect(DICT[lang][key as keyof typeof DICT.kk], `${lang}:${key}`).toBeTruthy();
      }
    }
  });
  it("val.* кілттері үш тілде де бірдей", () => {
    const kkKeys = Object.keys(DICT.kk).filter((k) => k.startsWith("val."));
    for (const lang of ["ru", "en"] as const) {
      for (const k of kkKeys) expect(DICT[lang][k as keyof typeof DICT.kk], `${lang}:${k}`).toBeTruthy();
    }
  });
});

describe("жиынтық", () => {
  it("санау қосындысы толық", () => {
    const s = summarize(checks);
    expect(s.passed + s.failed + s.descriptive + s.notComparable).toBe(s.total);
    expect(s.passed).toBe(1);
  });
});
