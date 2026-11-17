import { timingSafeEqual } from "node:crypto";

// Telegram webhook қорғанысы.
//
// Webhook URL-і жария, ал жаңарту денесіндегі chat.id-ді кез келген адам
// өзі жаза алады. Сондықтан «бұл модератор чаты ма» деген тексеріс жалғыз
// өзі ештеңе қорғамайды: сұраныстың Telegram-нан келгенін тек setWebhook
// кезінде берілген secret_token дәлелдейді (X-Telegram-Bot-Api-Secret-Token).

export type WebhookTrust = "verified" | "unverified" | "rejected";

export function webhookTrust(req: Request, secret = process.env.TELEGRAM_WEBHOOK_SECRET): WebhookTrust {
  if (!secret) return "unverified";
  const given = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b) ? "verified" : "rejected";
}

// parse_mode=HTML: қашырылмаған `<` Telegram-да 400 береді де, хабарлама
// үнсіз жоғалады (модератор шағымды көрмей қалады).
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Модератор жауабы қай азаматқа баратынын хабарламаның СОҢЫНДАҒЫ белгі
// анықтайды. Азамат сұрағының ішіне өзі жазған `[uid:…]` есепке алынбайды.
export function trailingCitizenId(text: string): number | null {
  const m = text.match(/\[uid:(\d{1,20})\]\s*$/);
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isSafeInteger(id) ? id : null;
}
