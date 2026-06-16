import { NextResponse } from "next/server";
import OpenAI from "openai";
import { supabase } from "@/lib/supabase";

// Jaiyq Telegram Bot webhook.
// Moderator flow:
//   Citizen submits photo → AI analysis → Supabase → Telegram with 3 inline buttons
//   Moderator taps button → callback_query → Supabase verification_status updated → map reflects change
//
// Commands: /start /ауа /маса /алерт

const BOT = process.env.TELEGRAM_BOT_TOKEN;

// ─── Telegram API helpers ──────────────────────────────────────────────────

async function sendMessage(chatId: number | string, text: string, extra?: Record<string, unknown>) {
  if (!BOT) return;
  await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", ...extra }),
  });
}

async function sendPhoto(chatId: number | string, photoUrl: string, caption: string, extra?: Record<string, unknown>) {
  if (!BOT) return;
  await fetch(`https://api.telegram.org/bot${BOT}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption, parse_mode: "HTML", ...extra }),
  });
}

async function answerCallback(callbackQueryId: string, text: string) {
  if (!BOT) return;
  await fetch(`https://api.telegram.org/bot${BOT}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: false }),
  });
}

async function editMessageReplyMarkup(chatId: number | string, messageId: number, markup: Record<string, unknown> | null) {
  if (!BOT) return;
  await fetch(`https://api.telegram.org/bot${BOT}/editMessageReplyMarkup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: markup ?? {} }),
  });
}

// ─── Moderator notification (called from /api/reports) ───────────────────

export async function notifyModerator(opts: {
  lat: number;
  lng: number;
  description: string | undefined;
  riskScore: number;
  verificationStatus: string | undefined;
  features: string[];
  recommendation: string;
  photoUrl: string;
  reportId: string;
}) {
  const token = BOT;
  const chatId = process.env.TELEGRAM_MODERATOR_CHAT_ID;
  if (!token || !chatId) return;

  const { lat, lng, description, riskScore, verificationStatus, features, recommendation, photoUrl, reportId } = opts;

  const riskEmoji = riskScore >= 70 ? "🔴" : riskScore >= 50 ? "🟠" : riskScore >= 30 ? "🟡" : "🟢";
  const aiVerified =
    verificationStatus === "confirmed" ? "✅ Спутник растады"
    : verificationStatus === "contradicted" ? "❌ Спутник қайшылықты"
    : "❔ Расталмаған";

  const caption =
    `${riskEmoji} <b>Жаңа азаматтық хабарлама</b>\n\n` +
    `📍 <a href="https://maps.google.com/?q=${lat},${lng}">${lat.toFixed(5)}, ${lng.toFixed(5)}</a>\n` +
    `📊 Тәуекел: <b>${riskScore}/100</b>\n` +
    `🔍 AI: ${aiVerified}\n` +
    (features.length ? `⚠️ ${features.slice(0, 3).join(" · ")}\n` : "") +
    (description ? `\n💬 <i>${description.slice(0, 200)}</i>\n` : "") +
    `\n📝 ${recommendation}\n` +
    `\n🆔 <code>${reportId}</code>`;

  // Inline keyboard for moderator
  const reply_markup = {
    inline_keyboard: [[
      { text: "✅ Растау", callback_data: `confirm:${reportId}` },
      { text: "🔍 Тексеруде", callback_data: `inspect:${reportId}` },
      { text: "❌ Қабылдамау", callback_data: `reject:${reportId}` },
    ]],
  };

  try {
    if (photoUrl.startsWith("http")) {
      await sendPhoto(chatId, photoUrl, caption, { reply_markup });
    } else {
      await sendMessage(chatId, caption, { reply_markup });
    }
  } catch (e) {
    console.error("Telegram notify error:", e);
  }
}

// ─── Live data helpers ────────────────────────────────────────────────────

async function fetchAir() {
  try {
    const r = await fetch(
      "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=47.1167&longitude=51.9014&current=pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,european_aqi",
      { cache: "no-store" }
    );
    if (!r.ok) return null;
    const d = await r.json();
    return { aqi: d.current?.european_aqi ?? null, pm25: d.current?.pm2_5 ?? null, pm10: d.current?.pm10 ?? null, no2: d.current?.nitrogen_dioxide ?? null };
  } catch { return null; }
}

async function fetchLiveContext(): Promise<string> {
  try {
    const [airRes, meteoRes] = await Promise.all([
      fetch("https://air-quality-api.open-meteo.com/v1/air-quality?latitude=47.1167&longitude=51.9014&current=pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,european_aqi", { cache: "no-store" }),
      fetch("https://api.open-meteo.com/v1/forecast?latitude=47.1167&longitude=51.9014&current=temperature_2m,relative_humidity_2m,wind_speed_10m&daily=precipitation_sum&past_days=7&forecast_days=1&timezone=auto", { cache: "no-store" }),
    ]);
    const air = airRes.ok ? await airRes.json() : null;
    const met = meteoRes.ok ? await meteoRes.json() : null;
    const rain7 = (met?.daily?.precipitation_sum ?? []).reduce((a: number, x: number) => a + (x ?? 0), 0);
    return [
      air ? `Нақты уақыт ауа сапасы (Copernicus CAMS): EU AQI=${air.current?.european_aqi}, PM2.5=${air.current?.pm2_5} µg/m³, PM10=${air.current?.pm10}, NO₂=${air.current?.nitrogen_dioxide}, SO₂=${air.current?.sulphur_dioxide}.` : "",
      met ? `Ауа райы (Open-Meteo): ${met.current?.temperature_2m}°C, ылғал ${met.current?.relative_humidity_2m}%, жел ${met.current?.wind_speed_10m} км/сағ, 7 күн жаңбыр ${rain7.toFixed(1)} мм.` : "",
    ].filter(Boolean).join(" ");
  } catch {
    return "";
  }
}

const ECO_EXPERT_SYSTEM = `Сен Атырау облысының тәжірибелі экология маманысың. Жауаптарың нақты, қысқа, практикалық.

Атырау облысы туралы негізгі факттар:
- Каспий теңізі жағалауы, Жайық өзені арқылы өтеді
- Теңіз, Қашаған кен орындары — ірі мұнай өндіруші аймақ
- Негізгі экологиялық мәселелер: мұнай ластануы, газ факелдері, Жайық тасқыны, топырақ тұздануы, маса белсенділігі
- Халық саны: ~650 мың (Атырау қаласы ~350 мың)

Ережелер:
- Тек шынайы, дәл ғылыми ақпарат бер
- Егер білмесең — "дерегім жоқ, ресми дереккөзге жүгін" де
- Жауапты қазақ тілінде бер, 3-5 сөйлемнен аспасын
- Тірі деректер берілсе — оларды жауапқа қос`;

async function expertReply(userText: string, liveCtx: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return "OpenAI кілті орнатылмаған — AI жауабы қолжетімсіз.";
  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 400,
      messages: [
        { role: "system", content: ECO_EXPERT_SYSTEM + (liveCtx ? `\n\nТІРІ ДЕРЕКТЕР (қазір): ${liveCtx}` : "") },
        { role: "user", content: userText },
      ],
    });
    return completion.choices[0].message.content?.trim() ?? "Жауап алу мүмкін болмады.";
  } catch {
    return "AI уақытша қолжетімсіз. Кейін қайталаңыз.";
  }
}

async function forwardToModerator(fromUsername: string, question: string, answer: string) {
  const chatId = process.env.TELEGRAM_MODERATOR_CHAT_ID;
  if (!BOT || !chatId) return;
  const text =
    `💬 <b>Азамат сұрақ қойды</b>\n` +
    `👤 @${fromUsername || "белгісіз"}\n\n` +
    `❓ <i>${question.slice(0, 300)}</i>\n\n` +
    `🤖 Бот жауабы:\n${answer.slice(0, 500)}\n\n` +
    `<i>Модератор қажет деп санаса, азаматқа тікелей жаза алады.</i>`;
  try {
    await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
  } catch (e) {
    console.error("Forward to moderator error:", e);
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
    const tempScore = temp >= 25 ? 1 : temp >= 15 ? 0.6 : 0.2;
    const humScore = hum >= 70 ? 1 : hum >= 50 ? 0.6 : 0.2;
    const rainScore = rain > 20 ? 1 : rain > 5 ? 0.6 : 0.1;
    const base = Math.round((tempScore * 0.35 + humScore * 0.25 + rainScore * 0.4) * 100);
    return { index: Math.min(100, Math.round(base * 1.35)), temp, hum, rain: +rain.toFixed(1) };
  } catch { return null; }
}

// ─── Webhook handler ──────────────────────────────────────────────────────

interface TelegramUpdate {
  message?: { chat: { id: number }; from?: { username?: string }; text?: string };
  callback_query?: {
    id: string;
    from: { id: number };
    message: { message_id: number; chat: { id: number } };
    data?: string;
  };
}

export async function POST(req: Request) {
  if (!BOT) return NextResponse.json({ ok: false });

  let update: TelegramUpdate;
  try { update = await req.json(); } catch { return NextResponse.json({ ok: false }); }

  // ── Moderator button press ──
  if (update.callback_query) {
    const cq = update.callback_query;
    const data = cq.data ?? "";
    const [action, reportId] = data.split(":");

    if (!reportId) {
      await answerCallback(cq.id, "Қате: ID жоқ");
      return NextResponse.json({ ok: true });
    }

    const statusMap: Record<string, string> = {
      confirm: "confirmed",
      inspect: "unconfirmed",
      reject: "contradicted",
    };
    const labelMap: Record<string, string> = {
      confirm: "✅ Расталды — картада белгіленді",
      inspect: "🔍 Тексеруге қойылды",
      reject: "❌ Қабылданбады",
    };

    const newStatus = statusMap[action];
    if (!newStatus) {
      await answerCallback(cq.id, "Белгісіз әрекет");
      return NextResponse.json({ ok: true });
    }

    // Update Supabase
    let dbOk = false;
    if (supabase) {
      const { error } = await supabase
        .from("reports")
        .update({ verification_status: newStatus })
        .eq("id", reportId);
      dbOk = !error;
      if (error) console.error("Supabase update error:", error);
    }

    await answerCallback(cq.id, labelMap[action] ?? "Сақталды");

    // Remove inline keyboard from the message so buttons disappear after decision
    await editMessageReplyMarkup(cq.message.chat.id, cq.message.message_id, null);

    // Send confirmation message
    const confirmText =
      `${labelMap[action]}\n` +
      `🆔 <code>${reportId}</code>\n` +
      (dbOk ? "✅ Картада статус жаңарды" : "⚠️ Дерекқор жаңартылмады — Supabase қатесі");
    await sendMessage(cq.message.chat.id, confirmText);

    return NextResponse.json({ ok: true });
  }

  // ── Text commands ──
  const msg = update.message;
  if (!msg?.text) return NextResponse.json({ ok: true });
  const chatId = msg.chat.id;
  const username = msg.from?.username ?? "";
  const text = msg.text.trim().toLowerCase();
  const rawText = msg.text.trim();

  if (text.startsWith("/start")) {
    await sendMessage(chatId,
      "🌿 <b>Jaiyq — Атырау экологиялық мониторингі</b>\n\n" +
      "Модератор командалары:\n" +
      "✅ Азаматтық хабарламалар автоматты түседі — батырмалармен шешім қабылдаңыз\n\n" +
      "Тірі деректер:\n" +
      "/ауа — Атырауда ауа сапасы\n" +
      "/маса — Маса тәуекел индексі\n" +
      "/алерт — Ескерту жүйесі\n\n" +
      "Дереккөздер: Copernicus CAMS · Open-Meteo · NASA FIRMS"
    );
    return NextResponse.json({ ok: true });
  }

  if (text === "/ауа" || text === "/air") {
    const air = await fetchAir();
    if (!air) {
      await sendMessage(chatId, "⚠️ Ауа сапасы деректері уақытша қолжетімсіз.");
    } else {
      const lbl = (air.aqi ?? 0) > 80 ? "🔴 Өте жаман" : (air.aqi ?? 0) > 50 ? "🟠 Жаман" : (air.aqi ?? 0) > 25 ? "🟡 Қанағаттанарлық" : "🟢 Жақсы";
      await sendMessage(chatId,
        `🌬 <b>Атырау ауа сапасы</b>\n` +
        `EU AQI: <b>${air.aqi ?? "—"}</b> — ${lbl}\n` +
        `PM2.5: ${air.pm25 ?? "—"} µg/m³\n` +
        `PM10: ${air.pm10 ?? "—"} µg/m³\n` +
        `NO₂: ${air.no2 ?? "—"} µg/m³\n\n` +
        `Дереккөз: Copernicus CAMS · нақты уақыт`
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (text === "/маса" || text === "/mosquito") {
    const m = await fetchMosquito();
    if (!m) {
      await sendMessage(chatId, "⚠️ Маса индексі деректері уақытша қолжетімсіз.");
    } else {
      const level = m.index >= 70 ? "🔴 Жоғары" : m.index >= 40 ? "🟡 Орташа" : "🟢 Төмен";
      await sendMessage(chatId,
        `🦟 <b>Маса белсенділік индексі</b>\n` +
        `Индекс: <b>${m.index}/100</b> — ${level}\n` +
        `${m.temp}°C · ${m.hum}% ылғал · ${m.rain} мм жаңбыр (7 күн)\n` +
        `Дереккөз: Open-Meteo`
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (text === "/алерт" || text === "/alert") {
    await sendMessage(chatId,
      "🔔 <b>Ескерту жүйесі</b>\n\nКартада жоғары тәуекелді (55+) нүкте анықталса автохабарлама жіберіледі.\n\nТолығырақ: jaiyq.vercel.app/alerts"
    );
    return NextResponse.json({ ok: true });
  }

  // Free-text → GPT-4o-mini Atyrau ecology expert
  const liveCtx = await fetchLiveContext();
  const answer = await expertReply(rawText, liveCtx);
  await sendMessage(chatId, answer);

  // Forward conversation to moderator so they can intervene if needed
  forwardToModerator(username, rawText, answer);

  return NextResponse.json({ ok: true });
}

// ─── Setup status ─────────────────────────────────────────────────────────

export async function GET() {
  const moderatorId = process.env.TELEGRAM_MODERATOR_CHAT_ID;
  if (!BOT) {
    return NextResponse.json({
      configured: false,
      setup: [
        "1. TELEGRAM_BOT_TOKEN — @BotFather-дан алынған токен",
        "2. TELEGRAM_MODERATOR_CHAT_ID — модератордың chat id",
        "3. Вебхук: curl 'https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://jaiyq.vercel.app/api/telegram'",
      ],
    });
  }
  return NextResponse.json({
    configured: true,
    moderatorConfigured: !!moderatorId,
    message: moderatorId
      ? "Дайын. Азаматтық хабарламалар модераторға батырмалармен жіберіледі."
      : "Бот жұмыс істейді, бірақ TELEGRAM_MODERATOR_CHAT_ID орнатылмаған.",
  });
}
