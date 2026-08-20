import { NextResponse } from "next/server";
import { getRegion } from "@/data/regions";
import { haversineKm } from "@/lib/pollutionSource";

// ЖЕРДЕГІ СТАНСАЛАР — OpenAQ желісі арқылы НАҚТЫ ӨЛШЕМ.
//
// ═══ НЕГЕ БҰЛ ЕҢ МАҢЫЗДЫ ҚОСЫМША ═══
// Жүйедегі ауа деректерінің бәрі — 📊 МОДЕЛЬ (Copernicus CAMS, ~40 км тор).
// Модель — есептеу, өлшем емес. Ал заңдық тұрғыда мәні бар нәрсе —
// АСПАППЕН ӨЛШЕНГЕН мән.
//
// OpenAQ — мемлекеттік мониторинг желілерінің деректерін бір API-ға
// жинайтын ашық жоба. Егер Қазгидромет посттары сол желіде болса, жүйеде
// АЛҒАШ РЕТ 🛰 өлшем деңгейіндегі ауа дерегі пайда болады.
//
// ═══ ⭐ ЕКІНШІ, ОДАН ДА МАҢЫЗДЫ СЕБЕП ═══
// CAMS небәрі 5–8 затты береді. Жердегі станса ОДАН КӨП затты өлшей алады —
// соның ішінде Атырау үшін ең маңыздысы H₂S (күкіртсутек). Ол спутниктен
// де, модельден де МҮЛДЕМ анықталмайды.
//
// Сондықтан жауапта `beyondCams` өрісі бар: жердегі стансада өлшенетін,
// бірақ модельде ЖОҚ заттардың тізімі. Егер онда h2s шықса — жобаның ең
// үлкен олқылығы жабылады.
//
// ═══ ⚠️ ЖАЛҒАН ДЕРЕК ЖОҚ ═══
// Станса табылмаса — бұл ҚАТЕ ЕМЕС, ФАКТ: «бұл аймақта OpenAQ желісінде
// станса жоқ» деп ашық жазылады. Модель мәнін «станса өлшемі» деп беру
// мүлдем болмайды.
//
// ═══ КЕЛІСІМШАРТ ҚАЙДАН АЛЫНДЫ ═══
// API жауабының пішімі OpenAQ-тың ӨЗ БАСТАПҚЫ КОДЫНАН тексерілді
// (github.com/openaq/openaq-api-v2 → openaq_api/v3/models/responses.py),
// жорамалмен жазылмады. bbox реті: Min X, Min Y, Max X, Max Y (lon, lat) —
// бұл `regions.ts`-тегі `bbox` ретімен дәл сәйкес келеді.

export const revalidate = 900; // 15 мин

const API = "https://api.openaq.org/v3";

/** Бір жүгірісте нешеуінен соңғы мән сұралады (әрқайсысы жеке сұраныс) */
const MAX_LATEST = 6;

/** CAMS моделі беретін заттар — «модельде жоқ» тізімін есептеу үшін */
const CAMS_PARAMS = new Set([
  "pm25", "pm10", "no2", "so2", "o3", "co", "nh3", "ch4", "dust",
]);

interface OaqParameter { id: number; name: string; units: string; display_name?: string | null }
interface OaqSensor { id: number; name: string; parameter: OaqParameter }
interface OaqLocation {
  id: number;
  name: string | null;
  locality: string | null;
  country: { code: string; name: string };
  provider: { id: number; name: string };
  coordinates: { latitude: number | null; longitude: number | null };
  sensors: OaqSensor[];
  datetime_last?: { utc: string; local: string } | null;
}
interface OaqLatest {
  datetime: { utc: string; local: string };
  value: number;
  sensorsId?: number;
  coordinates?: { latitude: number | null; longitude: number | null };
}

