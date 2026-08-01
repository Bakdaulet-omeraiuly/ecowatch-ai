import { NextResponse } from "next/server";
import { allow } from "@/lib/ratelimit";
import OpenAI from "openai";
import { z } from "zod";
import { FORECAST_SYSTEM } from "@/lib/prompts";

const reqSchema = z.object({
  district: z.string().optional(),
  history: z.array(z.object({ month: z.string(), score: z.number() })).optional(),
});

const forecastSchema = z.object({
  trend: z.enum(["improving", "stable", "degrading"]),
  projectedScores: z.array(z.object({ month: z.string(), score: z.number() })),
  drivers: z.array(z.string()),
  outlook: z.string(),
});

export async function POST(req: Request) {
  if (!(await allow(req))) {
    return NextResponse.json({ error: "Тым көп сұраныс. Сәл кейін қайталаңыз." }, { status: 429 });
  }
  const parsed = reqSchema.safeParse(await req.json().catch(() => ({})));
  // No fabricated history: forecast only runs on real analysis data sent by the client
  if (!parsed.success || !parsed.data.history || parsed.data.history.length < 2) {
    return NextResponse.json(
      { error: "Болжам үшін кемінде 2 нақты талдау нүктесі қажет" },
      { status: 400 }
    );
  }
  const history = parsed.data.history;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return (
    NextResponse.json(
      {
        error: "AI болжамы қолжетімсіз — кілт бапталмаған",
        detail:
          "Ойдан болжам жасалмайды. Ауа сапасының 11 күндік сандық болжамы " +
          "JAIYQ-ML модулінде бөлек беріледі (/api/ml-forecast).",
      },
      { status: 503 }
    )
    );
  }

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 600,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: FORECAST_SYSTEM,
        },
        {
          role: "user",
          content: `Айлық орташа тәуекел тарихы: ${JSON.stringify(history)}. Келесі 6 айға болжам жаса. JSON: {"trend":"improving|stable|degrading","projectedScores":[{"month":"YYYY-MM","score":0-100}],"drivers":["..."],"outlook":"..."}`,
        },
      ],
    });
    const fp = forecastSchema.safeParse(JSON.parse(completion.choices[0].message.content ?? "{}"));
    if (!fp.success) {
      console.error("Forecast schema:", fp.error.message);
      return (
    NextResponse.json(
      {
        error: "AI жауабы күтілген пішінде емес — болжам көрсетілмейді",
        detail:
          "Ойдан болжам жасалмайды. Ауа сапасының 11 күндік сандық болжамы " +
          "JAIYQ-ML модулінде бөлек беріледі (/api/ml-forecast).",
      },
      { status: 502 }
    )
      );
    }
    const forecast = fp.data;
    return NextResponse.json({ forecast, mock: false });
  } catch (err) {
    console.error("Forecast error:", err);
    // ЖАЛҒАН ДЕРЕККЕ ШЕГІНУ ЖОҚ — бұрын мұнда сызықтық экстраполяция
    // «AI болжамы» болып қайтарылатын.
    return (
    NextResponse.json(
      {
        error: "AI болжамы уақытша қолжетімсіз",
        detail:
          "Ойдан болжам жасалмайды. Ауа сапасының 11 күндік сандық болжамы " +
          "JAIYQ-ML модулінде бөлек беріледі (/api/ml-forecast).",
      },
      { status: 503 }
    )
    );
  }
}
