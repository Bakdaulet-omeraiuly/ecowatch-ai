import { NextResponse } from "next/server";
import OpenAI from "openai";
import { allow } from "@/lib/ratelimit";
import { getRegion } from "@/data/regions";

// AI «Неге?» — бүгін ауа неге осындай екенін тірі деректермен түсіндіреді.
// Барлық САНДАР нақты (Open-Meteo + CAMS). GPT тек сол сандарды сөзбен түсіндіреді,
// ойдан дерек қоспайды. Кілт жоқ болса — ереже негізіндегі түсіндірме қайтарады.

const W_URL = (lat: number, lng: number) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
  `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,surface_pressure&timezone=auto`;
const A_URL = (lat: number, lng: number) =>
  `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}` +
  `&current=pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,ozone,european_aqi`;

// Фондық деңгейлер (µg/m³) — «қалыптыдан жоғары» деп бағалау үшін.
// ⚠️ Бұл — ЖАЛПЫ фон, нақты қаланың өлшенген фоны емес. Сондықтан
// қорытындыда «көзі мынау» деп айтылмайды, тек «жоғары» деп белгіленеді.
const BASE = { no2: 12, so2: 5, pm2_5: 10, pm10: 20 };

interface Factor { label: string; detail: string; severity: "ok" | "warn" | "bad" }

export async function GET(req: Request) {
  if (!(await allow(req, "why"))) {
    return NextResponse.json({ error: "Тым көп сұраныс. Сәл кейін қайталаңыз." }, { status: 429 });
  }
  const region = getRegion(new URL(req.url).searchParams.get("region"));
  try {
    const [wRes, aRes] = await Promise.all([
      fetch(W_URL(region.lat, region.lng), { next: { revalidate: 1800 } }),
      fetch(A_URL(region.lat, region.lng), { next: { revalidate: 1800 } }),
    ]);
    if (!wRes.ok || !aRes.ok) throw new Error(`upstream ${wRes.status}/${aRes.status}`);
    const w = (await wRes.json()).current ?? {};
    const a = (await aRes.json()).current ?? {};

    const temp = w.temperature_2m ?? null;
    const wind = w.wind_speed_10m ?? null; // км/сағ
    const pressure = w.surface_pressure ?? null; // hPa
    const humidity = w.relative_humidity_2m ?? null;
    const aqi = a.european_aqi ?? null;
    const no2 = a.nitrogen_dioxide ?? null;
    const so2 = a.sulphur_dioxide ?? null;
    const pm2_5 = a.pm2_5 ?? null;
    const pm10 = a.pm10 ?? null;
    const ozone = a.ozone ?? null;

    // Нақты сандардан ереже негізінде факторларды есептеу (болжам емес, өлшенген)
    const factors: Factor[] = [];
    if (wind != null && wind < 8)
      factors.push({ label: "Жел әлсіз", detail: `${wind.toFixed(1)} км/сағ — ластаушылар шашырамай жиналады`, severity: "warn" });
    else if (wind != null && wind > 20)
      factors.push({ label: "Жел күшті", detail: `${wind.toFixed(0)} км/сағ — ауаны тазартады`, severity: "ok" });
    if (temp != null && temp >= 30)
      factors.push({ label: "Ыстық ауа", detail: `${temp.toFixed(0)}°C — озон мен ұшпа қосылыстар артады`, severity: "warn" });
    if (no2 != null && no2 > BASE.no2 * 2)
      factors.push({ label: "NO₂ жоғары", detail: `${no2.toFixed(0)} µg/m³ (қалыпты ~${BASE.no2}) — көлік/жану көзі`, severity: "bad" });
    if (so2 != null && so2 > BASE.so2 * 2)
      factors.push({ label: "SO₂ жоғары", detail: `${so2.toFixed(0)} µg/m³ (қалыпты ~${BASE.so2}) — мұнай өңдеу/жағу`, severity: "bad" });
    if (pm2_5 != null && pm2_5 > BASE.pm2_5 * 2)
      factors.push({ label: "PM₂.₅ жоғары", detail: `${pm2_5.toFixed(0)} µg/m³ — ұсақ шаң/түтін`, severity: "bad" });
    if (pressure != null && wind != null && pressure > 1018 && wind < 8)
      factors.push({ label: "Инверсия ықтимал", detail: `Жоғары қысым (${pressure.toFixed(0)} hPa) + әлсіз жел — ластану жерге жақын қалуы мүмкін`, severity: "warn" });

    const verdict = aqi == null ? "белгісіз" : aqi < 20 ? "жақсы" : aqi < 40 ? "орташа" : aqi < 60 ? "нашарлау" : "нашар";
    if (!factors.length)
      factors.push({ label: "Қалыпты жағдай", detail: "Ластаушылар қалыпты шекте, ауа-райы қолайлы", severity: "ok" });

    const measured = {
      aqi, temperature: temp, wind, pressure, humidity, no2, so2, pm2_5, pm10, ozone,
    };

    // GPT тек НАҚТЫ сандар мен факторларды сөзбен түсіндіреді
    const apiKey = process.env.OPENAI_API_KEY;
    let summary: string;
    if (apiKey) {
      try {
        const openai = new OpenAI({ apiKey });
        const c = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          max_tokens: 220,
          messages: [
            {
              role: "system",
              content:
                `Сен ${region.name} қаласының экология AI-сың. Саған тек НАҚТЫ өлшенген сандар мен алдын ала есептелген факторлар беріледі. Осы деректерге ғана сүйеніп, бүгін ауа неге осындай екенін 2-3 сөйлеммен, қарапайым қазақ тілінде түсіндір. Жаңа сан ойлап таппа, берілмеген факт қоспа.`,
            },
            {
              role: "user",
              content: `Өлшенген деректер: ${JSON.stringify(measured)}. Факторлар: ${factors.map((f) => `${f.label} (${f.detail})`).join("; ")}. Қорытынды баға: «${verdict}». Осыны 2-3 сөйлеммен түсіндір.`,
            },
          ],
        });
        summary = c.choices[0].message.content?.trim() || fallbackSummary(verdict, factors);
      } catch {
        summary = fallbackSummary(verdict, factors);
      }
    } else {
      summary = fallbackSummary(verdict, factors);
    }

    return NextResponse.json({
      fetchedAt: new Date().toISOString(),
      source: "Open-Meteo + Copernicus CAMS (нақты өлшеу)",
      region: { id: region.id, name: region.name },
      verdict, aqi, summary, factors, measured,
    });
  } catch (err) {
    console.error("Why error:", err);
    return NextResponse.json(
      { error: "Тірі деректер уақытша қолжетімсіз — жалған дерек көрсетілмейді." },
      { status: 503 }
    );
  }
}

function fallbackSummary(verdict: string, factors: Factor[]): string {
  return `Бүгінгі ауа сапасы — ${verdict}. Негізгі себептер: ${factors.map((f) => f.label.toLowerCase()).join(", ")}.`;
}
