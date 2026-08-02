import { NextResponse } from "next/server";
import { csvHeaders, toCsv, withProvenance, type Cell } from "@/lib/csv";
import { getRegion, hasModule, moduleUnavailable, type ModuleKey } from "@/data/regions";

// Эколог есебі үшін CSV экспорт.
//
// `?dataset=air|mosquito|fire|drought|flares`
//
// Әр файлдың соңында дереккөз, әдіс, сенімділік деңгейі және ескертулер
// тіркеледі — есеп өз бетінше түсінікті болуы үшін. Дерек көзі қолжетімсіз
// болса CSV жасалмайды: 503 қайтарылады, бос немесе жалған баған берілмейді.
//
// Су басқан аумақ бөлек: /api/flood-extent?format=csv
//
// `?region=<id>` — таңдалған аймақ. Ішкі эндпоинттерге де беріледі,
// сондықтан Алматыны таңдағанда Атыраудың саны түспейді.

export const dynamic = "force-dynamic";

const DATASETS = ["air", "mosquito", "fire", "drought", "flares"] as const;
type Dataset = (typeof DATASETS)[number];

async function get(origin: string, path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${origin}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

const num = (v: unknown): Cell => (typeof v === "number" ? v : v == null ? "" : String(v));

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ds = url.searchParams.get("dataset") as Dataset | null;
  if (!ds || !DATASETS.includes(ds)) {
    return NextResponse.json(
      { error: `dataset көрсетіңіз: ${DATASETS.join(" | ")}` },
      { status: 400 }
    );
  }
  const origin = url.origin;
  const region = getRegion(url.searchParams.get("region"));

  // Аймақтық тізілім қажет ететін жиынтықтар — тізілімсіз қалада бос
  // немесе бөтен қаланың файлы жасалмайды
  const DATASET_MODULE: Partial<Record<Dataset, ModuleKey>> = { mosquito: "mosquito" };
  const needed = DATASET_MODULE[ds];
  if (needed && !hasModule(region, needed)) {
    return NextResponse.json(moduleUnavailable(region, needed), { status: 404 });
  }

  const rq = `?region=${region.id}`;
  const today = new Date().toISOString().slice(0, 10);

  try {
    let rows: Cell[][];
    let name: string;

    switch (ds) {
      case "air": {
        const d = await get(origin, `/api/airgrid${rq}`);
        const grid = (d.grid ?? []) as Record<string, unknown>[];
        rows = withProvenance(
          [
            ["Нүкте", "Ендік", "Бойлық", "EU AQI", "PM2.5", "PM10", "NO2", "SO2", "O3", "CO",
              "NH3", "CH4", "Шаң", "AOD", "UV"],
            ...grid.map((g) => [
              (g.name as string) ?? "тор нүктесі", num(g.lat), num(g.lng), num(g.aqi),
              num(g.pm2_5), num(g.pm10), num(g.no2), num(g.so2), num(g.ozone), num(g.co),
              num(g.nh3), num(g.ch4), num(g.dust), num(g.aod), num(g.uv),
            ]),
          ],
          {
            dataset: `Ауа сапасы — ${region.name} торы`,
            tier: "Модель",
            source: String(d.source ?? "Open-Meteo / Copernicus CAMS"),
            fetchedAt: String(d.fetchedAt ?? ""),
            method: "CAMS жаһандық атмосфералық реанализі/болжамы, сағат сайын жаңарады.",
            caveats: [
              "Бұл — модель шығысы, жер бетіндегі станция өлшемі емес.",
              "CAMS торының қадамы ~40 км — қала ішіндегі айырма толық көрінбейді.",
              "Жер бетіндегі станциямен салыстыру дашбордтағы «Дереккөздерді салыстыру» бөлімінде.",
            ],
          }
        );
        name = `jaiyq-aua-sapasy-${region.id}-${today}.csv`;
        break;
      }

      case "mosquito": {
        const d = await get(origin, `/api/mosquitogrid${rq}`);
        const grid = (d.grid ?? []) as Record<string, unknown>[];
        rows = withProvenance(
          [
            ["Нүкте", "Ендік", "Бойлық", "MRI индексі (0-100)", "Температура °C",
              "Ылғалдылық %", "Апталық жауын мм"],
            ...grid.map((g) => [
              (g.name as string) ?? "тор нүктесі", num(g.lat), num(g.lng), num(g.index),
              num(g.temperature), num(g.humidity), num(g.weekRainMm),
            ]),
          ],
          {
            dataset: `Маса тәуекел индексі (JAIYQ-MRI · FPEB) — ${region.name}`,
            tier: "Модель",
            source: String(d.source ?? "JAIYQ-MRI · Open-Meteo"),
            fetchedAt: String(d.fetchedAt ?? ""),
            method:
              "Mordecai 2017 термиялық қолайлылық қисығы + су режимі (flood-pulse egg-bank). " +
              "Екі түр ескеріледі: Aedes caspius (тасқын суы) және Culex modestus (тұрақты су).",
            caveats: [
              "Бұл — климаттық қолайлылық индексі, шынайы маса санының өлшемі ЕМЕС.",
              "Тұзақ (trap) деректері жоқ болғандықтан модель валидацияланбаған.",
              "Индекс салыстыру үшін жарайды (қай жер қауіптірек), абсолют сан ретінде емес.",
            ],
          }
        );
        name = `jaiyq-masa-indeksi-${region.id}-${today}.csv`;
        break;
      }

      case "fire": {
        const d = await get(origin, `/api/fire${rq}`);
        rows = withProvenance(
          [
            ["Көрсеткіш", "Мән", "Түсіндірме"],
            ["FWI", num(d.fwi), "Fire Weather Index — жиынтық өрт қаупі"],
            ["ISI", num(d.isi), "Initial Spread Index — таралу жылдамдығы"],
            ["BUI", num(d.bui), "Buildup Index — жанғыш материал қоры"],
            ["FFMC", num(d.ffmc), "Fine Fuel Moisture Code — ұсақ отынның ылғалы"],
            ["DMC", num(d.dmc), "Duff Moisture Code — орта қабат ылғалы"],
            ["DC", num(d.dc), "Drought Code — терең қабат құрғақтығы"],
            ["Қауіп деңгейі", String(d.dangerLabel ?? d.danger ?? ""), ""],
            ["Есептеу тереңдігі (күн)", num(d.spinupDays), "Индекстер жинақталу кезеңі"],
          ],
          {
            dataset: `Өрт қаупі — Canadian FWI жүйесі — ${region.name}`,
            tier: "Модель",
            source: String(d.source ?? "Open-Meteo (ECMWF) метеорологиясы бойынша есептелген"),
            fetchedAt: new Date().toISOString(),
            method: "Van Wagner 1987 Canadian Forest Fire Weather Index System.",
            caveats: [
              "FWI — ауа райына негізделген ҚАУІП көрсеткіші, өрттің бар-жоғы емес.",
              "Нақты жанып жатқан нүктелер бөлек: dataset=flares (NASA VIIRS).",
            ],
          }
        );
        name = `jaiyq-ort-qaupi-${region.id}-${today}.csv`;
        break;
      }

      case "drought": {
        const d = await get(origin, `/api/drought${rq}`);
        rows = withProvenance(
          [
            ["Көрсеткіш", "Мән"],
            ["SPI (стандартталған жауын индексі)", num(d.spi)],
            ["Соңғы 3 айдағы жауын, мм", num(d.precip3m)],
            ["Кезең", String(d.period ?? "")],
            ["Бақылау жылдарының саны", num(d.yearsOfRecord)],
            ["Құрғақшылық сыныбы", String(d.droughtLabel ?? d.droughtClass ?? "")],
          ],
          {
            dataset: `Құрғақшылық — SPI-3 — ${region.name}`,
            tier: "Модель",
            source: "Open-Meteo ERA5 архиві (ECMWF)",
            fetchedAt: new Date().toISOString(),
            method:
              "McKee 1993 Standardized Precipitation Index. Соңғы 3 айдағы жауын көп " +
              "жылдық таралумен салыстырылады.",
            caveats: [
              "SPI тек жауынға негізделген — температура мен буланудың әсері ескерілмейді.",
              "Бақылау кезеңі неғұрлым ұзақ болса, индекс соғұрлым сенімді.",
            ],
          }
        );
        name = `jaiyq-qurgaqshylyq-${region.id}-${today}.csv`;
        break;
      }

      case "flares": {
        const d = await get(origin, `/api/flares${rq}`);
        const flares = (d.flares ?? []) as Record<string, unknown>[];
        rows = withProvenance(
          [
            ["Ендік", "Бойлық", "Жарықтық K", "FRP MW", "Сенімділік", "Түсірілім күні", "Күн/Түн"],
            ...flares.map((f) => [
              num(f.lat), num(f.lng), num(f.brightness), num(f.frp),
              String(f.confidence ?? ""), String(f.acqDate ?? ""), String(f.dayNight ?? ""),
            ]),
          ],
          {
            dataset: `Жылу аномалиялары (газ факелдері / өрт) — ${region.name}`,
            tier: "Өлшем",
            source: "NASA FIRMS · VIIRS SNPP NRT",
            fetchedAt: new Date().toISOString(),
            method: "Спутниктің инфрақызыл арнасындағы жылу аномалиясының тікелей детекциясы.",
            caveats: [
              "VIIRS газ факелін дала өртінен АЖЫРАТПАЙДЫ — екеуі де жылу аномалиясы.",
              "FRP (Fire Radiative Power) — жылу қуаты, ластану мөлшері емес.",
              "Соңғы 2 тәуліктегі өтулер ғана. Бұлт детекцияға кедергі келтіруі мүмкін.",
            ],
          }
        );
        name = `jaiyq-zhylu-anomaliyalary-${region.id}-${today}.csv`;
        break;
      }
    }

    return new NextResponse(toCsv(rows), { headers: csvHeaders(name) });
  } catch (err) {
    console.error("export error:", err);
    return NextResponse.json(
      {
        error: "Дерек көзі уақытша қолжетімсіз — бос немесе жалған файл жасалмайды",
        dataset: ds,
      },
      { status: 503 }
    );
  }
}
