import { NextResponse } from "next/server";
import { getRegion, hasModule } from "@/data/regions";
import { checkCompliance, LEVEL_KZ, type ComplianceResult } from "@/lib/compliance";
import { LEGAL_DISCLAIMER, ACTS } from "@/data/legalNorms";
import { formatKz } from "@/lib/pollutionTime";
import { summarizeTimeline, type TimelineHour } from "@/lib/pollutionTimeline";
import { csvHeaders, toCsv, withProvenance, type Cell } from "@/lib/csv";

// ═══════════════════════════════════════════════════════════════════════
// АТМОСФЕРАЛЫҚ АУАНЫҢ ЛАСТАНУЫ ТУРАЛЫ АҚПАРАТТЫҚ АНЫҚТАМА
// (прокуратура / экология департаменті үшін)
//
// ⚠️⚠️ ҚҰЖАТТЫҢ ЗАҢДЫҚ МӘРТЕБЕСІ — ЕҢ МАҢЫЗДЫ ЖЕР ⚠️⚠️
//
// Бұл құжат «заң бұзылды» деп ТҰЖЫРЫМ ЖАСАМАЙДЫ және ешкімді
// АЙЫПТАМАЙДЫ. Себебі:
//
//   1. CAMS — ~40 км тор. Бір ұяшық бүкіл қаланы бір санмен жабады,
//      сондықтан нақты кәсіпорынға телу ЗАҢДЫҚ ФАКТ бола алмайды.
//   2. Дисперсия конусы — Pasquill/Briggs бойынша ЫҚТИМАЛ таралу
//      секторы, өлшенген концентрация өрісі емес.
//   3. ҚР заңнамасында әкімшілік жауапкершілікке негіз болатын өлшем —
//      аккредиттелген зертхананың хаттамасы (LEGAL_DISCLAIMER қара).
//
// Сондықтан құжаттың мақсаты БІРЕУ: «мына уақытта, мына жерде модель
// мынадай мән көрсетті, жел мына жақтан соқты — ТЕКСЕРУ ЖҮРГІЗУГЕ негіз
// бар». Одан әрі тұжырымды құзырлы орган өз өлшемімен жасайды.
//
// Егер біреу бұл файлды «айыптау» бағытына бұрғысы келсе — олай ІСТЕУГЕ
// БОЛМАЙДЫ: құжат бірінші сараптамада күйрейді әрі жобаға құқықтық
// тәуекел әкеледі.
// ═══════════════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface SourceData {
  mode: "live" | "archive";
  at: string | null;
  atLabel: string | null;
  fetchedAt: string;
  detected: boolean;
  pollutant: string;
  pollutantLabel: string;
  signalStrength: number;
  wind: { fromBearing: number; fromLabel: string; speed: number; toBearing: number };
  candidates: { id: string; name: string; short: string; confidence: number; distanceKm: number; bearingFromCity: number; approx?: boolean }[];
  top: { name: string; confidence: number; distanceKm: number } | null;
  stability: {
    cls: string; label: string; note: string; windDirSigma: number;
    coneAngle: { total: number; physical: number; wind: number };
    plumeLengthKm: number;
  };
  windField: { localPoints: number; totalReceptors: number; note: string };
  groundStations: number;
  timeline: TimelineHour[];
  sources: string[];
  archiveNote: string | null;
  method: string;
  note: string;
}

const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );

