import { NextResponse } from "next/server";
import { allow } from "@/lib/ratelimit";

import { z } from "zod";
import OpenAI from "openai";
import { supabase } from "@/lib/supabase";
import { satelliteImageUrl } from "@/lib/mapbox";
import { scoreToLevel } from "@/lib/risk";
import { mosquitoRiskIndex } from "@/lib/mosquito";
import type { AnalysisResult } from "@/types/site";
import { REPORT_MODERATION_SYSTEM, REPORT_ANALYSIS_SYSTEM } from "@/lib/prompts";
import { notifyModerator } from "@/app/api/telegram/route";

// Shared citizen reports: stored in Supabase so every user sees them.
// On submit: AI moderation (is this a real ecological issue?) + combined
// satellite/photo analysis, then insert. GET returns all reports.
// After insert, a Telegram notification is sent to TELEGRAM_MODERATOR_CHAT_ID.

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
  if (!(await allow(req))) {
    return NextResponse.json({ error: "Тым көп сұраныс. Сәл кейін қайталаңыз." }, { status: 429 });
  }
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
            content: REPORT_MODERATION_SYSTEM,
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
            content: REPORT_ANALYSIS_SYSTEM,
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
      const sp = analysisSchema.safeParse(JSON.parse(completion.choices[0].message.content ?? "{}"));
      if (!sp.success) { console.error("Report schema:", sp.error.message); return NextResponse.json({ error: "Талдау форматы дұрыс емес" }, { status: 500 }); }
      const raw = sp.data;
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

  // Upload the photo to Supabase Storage; keep only the URL in the row (lighter
  // DB). Falls back to inline base64 if the bucket/upload is unavailable.
  let photoRef = photo;
  try {
    const m = photo.match(/^data:(image\/\w+);base64,(.+)$/);
    if (m) {
      const ext = m[1].split("/")[1];
      const bytes = Buffer.from(m[2], "base64");
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("report-photos")
        .upload(path, bytes, { contentType: m[1], upsert: false });
      if (!upErr) {
        const { data: pub } = supabase.storage.from("report-photos").getPublicUrl(path);
        if (pub?.publicUrl) photoRef = pub.publicUrl;
      } else {
        console.error("Storage upload failed, keeping base64:", upErr.message);
      }
    }
  } catch (e) {
    console.error("Storage upload error:", e);
  }

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
      photo_thumb: photoRef,
      verification_status: analysis.verificationStatus ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("Reports INSERT error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fire-and-forget: notify Telegram moderator with inline action buttons
  notifyModerator({
    lat,
    lng,
    description,
    riskScore: analysis.riskScore,
    verificationStatus: analysis.verificationStatus,
    features: analysis.detectedFeatures ?? [],
    recommendation: analysis.recommendation ?? "",
    photoUrl: photoRef,
    reportId: data.id,
  });

  return NextResponse.json({ report: data });
}
