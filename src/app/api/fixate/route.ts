import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { REGIONS } from "@/data/regions";
import { INDICATORS } from "@/data/indicatorRegistry";
import { normsFor } from "@/data/legalNorms";
import { checkCompliance, type ComplianceLevel } from "@/lib/compliance";

// НОРМА АСУЫН ФИКСАЦИЯЛАУ — тәуліктік cron, ӨТКЕН 48 САҒАТТЫ ТОЛЫҚ ТІРКЕЙДІ.
//
// ═══ НЕГЕ КЕРЕК ═══
// Жүйе сәйкестікті СҰРАНЫС КЕЗІНДЕ есептейді де, кэшке салады.
// Түнгі 03:00-де болған асу таңертең қарағанда ЖОҚ болып қалады: ол ешжерде
// сақталмайды. Ал прокуратура үшін керегі дәл сол — «қашан, қай жерде,
// қандай мән, қандай нормадан асты».
//
// ═══ ⚠️ НЕГЕ ЛЕЗДІК ЕМЕС, САҒАТТЫҚ ҚАТАР ═══
// Бұрын эндпоинт `/api/compliance`-тен ТЕК ЛЕЗДІК мәнді алып, бір жазба
// жасайтын, әрі сағат сайынғы cron-ға есептелген еді. Ал Vercel Hobby
// жоспарында cron ТӘУЛІГІНЕ БІР РЕТ қана жүреді — сонда тәуліктің 24
// сағатының 23-і тіркелмей қалар еді. Бос журналды «асу болмады» деп оқу
// қате болар еді.
//
// Шешім: жүгіріс сайын CAMS-тың САҒАТТЫҚ қатарын алып, өткен 48 сағаттың
// ӘР САҒАТЫН бөлек тексереміз. Кестедегі (region, indicator, hour)
// бірегейлігі қайталауды өзі болдырмайды, сондықтан қайта жүгірту
// қауіпсіз әрі үзіліс болса кейінгі жүгіріс оны ЖАБАДЫ.
//
// Заңдық нормасы бар БАРЛЫҚ көрсеткіш (PM₂.₅, PM₁₀, NO₂, SO₂, O₃) —
// сағаттық CAMS деректері бар ауа ластаушылары, сондықтан тәуліктік
// жүгіріс заңдық жағынан ТОЛЫҚ қамтуды береді.
//
// ═══ ЕКІ УАҚЫТ ═══
// `observed_hour` — ДЕРЕКТІҢ өз сағаты (UTC)
// `recorded_at`   — біздің жазған сәтіміз
// Екеуін шатастыруға болмайды. Кідіріс болса, айырма көрініп тұрады.
//
// ═══ ҚАУІПСІЗДІК ═══
// Жазу үшін SUPABASE_SERVICE_ROLE_KEY керек (anon кілтіне RLS жазуға
// рұқсат бермейді). Кілт жоқ болса — 503, жалған «жазылды» жауабы емес.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Қай аймақтар тіркеледі. ҚР — заңдық маңызы бар, сондықтан бірінші. */
const TRACKED = REGIONS.filter((r) => r.country === "KZ");

/** Тіркелетін деңгейлер. `approaching` жазылмайды — ол әлі асу емес. */
const RECORDED_LEVELS: ComplianceLevel[] = ["exceeded", "exceeded-unverified"];

/** Артқа қарай қанша сағат тексеріледі. Тәуліктік cron + қор = 48. */
const BACKFILL_HOURS = 48;

/**
 * Заңдық нормасы бар көрсеткіштер ↔ CAMS сағаттық өріс аттары.
 * Тізілімде нормасы жоқ көрсеткіш тіркелмейді — салыстыруға шек жоқ.
 */
const HOURLY_FIELD: Record<string, string> = {
  pm25: "pm2_5",
  pm10: "pm10",
  no2: "nitrogen_dioxide",
  so2: "sulphur_dioxide",
  ozone: "ozone",
  co: "carbon_monoxide",
};
const TRACKED_INDICATORS = INDICATORS.filter(
  (i) => normsFor(i.id).length > 0 && HOURLY_FIELD[i.id]
);

