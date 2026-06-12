import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { satelliteImageUrl, historicalImageUrl } from "@/lib/mapbox";
import { scoreToLevel } from "@/lib/risk";
import type { AnalysisResult } from "@/types/site";

const reqSchema = z.object({
  mode: z.enum(["satellite", "photo", "combined"]),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  photo: z.string().optional(), // base64 data URL for photo/combined modes
  imageryYear: z.number().int().min(2016).max(2025).nullable().optional(), // Sentinel-2 year
});

const evidenceSchema = z.object({
  sign: z.string(),
  evidence: z.string(),
  confidence: z.number().min(0).max(100),
  prediction: z.string(),
});

const scienceSchema = z.object({
  ndvi: z.number().min(0).max(1),
  ndbi: z.number().min(0).max(1),
  ndwi: z.number().min(0).max(1),
  areaM2: z.number(),
  changeDynamics: z.string(),
  nearbyInfrastructure: z.array(z.string()),
  textureNote: z.string(),
  evidence: z.array(evidenceSchema),
});

const resultSchema = z.object({
  science: scienceSchema.optional(),
  riskScore: z.number().min(0).max(100),
  confidence: z.number().min(0).max(100),
  oilPollution: z.boolean(),
  illegalDumping: z.boolean(),
  landDegradation: z.boolean(),
  standingWater: z.boolean(),
  detectedFeatures: z.array(z.string()),
  recommendation: z.string(),
  summary: z.string(),
  verificationStatus: z.enum(["confirmed", "unconfirmed", "contradicted"]).optional(),
  verificationNotes: z.string().optional(),
});

const SYSTEM_PROMPT = `Сен Қазақстанның Атырау облысын бақылайтын экологиялық AI мониторинг жүйесісің.
Бұл — мұнай өндіруші аймақ: Каспий теңізі жағалауы, Жайық (Орал) өзені, Теңіз кен орны, мұнай өңдеу зауыттары.
Суреттерден мынаны іздейсің: мұнай ластануы (қара/қоңыр дақтар, су түсінің өзгеруі), заңсыз қоқыс
(объекттер кластері, жол іздері), жер деградациясы (өсімдік жоғалуы, тұздану), тұрған су (маса көбею ошағы).
Жауапты ТЕК валидті JSON түрінде қайтар, басқа мәтінсіз. Барлық мәтін өрістері қазақ тілінде болсын.

Сен сондай-ақ ҒЫЛЫМИ САРАПТАМА жасайсың (RGB суреттен прокси-бағалау):
- NDVI прокси (0-1): өсімдік жамылғысының тығыздығы — жасыл түс үлесі мен текстурасынан
- NDBI прокси (0-1): техногендік беттер — құрылыс, қоқыс, тегіс шағылысатын аймақтар
- NDWI прокси (0-1): су айдындары — көк/қара тегіс беттер
- Ластанған аумақ көлемі (м²): сурет ~600м×600м (zoom 15) екенін ескере отырып бағала
- Текстуралық талдау: қоқыс үйінділері хаотикалық пішінді, ландшафттан түсі өзгеше; мұнай дақтары ерекше шағылысуға ие
- Жақын инфрақұрылым: суретте көрінетін жолдар, ғимараттар, зауыттар, елді мекендер
- Әр анықталған белгіге СЕБЕП-САЛДАР тізбегі: Белгі → Дәлел (нақты визуалды дәлел + индекс мәні) → Болжам (шара қолданылмаса не болады, % және мерзіммен)`;

