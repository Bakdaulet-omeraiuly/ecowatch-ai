"use client";

import { useMemo } from "react";
import { Play, Pause, ChevronLeft, ChevronRight, FileText, Download, CalendarClock, RotateCcw } from "lucide-react";
import { useLang } from "@/lib/i18n";
import type { PollutionSourceData, PollutionTimelineHour, ComplianceLevelLite } from "@/hooks/useEcoData";

// ЛАСТАНУ ОҚИҒАСЫНЫҢ УАҚЫТ БАСҚАРУЫ МЕН ХРОНОЛОГИЯСЫ.
//
// ═══ НЕГЕ КЕРЕК ═══
// Бұрын анимация тек автоойнататын (450 мс), тоқтатуға да, нақты сағатты
// таңдауға да болмайтын. Ал оқиғаны талдау үшін керегі — «14:00-ге тоқтат,
// сол сағатта не болғанын көрсет». Енді слайдер бар: әр сағатты қолмен
// таңдауға, тоқтатуға, бір сағат алға-артқа жылжуға болады.
//
// ═══ ⚠️ ЖАПСЫРМА РЕЖИМГЕ ҚАРАП ӨЗГЕРЕДІ ═══
// Тірі режимде тірек сағаттан кейінгісі — БОЛЖАМ.
// Архив режимінде ол — ӨЛШЕНГЕН (нақты болған) дерек.
// Екеуін бір сөзбен атау пайдаланушыны адастырады.
//
// ═══ ⚠️ «ЖЕЛ БАҒЫТЫНДА» ДЕГЕН НЕ ═══
// Елді мекеннің конус ішінде болуы — сол жерде ластану ӨЛШЕНДІ дегенді
// БІЛДІРМЕЙДІ. Концентрация қала нүктесінде (CAMS ~40 км тор) алынған.
// Бұл ескерту кестенің астында ӘРҚАШАН тұруы керек.

const LEVEL_CLS: Record<ComplianceLevelLite, string> = {
  ok: "text-neutral-300",
  approaching: "text-amber-300",
  exceeded: "text-red-300 font-semibold",
  "exceeded-unverified": "text-orange-300",
  unknown: "text-neutral-500",
};
const LEVEL_MARK: Record<ComplianceLevelLite, string> = {
  ok: "", approaching: "~", exceeded: "⚠", "exceeded-unverified": "⚠?", unknown: "",
};

/** "2026-08-14T15:00" → datetime-local қабылдайтын пішін (сол қалпы) */
const toLocalInput = (iso: string) => iso.slice(0, 16);

