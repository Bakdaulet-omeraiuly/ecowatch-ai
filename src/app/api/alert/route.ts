import { NextResponse } from "next/server";
import { allow } from "@/lib/ratelimit";

// AI талдау нәтижесін тиісті органға (Telegram модераторға) жіберу.
// Азаматтық хабарлама емес — талдаушының қолмен жіберуі. Inline батырмасыз,
// тек ескерту хабары + картадағы орны.

export async function POST(req: Request) {
  if (!(await allow(req))) {
    return NextResponse.json({ error: "Тым көп сұраныс. Сәл кейін қайталаңыз." }, { status: 429 });
  }
  const BOT = process.env.TELEGRAM_BOT_TOKEN;
  const modChatId = process.env.TELEGRAM_MODERATOR_CHAT_ID;
  if (!BOT || !modChatId) {
    return NextResponse.json({ error: "Telegram бапталмаған" }, { status: 503 });
  }

  let b: { lat?: number; lng?: number; riskScore?: number; riskLevel?: string; summary?: string; features?: string[]; areaKm2?: number };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Жарамсыз сұраныс" }, { status: 400 });
  }
  const { lat, lng, riskScore, summary, features, areaKm2 } = b;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json({ error: "Координат жоқ" }, { status: 400 });
  }

  const emoji = (riskScore ?? 0) >= 80 ? "🔴" : (riskScore ?? 0) >= 55 ? "🟠" : (riskScore ?? 0) >= 30 ? "🟡" : "🟢";
  const text =
    `${emoji} <b>AI талдау ескертуі</b>\n\n` +
    `📍 <a href="https://maps.google.com/?q=${lat},${lng}">Картада ашу</a> · ${lat.toFixed(4)}°, ${lng.toFixed(4)}°\n` +
    (areaKm2 ? `📐 Аумақ: ${areaKm2.toFixed(2)} км²\n` : "") +
    `📊 Тәуекел: <b>${riskScore ?? "—"}/100</b>\n` +
    (features?.length ? `🛰 Белгілер: ${features.slice(0, 4).join(", ")}\n` : "") +
    (summary ? `\n${summary}` : "");

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: modChatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    if (!res.ok) throw new Error(await res.text());
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Alert send error:", err);
    return NextResponse.json({ error: "Жіберу сәтсіз аяқталды" }, { status: 502 });
  }
}
