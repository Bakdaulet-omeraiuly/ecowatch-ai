import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { REGIONS } from "@/data/regions";
import { INDICATORS } from "@/data/indicatorRegistry";
import { normsFor, type Averaging } from "@/data/legalNorms";
import {
  checkCompliance, HOURLY_BASIS, type ComparisonBasis, type ComplianceLevel, type ComplianceResult,
} from "@/lib/compliance";
import {
  DAILY_MIN_HOURS_DEFAULT, EIGHT_HOUR_MIN_COUNT_DEFAULT, LOCAL_TIME_ZONE,
  dailyWindows, parseUtcMs, rollingWindows, type SeriesPoint,
} from "@/lib/fixateWindows";

// НОРМА АСУЫН ФИКСАЦИЯЛАУ — тәуліктік cron, ӨТКЕН 48 САҒАТТЫ ТОЛЫҚ ТІРКЕЙДІ.
//
// ═══ НЕГЕ КЕРЕК ═══
// Жүйе сәйкестікті СҰРАНЫС КЕЗІНДЕ есептейді де, кэшке салады.
// Түнгі 03:00-де болған асу таңертең қарағанда ЖОҚ болып қалады: ол ешжерде
// сақталмайды. Ал прокуратура үшін керегі дәл сол — «қашан, қай жерде,
// қандай мән, қандай нормадан асты».
//
// ═══ НЕГІЗ ЕРЕЖЕСІ (Г.2, P1.2) ═══
// Мән ТЕК өзінің орташалау кезеңіндегі нормамен салыстырылады:
//   • сағаттық мән       → тек `hourly` нормасы (қазір: NO₂ ЕО 200)
//   • тәуліктік орта     → жергілікті күн бойынша 24 сағаттық орта → `daily` нормасы
//   • O₃ 8 сағаттық орта → жылжымалы 8 сағат → `8h` нормасы
// Басқа нормалар `not-comparable` болады және журналға ЖАЗЫЛМАЙДЫ.
// Жеткіліксіз тәулік/терезе — «тексерілмеді», асу емес; санағышы
// `fixation_runs.insufficient_days`-та.
//
// ═══ ЖАЗБА КІЛТІ ═══
// (region_id, indicator_id, averaging, window_end) — бірегей. Қайта жүгірту
// қауіпсіз: бар жазба қайталанбайды, ескі (негізсіз) жолдар ЖОЙЫЛМАЙДЫ
// (supabase/exceedances_basis.sql — `legacy_invalid_basis`).
//
// ═══ УАҚЫТ ═══
// Сұрау `timezone=GMT` (UTC). Тәулік — Атырау жергілікті күні (Asia/Atyrau,
// UTC+5; Open-Meteo utc_offset_seconds=18000 растайды). Қараңыз: src/lib/fixateWindows.ts.
//
// `observed_hour` — ДЕРЕКТІҢ өз уақыты (терезенің соңғы сағаты, UTC)
// `recorded_at`   — біздің жазған сәтіміз. Екеуін шатастыруға болмайды.
//
// ═══ ҚАУІПСІЗДІК ═══
// Жазу үшін серверлік кілт керек (anon кілтіне RLS жазуға рұқсат бермейді).
// Кілт жоқ болса — 503, жалған «жазылды» жауабы емес.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Қай аймақтар тіркеледі. ҚР — заңдық маңызы бар, сондықтан бірінші. */
const TRACKED = REGIONS.filter((r) => r.country === "KZ");

/** Тіркелетін деңгейлер. `approaching` жазылмайды — ол әлі асу емес. */
const RECORDED_LEVELS: ComplianceLevel[] = ["exceeded", "exceeded-unverified"];

/** Артқа қарай қанша сағат тексеріледі (сағаттық/8 сағаттық терезелер үшін). */
const BACKFILL_HOURS = 48;