interface HourlyAir {
  time?: string[];
  [k: string]: (number | null)[] | string[] | undefined;
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
  // Serverлік кілттің АТАУЫ бірнеше нұсқада кездеседі: Supabase ескі
  // `service_role` кілтін енді «Secret key» деп атайды, сондықтан адам
  // оны `SUPABASE_SECRET_KEY` деп қосуы әбден мүмкін. Үшеуін де
  // қабылдаймыз — қайсысы табылғаны жауапта көрінеді.
  const KEY_NAMES = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_SERVICE_KEY",
  ] as const;
  const foundKeyName = KEY_NAMES.find((n) => process.env[n]);
  const serviceKey = foundKeyName ? process.env[foundKeyName] : undefined;
  if (!url || !serviceKey) {
    // ⚠️ ҚАЙСЫСЫ ЖОҚ ЕКЕНІН НАҚТЫ АЙТАМЫЗ.
    // Бұрын хабарлама тек кілтті атайтын, ал шарт ЕКЕУІН тексеретін —
    // сондықтан URL жоқ болса да «кілт қажет» деп тұратын да, іздеу
    // басқа жаққа кетіп қалатын. Құпия мән ЕШҚАШАН қайтарылмайды,
    // тек «бар/жоқ» күйі.
    const missing = [
      !url && "NEXT_PUBLIC_SUPABASE_URL",
      !serviceKey && `серверлік кілт (${KEY_NAMES.join(" немесе ")})`,
    ].filter(Boolean) as string[];
    return NextResponse.json(
      {
        error: "Фиксация қоймасы бапталмаған — жазба жүргізілмейді",
        missing,
        detail:
          `Табылмағаны: ${missing.join("; ")}. ` +
          "Vercel → Settings → Environment Variables ішіне қосыңыз. " +
          "⚠️ ЕКІ ЖИІ ҚАТЕ: (1) қосқаннан КЕЙІН REDEPLOY жасалмаған — орта " +
          "айнымалылары бұрынғы деплойға кері қолданылмайды; (2) айнымалы тек " +
          "Preview/Development ортасына белгіленген, Production-ға емес. " +
          "Anon кілтіне RLS жазуға рұқсат бермейді, сондықтан жазу тек " +
          "серверлік кілтпен жүреді.",
        env: {
          NEXT_PUBLIC_SUPABASE_URL: url ? "бар" : "ЖОҚ",
          // Қай атаумен табылғаны (мәні ЕМЕС) — іздеуді жеңілдетеді
          ...Object.fromEntries(KEY_NAMES.map((n) => [n, process.env[n] ? "бар" : "ЖОҚ"])),
        },
      },
      { status: 503 }
    );
  }
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  const tierById = new Map(INDICATORS.map((i) => [i.id, i.tier]));
  const nameById = new Map(INDICATORS.map((i) => [i.id, i.name]));
  const unitById = new Map(INDICATORS.map((i) => [i.id, i.unit]));

  let checked = 0;
  let found = 0;
  let written = 0;
  const failed: string[] = [];
  const perRegion: { region: string; hours: number; found: number }[] = [];

  const cutoff = Date.now() - BACKFILL_HOURS * 3600_000;

  for (const region of TRACKED) {
    try {
      // ⚠️ timezone=GMT — жауаптағы уақыттар UTC болады. Бұл маңызды:
      // `observed_hour` — timestamptz бағаны. Жергілікті уақытты офсетсіз
      // жазсақ, база оны UTC деп оқып, сағат 5-ке жылжып кетер еді.
      const api =
        `https://air-quality-api.open-meteo.com/v1/air-quality` +
        `?latitude=${region.lat}&longitude=${region.lng}` +
        `&hourly=${Object.values(HOURLY_FIELD).join(",")}` +
        // ⚠️ forecast_days=1 — БҮГІНГІ сағаттар үшін.
        // `forecast_days=0` болғанда Open-Meteo тек өткен ТОЛЫҚ күндерді
        // қайтарады, яғни бүгін таңертеңнен бергі сағаттар жауапқа мүлдем
        // кірмейтін: бүгінгі асу ертеңгі жүгіріске дейін тіркелмей тұратын.
        // Прокуратураға арналған журнал үшін мұндай кідіріс жарамайды.
        // Болашақ сағаттар төмендегі `tMs > Date.now()` тексерісімен
        // сүзіледі — болжам ешқашан «тіркелген асу» болып жазылмайды.
        `&past_days=2&forecast_days=1&timezone=GMT`;
      const res = await fetch(api, { cache: "no-store" });
      if (!res.ok) {
        failed.push(`${region.id}: upstream ${res.status}`);
        continue;
      }
      const j = (await res.json()) as { hourly?: HourlyAir };
      const times = (j.hourly?.time as string[] | undefined) ?? [];
      if (!times.length) {
        failed.push(`${region.id}: сағаттық қатар бос`);
        continue;
      }

      const rows: Record<string, unknown>[] = [];
      let regionFound = 0;

      for (let h = 0; h < times.length; h++) {
        const tMs = new Date(`${times[h]}Z`).getTime();
        // Болашақ немесе тым ескі сағат — өткізіп жібереміз
        if (!Number.isFinite(tMs) || tMs > Date.now() || tMs < cutoff) continue;
        const observedHour = new Date(tMs).toISOString();

        for (const ind of TRACKED_INDICATORS) {
          const series = j.hourly?.[HOURLY_FIELD[ind.id]] as (number | null)[] | undefined;
          const value = series?.[h];
          if (value == null || !Number.isFinite(value)) continue;
          checked++;

          const c = checkCompliance(ind.id, value, "KZ");
          if (!RECORDED_LEVELS.includes(c.worst)) continue;
          found++;
          regionFound++;

          // Ең ауыр тексеру — қай нормадан асқаны сол
          const worstCheck = c.checks
            .filter((x) => RECORDED_LEVELS.includes(x.level))
            .sort((a, b) => (b.timesOver ?? 0) - (a.timesOver ?? 0))[0];

          rows.push({
            region_id: region.id,
            region_name: region.name,
            indicator_id: ind.id,
            indicator_name: nameById.get(ind.id) ?? ind.id,
            unit: unitById.get(ind.id) ?? "µg/m³",
            value,
            level: c.worst,
            kz_violation: c.kzViolation,
            act_jurisdiction: worstCheck?.act.jurisdiction ?? null,
            act_number: worstCheck?.act.number ?? null,
            averaging: worstCheck?.averagingKz ?? null,
            norm_limit: worstCheck?.norm.limit ?? null,
            times_over: worstCheck?.timesOver ?? null,
            tier: tierById.get(ind.id) ?? null,
            summary: c.summary,
            observed_hour: observedHour,
          });
        }
      }

      // Топтап жазу — сағат сайын жеке сұраныс жіберудің қажеті жоқ.
      // Бірегейлік (region, indicator, hour) қайталауды өзі кесіп тастайды,
      // сондықтан қайта жүгірту қауіпсіз.
      if (rows.length) {
        const { error } = await db.from("exceedances").upsert(rows, {
          onConflict: "region_id,indicator_id,observed_hour",
          ignoreDuplicates: true,
        });
        if (error) failed.push(`${region.id}: ${error.message}`);
        else written += rows.length;
      }
      perRegion.push({ region: region.name, hours: times.length, found: regionFound });
    } catch (e) {
      failed.push(`${region.id}: ${e instanceof Error ? e.message : "қате"}`);
    }
  }

  // ⚠️ Жүгірістің ӨЗІН тіркеу — журналдағы бос кезең «асу болмады» ма,
  // әлде «тексеру жүрмеген» бе, соны ажырату үшін
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
    backfillHours: BACKFILL_HOURS,
    indicators: TRACKED_INDICATORS.map((i) => i.id),
    checked,
    found,
    written,
    keyEnvName: foundKeyName,
    perRegion,
    failed,
    note:
      `Әр жүгіріс өткен ${BACKFILL_HOURS} сағаттың ӘР САҒАТЫН бөлек тексереді, ` +
      "сондықтан тәуліктік cron да толық қамту береді. Тіркелетін деңгейлер: " +
      "норма асқан (расталған) және асқан (шек расталмаған). «Нормаға жақын» " +
      "жазылмайды — ол әлі асу емес.",
  });
}