const LEVEL_MARK: Record<string, string> = {
  ok: "", approaching: "~", exceeded: "⚠", "exceeded-unverified": "⚠?", unknown: "—",
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const region = getRegion(url.searchParams.get("region"));
  const at = url.searchParams.get("at");
  const format = url.searchParams.get("format") ?? "html";

  if (!hasModule(region, "pollutionSource")) {
    return NextResponse.json(
      {
        error: `${region.name} үшін ластану көзі модулі жоқ`,
        detail:
          "Бұл модуль кәсіпорындардың ТЕКСЕРІЛГЕН координаттар тізілімін талап " +
          "етеді. Тізілім жоқ аймақта «көз» көрсету жалған айыптау болар еді.",
      },
      { status: 404 }
    );
  }

  // Деректі өз жүйемізден аламыз — есептеу логикасы қайталанбауы керек
  const q = `region=${encodeURIComponent(region.id)}${at ? `&at=${encodeURIComponent(at)}` : ""}`;
  const res = await fetch(`${url.origin}/api/pollution-source?${q}`, { cache: "no-store" });
  const d = (await res.json()) as SourceData & { error?: string; detail?: string };
  if (!res.ok) {
    return NextResponse.json(
      {
        error: d.error ?? "Дерек алынбады — анықтама жасалмайды",
        detail: d.detail ?? "Ойдан дерек жасалмайды.",
      },
      { status: res.status }
    );
  }

  const rows = d.timeline ?? [];
  const sum = summarizeTimeline(rows);
  const jur = region.country === "KZ" ? "KZ" : "OTHER";

  // Шыңдық мәндер бойынша норма салыстыруы
  const peakOf = (k: "so2" | "no2" | "pm") => {
    const vals = rows.map((r) => r[k]).filter((v): v is number => v != null);
    return vals.length ? Math.max(...vals) : null;
  };
  const checks: { id: string; label: string; value: number | null; res: ComplianceResult }[] = [
    { id: "so2", label: "SO₂ (күкірт диоксиді)", value: peakOf("so2") },
    { id: "no2", label: "NO₂ (азот диоксиді)", value: peakOf("no2") },
    { id: "pm10", label: "PM₁₀ (ірі дисперсті шаң)", value: peakOf("pm") },
  ].map((c) => ({ ...c, res: checkCompliance(c.id, c.value, jur) }));

  const periodLabel = d.atLabel ?? "соңғы 48 сағат (тірі режим)";

  // ── CSV нұсқасы: машина өңдеуіне ────────────────────────────────────
  if (format === "csv") {
    const head: Cell[] = [
      "Уақыт", "Жел (қайдан)", "Жел бағыты (°, қайда)", "Жел (км/сағ)",
      "Жел бағытындағы елді мекендер", "SO₂ µg/m³", "NO₂ µg/m³", "PM₁₀ µg/m³",
      "SO₂ күйі", "NO₂ күйі", "PM₁₀ күйі", "ҚР расталған нормасы асты ма",
    ];
    const body: Cell[][] = rows.map((r) => [
      r.time, r.wind.fromLabel, r.wind.toBearing, r.wind.speed,
      r.downwind.join(" · "), r.so2, r.no2, r.pm,
      LEVEL_KZ[r.levels.so2], LEVEL_KZ[r.levels.no2], LEVEL_KZ[r.levels.pm],
      r.kzViolation ? "иә" : "жоқ",
    ]);
    const csv = toCsv(
      withProvenance([head, ...body], {
        dataset: `Атмосфералық ауаның ластануы — сағаттық хронология — ${region.name} — ${periodLabel}`,
        tier: "Модель",
        source: (d.sources ?? []).join(" · "),
        fetchedAt: d.fetchedAt,
        method: d.method,
        caveats: [
          "«Жел бағытындағы елді мекендер» — дисперсия конусының ішіне түскен нүктелер. Бұл сол жерде ластану ӨЛШЕНДІ дегенді БІЛДІРМЕЙДІ.",
          "Концентрация ҚАЛА нүктесінде (CAMS ~40 км тор), әр елді мекенде емес.",
          LEGAL_DISCLAIMER,
        ],
      })
    );
    const name = `jaiyq-lastanu-hronologiya-${region.id}-${(d.at ?? d.fetchedAt).slice(0, 13).replace(/[:T]/g, "-")}.csv`;
    return new NextResponse(csv, { headers: csvHeaders(name) });
  }

  // ── HTML нұсқасы: басып шығаруға / PDF-ке дайын ─────────────────────
  const actList = [...new Set(checks.flatMap((c) => c.res.checks.map((x) => x.act.id)))];

  const html = `<!doctype html>
<html lang="kk"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ақпараттық анықтама — ${esc(region.name)} — ${esc(periodLabel)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: "DejaVu Sans", "Segoe UI", Arial, sans-serif; font-size: 11pt;
         line-height: 1.5; color: #111; background: #fff; margin: 0 auto; max-width: 900px; padding: 24px; }
  h1 { font-size: 15pt; text-align: center; margin: 0 0 4px; text-transform: uppercase; letter-spacing: .3px; }
  .sub { text-align: center; font-size: 10.5pt; color: #444; margin-bottom: 2px; }
  .meta { text-align: center; font-size: 9.5pt; color: #666; margin-bottom: 18px; }
  h2 { font-size: 12pt; margin: 22px 0 8px; padding-bottom: 4px; border-bottom: 1.5px solid #222; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin: 8px 0; }
  th, td { border: 1px solid #999; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #eee; font-weight: 600; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  tr.viol td { background: #fdeaea; }
  tr.pivot td { outline: 2px solid #333; font-weight: 600; }
  .warn { border: 1.5px solid #b00; background: #fff5f5; padding: 10px 12px; margin: 14px 0; }
  .note { border-left: 3px solid #999; background: #fafafa; padding: 8px 12px; margin: 10px 0; font-size: 10pt; color: #333; }
  dl { margin: 6px 0; } dt { font-weight: 600; float: left; clear: left; width: 210px; }
  dd { margin-left: 220px; margin-bottom: 3px; }
  ol, ul { margin: 6px 0 6px 20px; padding: 0; } li { margin-bottom: 4px; }
  .sign { margin-top: 34px; display: flex; justify-content: space-between; font-size: 10pt; }
  .small { font-size: 9pt; color: #555; }
  a { color: #06c; word-break: break-all; }
  @media print { body { padding: 0; } .noprint { display: none; } h2 { page-break-after: avoid; } tr { page-break-inside: avoid; } }
</style></head><body>

<div class="noprint" style="text-align:right;margin-bottom:10px">
  <button onclick="window.print()" style="padding:7px 14px;font-size:11pt;cursor:pointer">🖨 Басып шығару / PDF сақтау</button>
</div>

<h1>Атмосфералық ауаның ластануы туралы<br>ақпараттық анықтама</h1>
<p class="sub"><b>Тексеру жүргізуге негіз ретінде</b></p>
<p class="meta">
  ${esc(region.name)} · Кезең: ${esc(periodLabel)}<br>
  Жасалған уақыты: ${esc(new Date(d.fetchedAt).toISOString().replace("T", " ").slice(0, 16))} UTC ·
  Дереккөз жүйе: Jaiyq (ecojaiyq.com)
</p>

<div class="warn">
  <b>ҚҰЖАТТЫҢ МӘРТЕБЕСІ.</b> ${esc(LEGAL_DISCLAIMER)}
  <br><br>
  Осы анықтама ешкімді айыптамайды және құқық бұзушылық фактісін бекітпейді.
  Оның жалғыз мақсаты — құзырлы органға тексеру жүргізуге негіз болатын
  жағдайды уақыты мен өлшемдері көрсетілген түрде жеткізу.
</div>

<h2>1. Оқиғаның уақыты мен орны</h2>
<dl>
  <dt>Аймақ</dt><dd>${esc(region.name)}${region.country === "KZ" ? " (Қазақстан Республикасы)" : ""}</dd>
  <dt>Талданған кезең</dt><dd>${esc(periodLabel)}</dd>
  <dt>Дерек режимі</dt><dd>${d.mode === "archive" ? "Архив (өткен оқиға)" : "Тірі (ағымдағы жағдай)"}</dd>
  <dt>Талданған сағат саны</dt><dd>${sum.hours}</dd>
  <dt>Норма асқан сағат саны</dt><dd>${sum.exceededHours}${sum.exceededHours ? ` (оның ${sum.kzViolationHours}-і — ҚР расталған нормасы)` : ""}</dd>
  ${sum.firstExceedance ? `<dt>Алғашқы асу тіркелген сәт</dt><dd><b>${esc(formatKz(sum.firstExceedance))}</b></dd>` : ""}
  ${sum.lastExceedance ? `<dt>Соңғы асу тіркелген сәт</dt><dd><b>${esc(formatKz(sum.lastExceedance))}</b></dd>` : ""}
  ${sum.peak ? `<dt>Ең жоғары мән</dt><dd>${esc(sum.peak.pollutant)} — <b>${sum.peak.value} µg/m³</b> (${esc(formatKz(sum.peak.time))})</dd>` : ""}
  ${sum.affected.length ? `<dt>Асу сағаттарында жел бағытында болған елді мекендер</dt><dd>${esc(sum.affected.join(", "))}</dd>` : ""}
</dl>
${d.archiveNote ? `<div class="note">${esc(d.archiveNote)}</div>` : ""}

<h2>2. Метеорологиялық жағдай</h2>
<dl>
  <dt>Жел (қайдан соқты)</dt><dd>${esc(d.wind.fromLabel)}, ${d.wind.speed} км/сағ (${(d.wind.speed / 3.6).toFixed(1)} м/с)</dd>
  <dt>Шлейфтің бағыты</dt><dd>${d.wind.toBearing}° (солтүстіктен сағат тілімен)</dd>
  <dt>Атмосфералық орнықтылық</dt><dd>${esc(d.stability.cls)} — ${esc(d.stability.label)}. ${esc(d.stability.note)}</dd>
  <dt>Таралу конусының бұрышы</dt><dd>${d.stability.coneAngle.total.toFixed(1)}° = ${d.stability.coneAngle.physical}° физикалық жайылу + ${d.stability.coneAngle.wind}° жел бағытының ауытқуы</dd>
  <dt>Шлейфтің есептік ұзындығы</dt><dd>${d.stability.plumeLengthKm} км</dd>
  <dt>Жел өрісі</dt><dd>${esc(d.windField.note)}</dd>
  <dt>Жердегі стансалар</dt><dd>${d.groundStations ? `${d.groundStations} стансаның деректері ескерілді` : "қосылмаған (төмендегі шектеулерді қараңыз)"}</dd>
</dl>

<h2>3. Сағаттық хронология</h2>
<p class="small">
  «Жел бағытында» бағаны — сол сағаттағы дисперсия конусының ішіне түскен елді мекендер.
  <b>Бұл сол жерде ластану ӨЛШЕНДІ дегенді білдірмейді</b> — концентрация қала нүктесінде
  (CAMS ~40 км тор) алынған. Бағанның мәні: жел қай жаққа соққанын уақытымен көрсету.
</p>
<table>
  <thead><tr>
    <th>Уақыт</th><th>Жел</th><th>км/сағ</th><th>Жел бағытында</th>
    <th>SO₂</th><th>NO₂</th><th>PM₁₀</th>
  </tr></thead>
  <tbody>
  ${rows
    .map(
      (r) => `<tr class="${r.kzViolation ? "viol" : ""}${r.pivot ? " pivot" : ""}">
      <td>${esc(r.time.replace("T", " ").slice(0, 16))}</td>
      <td>${esc(r.wind.fromLabel)}</td>
      <td class="num">${r.wind.speed}</td>
      <td>${esc(r.downwind.join(", ") || "—")}</td>
      <td class="num">${r.so2 ?? "—"} ${LEVEL_MARK[r.levels.so2] ?? ""}</td>
      <td class="num">${r.no2 ?? "—"} ${LEVEL_MARK[r.levels.no2] ?? ""}</td>
      <td class="num">${r.pm ?? "—"} ${LEVEL_MARK[r.levels.pm] ?? ""}</td>
    </tr>`
    )
    .join("\n")}
  </tbody>
</table>
<p class="small">Белгілер: <b>⚠</b> — расталған нормадан асты · <b>⚠?</b> — асты, бірақ норма мәтіні расталмаған · <b>~</b> — нормаға жақындады (≥80%) · қызыл жол — ҚР расталған нормасы асқан сағат.</p>

<h2>4. Нормативтік салыстыру</h2>
${checks
  .map(
    (c) => `
  <p><b>${esc(c.label)}</b> — кезеңдегі ең жоғары мән: <b>${c.value ?? "дерек жоқ"}${c.value != null ? " µg/m³" : ""}</b>.
  Тұжырым: ${esc(c.res.summary)}</p>
  ${
    c.res.checks.length
      ? `<table><thead><tr><th>Норматив</th><th>Акт</th><th>Орташалау</th><th>Шек</th><th>Қатынас</th><th>Күйі</th><th>Растау</th></tr></thead><tbody>
      ${c.res.checks
        .map(
          (x) => `<tr><td>${esc(x.act.title)}</td>
          <td>${esc(x.act.number)}</td>
          <td>${esc(x.averagingKz)}</td>
          <td class="num">${x.norm.limit} ${esc(x.norm.unit)}</td>
          <td class="num">${x.timesOver != null ? `×${x.timesOver.toFixed(2)}` : (x.ratio * 100).toFixed(0) + "%"}</td>
          <td>${esc(LEVEL_KZ[x.level])}</td>
          <td>${esc(x.norm.status)}</td></tr>`
        )
        .join("")}
      </tbody></table>`
      : `<p class="small">Бұл көрсеткіш үшін тізілімде салыстыруға норма жоқ.</p>`
  }`
  )
  .join("\n")}

<div class="note">
  <b>Растау күйі туралы.</b> Тізілімдегі кейбір ШРК мәні бастапқы актімен әлі
  салыстырылмаған. Ондай шек бойынша жүйе «норма асқан (шек расталмаған)»
  деп қана белгілейді және <b>заң бұзылды деген тұжырым ШЫҒАРМАЙДЫ</b>.
  Тексеру барысында актінің қолданыстағы редакциясын ашып салыстыру қажет.
</div>

<h2>5. Жел бағыты бойынша талдау</h2>
${
  d.detected
    ? `<p>Талданған кезеңде елеулі концентрация көтерілуі тіркелген
       (басым ластаушы: ${esc(d.pollutantLabel)}, сигнал күші ${d.signalStrength}/100).
       Жел бағыты мен қашықтық бойынша есептелген ЫҚТИМАЛДЫҚ реті төменде.</p>`
    : `<p>Талданған кезеңде елеулі концентрация көтерілуі тіркелмеген.
       Төмендегі тізім — тек географиялық орналасу, ластану оқиғасы емес.</p>`
}
<table>
  <thead><tr><th>№</th><th>Нысан</th><th>Қаладан қашықтық</th><th>Бағыты</th><th>Салыстырмалы ықтималдық</th></tr></thead>
  <tbody>
  ${(d.candidates ?? [])
    .map(
      (c, i) => `<tr><td class="num">${i + 1}</td>
      <td>${esc(c.name)}${c.approx ? " <span class=\"small\">(координата жуық)</span>" : ""}</td>
      <td class="num">${c.distanceKm.toFixed(1)} км</td>
      <td class="num">${Math.round(c.bearingFromCity)}°</td>
      <td class="num">${c.confidence}%</td></tr>`
    )
    .join("")}
  </tbody>
</table>
<div class="warn">
  <b>Бұл баған айыптау ЕМЕС.</b> «Салыстырмалы ықтималдық» — тек белгілі
  нысандар ішіндегі өзара рет: жел бағытына сәйкестігі мен қашықтығы бойынша
  есептелген. Ол нақты шығарынды өлшемі емес, себебі:
  <ul>
    <li>кәсіпорындардың шығарынды қарқыны (г/с) жүйеде жоқ;</li>
    <li>құбыр биіктігі мен шлейфтің көтерілуі ескерілмейді;</li>
    <li>тізілімде жоқ көз (көлік, тұрмыстық жағу, шаң дауылы) есепке алынбайды.</li>
  </ul>
  Нақты көзді анықтау — құзырлы органның аспаптық тексеруінің міндеті.
</div>

<h2>6. Әдістеме және шектеулер</h2>
<p class="small">${esc(d.method)}</p>
<ul class="small">
  <li>Концентрация — Copernicus CAMS атмосфералық химия моделі, кеңістік ажыратымдылығы ≈40 км. Бұл жер бетіндегі станса ӨЛШЕМІ ЕМЕС.</li>
  <li>Таралу конусы — Pasquill (1961) орнықтылық класы мен Briggs (1973) коэффициенттері бойынша есептелген ықтимал сектор.</li>
  <li>Шығарынды қарқыны белгісіз болғандықтан концентрация САЛЫСТЫРМАЛЫ; абсолют µg/m³ тек қала нүктесінің модель мәні ретінде беріледі.</li>
  <li>Жер бедері мен ғимараттар ескерілмейді (ашық дала жуықтауы).</li>
  ${d.mode === "archive" ? "<li>Архив режимінде жердегі стансалар (WAQI) қосылмайды — ол дереккөзде тарих сақталмайды.</li>" : ""}
</ul>

<h2>7. Қорытынды</h2>
${
  sum.kzViolationHours > 0
    ? `<p>Талданған кезеңде <b>${sum.kzViolationHours} сағат</b> бойы модель мәні
       Қазақстан Республикасының расталған гигиеналық нормативінен жоғары болды.
       Осы сағаттарда жел ${esc(d.wind.fromLabel)} бағытынан соқты.</p>`
    : sum.exceededHours > 0
      ? `<p>Талданған кезеңде <b>${sum.exceededHours} сағат</b> бойы модель мәні
         норматив шегінен жоғары болды. Шектердің бір бөлігі бастапқы актімен
         әлі салыстырылмағандықтан, заңдық тұжырым ЖАСАЛМАЙДЫ.</p>`
      : `<p>Талданған кезеңде нормативтен асу тіркелмеген.</p>`
}
<p><b>Ұсыныс:</b> ${
    sum.exceededHours > 0
      ? `жоғарыда көрсетілген уақыт аралығында аккредиттелген зертхананың
         аспаптық өлшеуін жүргізу және жел бағытында орналасқан кәсіпорындардың
         сол сағаттардағы шығарынды журналдарын салыстыру мәселесін қарау.`
      : `осы кезең бойынша тексеру жүргізуге негіз анықталмады.`
  }</p>

<h2>Дереккөздер</h2>
<ol class="small">
  ${(d.sources ?? []).map((s) => `<li>${esc(s)}</li>`).join("")}
  ${actList
    .map((id) => {
      const a = ACTS[id];
      return a
        ? `<li>${esc(a.number)} — ${esc(a.title)} (${esc(a.authority)}, ${esc(a.date)})${a.url ? ` — <a href="${esc(a.url)}">${esc(a.url)}</a>` : ""}</li>`
        : "";
    })
    .join("")}
</ol>

<div class="sign">
  <div>Анықтаманы жасаған жүйе: <b>Jaiyq</b><br><span class="small">ecojaiyq.com</span></div>
  <div>Қабылдаған: _______________________<br><span class="small">(лауазымы, аты-жөні, қолы, күні)</span></div>
</div>

</body></html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