/** Тәуліктік норма үшін базис: 24 сағаттық орта. */
const DAILY_BASIS: ComparisonBasis = { averaging: "daily", windowHours: 24 };
/** O₃ 8 сағаттық норма үшін базис. */
const EIGHT_HOUR_BASIS: ComparisonBasis = { averaging: "8h", windowHours: 8 };

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

type IndicatorDef = (typeof INDICATORS)[number];

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
          "ЕКІ ЖИІ ҚАТЕ: (1) қосқаннан КЕЙІН REDEPLOY жасалмаған — орта " +
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
  /** Толық өткен, бірақ жеткіліксіз дерекпен тәулік (көрсеткіш × күн). «Асу болмады» емес — тексерілмеді. */
  let insufficientDays = 0;
  const failed: string[] = [];
  const perRegion: { region: string; hours: number; found: number }[] = [];

  const nowMs = Date.now();
  const cutoff = nowMs - BACKFILL_HOURS * 3600_000;

  for (const region of TRACKED) {
    try {
      // ⚠️ timezone=GMT — жауаптағы уақыттар UTC болады. Бұл маңызды:
      // `observed_hour` — timestamptz бағаны. Жергілікті уақытты офсетсіз
      // жазсақ, база оны UTC деп оқып, сағат 5-ке жылжып кетер еді.
      // Тәулік шекарасын жергілікті күн бойынша `fixateWindows` есептейді.
      const api =
        `https://air-quality-api.open-meteo.com/v1/air-quality` +
        `?latitude=${region.lat}&longitude=${region.lng}` +
        `&hourly=${Object.values(HOURLY_FIELD).join(",")}` +
        // ⚠️ forecast_days=1 — БҮГІНГІ сағаттар үшін.
        // `forecast_days=0` болғанда Open-Meteo тек өткен ТОЛЫҚ күндерді
        // қайтарады, яғни бүгін таңертеңнен бергі сағаттар жауапқа мүлдем
        // кірмейтін: бүгінгі асу ертеңгі жүгіріске дейін тіркелмей тұратын.
        // Болашақ сағаттар төмендегі `tMs > nowMs` тексерісімен сүзіледі —
        // болжам ешқашан «тіркелген асу» болып жазылмайды.
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

      /** Бір бекітілген асуды жолға айналдырады. Мән мен оның терезесі бірге жазылады. */
      const record = (
        ind: IndicatorDef,
        c: ComplianceResult,
        value: number,
        win: { start: string; end: string; count: number },
        averaging: Averaging
      ) => {
        if (!RECORDED_LEVELS.includes(c.worst)) return;
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
          // Кілт (hourly | daily | 8h) — машина оқиды; адам мәтіні UI-да AVERAGING_KZ-тен шығады
          averaging,
          norm_limit: worstCheck?.norm.limit ?? null,
          times_over: worstCheck?.timesOver ?? null,
          tier: tierById.get(ind.id) ?? null,
          summary: c.summary,
          observed_hour: win.end,
          window_start: win.start,
          window_end: win.end,
          sample_count: win.count,
          legacy_invalid_basis: false,
        });
      };

      for (const ind of TRACKED_INDICATORS) {
        const series = j.hourly?.[HOURLY_FIELD[ind.id]] as (number | null)[] | undefined;
        const points: SeriesPoint[] = times.map((time, h) => ({ time, value: series?.[h] }));
        const hasNorm = (a: Averaging) => normsFor(ind.id).some((n) => n.averaging === a);

        // 1) САҒАТТЫҚ мән — тек сағаттық нормамен
        if (hasNorm("hourly")) {
          for (const p of points) {
            const tMs = parseUtcMs(p.time);
            if (!Number.isFinite(tMs) || tMs > nowMs || tMs < cutoff) continue;
            if (p.value == null || !Number.isFinite(p.value)) continue;
            checked++;
            const iso = new Date(tMs).toISOString();
            const c = checkCompliance(ind.id, p.value, "KZ", HOURLY_BASIS);
            record(ind, c, p.value, { start: iso, end: iso, count: 1 }, "hourly");
          }
        }

        // 2) ТӘУЛІКТІК орта — жергілікті күн бойынша, тек АЯҚТАЛҒАН тәулік
        if (hasNorm("daily")) {
          for (const d of dailyWindows(points, { minHours: DAILY_MIN_HOURS_DEFAULT, nowMs, timeZone: LOCAL_TIME_ZONE })) {
            if (!d.complete) continue; // тәулік әлі өтпеген — фиксацияланбайды
            if (!d.sufficient || d.mean == null) {
              insufficientDays++; // тексерілмеді, асу емес
              continue;
            }
            checked++;
            const c = checkCompliance(ind.id, d.mean, "KZ", DAILY_BASIS);
            record(ind, c, d.mean, { start: d.windowStart, end: d.windowEnd, count: d.count }, "daily");
          }
        }

        // 3) O₃ 8 сағаттық жылжымалы орта — тек аяқталған терезе
        if (hasNorm("8h")) {
          for (const w of rollingWindows(points, { windowHours: 8, minCount: EIGHT_HOUR_MIN_COUNT_DEFAULT })) {
            const endMs = parseUtcMs(w.windowEnd);
            if (endMs > nowMs || endMs < cutoff) continue;
            if (!w.sufficient || w.mean == null) continue; // жеткіліксіз терезе — жазылмайды
            checked++;
            const c = checkCompliance(ind.id, w.mean, "KZ", EIGHT_HOUR_BASIS);
            record(ind, c, w.mean, { start: w.windowStart, end: w.windowEnd, count: w.count }, "8h");
          }
        }
      }

      // Топтап жазу — сағат сайын жеке сұраныс жіберудің қажеті жоқ.
      // Бірегейлік (region, indicator, averaging, window_end) қайталауды өзі кесіп тастайды.
      if (rows.length) {
        const { error } = await db.from("exceedances").upsert(rows, {
          onConflict: "region_id,indicator_id,averaging,window_end",
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
  // әлде «тексеру жүрмеген» бе, соны ажырату үшін. Жеткіліксіз тәуліктер де
  // осында есептеледі: олар «тексерілмеді», «асу жоқ» емес.
  // Жазу нәтижесі ТЕКСЕРІЛЕДІ: бұрын қате үнсіз жұтылатын (мыс. exceedances_basis.sql
  // қолданылмаған → insufficient_days бағаны жоқ → жүгіріс тіркелмей, бет «бақылау үзілген» дейтін).
  const { error: runLogErr } = await db.from("fixation_runs").insert({
    regions: TRACKED.length,
    checked,
    found,
    insufficient_days: insufficientDays,
    ok: failed.length === 0,
    error: failed.length ? failed.slice(0, 5).join(" · ") : null,
  });
  if (runLogErr) {
    console.error("fixate: fixation_runs insert failed:", runLogErr.message);
    failed.push(`fixation_runs: ${runLogErr.message}`);
  }

  return NextResponse.json({
    ok: failed.length === 0,
    ranAt: new Date().toISOString(),
    regions: TRACKED.length,
    backfillHours: BACKFILL_HOURS,
    timeZone: LOCAL_TIME_ZONE,
    dailyMinHours: DAILY_MIN_HOURS_DEFAULT,
    eightHourMinCount: EIGHT_HOUR_MIN_COUNT_DEFAULT,
    indicators: TRACKED_INDICATORS.map((i) => i.id),
    checked,
    found,
    written,
    insufficientDays,
    keyEnvName: foundKeyName,
    perRegion,
    failed,
    note:
      "Әр мән өз орташалау кезеңінің нормасымен салыстырылады: сағаттық — сағаттық нормамен, " +
      `тәуліктік — ${DAILY_MIN_HOURS_DEFAULT}+ сағаты бар толық жергілікті күнмен, O₃ — 8 сағаттық ` +
      "тереземен. Жеткіліксіз тәулік «тексерілмеді» деп санала­ды. Тіркелетін деңгейлер: " +
      "норма асқан (расталған) және асқан (шек расталмаған). «Нормаға жақын» жазылмайды.",
  });
}
