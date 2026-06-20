import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Hourly Vercel cron job: check thresholds → notify Telegram subscribers.
// Thresholds:
//   AQI ≥ 75 (CAMS)  → ауа ластығы ескертуі
//   Flood ratio ≥ 0.7 → су тасқыны ескертуі
//   Fire hotspot     → өрт қаупі ескертуі (FIRMS)

const BOT = process.env.TELEGRAM_BOT_TOKEN;
const CRON_SECRET = process.env.CRON_SECRET;

async function sendMessage(chatId: number | string, text: string) {
  if (!BOT) return;
  await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  }).catch(() => {});
}

async function getSubscribers(): Promise<{ chat_id: number; username: string | null }[]> {
  if (!supabase) return [];
  const { data } = await supabase.from("telegram_subscribers").select("chat_id, username");
  return data ?? [];
}

interface Alert {
  emoji: string;
  type: string;
  message: string;
}

async function checkAir(): Promise<Alert | null> {
  try {
    const r = await fetch(
      "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=47.1167&longitude=51.9014&current=european_aqi,pm2_5,nitrogen_dioxide,sulphur_dioxide",
      { cache: "no-store" }
    );
    if (!r.ok) return null;
    const d = await r.json();
    const aqi = d.current?.european_aqi ?? 0;
    const pm25 = d.current?.pm2_5 ?? 0;
    const no2 = d.current?.nitrogen_dioxide ?? 0;
    if (aqi >= 75) {
      const level = aqi >= 100 ? "🔴 Өте қауіпті" : "🟠 Нашар";
      return {
        emoji: "🌫️",
        type: "Ауа ластығы ескертуі",
        message:
          `${level}\n` +
          `EU AQI: <b>${aqi}/100</b>\n` +
          `PM2.5: ${pm25.toFixed(1)} мкг/м³  |  NO₂: ${no2.toFixed(1)} мкг/м³\n\n` +
          `Дереккөз: Copernicus CAMS · Атырау қаласы`,
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function checkFlood(): Promise<Alert | null> {
  try {
    const r = await fetch(
      "https://flood-api.open-meteo.com/v1/flood?latitude=47.1167&longitude=51.8833&daily=river_discharge&past_days=30&forecast_days=1",
      { cache: "no-store" }
    );
    if (!r.ok) return null;
    const d = await r.json();
    const disc = (d.daily?.river_discharge ?? []).map((v: number | null) => v ?? 0);
    const current = disc[30] ?? disc[disc.length - 1] ?? 0;
    const max = Math.max(1, ...disc);
    const ratio = current / max;
    if (ratio >= 0.70) {
      const level = ratio >= 0.85 ? "🔴 Жоғары" : "🟠 Орташа";
      return {
        emoji: "🌊",
        type: "Су тасқыны ескертуі",
        message:
          `${level} тасқын қаупі\n` +
          `Жайық өзені ағысы: <b>${current.toFixed(0)} м³/с</b>\n` +
          `30 күндік максимумның ${Math.round(ratio * 100)}%\n\n` +
          `Дереккөз: Copernicus GloFAS`,
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function checkFire(): Promise<Alert | null> {
  try {
    const r = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=47.1167&longitude=51.9014&daily=et0_fao_evapotranspiration,precipitation_sum&past_days=7&forecast_days=1&timezone=auto",
      { cache: "no-store" }
    );
    if (!r.ok) return null;
    const d = await r.json();
    const rain7 = (d.daily?.precipitation_sum ?? []).slice(0, 7).reduce((a: number, x: number) => a + (x ?? 0), 0);
    const et = (d.daily?.et0_fao_evapotranspiration ?? []).slice(0, 7).reduce((a: number, x: number) => a + (x ?? 0), 0);
    // Simple drought/fire proxy: high evapotranspiration + low rain = high fire risk
    const fireRisk = et > 40 && rain7 < 5;
    if (fireRisk) {
      return {
        emoji: "🔥",
        type: "Өрт қаупі ескертуі",
        message:
          `🟠 Жоғары өрт қаупі\n` +
          `7 күндегі жауын-шашын: <b>${rain7.toFixed(1)} мм</b>\n` +
          `Булану (ET₀): ${et.toFixed(1)} мм — топырақ өте кепкен\n\n` +
          `Дереккөз: Open-Meteo`,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  // Verify cron secret so only Vercel can trigger this
  const secret = new URL(req.url).searchParams.get("secret");
  if (CRON_SECRET && secret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [airAlert, floodAlert, fireAlert] = await Promise.all([
    checkAir(),
    checkFlood(),
    checkFire(),
  ]);

  const alerts = [airAlert, floodAlert, fireAlert].filter((a): a is Alert => a !== null);

  if (alerts.length === 0) {
    return NextResponse.json({ sent: 0, message: "Ескертулер жоқ — барлық деңгейлер қалыпты" });
  }

  const subscribers = await getSubscribers();
  if (subscribers.length === 0) {
    return NextResponse.json({ sent: 0, alerts: alerts.length, message: "Жазылушылар жоқ" });
  }

  const body =
    `⚠️ <b>Jaiyq — Экологиялық ескерту</b>\n\n` +
    alerts.map(a => `${a.emoji} <b>${a.type}</b>\n${a.message}`).join("\n\n─────────────\n\n") +
    `\n\n🌐 jaiyq.vercel.app\n/болдырма — жазылудан шығу`;

  let sent = 0;
  for (const sub of subscribers) {
    await sendMessage(sub.chat_id, body);
    sent++;
  }

  return NextResponse.json({ sent, alerts: alerts.length });
}
