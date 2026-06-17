import { NextResponse } from "next/server";
import { allow } from "@/lib/ratelimit";
import OpenAI from "openai";
import { z } from "zod";

// Деректерге негізделген НАҚТЫ ұсыныстар. ML спектрлік индекстер +
// LLM Vision нәтижесі + анықталған белгілерге сүйеніп, тек осы нүктеге
// қатысты, сандарға сілтеме жасайтын орындалатын ұсыныстар генерациялайды.

const reqSchema = z.object({
  lat: z.number(), lng: z.number(),
  lang: z.enum(["kk", "ru", "en"]).optional(),
  riskScore: z.number(), riskLevel: z.string(),
  detectedFeatures: z.array(z.string()).optional(),
  oilPollution: z.boolean().optional(),
  illegalDumping: z.boolean().optional(),
  landDegradation: z.boolean().optional(),
  standingWater: z.boolean().optional(),
  mosquitoRiskIndex: z.number().optional(),
  areaKm2: z.number().optional(),
  summary: z.string().optional(),
  indices: z.object({
    ndvi: z.number(), ndwi: z.number(), ndmi: z.number(), ndbi: z.number(),
  }).nullable().optional(),
});

const SYSTEM_KK = `Сен — Атырау облысының (мұнай өңірі, Каспий жағалауы, шөлейт климат) тәжірибелі экологиялық сарапшысың.
Саған бір нақты нүктенің НАҚТЫ талдау деректері беріледі: спектрлік индекстер (Sentinel-2), тәуекел деңгейі, анықталған белгілер.
Міндетің — ТЕК осы деректерге сүйеніп, дәл осы нүктеге бағытталған 3-4 ОРЫНДАЛАТЫН ұсыныс жазу.

ҚАТАҢ ережелер:
- Әр ұсыныс белгілі бір САНҒА немесе анықталған белгіге сілтеме жасасын (мысалы: "NDVI 0.12 — өсімдік аз, ...").
- Жалпылама, банальды сөз ТЫЙЫМ: "мониторингке алу", "бақылау керек", "шара қолдану" деген жалаң тіркестер болмасын.
- Нақты әрекет: кім, нені, қалай (мысалы: "тұзға төзімді изен/жусан егу", "дренаж арық қазу", "мұнай қалдығын сорбентпен жинау").
- Атырау контексі: мұнай инфрақұрылымы, Жайық/Каспий, маса, шөлейттену.
- Қазақ тілінде, әр ұсыныс 1-2 сөйлем, нақты.
- JSON қайтар: {"recommendations":["...","...","..."]}`;

const SYSTEM_RU = `Ты — опытный эколог-эксперт Атырауской области (нефтяной регион, побережье Каспия, полупустынный климат).
Тебе даются РЕАЛЬНЫЕ данные анализа точки: спектральные индексы (Sentinel-2), уровень риска, выявленные признаки.
Задача — опираясь ТОЛЬКО на эти данные, дать 3-4 ВЫПОЛНИМЫЕ рекомендации именно для этой точки.

СТРОГИЕ правила:
- Каждая рекомендация ссылается на конкретное ЧИСЛО или признак (например: "NDVI 0.12 — мало растительности, ...").
- Запрещены общие, банальные фразы: "взять на мониторинг", "контролировать", "принять меры".
- Конкретное действие: кто, что, как (например: "посадить солеустойчивые полынь/изень", "вырыть дренажную канаву", "собрать нефтешлам сорбентом").
- Контекст Атырау: нефтяная инфраструктура, Урал/Каспий, комары, опустынивание.
- На русском языке, каждая рекомендация 1-2 предложения, конкретно.
- Верни JSON: {"recommendations":["...","...","..."]}`;

const SYSTEM_EN = `You are an experienced environmental expert for Atyrau region (oil region, Caspian coast, semi-arid climate).
You are given REAL analysis data for a point: spectral indices (Sentinel-2), risk level, detected features.
Your task — based ONLY on this data, give 3-4 ACTIONABLE recommendations specific to this point.

STRICT rules:
- Each recommendation must reference a specific NUMBER or detected feature (e.g. "NDVI 0.12 — sparse vegetation, ...").
- No generic, banal phrases: "monitor", "keep under control", "take measures".
- Concrete action: who, what, how (e.g. "plant salt-tolerant sagebrush/kochia", "dig a drainage ditch", "collect oil sludge with sorbent").
- Atyrau context: oil infrastructure, Ural/Caspian, mosquitoes, desertification.
- In English, each recommendation 1-2 sentences, specific.
- Return JSON: {"recommendations":["...","...","..."]}`;

const SYSTEMS = { kk: SYSTEM_KK, ru: SYSTEM_RU, en: SYSTEM_EN };

export async function POST(req: Request) {
  if (!(await allow(req))) {
    return NextResponse.json({ error: "Тым көп сұраныс" }, { status: 429 });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI кілті жоқ" }, { status: 503 });

  const parsed = reqSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Жарамсыз сұраныс" }, { status: 400 });
  const d = parsed.data;

  const ctx = [
    `Координат: ${d.lat.toFixed(4)}, ${d.lng.toFixed(4)}`,
    d.areaKm2 ? `Аумақ: ${d.areaKm2.toFixed(2)} км²` : null,
    `Тәуекел: ${d.riskScore}/100 (${d.riskLevel})`,
    d.indices
      ? `Нақты спектрлік индекстер (Sentinel-2): NDVI=${d.indices.ndvi} (өсімдік), NDWI=${d.indices.ndwi} (су), NDMI=${d.indices.ndmi} (ылғал), NDBI=${d.indices.ndbi} (құрылыс/тас)`
      : `Спектрлік индекстер қолжетімсіз (бұлт)`,
    d.mosquitoRiskIndex != null ? `Маса индексі: ${d.mosquitoRiskIndex}/100` : null,
    `Анықталған мәселелер: ${[
      d.oilPollution && "мұнай ластануы",
      d.illegalDumping && "заңсыз қоқыс",
      d.landDegradation && "жер деградациясы",
      d.standingWater && "тұрған су",
    ].filter(Boolean).join(", ") || "айқын мәселе жоқ"}`,
    d.detectedFeatures?.length ? `AI белгілері: ${d.detectedFeatures.join(", ")}` : null,
    d.summary ? `LLM түйіні: ${d.summary}` : null,
  ].filter(Boolean).join("\n");

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 600,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEMS[d.lang ?? "kk"] },
        { role: "user", content: `${ctx}\n\nReturn specific recommendations as JSON.` },
      ],
    });
    const raw = JSON.parse(completion.choices[0].message.content ?? "{}");
    const recs = Array.isArray(raw.recommendations) ? raw.recommendations.slice(0, 4).filter((x: unknown) => typeof x === "string") : [];
    if (!recs.length) throw new Error("бос");
    return NextResponse.json({ recommendations: recs });
  } catch (err) {
    console.error("Recommend error:", err);
    return NextResponse.json({ error: "Ұсыныс генерациясы сәтсіз" }, { status: 502 });
  }
}