function userPrompt(mode: string): string {
  const science = `"science":{"ndvi":0-1,"ndbi":0-1,"ndwi":0-1,"areaM2":number,"changeDynamics":"өткен кезеңмен салыстырғандағы болжалды динамика","nearbyInfrastructure":["..."],"textureNote":"...","evidence":[{"sign":"...","evidence":"...","confidence":0-100,"prediction":"..."}]}`;
  const schema = `{"riskScore":0-100,"confidence":0-100,"oilPollution":bool,"illegalDumping":bool,"landDegradation":bool,"standingWater":bool,"detectedFeatures":["..."],"recommendation":"...","summary":"...",${science}}`;
  if (mode === "satellite")
    return `Осы спутник суретін экологиялық тәуекелге талда. JSON: ${schema}`;
  if (mode === "photo")
    return `Азамат түсірген жер деңгейіндегі осы фотоны талда: қоқыс түрі, көлемі, қауіптілігі. JSON: ${schema}`;
  return `1-сурет — азаматтың жердегі фотосы, 2-сурет — сол координаттың спутник көрінісі. Спутник көрінісі жердегі дәлелді растай ма? JSON: ${schema} + "verificationStatus":"confirmed|unconfirmed|contradicted","verificationNotes":"..."`;
}

// Deterministic fallback when no API key — keyed off coordinates so the demo
// stays consistent: oil zones near Tengiz/refinery score high, river zones
// get standing water, etc.
function mockAnalysis(lat: number, lng: number, mode: string): AnalysisResult {
  const nearTengiz = Math.abs(lat - 46.2) < 0.4 && Math.abs(lng - 53.3) < 0.5;
  const nearRefinery = Math.abs(lat - 47.1) < 0.06 && Math.abs(lng - 51.96) < 0.06;
  const nearRiver = Math.abs(lng - 51.9) < 0.15 && lat > 46.9 && lat < 47.8;
  const seedNoise = Math.abs(Math.sin(lat * 7919 + lng * 104729));
  let score: number;
  if (nearTengiz || nearRefinery) score = 75 + Math.round(seedNoise * 20);
  else if (nearRiver) score = 40 + Math.round(seedNoise * 30);
  else score = 15 + Math.round(seedNoise * 45);
  const oil = nearTengiz || nearRefinery;
  const water = nearRiver || seedNoise > 0.7;
  const ndvi = Math.max(0.05, 0.6 - score / 200);
  const evidence = [
    ...(oil
      ? [{
          sign: "Мұнай ластануы",
          evidence: `Беткейде аномальды шағылысу аймақтары; NDBI прокси ${(0.3 + seedNoise * 0.3).toFixed(2)}`,
          confidence: 70 + Math.round(seedNoise * 20),
          prediction: "Шара қолданылмаса, дақ 2-3 ай ішінде ~20%-ға кеңеюі мүмкін.",
        }]
      : []),
    ...(score > 55
      ? [{
          sign: "Жер деградациясы",
          evidence: `NDVI прокси-индексі ${ndvi.toFixed(2)} — өсімдік жамылғысы айтарлықтай әлсіреген`,
          confidence: 65 + Math.round(seedNoise * 20),
          prediction: "Келесі маусымда топырақ эрозиясы ~15%-ға артуы ықтимал.",
        }]
      : []),
    ...(water
      ? [{
          sign: "Тұрған су (маса ошағы)",
          evidence: `NDWI прокси ${(0.4 + seedNoise * 0.3).toFixed(2)} — тегіс су беттері анықталды`,
          confidence: 75,
          prediction: "Мамыр-шілде аралығында маса белсенділігі пик деңгейге жетеді.",
        }]
      : []),
  ];
  return {
    science: {
      ndvi: +ndvi.toFixed(2),
      ndbi: +(oil || score > 50 ? 0.35 + seedNoise * 0.3 : 0.1 + seedNoise * 0.15).toFixed(2),
      ndwi: +(water ? 0.45 + seedNoise * 0.3 : 0.08 + seedNoise * 0.1).toFixed(2),
      areaM2: Math.round((2000 + seedNoise * 38000) / 100) * 100,
      changeDynamics:
        score > 55
          ? "Өткен айдағы бағалаумен салыстырғанда ластану аумағы ~8-12%-ға ұлғайған (болжалды)"
          : "Өткен кезеңмен салыстырғанда айтарлықтай өзгеріс байқалмайды",
      nearbyInfrastructure: [
        ...(nearRefinery ? ["Мұнай өңдеу зауыты (~1 км)"] : []),
        ...(nearRiver ? ["Жайық өзені (<2 км)", "Тұрғын аудандар (~3 км)"] : []),
        ...(nearTengiz ? ["Кен орны инфрақұрылымы (~2 км)", "Технологиялық жолдар"] : []),
        ...(!nearRefinery && !nearRiver && !nearTengiz ? ["Далалық жолдар"] : []),
      ],
      textureNote:
        score > 55
          ? "Хаотикалық пішінді, ландшафттан түсі өзгеше аймақтар — техногендік әсердің белгісі"
          : "Текстура біркелкі, табиғи ландшафтқа сәйкес",
      evidence,
    },
    riskScore: score,
    confidence: 60 + Math.round(seedNoise * 25),
    riskLevel: scoreToLevel(score),
    oilPollution: oil,
    illegalDumping: !oil && score > 40,
    landDegradation: score > 55,
    standingWater: water,
    detectedFeatures: [
      ...(oil ? ["Мұнай дақтарына ұқсас қара аймақтар", "Топырақ түсінің өзгеруі"] : []),
      ...(!oil && score > 40 ? ["Кездейсоқ объекттер кластері", "Кіреберіс жол іздері"] : []),
      ...(water ? ["Тұрған су айдындары"] : []),
      ...(score <= 40 && !water ? ["Айтарлықтай ауытқу байқалмады"] : []),
    ],
    recommendation:
      score >= 55
        ? "Жедел далалық тексеру ұсынылады. Жергілікті экология департаментіне хабарлау қажет."
        : "Кезекті мониторинг аясында бақылауда ұстау жеткілікті.",
    summary:
      score >= 55
        ? "Аумақта экологиялық бұзылу белгілері анықталды — назар аудару қажет."
        : "Аумақ салыстырмалы түрде таза, елеулі бұзылулар байқалмады.",
    ...(mode === "combined"
      ? { verificationStatus: (score >= 50 ? "confirmed" : "unconfirmed") as "confirmed" | "unconfirmed", verificationNotes: "Демо режимі: спутник деректері шартты түрде салыстырылды." }
      : {}),
  };
}

