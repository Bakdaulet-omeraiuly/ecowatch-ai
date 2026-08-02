import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getRegion } from "@/data/regions";

// НОРМА АСУЫНЫҢ ЖУРНАЛЫ — тіркелген асулар, уақытымен.
//
// Оқу anon кілтімен жүреді (RLS-те SELECT ашық). Жазу тек `/api/fixate`
// арқылы, серверлік кілтпен.
//
// ⚠️ ЕҢ МАҢЫЗДЫСЫ: жауапта `coverage` өрісі бар — соңғы тексеру қашан
// жүргені. Журнал бос болса, ол «асу болмады» дегенді БІЛДІРМЕЙДІ:
// тексеру мүлдем жүрмеген де болуы мүмкін. UI сол айырманы көрсетеді.

export const revalidate = 300; // 5 мин

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const region = getRegion(params.get("region"));
  const days = Math.min(90, Math.max(1, Number(params.get("days")) || 30));
  const since = new Date(Date.now() - days * 86400_000).toISOString();

  if (!supabase) {
    return NextResponse.json(
      {
        available: false,
        error: "Фиксация қоймасы бапталмаған — журнал жүргізілмейді",
        reason:
          "Supabase байланысы жоқ. Асулар тіркелмейді, сондықтан журнал " +
          "көрсетілмейді. Бос тізім «асу болмады» дегенді білдірмейді.",
      },
      { status: 503 }
    );
  }

  try {
    const [{ data: rows, error }, { data: runs }] = await Promise.all([
      supabase
        .from("exceedances")
        .select("*")
        .eq("region_id", region.id)
        .gte("observed_hour", since)
        .order("observed_hour", { ascending: false })
        .limit(500),
      supabase
        .from("fixation_runs")
        .select("ran_at, ok, checked, found")
        .order("ran_at", { ascending: false })
        .limit(1),
    ]);
    if (error) throw new Error(error.message);

    const list = rows ?? [];
    const lastRun = runs?.[0] ?? null;

    // Бақылаудың үзілуі: соңғы тексеруден бері неше сағат өтті
    const gapHours = lastRun
      ? Math.round((Date.now() - new Date(lastRun.ran_at).getTime()) / 3600_000)
      : null;

    // Эпизодтарға топтау: бір көрсеткіштің қатарынан асқан сағаттары
    const byIndicator = new Map<string, typeof list>();
    for (const r of list) {
      const k = r.indicator_id as string;
      if (!byIndicator.has(k)) byIndicator.set(k, []);
      byIndicator.get(k)!.push(r);
    }
    const summary = [...byIndicator.entries()].map(([id, rs]) => ({
      indicatorId: id,
      name: rs[0].indicator_name,
      hours: rs.length,
      maxValue: Math.max(...rs.map((r) => r.value as number)),
      maxTimesOver: Math.max(...rs.map((r) => (r.times_over as number) ?? 0)),
      lastAt: rs[0].observed_hour,
      kzViolation: rs.some((r) => r.kz_violation),
    }));

    return NextResponse.json({
      available: true,
      region: { id: region.id, name: region.name },
      days,
      count: list.length,
      kzViolations: list.filter((r) => r.kz_violation).length,
      summary: summary.sort((a, b) => b.hours - a.hours),
      records: list,
      coverage: {
        lastRunAt: lastRun?.ran_at ?? null,
        lastRunOk: lastRun?.ok ?? null,
        gapHours,
        // Сағат сайынғы cron: 2 сағаттан асса — үзіліс болды
        interrupted: gapHours == null || gapHours > 2,
        note:
          lastRun == null
            ? "Тексеру әлі бір рет те жүрмеген — журналдағы бос орын «асу болмады» дегенді БІЛДІРМЕЙДІ."
            : gapHours != null && gapHours > 2
              ? `Соңғы тексеру ${gapHours} сағат бұрын. Бақылау үзілген — сол аралықтағы асулар тіркелмеген болуы мүмкін.`
              : "Бақылау үзіліссіз жүріп тұр.",
      },
      note:
        "Әр жазба — деректің ӨЗ САҒАТЫ бойынша тіркелген асу. `observed_hour` — " +
        "оқиғаның уақыты, `recorded_at` — тіркеудің уақыты.",
    });
  } catch (err) {
    console.error("exceedances error:", err);
    return NextResponse.json(
      {
        available: false,
        error: "Журнал уақытша қолжетімсіз",
        reason:
          "Кесте жасалмаған болуы мүмкін: supabase/exceedances.sql файлын " +
          "Supabase SQL Editor-де іске қосыңыз.",
      },
      { status: 503 }
    );
  }
}
