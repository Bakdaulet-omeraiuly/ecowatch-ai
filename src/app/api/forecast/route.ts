import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

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

function mockForecast(history: { month: string; score: number }[]) {
  const last = history[history.length - 1]?.score ?? 50;
  const slope =
    history.length > 1 ? (last - history[0].score) / (history.length - 1) : 1;
  const lastMonth = history[history.length - 1]?.month ?? "2026-06";
  const [y, m] = lastMonth.split("-").map(Number);
  const projectedScores = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(y, m - 1 + i + 1);
    return {
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      score: Math.round(Math.min(100, Math.max(0, last + slope * (i + 1)))),
    };
  });
  return {
    trend: slope > 1 ? ("degrading" as const) : slope < -1 ? ("improving" as const) : ("stable" as const),
    projectedScores,
    drivers: [
      "Мұнай өндіру белсенділігінің сақталуы",
      "Көктемгі тасқын маусымы (мамыр–шілде)",
      "Қоқыс шығару инфрақұрылымының жетіспеуі",
    ],
    outlook:
      "Ағымдағы тренд сақталса, алдағы 6 айда аймақтық тәуекел деңгейі біртіндеп өседі. Жоғары тәуекелді нүктелерде жедел шара қолдану таралуды баяулатады.",
  };
}

export async function POST(req: Request) {
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
  if (!apiKey) return NextResponse.json({ forecast: mockForecast(history), mock: true });

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 600,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Сен Атырау облысының экологиялық болжам жасайтын AI-сың. Аймақ контексті: мұнай өндіру, Каспий жағалауы, Жайық өзені, мамыр-шілде тасқыны. Тек JSON қайтар, мәтін өрістері қазақша.",
        },
        {
          role: "user",
          content: `Айлық орташа тәуекел тарихы: ${JSON.stringify(history)}. Келесі 6 айға болжам жаса. JSON: {"trend":"improving|stable|degrading","projectedScores":[{"month":"YYYY-MM","score":0-100}],"drivers":["..."],"outlook":"..."}`,
        },
      ],
    });
    const forecast = forecastSchema.parse(JSON.parse(completion.choices[0].message.content ?? "{}"));
    return NextResponse.json({ forecast, mock: false });
  } catch (err) {
    console.error("Forecast error:", err);
    return NextResponse.json({ forecast: mockForecast(history), mock: true });
  }
}