export async function POST(req: Request) {
  const parsed = reqSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Жарамсыз сұраныс" }, { status: 400 });
  }
  const { mode, lat, lng, photo, imageryYear } = parsed.data;
  const imageUrl = imageryYear
    ? historicalImageUrl(lat, lng, imageryYear)
    : satelliteImageUrl(lat, lng);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ analysis: mockAnalysis(lat, lng, mode), imageUrl, mock: true });
  }

  try {
    const openai = new OpenAI({ apiKey });
    const images: { type: "image_url"; image_url: { url: string } }[] = [];
    if (mode === "photo" || mode === "combined") {
      if (!photo) return NextResponse.json({ error: "Фото жоқ" }, { status: 400 });
      images.push({ type: "image_url", image_url: { url: photo } });
    }
    if (mode === "satellite" || mode === "combined") {
      images.push({ type: "image_url", image_url: { url: imageUrl } });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1800,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                (imageryYear
                  ? `НАЗАР АУДАР: спутник суреті ${imageryYear} жылғы Sentinel-2 мозаикасы — талдау сол жылғы жағдайды сипаттайды. `
                  : "") + userPrompt(mode),
            },
            ...images,
          ],
        },
      ],
    });

    const raw = JSON.parse(completion.choices[0].message.content ?? "{}");
    const result = resultSchema.parse(raw);
    const analysis: AnalysisResult = { ...result, riskLevel: scoreToLevel(result.riskScore) };
    return NextResponse.json({ analysis, imageUrl, mock: false });
  } catch (err) {
    console.error("Analyze error:", err);
    // Graceful degradation: fall back to mock so the demo never hard-fails
    return NextResponse.json({ analysis: mockAnalysis(lat, lng, mode), imageUrl, mock: true });
  }
}