function headers(): HeadersInit {
  const key = process.env.OPENAQ_API_KEY;
  return key ? { "X-API-Key": key, Accept: "application/json" } : { Accept: "application/json" };
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const region = getRegion(params.get("region"));

  // ЕКІ ІЗДЕУ АУҚЫМЫ:
  //   region  (әдепкі) — тек осы аймақтың шекарасы ішінде
  //   country          — БҮКІЛ ел бойынша (?scope=country)
  //
  // Екіншісі неге керек: аймақта станса табылмағанда «елде мүлдем жоқ па,
  // әлде басқа қалада бар ма?» деген сұрақ туады. Оны бір сұраныспен
  // шешу үшін OpenAQ-тың `iso` сүзгісі қолданылады (келісімшарт сол
  // репозиторийден расталды: v3/models/queries.py → CountryIsoQuery).
  const scope = params.get("scope") === "country" ? "country" : "region";

  const [minX, minY, maxX, maxY] = region.bbox;
  const bbox = [minX, minY, maxX, maxY].map((v) => v.toFixed(4)).join(",");
  const filter =
    scope === "country" ? `iso=${encodeURIComponent(region.country)}` : `bbox=${bbox}`;

  try {
    const locRes = await fetch(
      `${API}/locations?${filter}&limit=1000`,
      { headers: headers(), next: { revalidate: 900 } }
    );

    if (locRes.status === 401 || locRes.status === 403) {
      return NextResponse.json(
        {
          available: false,
          error: "OpenAQ кілті қажет — жердегі стансалар жүктелмеді",
          detail:
            "OpenAQ v3 API кілтсіз жұмыс істемейді. openaq.org сайтынан тегін кілт " +
            "алып, Vercel → Environment Variables ішіне OPENAQ_API_KEY деп қосыңыз. " +
            "Кілт жоқ болғандықтан модель мәні «станса өлшемі» ретінде БЕРІЛМЕЙДІ.",
          needsKey: true,
        },
        { status: 503 }
      );
    }
    if (!locRes.ok) throw new Error(`openaq locations ${locRes.status}`);

    const locJson = (await locRes.json()) as { results?: OaqLocation[] };
    const locations = (locJson.results ?? []).filter(
      (l) => l.coordinates?.latitude != null && l.coordinates?.longitude != null
    );

    // Станса ЖОҚ — бұл қате емес, факт. Ашық жазылады.
    if (!locations.length) {
      return NextResponse.json({
        available: true,
        region: { id: region.id, name: region.name },
        bbox: region.bbox,
        tier: "measurement",
        stationCount: 0,
        parameters: [],
        beyondCams: [],
        stations: [],
        scope,
        note:
          (scope === "country"
            ? `${region.countryName} бойынша OpenAQ желісінде тіркелген станса табылмады. `
            : `${region.name} аумағында OpenAQ желісінде тіркелген станса табылмады. `) +
          "Бұл «ауа таза» дегенді БІЛДІРМЕЙДІ — бұл жерде аспаптық өлшеу " +
          "жүргізілмейді (немесе оның деректері ашық желіге берілмейді) дегенді " +
          "білдіреді. Жүйедегі ауа сандары модель (CAMS) болып қалады.",
        hint:
          scope === "region"
            ? "Елде мүлдем бар-жоғын білу үшін: осы сілтемеге &scope=country қосыңыз."
            : undefined,
      });
    }

    // Соңғы мәндер — ең жаңа жаңартылған стансалардан бастаймыз
    // Аймақ ішінде — ең соңғы жаңарғаны бірінші.
    // Ел бойынша — ең ЖАҚЫНЫ бірінші (алыс станса пайдасыз).
    const ordered = [...locations].sort((a, b) =>
      scope === "country"
        ? haversineKm(region.lat, region.lng, a.coordinates.latitude!, a.coordinates.longitude!) -
          haversineKm(region.lat, region.lng, b.coordinates.latitude!, b.coordinates.longitude!)
        : (b.datetime_last?.utc ?? "").localeCompare(a.datetime_last?.utc ?? "")
    );
    const picked = ordered.slice(0, MAX_LATEST);

    const latests = await Promise.all(
      picked.map(async (l) => {
        try {
          const r = await fetch(`${API}/locations/${l.id}/latest?limit=100`, {
            headers: headers(),
            next: { revalidate: 900 },
          });
          if (!r.ok) return { id: l.id, results: [] as OaqLatest[] };
          const j = (await r.json()) as { results?: OaqLatest[] };
          return { id: l.id, results: j.results ?? [] };
        } catch {
          return { id: l.id, results: [] as OaqLatest[] };
        }
      })
    );
    const latestById = new Map(latests.map((x) => [x.id, x.results]));

    // Сенсор id → параметр (соңғы мәндерді атауымен байланыстыру үшін)
    const paramBySensor = new Map<number, OaqParameter>();
    for (const l of locations) for (const s of l.sensors ?? []) paramBySensor.set(s.id, s.parameter);

    const stations = picked.map((l) => {
      const vals = (latestById.get(l.id) ?? []).map((m) => {
        const p = m.sensorsId != null ? paramBySensor.get(m.sensorsId) : undefined;
        return {
          parameter: p?.name ?? null,
          label: p?.display_name ?? p?.name ?? null,
          value: m.value,
          unit: p?.units ?? null,
          atUtc: m.datetime?.utc ?? null,
        };
      });
      return {
        id: l.id,
        name: l.name,
        locality: l.locality,
        provider: l.provider?.name ?? null,
        country: l.country?.code ?? null,
        lat: l.coordinates.latitude!,
        lng: l.coordinates.longitude!,
        lastUtc: l.datetime_last?.utc ?? null,
        // Аймақ орталығынан қашықтығы — ел бойынша іздегенде маңызды:
        // 900 км жердегі станса Атыраудың ауасы туралы ештеңе айтпайды
        distanceKm: +haversineKm(region.lat, region.lng, l.coordinates.latitude!, l.coordinates.longitude!).toFixed(1),
        measures: (l.sensors ?? []).map((s) => s.parameter.name),
        values: vals.filter((v) => v.parameter),
      };
    });

    // Аймақта өлшенетін БАРЛЫҚ зат (тек таңдалған алтауы емес)
    const allParams = [
      ...new Set(locations.flatMap((l) => (l.sensors ?? []).map((s) => s.parameter.name))),
    ].sort();

    // ⭐ ЕҢ ҚҰНДЫ ӨРІС: жерде өлшенеді, бірақ модельде ЖОҚ
    const beyondCams = allParams.filter((p) => !CAMS_PARAMS.has(p));

    return NextResponse.json({
      available: true,
      region: { id: region.id, name: region.name },
      bbox: region.bbox,
      // 🛰 Бұл — МОДЕЛЬ ЕМЕС, аспаппен өлшенген мән
      tier: "measurement",
      source: "OpenAQ (мемлекеттік мониторинг желілерінің ашық агрегаторы)",
      sourceUrl: "https://openaq.org",
      scope,
      stationCount: locations.length,
      shown: picked.length,
      parameters: allParams,
      beyondCams,
      stations,
      note:
        `${region.name} аумағында ${locations.length} станса тіркелген` +
        (picked.length < locations.length
          ? `; соңғы мәндер ең жаңа ${picked.length} стансадан алынды` : "") +
        (beyondCams.length
          ? `. ⭐ Модельде ЖОҚ, тек жерде өлшенетін заттар: ${beyondCams.join(", ")}.`
          : ". Барлық өлшенетін зат модельде де бар."),
      caveat:
        "Станса мәні — НҮКТЕЛІК өлшем, қаланың орташасы емес. Дереккөз бен " +
        "калибрлеу жауапкершілігі стансаны иеленуші ұйымда. Заңдық тұжырым " +
        "үшін аккредиттелген зертхананың хаттамасы қажет.",
    });
  } catch (err) {
    console.error("ground-stations error:", err);
    return NextResponse.json(
      {
        available: false,
        error: "Жердегі стансалар деректері уақытша қолжетімсіз",
        detail:
          "OpenAQ жауап бермеді. Жалған дерек көрсетілмейді — модель мәні " +
          "«станса өлшемі» ретінде берілмейді.",
      },
      { status: 503 }
    );
  }
}
