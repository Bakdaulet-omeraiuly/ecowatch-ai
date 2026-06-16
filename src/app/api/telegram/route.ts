import { NextResponse } from "next/server";
import OpenAI from "openai";
import { supabase } from "@/lib/supabase";

// Jaiyq Telegram Bot webhook.
// Moderator flow:
//   Citizen sends photo via web app → AI analysis → saved to Supabase
//   → forwarded to Telegram moderator with 3 buttons
//   Moderator taps button → callback_query → Supabase status updated → map reflects it
//   Moderator replies to forwarded message → bot delivers reply to citizen
//
// Commands (anyone): /start /ауа /маса
// Free text: answered by GPT-4o-mini as Atyrau ecology expert

const BOT = process.env.TELEGRAM_BOT_TOKEN;

// ─── Telegram API helpers ─────────────────────────────────────────────────

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
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

async function removeButtons(chatId: number | string, messageId: number) {
  if (!BOT) return;
  await fetch(`https://api.telegram.org/bot${BOT}/editMessageReplyMarkup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: {} }),
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
  const modChatId = process.env.TELEGRAM_MODERATOR_CHAT_ID;
  if (!BOT || !modChatId) return;

  const { lat, lng, description, riskScore, verificationStatus, features, recommendation, photoUrl, reportId } = opts;

  const riskEmoji = riskScore >= 70 ? "🔴" : riskScore >= 50 ? "🟠" : riskScore >= 30 ? "🟡" : "🟢";
  const aiStatus =
    verificationStatus === "confirmed"   ? "✅ Спутник суреті растайды"     :
    verificationStatus === "contradicted"? "❌ Спутник суреті қайшылықты"   :
                                           "❔ Спутникпен тексерілмеген";

  const text =
    `${riskEmoji} <b>Жаңа хабарлама келді</b>\n\n` +
    `📍 <a href="https://maps.google.com/?q=${lat},${lng}">Картада ашу</a> · ${lat.toFixed(4)}°, ${lng.toFixed(4)}°\n` +
    `📊 Тәуекел деңгейі: <b>${riskScore}/100</b>\n` +
    `🛰 AI талдауы: ${aiStatus}\n` +
    (features.length ? `⚠️ Анықталған: ${features.slice(0, 3).join(", ")}\n` : "") +
    (description ? `\n💬 Азамат жазғаны: <i>${description.slice(0, 250)}</i>\n` : "") +
    `\n📋 Ұсыным: ${recommendation}\n` +
    `🌐 <a href="https://jaiyq.vercel.app/moderation">Веб-панельде ашу</a>\n` +
    `\n🆔 <code>${reportId}</code>`;

  const reply_markup = {
    inline_keyboard: [[
      { text: "✅ Растау",    callback_data: `confirm:${reportId}` },
      { text: "🔍 Тексеруде", callback_data: `inspect:${reportId}` },
      { text: "❌ Өшіру",     callback_data: `reject:${reportId}`  },
    ]],
  };

  try {
    if (photoUrl.startsWith("http")) {
      await sendPhoto(modChatId, photoUrl, text, { reply_markup });
    } else {
      await sendMessage(modChatId, text, { reply_markup });
    }
  } catch (e) {
    console.error("Telegram notify error:", e);
  }
}

// ─── Ecology expert (GPT-4o-mini) ────────────────────────────────────────

async function fetchLiveContext(): Promise<string> {
  try {
    const [airRes, metRes] = await Promise.all([
      fetch("https://air-quality-api.open-meteo.com/v1/air-quality?latitude=47.1167&longitude=51.9014&current=pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,european_aqi", { cache: "no-store" }),
      fetch("https://api.open-meteo.com/v1/forecast?latitude=47.1167&longitude=51.9014&current=temperature_2m,relative_humidity_2m,wind_speed_10m&daily=precipitation_sum&past_days=7&forecast_days=1&timezone=auto", { cache: "no-store" }),
    ]);
    const air = airRes.ok ? await airRes.json() : null;
    const met = metRes.ok  ? await metRes.json()  : null;
    const rain7 = (met?.daily?.precipitation_sum ?? []).reduce((a: number, x: number) => a + (x ?? 0), 0);
    return [
      air ? `Ауа сапасы (Copernicus CAMS, қазір): EU AQI=${air.current?.european_aqi}, PM2.5=${air.current?.pm2_5} мкг/м³, NO₂=${air.current?.nitrogen_dioxide}, SO₂=${air.current?.sulphur_dioxide}.` : "",
      met ? `Ауа райы (Open-Meteo): ${met.current?.temperature_2m}°C, ылғалдылық ${met.current?.relative_humidity_2m}%, жел ${met.current?.wind_speed_10m} км/сағ, соңғы 7 күндегі жауын-шашын ${rain7.toFixed(1)} мм.` : "",
    ].filter(Boolean).join(" ");
  } catch {
    return "";
  }
}

const ECO_EXPERT_SYSTEM = `Сен Атырау облысының тәжірибелі экология маманысың. Азаматтардың экологиялық сұрақтарына жауап бересің.

Атырау облысы туралы негізгі деректер:
— Каспий теңізінің солтүстік жағалауында орналасқан
— Жайық (Орал) өзені қаланы екіге бөледі; тасқын мамыр-маусымда болады
— Теңіз және Қашаған — әлемдегі ең ірі мұнай кен орындарының бірі
— Басты экологиялық мәселелер: мұнай ластануы, газ факелдері, топырақ тұздануы, Жайық жайылмасындағы маса белсенділігі
— Облыс халқы — шамамен 650 мың адам

Жауап беру ережелері:
— Тек дәл, ғылыми негізделген ақпарат бер
— Жауап қазақ тілінде, анық, 2–4 сөйлем болсын
— Берілген тірі деректерді (ауа сапасы, температура) жауапта қолдан
— Білмейтін жағдайда "нақты деректер жоқ, ресми органға жүгін" де
— Азаматты фото хабарлама жіберуге бағытта: jaiyq.vercel.app/report`;

async function expertReply(userText: string, liveCtx: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return "AI жауабы уақытша қолжетімсіз.";
  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 350,
      messages: [
        { role: "system", content: ECO_EXPERT_SYSTEM + (liveCtx ? `\n\nҚАЗІРГІ ТІРІ ДЕРЕКТЕР: ${liveCtx}` : "") },
        { role: "user", content: userText },
      ],
    });
    return completion.choices[0].message.content?.trim() ?? "Жауап алу мүмкін болмады.";
  } catch {
    return "Сервер уақытша бос емес. Сәл кейін қайталап көріңіз.";
  }
}

// ─── Forward citizen conversation to moderator ───────────────────────────
// [uid:CHAT_ID] is embedded so the moderator's Reply is routed back correctly.

async function forwardToModerator(citizenChatId: number, fromUsername: string, question: string, answer: string) {
  const modChatId = process.env.TELEGRAM_MODERATOR_CHAT_ID;
  if (!BOT || !modChatId) return;

  const text =
    `💬 <b>Азамат сұрақ қойды</b>\n` +
    `👤 ${fromUsername ? `@${fromUsername}` : "аты белгісіз"}\n\n` +
    `❓ <i>${question.slice(0, 300)}</i>\n\n` +
    `🤖 Бот берген жауап:\n${answer.slice(0, 500)}\n\n` +
    `<i>Жауапқа Reply жасасаңыз — хабарыңыз азаматқа тікелей жетеді.</i>\n` +
    `[uid:${citizenChatId}]`;

  try {
    await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: modChatId, text, parse_mode: "HTML" }),
    });
  } catch (e) {
    console.error("forwardToModerator error:", e);
  }
}

async function fetchAir() {
  try {
    const r = await fetch("https://air-quality-api.open-meteo.com/v1/air-quality?latitude=47.1167&longitude=51.9014&current=pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,european_aqi", { cache: "no-store" });
    if (!r.ok) return null;
    const d = await r.json();
    return { aqi: d.current?.european_aqi ?? null, pm25: d.current?.pm2_5 ?? null, pm10: d.current?.pm10 ?? null, no2: d.current?.nitrogen_dioxide ?? null };
  } catch { return null; }
}

async function fetchMosquito() {
  try {
    const r = await fetch("https://api.open-meteo.com/v1/forecast?latitude=47.1167&longitude=51.9014&current=temperature_2m,relative_humidity_2m&daily=precipitation_sum&past_days=7&forecast_days=1&timezone=auto", { cache: "no-store" });
    if (!r.ok) return null;
    const d = await r.json();
    const temp = d.current?.temperature_2m ?? 0;
    const hum  = d.current?.relative_humidity_2m ?? 0;
    const rain = (d.daily?.precipitation_sum ?? []).reduce((a: number, x: number) => a + (x ?? 0), 0);
    const base = Math.round(((temp >= 25 ? 1 : temp >= 15 ? 0.6 : 0.2) * 0.35 + (hum >= 70 ? 1 : hum >= 50 ? 0.6 : 0.2) * 0.25 + (rain > 20 ? 1 : rain > 5 ? 0.6 : 0.1) * 0.4) * 100);
    return { index: Math.min(100, Math.round(base * 1.35)), temp, hum, rain: +rain.toFixed(1) };
  } catch { return null; }
}

// ─── Webhook ──────────────────────────────────────────────────────────────

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    from?: { username?: string };
    text?: string;
    reply_to_message?: { text?: string; caption?: string };
  };
  callback_query?: {
    id: string;
    message: { message_id: number; chat: { id: number } };
    data?: string;
  };
}

export async function POST(req: Request) {
  if (!BOT) return NextResponse.json({ ok: false });

  let update: TelegramUpdate;
  try { update = await req.json(); } catch { return NextResponse.json({ ok: false }); }

  // ── Moderator button tap (confirm / inspect / reject) ──
  if (update.callback_query) {
    const cq = update.callback_query;
    const [action, reportId] = (cq.data ?? "").split(":");
    if (!reportId) { await answerCallback(cq.id, "Қате: ID табылмады"); return NextResponse.json({ ok: true }); }

    const statusMap: Record<string, string> = { confirm: "confirmed", inspect: "unconfirmed", reject: "contradicted" };
    const labelMap:  Record<string, string> = {
      confirm: "✅ Расталды — картада жасыл белгі қойылды",
      inspect: "🔍 Тексеруге жіберілді",
      reject:  "❌ Хабарлама өшірілді",
    };

    const newStatus = statusMap[action];
    if (!newStatus) { await answerCallback(cq.id, "Белгісіз әрекет"); return NextResponse.json({ ok: true }); }

    let dbOk = false;
    if (supabase) {
      if (action === "reject") {
        const { error } = await supabase.from("reports").delete().eq("id", reportId);
        dbOk = !error;
      } else {
        const { error } = await supabase.from("reports").update({ verification_status: newStatus }).eq("id", reportId);
        dbOk = !error;
      }
    }

    await answerCallback(cq.id, labelMap[action]);
    await removeButtons(cq.message.chat.id, cq.message.message_id);
    await sendMessage(
      cq.message.chat.id,
      `${labelMap[action]}\n🆔 <code>${reportId}</code>\n` +
      (dbOk ? "✅ Дерекқор жаңартылды" : "⚠️ Дерекқор жаңартылмады")
    );
    return NextResponse.json({ ok: true });
  }

  // ── Text message ──
  const msg = update.message;
  if (!msg?.text) return NextResponse.json({ ok: true });

  const chatId   = msg.chat.id;
  const username = msg.from?.username ?? "";
  const rawText  = msg.text.trim();
  const text     = rawText.toLowerCase();
  const modChatId = process.env.TELEGRAM_MODERATOR_CHAT_ID;

  // ── Moderator replies to a forwarded citizen message ──
  if (msg.reply_to_message && modChatId && String(chatId) === String(modChatId)) {
    const original = msg.reply_to_message.text ?? msg.reply_to_message.caption ?? "";
    const match = original.match(/\[uid:(\d+)\]/);
    if (match) {
      const citizenId = Number(match[1]);
      await sendMessage(citizenId, `👨‍💼 <b>Маман жауабы:</b>\n\n${rawText}`);
      await sendMessage(chatId, "✅ Жауабыңыз азаматқа жіберілді.");
      return NextResponse.json({ ok: true });
    }
  }

  // ── /start ──
  if (text.startsWith("/start")) {
    await sendMessage(chatId,
      `🌿 <b>Jaiyq — Атырау экологиялық мониторингі</b>\n\n` +
      `Сізге қандай көмек керек?\n\n` +
      `/ауа — Атырау қаласының қазіргі ауа сапасы\n` +
      `/маса — Маса белсенділігінің индексі\n\n` +
      `Немесе экология туралы кез келген сұрағыңызды жазыңыз — маман жауап береді.\n\n` +
      `📸 Ластану байқасаңыз: jaiyq.vercel.app/report`
    );
    return NextResponse.json({ ok: true });
  }

  // ── /ауа ──
  if (text === "/ауа" || text === "/air") {
    const air = await fetchAir();
    if (!air) {
      await sendMessage(chatId, "Ауа сапасы деректері қазір қолжетімсіз. Кейінірек қайталап көріңіз.");
    } else {
      const lbl = (air.aqi ?? 0) > 80 ? "🔴 Өте жаман" : (air.aqi ?? 0) > 50 ? "🟠 Нашар" : (air.aqi ?? 0) > 25 ? "🟡 Қанағаттанарлық" : "🟢 Жақсы";
      await sendMessage(chatId,
        `🌬 <b>Атырау қаласы — ауа сапасы</b>\n\n` +
        `EU AQI: <b>${air.aqi ?? "—"}</b> — ${lbl}\n` +
        `PM2.5: ${air.pm25 ?? "—"} мкг/м³\n` +
        `PM10:  ${air.pm10 ?? "—"} мкг/м³\n` +
        `NO₂:   ${air.no2 ?? "—"} мкг/м³\n\n` +
        `Дереккөз: Copernicus CAMS · нақты уақыт`
      );
    }
    return NextResponse.json({ ok: true });
  }

  // ── /маса ──
  if (text === "/маса" || text === "/mosquito") {
    const m = await fetchMosquito();
    if (!m) {
      await sendMessage(chatId, "Маса индексі деректері қазір қолжетімсіз. Кейінірек қайталап көріңіз.");
    } else {
      const lvl = m.index >= 70 ? "🔴 Жоғары" : m.index >= 40 ? "🟡 Орташа" : "🟢 Төмен";
      await sendMessage(chatId,
        `🦟 <b>Маса белсенділігінің индексі — Атырау</b>\n\n` +
        `Индекс: <b>${m.index}/100</b> — ${lvl}\n` +
        `Температура: ${m.temp}°C · Ылғалдылық: ${m.hum}%\n` +
        `7 күндегі жауын-шашын: ${m.rain} мм\n\n` +
        `Жайық өзенінің жайылмасы факторы есепке алынған.\n` +
        `Дереккөз: Open-Meteo`
      );
    }
    return NextResponse.json({ ok: true });
  }

  // ── Free text → ecology expert ──
  const liveCtx = await fetchLiveContext();
  const answer  = await expertReply(rawText, liveCtx);
  await sendMessage(chatId, answer);
  forwardToModerator(chatId, username, rawText, answer);

  return NextResponse.json({ ok: true });
}

// ─── Setup status ─────────────────────────────────────────────────────────

export async function GET() {
  const modId = process.env.TELEGRAM_MODERATOR_CHAT_ID;
  if (!BOT) {
    return NextResponse.json({
      configured: false,
      setup: [
        "1. TELEGRAM_BOT_TOKEN — @BotFather арқылы алынған токен",
        "2. TELEGRAM_MODERATOR_CHAT_ID — модератордың немесе топтың chat_id",
        "3. Вебхук: POST https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://jaiyq.vercel.app/api/telegram",
      ],
    });
  }
  return NextResponse.json({
    configured: true,
    moderatorConfigured: !!modId,
    status: modId ? "Дайын. Азаматтық хабарламалар модераторға автоматты жіберіледі." : "Бот жұмыс істейді, бірақ TELEGRAM_MODERATOR_CHAT_ID орнатылмаған.",
  });
}
