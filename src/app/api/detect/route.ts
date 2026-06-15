import { NextResponse } from "next/server";
import { allow } from "@/lib/ratelimit";

import { z } from "zod";

// Trash detection via Roboflow hosted inference (trash-detection model).
// Real object-detection model trained on litter — returns bounding boxes.

const reqSchema = z.object({
  image: z.string().min(10), // data URL or raw base64
});

const MODEL = "trash-detection-3/1";

export async function POST(req: Request) {
  if (!(await allow(req))) {
    return NextResponse.json({ error: "Тым көп сұраныс. Сәл кейін қайталаңыз." }, { status: 429 });
  }
  const key = process.env.ROBOFLOW_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Roboflow кілті бапталмаған" }, { status: 503 });
  }
  const parsed = reqSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Жарамсыз сұраныс" }, { status: 400 });

  // Strip data-URL prefix if present
  const b64 = parsed.data.image.replace(/^data:image\/\w+;base64,/, "");

  try {
    const res = await fetch(
      `https://detect.roboflow.com/${MODEL}?api_key=${key}&confidence=20&overlap=40`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: b64,
      }
    );
    if (!res.ok) {
      const t = await res.text();
      console.error("Roboflow error:", t);
      return NextResponse.json({ error: "Детектор қатесі" }, { status: 502 });
    }
    const data = await res.json();
    // Normalise: Roboflow gives center x,y + width,height (pixels)
    const predictions = (data.predictions ?? []).map(
      (p: { x: number; y: number; width: number; height: number; class: string; confidence: number }) => ({
        xmin: p.x - p.width / 2,
        ymin: p.y - p.height / 2,
        xmax: p.x + p.width / 2,
        ymax: p.y + p.height / 2,
        label: p.class,
        score: p.confidence,
      })
    );
    return NextResponse.json({
      predictions,
      imageWidth: data.image?.width ?? null,
      imageHeight: data.image?.height ?? null,
      model: "Roboflow trash-detection",
    });
  } catch (err) {
    console.error("Detect error:", err);
    return NextResponse.json({ error: "Детектор қолжетімсіз" }, { status: 503 });
  }
}
