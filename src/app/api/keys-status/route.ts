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
      what: "Sentinel-1 SAR (су басу), Sentinel-2 (NDVI)",
      required: "қосымша",
      where: "dataspace.copernicus.eu → OAuth clients",
    },
    {
      env: "NEXT_PUBLIC_SENTINELHUB_S5P_INSTANCE_ID",
      set: has("NEXT_PUBLIC_SENTINELHUB_S5P_INSTANCE_ID"),
      what: "Sentinel-5P/TROPOMI қабаттары (NO₂, SO₂, CH₄, CO)",
      required: "қосымша",
      where: "Sentinel Hub → Configuration Utility",
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
