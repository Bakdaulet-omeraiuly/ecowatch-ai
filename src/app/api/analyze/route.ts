import { NextResponse } from "next/server";
import { allow } from "@/lib/ratelimit";

import { z } from "zod";
import OpenAI from "openai";
import { satelliteImageUrl, historicalImageUrl } from "@/lib/mapbox";
import { scoreToLevel } from "@/lib/risk";
import { ANALYZE_SYSTEM, analyzeUserPrompt, langDirective } from "@/lib/prompts";
import type { AnalysisResult } from "@/types/site";

const reqSchema = z.object({
  mode: z.enum(["satellite", "photo", "combined"]),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  photo: z.string().optional(), // base64 data URL for photo/combined modes
  imageryYear: z.number().int().min(2000).max(2025).nullable().optional(), // imagery year
  zoom: z.number().min(8).max(17).optional(), // таңдалған аумаққа сай масштаб
  areaKm2: z.number().optional(), // сызылған аумақ ауданы (контекст үшін)
  lang: z.enum(["kk", "ru", "en"]).optional(), // жауап тілі
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

/** Mapbox static суретінің шамамен ені (м) — 1024 px, экватор бойынша,
 *  47° ендікте cos φ түзетуімен. Промптта масштабты түсіндіру үшін. */
function approxWidthM(zoom: number, px = 1024, lat = 47): number {
  const metersPerPx = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
  return Math.round((metersPerPx * px) / 10) * 10;
}

export async function POST(req: Request) {
  if (!(await allow(req))) {
    return NextResponse.json({ error: "Тым көп сұраныс. Сәл кейін қайталаңыз." }, { status: 429 });
  }
  const parsed = reqSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Жарамсыз сұраныс" }, { status: 400 });
  }
  const { mode, lat, lng, photo, imageryYear, zoom, areaKm2, lang } = parsed.data;
  const imageUrl = imageryYear
    ? historicalImageUrl(lat, lng, imageryYear)
    : satelliteImageUrl(lat, lng, zoom ?? 15);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "AI баяндамасы қолжетімсіз — кілт бапталмаған",
        detail:
          "Ойдан талдау жасалмайды. Нақты Sentinel-2 өлшемдері (NDVI/NDWI/NDMI/NDBI) " +
          "бөлек қолжетімді — /api/indices.",
        imageUrl,
      },
      { status: 503 }
    );
  }

  try {
    const openai = new OpenAI({ apiKey });
    const images: { type: "image_url"; image_url: { url: string; detail: "high" } }[] = [];
    // Суреттердің сипаттамасы — промптта дәйексөз ретінде қолданылады
    const shots: string[] = [];
    const addShot = (url: string, label: string) => {
      images.push({ type: "image_url", image_url: { url, detail: "high" } });
      shots.push(`${images.length}-сурет: ${label}`);
    };

    if (mode === "photo" || mode === "combined") {
      if (!photo) return NextResponse.json({ error: "Фото жоқ" }, { status: 400 });
      addShot(photo, "азаматтың жердегі фотосы");
    }

    if (mode === "satellite" || mode === "combined") {
      const baseZoom = zoom ?? 15;
      if (imageryYear) {
        // Тарихи режим: сол жылғы кадр + бүгінгі кадр → өзгерісті салыстыру
        addShot(imageUrl, `${imageryYear} ж. Sentinel-2 мозаикасы, шолу масштабы`);
        addShot(
          satelliteImageUrl(lat, lng, baseZoom),
          `бүгінгі көрініс, zoom ${baseZoom} (~${approxWidthM(baseZoom)} м)`
        );
      } else {
        // ЕКІ МАСШТАБ: кең — контекст үшін, тар — деталь үшін.
        // Бір суретпен талдау бұрын ең әлсіз жері еді: не контекст жоқ,
        // не деталь көрінбейтін.
        const wide = Math.max(11, baseZoom - 2);
        const tight = Math.min(18, baseZoom + 2);
        addShot(
          satelliteImageUrl(lat, lng, wide),
          `шолу, zoom ${wide} (~${approxWidthM(wide)} м) — инфрақұрылым мен ландшафт контексті`
        );
        addShot(
          satelliteImageUrl(lat, lng, tight),
          `деталь, zoom ${tight} (~${approxWidthM(tight)} м) — текстура мен шекара`
        );
        // Өткен жылмен салыстыру — өзгерісті көру үшін
        const prevYear = new Date().getFullYear() - 2;
        addShot(
          historicalImageUrl(lat, lng, prevYear),
          `${prevYear} ж. Sentinel-2 мозаикасы — өзгерісті салыстыру үшін`
        );
      }
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 2400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: ANALYZE_SYSTEM + langDirective(lang) },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                (imageryYear
                  ? `НАЗАР АУДАР: 1-сурет ${imageryYear} жылғы, 2-сурет бүгінгі. Екеуін салыстырып, ӨЗГЕРІСТІ анықта. `
                  : "") +
                (areaKm2
                  ? `Бұл — пайдаланушы картада сызған шамамен ${areaKm2.toFixed(2)} км² аумақ. Тек осы аумаққа қатысты талдау жаса. `
                  : "") +
                `КООРДИНАТА: ${lat.toFixed(5)}, ${lng.toFixed(5)}\n` +
                `БЕРІЛГЕН СУРЕТТЕР:\n${shots.map((x) => "· " + x).join("\n")}\n\n` +
                analyzeUserPrompt(mode),
            },
            ...images,
          ],
        },
      ],
    });

    const raw = JSON.parse(completion.choices[0].message.content ?? "{}");
    const parsedResult = resultSchema.safeParse(raw);
    if (!parsedResult.success) {
      console.error("Analyze schema mismatch:", parsedResult.error.message);
      return NextResponse.json(
        {
          error: "AI жауабы күтілген пішінде емес — нәтиже көрсетілмейді",
          detail: "Жарамсыз жауапты «талдау» ретінде ұсынбаймыз. Қайталап көріңіз.",
          imageUrl,
        },
        { status: 502 }
      );
    }
    const analysis: AnalysisResult = { ...parsedResult.data, riskLevel: scoreToLevel(parsedResult.data.riskScore) };
    return NextResponse.json({ analysis, imageUrl, mock: false });
  } catch (err) {
    console.error("Analyze error:", err);
    // ЖАЛҒАН ДЕРЕККЕ ШЕГІНУ ЖОҚ. Бұрын мұнда ойдан жасалған талдау
    // қайтарылатын («демо ешқашан құламасын» деп) — ол синустан шыққан
    // санды «NDVI» мен «сенімділік 78%» етіп көрсететін де, нақтысымен
    // бірге сақталатын. Жобаның басты қағидасы оған тыйым салады.
    return NextResponse.json(
      {
        error: "AI талдауы уақытша қолжетімсіз",
        detail:
          "Ойдан талдау жасалмайды. Осы нүктенің нақты спутник өлшемдерін " +
          "«ML индекстері» бөлімінен көруге болады (Sentinel-2).",
        imageUrl,
      },
      { status: 503 }
    );
  }
}
