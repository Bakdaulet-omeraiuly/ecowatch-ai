import { NextResponse } from "next/server";

// Jaiyq Telegram Bot webhook.
// Setup: @BotFather → /newbot → get token → set webhook:
//   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://jaiyq.vercel.app/api/telegram"
//
// Commands:
//   /start        — welcome message
//   /ауа          — current Atyrau air quality (Copernicus CAMS)
//   /алерт <lat> <lng> — subscribe to high-risk alerts for a location
//   /маса         — current mosquito risk index for Atyrau city

const BOT = process.env.TELEGRAM_BOT_TOKEN;

async function send(chatId: number, text: string) {
  if (!BOT) return;
  await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

async function fetchAir() {
  try {
    const r = await fetch(
      "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=47.1167&longitude=51.9014&current=pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,european_aqi",
      { cache: "no-store" }
    );
    if (!r.ok) return null;
    const d = await r.json();
    return {
      aqi: d.current?.european_aqi ?? null,
      pm25: d.current?.pm2_5 ?? null,
      pm10: d.current?.pm10 ?? null,
      no2: d.current?.nitrogen_dioxide ?? null,
    };
  } catch {
    return null;
  }
}

async function fetchMosquito() {
  try {
    const r = await fetch("https://api.open-meteo.com/v1/forecast?latitude=47.1167&longitude=51.9014&current=temperature_2m,relative_humidity_2m&daily=precipitation_sum&past_days=7&forecast_days=1&timezone=auto", { cache: "no-store" });
    if (!r.ok) return null;
    const d = await r.json();
    const temp = d.current?.temperature_2m ?? 0;
    const hum = d.current?.relative_humidity_2m ?? 0;
    const rain = (d.daily?.precipitation_sum ?? []).reduce((a: number, x: number) => a + (x ?? 0), 0);
    // Mordecai simplified index
    const tempScore = temp >= 25 ? 1 : temp >= 15 ? 0.6 : 0.2;
    const humScore = hum >= 70 ? 1 : hum >= 50 ? 0.6 : 0.2;
    const rainScore = rain > 20 ? 1 : rain > 5 ? 0.6 : 0.1;
    const base = Math.round((tempScore * 0.35 + humScore * 0.25 + rainScore * 0.4) * 100);
    const floodplain = Math.min(100, Math.round(base * 1.35)); // Zhaiyk floodplain factor
    return { index: floodplain, temp, hum, rain: +rain.toFixed(1) };
  } catch {
    return null;
  }
}

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
  };
}

export async function POST(req: Request) {
  if (!BOT) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN бапталмаған" }, { status: 503 });
  }

  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: false });
  }

  const msg = update.message;
  if (!msg?.text) return NextResponse.json({ ok: true });

  const chatId = msg.chat.id;
  const text = msg.text.trim().toLowerCase();

  if (text === "/start" || text.startsWith("/start ")) {
    await send(chatId,
      "🌿 <b>Jaiyq — Атырау экологиялық мониторингі</b>\n\n" +
      "Қолжетімді командалар:\n" +
      "/ауа — Атырауда ауа сапасы (нақты уақыт)\n" +
      "/маса — Маса тәуекел индексі\n" +
      "/алерт — Жоғары тәуекел туралы ескерту\n\n" +
      "Дереккөздер: Copernicus CAMS · Open-Meteo · NASA FIRMS"
    );
    return NextResponse.json({ ok: true });
  }

  if (text === "/ауа" || text === "/air") {
    const air = await fetchAir();
    if (!air) {
      await send(chatId, "⚠️ Ауа сапасы деректері уақытша қолжетімсіз. Кейін қайталаңыз.");
    } else {
      const aqiLabel = (air.aqi ?? 0) > 80 ? "🔴 Өте жаман" : (air.aqi ?? 0) > 50 ? "🟠 Жаман" : (air.aqi ?? 0) > 25 ? "🟡 Қанағаттанарлық" : "🟢 Жақсы";
      await send(chatId,
        `🌬 <b>Атырау ауа сапасы</b>\n` +
        `EU AQI: <b>${air.aqi ?? "—"}</b> — ${aqiLabel}\n` +
        `PM2.5: ${air.pm25 ?? "—"} µg/m³\n` +
        `PM10: ${air.pm10 ?? "—"} µg/m³\n` +
        `NO₂: ${air.no2 ?? "—"} µg/m³\n\n` +
        `Дереккөз: Copernicus CAMS · нақты уақыт\n` +
        `Толығырақ: jaiyq.vercel.app/dashboard`
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (text === "/маса" || text === "/mosquito") {
    const m = await fetchMosquito();
    if (!m) {
      await send(chatId, "⚠️ Маса индексі деректері уақытша қолжетімсіз.");
    } else {
      const level = m.index >= 70 ? "🔴 Жоғары" : m.index >= 40 ? "🟡 Орташа" : "🟢 Төмен";
      await send(chatId,
        `🦟 <b>Маса белсенділік индексі — Атырау</b>\n` +
        `Индекс: <b>${m.index}/100</b> — ${level}\n` +
        `Температура: ${m.temp}°C\n` +
        `Ылғалдылық: ${m.hum}%\n` +
        `7 күн жаңбыр: ${m.rain} мм\n\n` +
        `Жайық жайылмасы факторы қосылған. Дереккөз: Open-Meteo\n` +
        `Картада: jaiyq.vercel.app/map → «Маса қабаты»`
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (text === "/алерт" || text === "/alert") {
    await send(chatId,
      "🔔 <b>Ескерту жүйесі</b>\n\n" +
      "Картада жоғары тәуекелді нүктені (55+ балл) AI анықтаса, Jaiyq автоматты ескерту жібереді.\n\n" +
      "Толығырақ: jaiyq.vercel.app/alerts"
    );
    return NextResponse.json({ ok: true });
  }

  // Default
  await send(chatId,
    "Команда танылмады. Қолдану үшін /start жазыңыз."
  );
  return NextResponse.json({ ok: true });
}

// Verify that the bot token is set — returns setup instructions
export async function GET() {
  if (!BOT) {
    return NextResponse.json({
      configured: false,
      setup: [
        "1. @BotFather-ға /newbot жазыңыз, жаңа бот жасаңыз",
        "2. Алынған токенді TELEGRAM_BOT_TOKEN env айнымалысына қосыңыз",
        "3. Vercel-де env-ке қосып, қайта деплой жасаңыз",
        "4. Вебхукты орнатыңыз: curl 'https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://YOUR_DOMAIN/api/telegram'",
      ],
    });
  }
  return NextResponse.json({ configured: true, message: "Telegram боты дайын." });
}
