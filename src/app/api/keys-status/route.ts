import { NextResponse } from "next/server";

// ДЕРЕККӨЗ КІЛТТЕРІНІҢ КҮЙІ — «бар/жоқ» ғана.
//
// ═══ НЕГЕ КЕРЕК ═══
// Қосымша дереккөздер (жердегі стансалар, спутник, AI) бөлек кілттерге
// сүйенеді. Кілт қосылмаса, тиісті модуль үнсіз өшіп тұрады да, себебі
// белгісіз болып қалады — соны іздеу көп уақыт алады.
//
// Бұл эндпоинт әр кілттің БАР-ЖОҒЫН, не үшін керегін және қайдан
// алынатынын көрсетеді.
//
// ═══ ⚠️ ҚАУІПСІЗДІК ═══
// Кілттің МӘНІ ешқашан қайтарылмайды — тек `true/false`. Ұзындығы да,
// бас әріптері де берілмейді. Бұл — баптау күйі, құпия емес.

export const dynamic = "force-dynamic";

interface KeyInfo {
  env: string;
  set: boolean;
  what: string;
  required: "міндетті" | "қосымша";
  where: string;
}

export async function GET() {
  const has = (n: string) => Boolean(process.env[n]);

  const keys: KeyInfo[] = [
    {
      env: "NEXT_PUBLIC_MAPBOX_TOKEN",
      set: has("NEXT_PUBLIC_MAPBOX_TOKEN"),
      what: "Карта фоны мен спутник суреттері",
      required: "міндетті",
      where: "mapbox.com → Account → Access tokens",
    },
    {
      env: "OPENAI_API_KEY",
      set: has("OPENAI_API_KEY"),
      what: "AI талдау, AI агент, қабат талдауы",
      required: "қосымша",
      where: "platform.openai.com/api-keys",
    },
    {
      env: "NEXT_PUBLIC_SUPABASE_URL",
      set: has("NEXT_PUBLIC_SUPABASE_URL"),
      what: "Дерекқор байланысы",
      required: "қосымша",
      where: "Supabase → Settings → API",
    },
    {
      env: "SUPABASE_SERVICE_ROLE_KEY",
      set:
        has("SUPABASE_SERVICE_ROLE_KEY") ||
        has("SUPABASE_SECRET_KEY") ||
        has("SUPABASE_SERVICE_KEY"),
      what: "Норма асуын журналға жазу (/api/fixate)",
      required: "қосымша",
      where: "Supabase → Settings → API keys → Secret keys",
    },
    {
      env: "OPENAQ_API_KEY",
      set: has("OPENAQ_API_KEY"),
      what: "⭐ Жердегі стансалардың НАҚТЫ өлшемі (/api/ground-stations)",
      required: "қосымша",
      where: "explore.openaq.org → тіркелу → Account → API key",
    },
    {
      env: "WAQI_TOKEN",
      set: has("WAQI_TOKEN"),
      what: "Жердегі стансалардың AQI мәні (ластану көзі картасында)",
      required: "қосымша",
      where: "aqicn.org/data-platform/token — email жеткілікті, бірден беріледі",
    },
    {
      env: "CDSE_CLIENT_ID",
      set: has("CDSE_CLIENT_ID") && has("CDSE_CLIENT_SECRET"),
      what:
        "⚠️ Copernicus OAuth. Осыған тәуелді: су басқан аумақ (S1 SAR), " +
        "қамыс мекені (S2 NDVI), мұнай дағын іздеу, ЖӘНЕ Sentinel-5P " +
        "атмосфера қабаттары (NO₂/SO₂/CH₄/CO — олар /api/s5p проксиі арқылы жүреді)",
      required: "қосымша",
      where: "dataspace.copernicus.eu → OAuth clients",
    },
    {
      env: "NEXT_PUBLIC_SENTINELHUB_INSTANCE_ID",
      set: has("NEXT_PUBLIC_SENTINELHUB_INSTANCE_ID"),
      what:
        "Sentinel-2 оптикалық қабаттары, 10 м: шынайы түс, жалған түс, NDVI, " +
        "NDMI, SWIR, геология, батиметрия. Болмаса — NASA GIBS/EOX резерві (өрескел)",
      required: "қосымша",
      where: "Sentinel Hub → Configuration Utility → Instance ID",
    },
    {
      env: "NEXT_PUBLIC_SENTINELHUB_S1_INSTANCE_ID",
      set: has("NEXT_PUBLIC_SENTINELHUB_S1_INSTANCE_ID"),
      what: "Sentinel-1 радар қабаттары (су/мұнай VV, өсімдік VH). Болмаса — қабат мүлдем көрсетілмейді",
      required: "қосымша",
      where: "Sentinel Hub → Configuration Utility → Instance ID",
    },
    {
      env: "FIRMS_MAP_KEY",
      set: has("FIRMS_MAP_KEY"),
      what: "NASA FIRMS — жылу аномалиялары мен газ факелдері (/api/flares)",
      required: "қосымша",
      where: "firms.modaps.eosdis.nasa.gov/api/map_key",
    },
    {
      env: "CRON_SECRET",
      set: has("CRON_SECRET"),
      what: "Cron эндпоинттерін қорғау",
      required: "қосымша",
      where: "Кез келген ұзын кездейсоқ жол",
    },
  ];

  const missing = keys.filter((k) => !k.set);

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    note:
      "Кілттің МӘНІ мұнда ешқашан көрсетілмейді — тек бар-жоғы. " +
      "⚠️ Кілт қосқаннан КЕЙІН Vercel-де REDEPLOY жасау керек: орта " +
      "айнымалылары бұрынғы деплойға кері қолданылмайды.",
    total: keys.length,
    configured: keys.length - missing.length,
    keys,
    missing: missing.map((k) => k.env),
  });
}