export function PollutionTimeline({
  source, frameIdx, onFrame, playing, onPlayToggle,
  at, onAt, loading, regionId,
}: {
  source: PollutionSourceData;
  /** Ағымдағы кадр индексі (timeline ішінде) */
  frameIdx: number;
  onFrame: (i: number) => void;
  playing: boolean;
  onPlayToggle: () => void;
  /** Таңдалған архив сағаты (null — тірі режим) */
  at: string | null;
  onAt: (v: string | null) => void;
  loading: boolean;
  regionId: string;
}) {
  const { tr } = useLang();
  const rows: PollutionTimelineHour[] = source.timeline ?? [];
  const archive = source.mode === "archive";
  const cur = rows[Math.min(frameIdx, Math.max(0, rows.length - 1))];

  // datetime-local үшін шектер: бүгіннен MAX_DAYS_BACK күн бұрынға дейін
  const bounds = useMemo(() => {
    const now = new Date();
    const min = new Date(now.getTime() - (source.maxDaysBack ?? 366) * 86400_000);
    const p = (n: number) => String(n).padStart(2, "0");
    const f = (d: Date) =>
      `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:00`;
    return { min: f(min), max: f(now) };
  }, [source.maxDaysBack]);

  const reportUrl = `/api/pollution-report?region=${regionId}${at ? `&at=${encodeURIComponent(at)}` : ""}`;

  return (
    <div className="space-y-2.5">
      {/* ── УАҚЫТ ТАҢДАУ ─────────────────────────────────────────────── */}
      <div className="rounded-lg bg-white/[0.03] p-2.5">
        <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-neutral-200">
          <CalendarClock className="h-3.5 w-3.5 text-sky-300" />
          {tr("Нақты уақытты таңдау")}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            type="datetime-local"
            step={3600}
            min={bounds.min}
            max={bounds.max}
            value={at ? toLocalInput(at) : ""}
            onChange={(e) => onAt(e.target.value ? `${e.target.value.slice(0, 13)}:00` : null)}
            className="flex-1 rounded border border-white/15 bg-neutral-900 px-2 py-1 text-[13px] text-neutral-100 [color-scheme:dark]"
          />
          {archive && (
            <button
              onClick={() => onAt(null)}
              className="inline-flex items-center gap-1 rounded border border-white/15 bg-white/5 px-2 py-1 text-[12px] text-neutral-300 hover:bg-white/10"
              title={tr("Тірі режимге қайту")}
            >
              <RotateCcw className="h-3 w-3" /> {tr("Тірі")}
            </button>
          )}
        </div>
        <p className="mt-1 text-[12px] leading-snug text-neutral-400">
          {archive
            ? `${source.atLabel} · ${source.daysAgo} ${tr("күн бұрын")}`
            : tr("Жыл, ай, күн, сағат таңдаңыз — сол сәттегі нақты жағдай көрсетіледі")}
          {" · "}
          {tr("тереңдік")}: {source.maxDaysBack} {tr("күн")}
        </p>
        {loading && (
          <p className="mt-1 text-[12px] text-sky-300">{tr("Архивтен жүктелуде…")}</p>
        )}
      </div>

      {source.archiveNote && (
        <p className="rounded border border-amber-400/25 bg-white/[0.02] px-2 py-1.5 text-[12px] leading-relaxed text-amber-100/90">
          {source.archiveNote}
        </p>
      )}

      {/* ── САҒАТТЫҚ СКРОЛЛЕР ────────────────────────────────────────── */}
      {rows.length > 0 && (
        <div className="rounded-lg bg-white/[0.03] p-2.5">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-neutral-200">
              {cur ? cur.time.replace("T", " ").slice(0, 16) : "—"}
            </span>
            <span className="text-[12px] text-neutral-400">
              {cur && `${cur.wind.fromLabel} · ${cur.wind.speed} ${tr("км/сағ")}`}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onFrame(Math.max(0, frameIdx - 1))}
              disabled={frameIdx <= 0}
              className="rounded border border-white/15 bg-white/5 p-1 text-neutral-300 hover:bg-white/10 disabled:opacity-30"
              title={tr("Бір сағат артқа")}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onPlayToggle}
              className="rounded border border-violet-400/40 bg-violet-500/15 p-1 text-violet-200 hover:bg-violet-500/25"
              title={playing ? tr("Тоқтату") : tr("Ойнату")}
            >
              {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => onFrame(Math.min(rows.length - 1, frameIdx + 1))}
              disabled={frameIdx >= rows.length - 1}
              className="rounded border border-white/15 bg-white/5 p-1 text-neutral-300 hover:bg-white/10 disabled:opacity-30"
              title={tr("Бір сағат алға")}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <input
              type="range"
              min={0}
              max={Math.max(0, rows.length - 1)}
              value={Math.min(frameIdx, rows.length - 1)}
              onChange={(e) => onFrame(+e.target.value)}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/15 accent-violet-400"
            />
          </div>

          <div className="mt-1 flex justify-between text-[12px] text-neutral-400">
            <span>{rows[0]?.hour}</span>
            <span>
              {frameIdx + 1}/{rows.length} ·{" "}
              {cur?.past
                ? tr("өткен")
                : archive
                  ? tr("өлшенген (оқиғадан кейін)")
                  : tr("болжам")}
            </span>
            <span>{rows[rows.length - 1]?.hour}</span>
          </div>
        </div>
      )}

      {/* ── ХРОНОЛОГИЯ ───────────────────────────────────────────────── */}
      {rows.length > 0 && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[13px] font-semibold text-neutral-200">
              {tr("Сағаттық хронология")}
            </span>
            <span className="text-[12px] text-neutral-400">µg/m³</span>
          </div>
          <div className="max-h-56 overflow-auto rounded-lg border border-white/10">
            <table className="w-full min-w-[680px] text-left text-[12px]">
              <thead className="sticky top-0 border-b border-white/10 bg-neutral-950 text-neutral-500">
                <tr>
                  <th className="px-1.5 py-1 font-medium">{tr("Уақыт")}</th>
                  <th className="px-1.5 py-1 font-medium">{tr("Жел")}</th>
                  <th className="px-1.5 py-1 font-medium">{tr("Жел бағытында")}</th>
                  <th className="px-1.5 py-1 text-right font-medium">SO₂</th>
                  <th className="px-1.5 py-1 text-right font-medium">NO₂</th>
                  <th className="px-1.5 py-1 text-right font-medium">PM₁₀</th>
                  <th className="px-1.5 py-1 text-right font-medium">PM₂.₅</th>
                  <th className="px-1.5 py-1 text-right font-medium">O₃</th>
                  <th className="px-1.5 py-1 text-right font-medium">CO</th>
                  {/* Нормасы жоқ — тек өлшем әрі ажыратқыш */}
                  <th className="px-1.5 py-1 text-right font-medium text-neutral-400">Шаң</th>
                  <th className="px-1.5 py-1 text-right font-medium text-neutral-400">CH₄</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={r.time}
                    onClick={() => onFrame(i)}
                    className={`cursor-pointer border-t border-white/5 transition-colors ${
                      i === frameIdx ? "bg-violet-500/20" : r.kzViolation ? "bg-red-500/10" : "hover:bg-white/5"
                    }`}
                  >
                    <td className="whitespace-nowrap px-1.5 py-1 font-mono text-neutral-300">
                      {r.hour}
                      {r.pivot && <span className="ml-1 text-violet-300">●</span>}
                    </td>
                    <td className="whitespace-nowrap px-1.5 py-1 text-neutral-400">
                      {r.wind.fromLabel} {r.wind.speed}
                    </td>
                    <td className="px-1.5 py-1 text-neutral-300">
                      {r.downwind.join(", ") || <span className="text-neutral-500">—</span>}
                    </td>
                    {(["so2", "no2", "pm", "pm25", "ozone", "co"] as const).map((k) => (
                      <td key={k} className={`whitespace-nowrap px-1.5 py-1 text-right ${LEVEL_CLS[r.levels[k]]}`}>
                        {r[k] ?? "—"} {LEVEL_MARK[r.levels[k]]}
                      </td>
                    ))}
                    {/* Шаң мен метан — гигиеналық нормасы ЖОҚ, сондықтан
                        деңгей түсі берілмейді (жалған «асты» әсерін
                        болдырмау үшін) */}
                    {(["dust", "ch4"] as const).map((k) => (
                      <td key={k} className="whitespace-nowrap px-1.5 py-1 text-right text-neutral-400">
                        {r[k] ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-neutral-400">
            <b className="text-neutral-400">{tr("«Жел бағытында»")}</b>{" "}
            {tr(
              "— сол сағаттағы таралу конусының ішіне түскен елді мекендер. Бұл сол жерде " +
              "ластану ӨЛШЕНДІ дегенді білдірмейді: концентрация қала нүктесінде (CAMS ~40 км тор) алынған."
            )}{" "}
            <b className="text-neutral-400">⚠</b> {tr("— расталған нормадан асты")},{" "}
            <b className="text-neutral-400">⚠?</b> {tr("— асты, бірақ норма мәтіні расталмаған")}.{" "}
            <b className="text-neutral-400">{tr("Шаң мен CH₄")}</b>{" "}
            {tr("— гигиеналық нормасы жоқ, тек өлшем. Шаң — PM₁₀ асуы шөл шаңынан ба, әлде кәсіпорыннан ба, соны ажыратуға көмектеседі.")}
          </p>

          {/* ⛔ ӨЛШЕНБЕЙТІНІ — бос баған етіп қосуға БОЛМАЙДЫ.
              Бос ұяшық «қаралды, таза екен» деген жалған әсер берер еді.
              Сондықтан кестенің АСТЫНДА ашық жазба ретінде тұрады. */}
          <div className="mt-2 rounded-lg border border-red-400/25 bg-white/[0.02] p-2">
            <p className="text-[12px] leading-relaxed text-red-100/90">
              <b>⛔ {tr("Бұл кестеде ЖОҚ, себебі мүлдем өлшенбейді")}:</b>{" "}
              H₂S ({tr("күкіртсутек")}), {tr("меркаптандар")}, {tr("бензол")},{" "}
              {tr("формальдегид")}, {tr("бенз(а)пирен")}, {tr("фенол")},{" "}
              {tr("ауыр металдар")} (V, Ni, Pb, Hg, Cd).
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-neutral-400">
              {tr(
                "Бұлар спутниктен де, CAMS моделінен де анықталмайды — тек жердегі аспап " +
                "пен зертхана арқылы. H₂S — мұнай өңдеудің басты маркері, сондықтан " +
                "кестедегі сандар «ауа таза» дегенді БІЛДІРМЕЙДІ."
              )}{" "}
              <a href="/legislation" className="text-sky-300 underline-offset-2 hover:underline">
                {tr("Толық тізім →")}
              </a>
            </p>
          </div>
        </div>
      )}

      {/* ── ҚҰЖАТ ────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-emerald-400/25 bg-white/[0.02] p-2.5">
        <div className="mb-1 text-[13px] font-semibold text-emerald-100">
          {tr("Мемлекеттік органға арналған құжат")}
        </div>
        <p className="mb-2 text-[12px] leading-relaxed text-neutral-400">
          {tr(
            "Оқиғаның уақыты, метеожағдайы, сағаттық хронологиясы, нормативтік салыстыруы " +
            "және заң актілері бір анықтамаға жиналады. Басып шығаруға / PDF сақтауға дайын."
          )}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <a
            href={reportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 text-[12px] font-medium text-emerald-100 hover:bg-emerald-500/25"
          >
            <FileText className="h-3 w-3" /> {tr("Анықтама (PDF)")}
          </a>
          <a
            href={`${reportUrl}&format=csv`}
            className="inline-flex items-center gap-1.5 rounded border border-white/15 bg-white/5 px-2.5 py-1 text-[12px] text-neutral-300 hover:bg-white/10"
          >
            <Download className="h-3 w-3" /> CSV
          </a>
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-amber-200/70">
          ⚠{" "}
          {tr(
            "Анықтама ешкімді айыптамайды: спутник/модель дерегі құқық бұзушылық фактісі емес, " +
            "тек ТЕКСЕРУ ЖҮРГІЗУГЕ негіз. Заңдық тұжырым аккредиттелген зертхананың өлшемімен жасалады."
          )}
        </p>
      </div>
    </div>
  );
}
