import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { REGIONS } from "@/data/regions";
import { INDICATORS } from "@/data/indicatorRegistry";
import type { ComplianceLevel } from "@/lib/compliance";

// НОРМА АСУЫН ФИКСАЦИЯЛАУ — сағат сайынғы cron.
//
// ═══ НЕГЕ КЕРЕК ═══
// Жүйе сәйкестікті СҰРАНЫС КЕЗІНДЕ есептейді де, 30 минуттық кэшке салады.
// Түнгі 03:00-де болған асу таңертең қарағанда ЖОҚ болып қалады: ол ешжерде
// сақталмайды. Ал прокуратура үшін керегі дәл сол — «қашан, қай жерде,
// қандай мән, қандай нормадан асты».
//
// Бұл эндпоинт сағат сайын жүріп, әр асуды УАҚЫТЫМЕН жазып отырады.
//
// ═══ ЕКІ УАҚЫТ ═══
// `observed_hour` — ДЕРЕКТІҢ өз сағаты (CAMS сағат сайын жаңарады)
// `recorded_at`   — біздің жазған сәтіміз
// Екеуін шатастыруға болмайды. Кідіріс болса, айырма көрініп тұрады.
//
// ═══ БОС КЕЗЕҢ ≠ АСУ ЖОҚ ═══
// Әр жүгіріс `fixation_runs` кестесіне тіркеледі. Онсыз журналдағы бос
// кезеңді «асу болмады» деп оқу қате болар еді — тексеру мүлдем
// жүрмеген де болуы мүмкін.
//
// ═══ ҚАУІПСІЗДІК ═══
// Жазу үшін SUPABASE_SERVICE_ROLE_KEY керек (anon кілтіне RLS жазуға
// рұқсат бермейді). Кілт жоқ болса — 503, жалған «жазылды» жауабы емес.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Қай аймақтар тіркеледі. ҚР — заңдық маңызы бар, сондықтан бірінші. */
const TRACKED = REGIONS.filter((r) => r.country === "KZ").map((r) => r.id);

/** Тіркелетін деңгейлер. `approaching` жазылмайды — ол әлі асу емес. */
const RECORDED_LEVELS: ComplianceLevel[] = ["exceeded", "exceeded-unverified"];

interface CheckRow {
  norm: { limit: number; unit: string; status: string };
  act: { jurisdiction: string; number: string };
  averagingKz: string;
  level: ComplianceLevel;
  timesOver: number | null;
}
interface ResultRow {
  indicatorId: string;
  name: string;
  unit: string;
  value: number | null;
  worst: ComplianceLevel;
  kzViolation: boolean;
  summary: string;
  checks: CheckRow[];
}

/** Сағатқа дейін дөңгелектеу — CAMS сағат сайын жаңарады */
function toHour(iso: string): string {
  const d = new Date(iso);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

export async function GET(req: Request) {
  // Cron құпиясы бапталған болса — тексереміз
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const given =
      req.headers.get("x-cron-secret") ??
      new URL(req.url).searchParams.get("secret") ??
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (given !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      {
        error: "Фиксация қоймасы бапталмаған — жазба жүргізілмейді",
        detail:
          "SUPABASE_SERVICE_ROLE_KEY қажет. Anon кілтіне RLS жазуға рұқсат " +
          "бермейді, сондықтан жазу тек серверлік кілтпен жүреді.",
      },
      { status: 503 }
    );
  }
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  const origin = new URL(req.url).origin;
  const tierById = new Map(INDICATORS.map((i) => [i.id, i.tier]));

  let checked = 0;
  let found = 0;
  const written: { region: string; indicator: string; value: number; level: string }[] = [];
  const failed: string[] = [];

  for (const regionId of TRACKED) {
    try {
      const res = await fetch(`${origin}/api/compliance?region=${regionId}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        failed.push(regionId);
        continue;
      }
      const d = (await res.json()) as {
        fetchedAt: string;
        region: { id: string; name: string };
        results: ResultRow[];
      };
      const hour = toHour(d.fetchedAt);

      for (const r of d.results) {
        checked++;
        if (r.value == null || !RECORDED_LEVELS.includes(r.worst)) continue;
        found++;

        // Ең ауыр тексеру — қай нормадан асқаны сол
        const worstCheck = r.checks
          .filter((c) => RECORDED_LEVELS.includes(c.level))
          .sort((a, b) => (b.timesOver ?? 0) - (a.timesOver ?? 0))[0];

        const { error } = await db.from("exceedances").upsert(
          {
            region_id: d.region.id,
            region_name: d.region.name,
            indicator_id: r.indicatorId,
            indicator_name: r.name,
            unit: r.unit,
            value: r.value,
            level: r.worst,
            kz_violation: r.kzViolation,
            act_jurisdiction: worstCheck?.act.jurisdiction ?? null,
            act_number: worstCheck?.act.number ?? null,
            averaging: worstCheck?.averagingKz ?? null,
            norm_limit: worstCheck?.norm.limit ?? null,
            times_over: worstCheck?.timesOver ?? null,
            tier: tierById.get(r.indicatorId) ?? null,
            summary: r.summary,
            observed_hour: hour,
          },
          // Бір сағаттағы бір көрсеткіш бір рет — қайталанбайды
          { onConflict: "region_id,indicator_id,observed_hour", ignoreDuplicates: true }
        );
        if (error) {
          failed.push(`${regionId}/${r.indicatorId}: ${error.message}`);
        } else {
          written.push({
            region: d.region.name,
            indicator: r.name,
            value: r.value,
            level: r.worst,
          });
        }
      }
    } catch (e) {
      failed.push(`${regionId}: ${e instanceof Error ? e.message : "қате"}`);
    }
  }

  // ⚠️ Жүгірістің ӨЗІН тіркеу — журналдағы бос кезең «асу болмады» ма,
  // әлде «тексеру жүрмеді» ме, соны ажырату үшін
  await db.from("fixation_runs").insert({
    regions: TRACKED.length,
    checked,
    found,
    ok: failed.length === 0,
    error: failed.length ? failed.slice(0, 5).join(" · ") : null,
  });

  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    regions: TRACKED.length,
    checked,
    found,
    written: written.length,
    failed,
    note:
      "Тіркелетін деңгейлер: норма асқан (расталған) және асқан (шек расталмаған). " +
      "«Нормаға жақын» жазылмайды — ол әлі асу емес.",
  });
}
