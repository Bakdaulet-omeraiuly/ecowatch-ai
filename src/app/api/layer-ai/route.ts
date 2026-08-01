import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { allow } from "@/lib/ratelimit";
import { LAYER_BY_KEY, type EcoLayer } from "@/data/ecoLayers";
import { LEGAL_DISCLAIMER } from "@/data/legalNorms";

// ЭКО ҚАБАТТЫҢ AI ТАЛДАУЫ — БӨЛЕК эндпоинт, БӨЛЕК батырма.
//
// Неге бөлек: қабаттың өз деректері (/api/layer/[key]) таза өлшем болуы
// керек. AI араласса, пайдаланушы қайсысы өлшем, қайсысы болжам екенін
// ажырата алмай қалады. Прокуратура үшін бұл жарамсыз.
//
// AI-ға берілетіні — ТЕК осы жүйедегі нақты сандар. Ол жаңа дерек
// ойлап таппауы керек, тек бар санды түсіндіруі, үрдісті сипаттауы және
// ПРАКТИКАЛЫҚ ұсыныс беруі керек.
//
// Кілт жоқ/шақыру сәтсіз → 503. Ойдан талдау ЖАСАЛМАЙДЫ.

export const dynamic = "force-dynamic";

const reqSchema = z.object({
  key: z.string().min(2).max(20),
  lang: z.enum(["kk", "ru", "en"]).optional(),
});

const outSchema = z.object({
  situation: z.string(),
  drivers: z.array(z.object({ factor: z.string(), evidence: z.string() })).min(1).max(5),
  trend24h: z.string(),
  forecast24h: z.string(),
  recommendations: z
    .array(
      z.object({
        priority: z.enum(["жоғары", "орташа", "төмен"]),
        audience: z.string(),
        action: z.string(),
        basis: z.string(),
      })
    )
    .min(2)
    .max(5),
  uncertainty: z.string(),
});

const SYSTEM = `Сен — Атырау облысының экологиялық мониторинг жүйесінің талдаушысысың.

ҚАТАҢ ЕРЕЖЕЛЕР:
1. Саған берілген сандардан БАСҚА ешқандай дерек қолданба. Жаңа сан ойлап тапба.
2. Әр тұжырымда нақты санды дәйексөз ретінде келтір (мысалы: "PM₂.₅ 42 µg/m³").
3. Ұсыныстар ӘРТҮРЛІ болсын — бірін-бірі қайталамасын, әрқайсысы басқа
   әрекетті және басқа адресатты нұсқасын (тұрғын / кәсіпорын / әкімдік /
   эколог / жедел қызмет).
4. Ұсыныс НАҚТЫ болсын: "мониторингті күшейту" деген жалпы сөз емес, "қай
   жерде, не істеу, қашан" деген нақты әрекет.
5. Заңнамалық норма асқаны айтылса — оның ЗАҢДЫҚ ФАКТ ЕМЕС, тексеруге негіз
   екенін ескерт.
6. Белгісіздікті ашық жаз: модель мен өлшемнің айырмасын, шектеулерін.
7. Жауап тек қазақ тілінде (басқа тіл сұралмаса).

Жауапты JSON түрінде бер.`;

export async function POST(req: Request) {
  if (!(await allow(req, "layer-ai"))) {
    return NextResponse.json({ error: "Тым көп сұраныс. Сәл кейін қайталаңыз." }, { status: 429 });
  }

  const parsed = reqSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Жарамсыз сұраныс" }, { status: 400 });
  }
  const layer = LAYER_BY_KEY.get(parsed.data.key as EcoLayer["key"]);
  if (!layer) {
    return NextResponse.json({ error: "Белгісіз қабат" }, { status: 404 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "AI талдауы қолжетімсіз — кілт бапталмаған",
        detail:
          "Ойдан талдау жасалмайды. Қабаттың нақты деректері «Нақты деректер» " +
          "қойындысында AI-сыз да толық қолжетімді.",
      },
      { status: 503 }
    );
  }

  // Қабаттың нақты деректерін өз жүйемізден аламыз — AI-ға тек солар беріледі
  const origin = new URL(req.url).origin;
  let layerData: Record<string, unknown> | null = null;
  try {
    const r = await fetch(`${origin}/api/layer/${layer.key}`, { cache: "no-store" });
    if (r.ok) layerData = await r.json();
  } catch {
    /* төменде тексеріледі */
  }
  if (!layerData) {
    return NextResponse.json(
      {
        error: "Қабат деректері қолжетімсіз — талдау жүргізілмеді",
        detail: "AI тек нақты деректер негізінде жұмыс істейді. Дерек жоқ болса талдау да жоқ.",
      },
      { status: 503 }
    );
  }

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1600,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content:
            `ҚАБАТ: ${layer.name} (${layer.emoji})\n` +
            `СИПАТТАМАСЫ: ${layer.what}\n` +
            `ТАЛДАУ КОНТЕКСТІ: ${layer.aiContext}\n` +
            `ДЕРЕККӨЗДЕР: ${layer.sources.join(", ")}\n\n` +
            `ЖҮЙЕДЕГІ НАҚТЫ ДЕРЕКТЕР (JSON):\n${JSON.stringify(layerData).slice(0, 14000)}\n\n` +
            `Осы деректер негізінде талда. JSON пішімі:\n` +
            `{"situation":"қазіргі жағдай, сандармен",` +
            `"drivers":[{"factor":"фактор аты","evidence":"нақты сан"}],` +
            `"trend24h":"өткен 24 сағаттағы өзгеріс, сандармен",` +
            `"forecast24h":"алдағы 24 сағат — ресми болжам деректері бойынша",` +
            `"recommendations":[{"priority":"жоғары|орташа|төмен","audience":"кімге","action":"нақты әрекет","basis":"қандай санға негізделген"}],` +
            `"uncertainty":"белгісіздік пен шектеулер"}`,
        },
      ],
    });

    const raw = JSON.parse(completion.choices[0].message.content ?? "{}");
    const out = outSchema.safeParse(raw);
    if (!out.success) {
      console.error("layer-ai schema:", out.error.message);
      return NextResponse.json(
        {
          error: "AI жауабы күтілген пішінде емес — нәтиже көрсетілмейді",
          detail: "Жарамсыз жауапты талдау ретінде ұсынбаймыз.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      layer: layer.key,
      generatedAt: new Date().toISOString(),
      model: "gpt-4o",
      analysis: out.data,
      // UI-де әрқашан көрсетіледі
      tier: "ai",
      disclaimer:
        "Бұл — тіл моделінің талдауы, валидацияланбаған. Жоғарыдағы сандар нақты, " +
        "ал олардың ТҮСІНДІРМЕСІ мен ұсыныстары AI-дың бағалауы. " +
        LEGAL_DISCLAIMER,
      basedOn: {
        endpoint: `/api/layer/${layer.key}`,
        fetchedAt: (layerData as { fetchedAt?: string }).fetchedAt ?? null,
      },
    });
  } catch (err) {
    console.error("layer-ai error:", err);
    return NextResponse.json(
      {
        error: "AI талдауы уақытша қолжетімсіз",
        detail: "Ойдан талдау жасалмайды. Нақты деректер «Нақты деректер» қойындысында.",
      },
      { status: 503 }
    );
  }
}
