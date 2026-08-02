"use client";

import { useEffect, useState } from "react";
import { ScrollText, Loader2, AlertTriangle, Download, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLang } from "@/lib/i18n";
import { TierBadge } from "@/components/ui/TierBadge";
import { useRegion } from "@/store/useRegionStore";

// НОРМА АСУЫНЫҢ ЖУРНАЛЫ.
//
// НЕГЕ КЕРЕК: жүйе сәйкестікті сұраныс кезінде есептейді де, кэшке салады.
// Түнгі 03:00-дегі асу таңертең қарағанда ЖОҚ болып қалатын. Ал прокуратура
// үшін керегі дәл сол: қашан, қандай мән, қандай нормадан асты.
//
// ⚠️ ЕҢ МАҢЫЗДЫ ЭЛЕМЕНТ — «бақылау қамтуы». Бос журнал «асу болмады»
// дегенді БІЛДІРМЕЙДІ: тексеру үзіліп қалған да болуы мүмкін. Сондықтан
// соңғы тексерудің уақыты әрқашан жоғарыда тұрады.

interface Record {
  id: number;
  indicator_id: string;
  indicator_name: string;
  unit: string;
  value: number;
  level: "exceeded" | "exceeded-unverified";
  kz_violation: boolean;
  act_jurisdiction: string | null;
  act_number: string | null;
  averaging: string | null;
  norm_limit: number | null;
  times_over: number | null;
  tier: string | null;
  observed_hour: string;
  recorded_at: string;
}

interface Data {
  available: true;
  region: { id: string; name: string };
  days: number;
  count: number;
  kzViolations: number;
  summary: {
    indicatorId: string; name: string; hours: number;
    maxValue: number; maxTimesOver: number; lastAt: string; kzViolation: boolean;
  }[];
  records: Record[];
  coverage: {
    lastRunAt: string | null; gapHours: number | null;
    interrupted: boolean; note: string;
  };
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("kk-KZ", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });

export function ExceedanceLog() {
  const { tr } = useLang();
  const region = useRegion();
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<{ error: string; reason?: string } | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const loading = loadedFor !== region.id;

  useEffect(() => {
    if (loadedFor === region.id) return;
    fetch(`/api/exceedances?region=${region.id}&days=30`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (ok && d.available) { setData(d); setErr(null); }
        else { setData(null); setErr({ error: d.error, reason: d.reason }); }
      })
      .catch(() => setErr({ error: "Журнал уақытша қолжетімсіз" }))
      .finally(() => setLoadedFor(region.id));
  }, [region.id, loadedFor]);

  return (
    <Card className="border-red-500/20 bg-red-500/[0.03]">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm text-white">
          <ScrollText className="h-4 w-4 text-red-300" />
          {tr("Норма асуының журналы")}
          <span className="text-[11px] font-normal text-neutral-400">
            · {region.name} · {tr("соңғы 30 күн")}
          </span>
          {data && data.count > 0 && (
            <a
              href={`/api/exceedances?region=${region.id}&days=30`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1 rounded border border-white/15 px-2 py-0.5 text-[10px] text-neutral-300 transition hover:bg-white/10"
            >
              <Download className="h-3 w-3" /> JSON
            </a>
          )}
        </CardTitle>
        <p className="text-[11px] leading-relaxed text-neutral-400">
          {tr("Әр асу деректің өз сағатымен тіркеледі — кейін жоғалмайды.")}
        </p>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-neutral-400">
            <Loader2 className="h-4 w-4 animate-spin" /> {tr("Жүктелуде…")}
          </div>
        ) : err ? (
          <div className="space-y-1.5 rounded-lg border border-amber-400/25 bg-amber-500/[0.06] p-3">
            <p className="text-[12px] text-amber-100">⚠ {err.error}</p>
            {err.reason && (
              <p className="text-[11px] leading-relaxed text-neutral-400">{err.reason}</p>
            )}
          </div>
        ) : data ? (
          <>
            {/* ⚠️ БАҚЫЛАУ ҚАМТУЫ — бос журналды дұрыс оқу үшін ЕҢ МАҢЫЗДЫ блок */}
            <div
              className={`mb-3 flex flex-wrap items-center gap-2 rounded-lg border p-2.5 ${
                data.coverage.interrupted
                  ? "border-amber-400/30 bg-amber-500/[0.07]"
                  : "border-emerald-400/25 bg-emerald-500/[0.06]"
              }`}
            >
              <Clock
                className={`h-3.5 w-3.5 shrink-0 ${
                  data.coverage.interrupted ? "text-amber-300" : "text-emerald-300"
                }`}
              />
              <span className="text-[11px] text-neutral-200">
                {tr("Соңғы тексеру")}:{" "}
                {data.coverage.lastRunAt ? fmtTime(data.coverage.lastRunAt) : tr("жүрмеген")}
              </span>
              <span className="w-full text-[10px] leading-snug text-neutral-400">
                {data.coverage.note}
              </span>
            </div>

            {data.count === 0 ? (
              <p className="py-2 text-[12px] leading-relaxed text-neutral-300">
                {tr("Соңғы 30 күнде тіркелген асу жоқ.")}{" "}
                <span className="text-neutral-500">
                  {tr("Бұл — тексеру жүріп тұрған кезеңге ғана қатысты (жоғарыдағы қамтуды қараңыз).")}
                </span>
              </p>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap gap-2">
                  <Stat label={tr("Барлық жазба")} value={data.count} />
                  <Stat label={tr("ҚР нормасы асқан")} value={data.kzViolations} bad={data.kzViolations > 0} />
                  <Stat label={tr("Көрсеткіш")} value={data.summary.length} />
                </div>

                {/* Көрсеткіш бойынша жиынтық */}
                <div className="mb-3 space-y-1">
                  {data.summary.map((s) => (
                    <div
                      key={s.indicatorId}
                      className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1.5"
                    >
                      <span className="text-[12px] text-neutral-100">{s.name}</span>
                      {s.kzViolation && (
                        <span className="rounded border border-red-400/40 bg-red-500/15 px-1 py-px text-[9px] text-red-200">
                          ҚР
                        </span>
                      )}
                      <span className="ml-auto text-[11px] text-neutral-400">
                        {s.hours} {tr("сағат")}
                      </span>
                      <span className="text-[11px] font-semibold text-white">
                        {tr("макс")} {s.maxValue}
                      </span>
                      {s.maxTimesOver > 0 && (
                        <span className="text-[11px] text-red-300">
                          ×{s.maxTimesOver.toFixed(1)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Уақыт бойынша жазбалар */}
                <div className="overflow-x-auto rounded-lg border border-white/10">
                  <table className="w-full min-w-[560px] text-left text-[11px]">
                    <thead className="bg-white/[0.04] text-neutral-400">
                      <tr>
                        <th className="px-2 py-1.5 font-medium">{tr("Оқиға уақыты")}</th>
                        <th className="px-2 py-1.5 font-medium">{tr("Көрсеткіш")}</th>
                        <th className="px-2 py-1.5 text-right font-medium">{tr("Мән")}</th>
                        <th className="px-2 py-1.5 text-right font-medium">{tr("Шек")}</th>
                        <th className="px-2 py-1.5 font-medium">{tr("Норма")}</th>
                        <th className="px-2 py-1.5 font-medium">{tr("Тіркелген")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(showAll ? data.records : data.records.slice(0, 15)).map((r) => (
                        <tr key={r.id} className="border-t border-white/5">
                          <td className="whitespace-nowrap px-2 py-1.5 font-mono text-neutral-200">
                            {fmtTime(r.observed_hour)}
                          </td>
                          <td className="px-2 py-1.5">
                            <span className="text-neutral-200">{r.indicator_name}</span>
                            {r.tier && (
                              <TierBadge tier={r.tier as "measurement" | "model" | "ai"} />
                            )}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold text-white">
                            {r.value} <span className="text-[9px] font-normal text-neutral-500">{r.unit}</span>
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 text-right text-neutral-400">
                            {r.norm_limit ?? "—"}
                            {r.times_over != null && (
                              <span className="ml-1 text-red-300">×{r.times_over.toFixed(1)}</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-neutral-400">
                            {r.act_jurisdiction === "KZ" ? "ҚР" : r.act_jurisdiction ?? "—"}{" "}
                            {r.act_number ?? ""}
                            {r.level === "exceeded-unverified" && (
                              <span className="ml-1 text-amber-300/80">⚠</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 font-mono text-neutral-500">
                            {fmtTime(r.recorded_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {data.records.length > 15 && (
                  <button
                    onClick={() => setShowAll((v) => !v)}
                    className="mt-2 text-[11px] text-sky-300 underline-offset-2 hover:underline"
                  >
                    {showAll
                      ? tr("Жинау")
                      : `${tr("Барлығын көрсету")} (${data.records.length})`}
                  </button>
                )}
              </>
            )}

            <p className="mt-3 border-t border-white/10 pt-2 text-[10px] leading-relaxed text-neutral-500">
              <b className="text-neutral-400">{tr("Оқиға уақыты")}</b> —{" "}
              {tr("деректің өз сағаты (CAMS сағат сайын жаңарады).")}{" "}
              <b className="text-neutral-400">{tr("Тіркелген")}</b> —{" "}
              {tr("жүйе жазып алған сәт. ⚠ белгісі — норма мәтіні расталмаған, заңдық тұжырым емес.")}
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, bad }: { label: string; value: number; bad?: boolean }) {
  return (
    <div
      className={`rounded-lg border px-2.5 py-1.5 ${
        bad ? "border-red-400/30 bg-red-500/10" : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <div className={`text-base font-bold ${bad ? "text-red-300" : "text-white"}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-wide text-neutral-500">{label}</div>
    </div>
  );
}
