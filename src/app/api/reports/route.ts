import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { supabase } from "@/lib/supabase";
import { satelliteImageUrl } from "@/lib/mapbox";
import { scoreToLevel } from "@/lib/risk";
import { mosquitoRiskIndex } from "@/lib/mosquito";
import type { AnalysisResult } from "@/types/site";

// Shared citizen reports: stored in Supabase so every user sees them.
// On submit: AI moderation (is this a real ecological issue?) + combined
// satellite/photo analysis, then insert. GET returns all reports.

const postSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  photo: z.string().min(10), // base64 data URL
  description: z.string().max(500).optional(),
});

const analysisSchema = z.object({
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

export async function GET() {
  if (!supabase) return NextResponse.json({ reports: [], configured: false });
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    console.error("Reports GET error:", error);
    return NextResponse.json({ reports: [], error: error.message }, { status: 500 });
  }
  return NextResponse.json({ reports: data ?? [] });
}

export async function POST(req: Request) {
  if (!supabase) {
    return NextResponse.json({ error: "Ортақ дерекқор бапталмаған" }, { status: 503 });
  }
  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Жарамсыз сұраныс" }, { status: 400 });
  const { lat, lng, photo, description } = parsed.data;
  const imageUrl = satelliteImageUrl(lat, lng);
  const apiKey = process.env.OPENAI_API_KEY;

  let analysis: AnalysisResult;
  if (apiKey) {
    try {
      const openai = new OpenAI({ apiKey });
      // Step 1 — moderation gate
      const mod = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 100,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Сен модерациялық сүзгісің. Фото экологиялық мәселені (қоқыс, мұнай ластануы, жер деградациясы, тұрған су, өлі жануарлар, түтін) көрсете ме, әлде қатысы жоқ па (селфи, мем, жарнама, кездейсоқ зат)? Тек JSON.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Бұл фото экологиялық хабарламаға жарай ма? JSON: {"relevant":bool,"reason":"қысқа себеп"}` },
              { type: "image_url", image_url: { url: photo } },
            ],
          },
        ],
      });
      const modResult = JSON.parse(mod.choices[0].message.content ?? "{}");
      if (modResult.relevant === false) {
        return NextResponse.json(
          { rejected: true, reason: modResult.reason || "Фото экологиялық мәселеге қатысы жоқ сияқты." },
          { status: 422 }
        );
      }

      // Step 2 — combined analysis (photo + satellite cross-verification)
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 900,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Сен Атырау облысының экологиялық AI-сың. 1-сурет азаматтың фотосы, 2-сурет сол координаттың спутник көрінісі. Тек JSON, қазақша.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `${description ? `Азамат сипаттамасы: ${description}. ` : ""}Спутник көрінісі жердегі дәлелді растай ма? JSON: {"riskScore":0-100,"confidence":0-100,"oilPollution":bool,"illegalDumping":bool,"landDegradation":bool,"standingWater":bool,"detectedFeatures":["..."],"recommendation":"...","summary":"...","verificationStatus":"confirmed|unconfirmed|contradicted","verificationNotes":"..."}`,
              },
              { type: "image_url", image_url: { url: photo } },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
      });
      const raw = analysisSchema.parse(JSON.parse(completion.choices[0].message.content ?? "{}"));
      analysis = { ...raw, riskLevel: scoreToLevel(raw.riskScore) };
    } catch (err) {
      console.error("Report analysis error:", err);
      return NextResponse.json({ error: "Талдау сәтсіз аяқталды" }, { status: 500 });
    }
  } else {
    // No key: accept with a neutral placeholder analysis
    analysis = {
      riskScore: 50,
      confidence: 50,
      riskLevel: "medium",
      oilPollution: false,
      illegalDumping: true,
      landDegradation: false,
      standingWater: false,
      detectedFeatures: ["Азаматтық фото-хабарлама"],
      recommendation: "Мониторингке алу ұсынылады.",
      summary: "AI кілті жоқ — фото тіркелді, талдау кейінге қалдырылды.",
    };
  }

  const mri = mosquitoRiskIndex(lat, lng, analysis.standingWater);
  const { data, error } = await supabase
    .from("reports")
    .insert({
      lat,
      lng,
      name: description ? description.slice(0, 80) : "Азаматтық хабарлама",
      district: "Атырау облысы",
      risk_score: analysis.riskScore,
      risk_level: analysis.riskLevel,
      mosquito_index: mri,
      analysis,
      image_url: imageUrl,
      photo_thumb: photo,
      verification_status: analysis.verificationStatus ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("Reports INSERT error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ report: data });
}
