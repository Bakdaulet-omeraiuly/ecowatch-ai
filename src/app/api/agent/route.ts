import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { satelliteImageUrl } from "@/lib/mapbox";
import { scoreToLevel } from "@/lib/risk";
import { mosquitoRiskIndex } from "@/lib/mosquito";
import type { AnalysisResult } from "@/types/site";

// AI Agent: a multi-source assessment. It does NOT rely on satellite imagery
// alone — it also pulls LIVE official data for the exact point (Copernicus CAMS
// air quality + Open-Meteo weather) and lets the model synthesise everything.

const reqSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

async function fetchLive(lat: number, lng: number) {
  const wUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&daily=precipitation_sum&past_days=7&forecast_days=1&timezone=auto`;
  const aUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,ozone,european_aqi`;
  try {
    const [w, a] = await Promise.all([
      fetch(wUrl, { cache: "no-store" }),
      fetch(aUrl, { cache: "no-store" }),
    ]);
    const wj = w.ok ? await w.json() : null;
    const aj = a.ok ? await a.json() : null;
    const weekRain = (wj?.daily?.precipitation_sum ?? []).reduce((s: number, x: number) => s + (x ?? 0), 0);
    return {
      temperature: wj?.current?.temperature_2m ?? null,
      humidity: wj?.current?.relative_humidity_2m ?? null,
      windSpeed: wj?.current?.wind_speed_10m ?? null,
      weekRainMm: +weekRain.toFixed(1),
      pm2_5: aj?.current?.pm2_5 ?? null,
      pm10: aj?.current?.pm10 ?? null,
      no2: aj?.current?.nitrogen_dioxide ?? null,
      so2: aj?.current?.sulphur_dioxide ?? null,
      ozone: aj?.current?.ozone ?? null,
      europeanAqi: aj?.current?.european_aqi ?? null,
    };
  } catch {
    return null;
  }
}

const resultSchema = z.object({
  riskScore: z.number().min(0).max(100),
  confidence: z.number().min(0).max(100),
  oilPollution: z.boolean(),
  illegalDumping: z.boolean(),
  landDegradation: z.boolean(),
  standingWater: z.boolean(),
  detectedFeatures: z.array(z.string()),
  recommendation: z.string(),
  summary: z.string(),
  agentSources: z.array(z.object({ source: z.string(), finding: z.string() })),
});

function liveText(live: Awaited<ReturnType<typeof fetchLive>>): string {
  if (!live) return "Тірі деректер қолжетімсіз.";
  return [
    `Ауа сапасы (Copernicus CAMS, нақты уақыт): EU AQI=${live.europeanAqi}, PM2.5=${live.pm2_5} µg/m³, PM10=${live.pm10}, NO₂=${live.no2}, SO₂=${live.so2}, O₃=${live.ozone}.`,
    `Ауа райы (Open-Meteo): температура ${live.temperature}°C, ылғал ${live.humidity}%, жел ${live.windSpeed} км/сағ, соңғы 7 күн жаңбыр ${live.weekRainMm} мм.`,
  ].join(" ");
}

function mockAgent(lat: number, lng: number, live: Awaited<ReturnType<typeof fetchLive>>): AnalysisResult {
  const aqi = live?.europeanAqi ?? 30;
  const no2 = live?.no2 ?? 5;
  const near = Math.abs(lat - 47.1) < 0.08 && Math.abs(lng - 51.96) < 0.08;
  const score = Math.min(100, Math.round((near ? 60 : 35) + aqi / 3 + no2 / 4));
  return {
    isAgent: true,
    riskScore: score,
    confidence: 68,
    riskLevel: scoreToLevel(score),
    oilPollution: near,
    illegalDumping: score > 45,
    landDegradation: score > 55,
    standingWater: (live?.weekRainMm ?? 0) > 5,
    detectedFeatures: [
      "Спутник суретіндегі визуалды белгілер",
      `Ауа сапасы AQI=${aqi}`,
      ...(no2 > 10 ? ["NO₂ деңгейі жоғары — өнеркәсіптік шығарынды белгісі"] : []),
    ],
    recommendation:
      score >= 55
        ? "Көп дереккөз жоғары тәуекелді растайды — далалық тексеру ұсынылады."
        : "Тәуекел орташа — мониторингте ұстау жеткілікті.",
    summary: "AI агент спутник суреті мен тірі ауа/климат деректерін біріктіріп бағалады.",
    agentSources: [
      { source: "Mapbox спутник суреті", finding: "Аумақтың визуалды жағдайы талданды." },
      { source: "Copernicus CAMS (ауа сапасы)", finding: `EU AQI=${aqi}, NO₂=${no2} µg/m³.` },
      { source: "Open-Meteo (ауа райы)", finding: `Жаңбыр ${live?.weekRainMm ?? 0}мм, ${live?.temperature ?? "?"}°C.` },
    ],
  };
}

export async function POST(req: Request) {
  const parsed = reqSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Жарамсыз сұраныс" }, { status: 400 });
  const { lat, lng } = parsed.data;
  const imageUrl = satelliteImageUrl(lat, lng);
  const live = await fetchLive(lat, lng);
  const mri = mosquitoRiskIndex(lat, lng, (live?.weekRainMm ?? 0) > 5);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ analysis: mockAgent(lat, lng, live), imageUrl, live, mri, mock: true });
  }

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1100,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Сен Атырау облысының көп дереккөзді экологиялық AI агентісің. Сен ТЕК спутник суретіне сүйенбейсің — қоса берілген тірі ресми деректерді (Copernicus CAMS ауа сапасы, Open-Meteo ауа райы) де есепке аласың. Әр дереккөзден нақты тұжырым жаса. Тек JSON, мәтін қазақша.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Координат: ${lat.toFixed(4)}, ${lng.toFixed(4)}. ТІРІ ДЕРЕКТЕР: ${liveText(live)}\n\nОсы тірі деректерді қоса берілген спутник суретімен біріктіріп, толық экологиялық бағалау жаса. JSON: {"riskScore":0-100,"confidence":0-100,"oilPollution":bool,"illegalDumping":bool,"landDegradation":bool,"standingWater":bool,"detectedFeatures":["..."],"recommendation":"...","summary":"...","agentSources":[{"source":"дереккөз аты","finding":"сол дереккөзден нақты тұжырым"}]}. agentSources-та кемінде 3 дереккөз болсын: спутник суреті, Copernicus CAMS, Open-Meteo.`,
            },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
    });
    const raw = JSON.parse(completion.choices[0].message.content ?? "{}");
    const result = resultSchema.parse(raw);
    const analysis: AnalysisResult = { ...result, riskLevel: scoreToLevel(result.riskScore), isAgent: true };
    return NextResponse.json({ analysis, imageUrl, live, mri, mock: false });
  } catch (err) {
    console.error("Agent error:", err);
    return NextResponse.json({ analysis: mockAgent(lat, lng, live), imageUrl, live, mri, mock: true });
  }
}
