import { NextResponse } from "next/server";
import { allow } from "@/lib/ratelimit";
import OpenAI from "openai";
import { z } from "zod";

// Дайын AI талдау мәтінін таңдалған тілге жедел аудару (тіл ауысқанда).
// Мағынаны сақтайды, реттілікті бұзбайды. GPT-4o-mini — жылдам, арзан.

const reqSchema = z.object({
  texts: z.array(z.string()).min(1).max(40),
  lang: z.enum(["kk", "ru", "en"]),
});

const LANGNAME = { kk: "Kazakh (қазақ)", ru: "Russian (русский)", en: "English" };

export async function POST(req: Request) {
  if (!(await allow(req))) {
    return NextResponse.json({ error: "Тым көп сұраныс" }, { status: 429 });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI кілті жоқ" }, { status: 503 });

  const parsed = reqSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Жарамсыз сұраныс" }, { status: 400 });
  const { texts, lang } = parsed.data;

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1500,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            `You are a precise translator for an Atyrau (Kazakhstan) environmental platform. ` +
            `Translate each string in the input array into ${LANGNAME[lang]}. ` +
            `Keep technical terms (NDVI, PM2.5, AQI, Sentinel-2), numbers and emoji intact. ` +
            `Preserve order and count exactly. Return JSON: {"texts":["...","..."]}.`,
        },
        { role: "user", content: JSON.stringify({ texts }) },
      ],
    });
    const raw = JSON.parse(completion.choices[0].message.content ?? "{}");
    const out = Array.isArray(raw.texts) ? raw.texts.map(String) : [];
    if (out.length !== texts.length) throw new Error("санақ сәйкес емес");
    return NextResponse.json({ texts: out });
  } catch (err) {
    console.error("Translate error:", err);
    return NextResponse.json({ error: "Аудару сәтсіз" }, { status: 502 });
  }
}
