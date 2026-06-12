import { NextResponse } from "next/server";
import OpenAI from "openai";

export const revalidate = 86400; // refresh once a day

interface Article {
  title: string;
  titleKz: string;
  summaryKz: string;
  link: string;
  source: string;
  date: string;
}

const FEEDS = [
  { url: "https://www.sciencedaily.com/rss/earth_climate/pollution.xml", source: "ScienceDaily" },
  { url: "https://phys.org/rss-feed/earth-news/environment/", source: "Phys.org" },
];

const FALLBACK: Article[] = [
  {
    title: "Satellite monitoring reveals expanding oil contamination zones",
    titleKz: "Спутниктік мониторинг мұнай ластану аймақтарының кеңеюін көрсетті",
    summaryKz: "Жаңа зерттеу спутник деректері арқылы мұнай өндіру аймақтарындағы ластанудың таралу динамикасын талдайды.",
    link: "https://www.sciencedaily.com/news/earth_climate/pollution/",
    source: "ScienceDaily",
    date: new Date().toISOString(),
  },
  {
    title: "Caspian Sea level decline threatens coastal ecosystems",
    titleKz: "Каспий теңізі деңгейінің төмендеуі жағалау экожүйелеріне қауіп төндіреді",
    summaryKz: "Ғалымдар Каспий теңізінің тартылуы жағалаудағы биоалуантүрлілікке әсерін зерттеп жатыр.",
    link: "https://phys.org/tags/caspian+sea/",
    source: "Phys.org",
    date: new Date().toISOString(),
  },
  {
    title: "AI models improve detection of illegal waste dumping",
    titleKz: "AI модельдері заңсыз қоқыс тастауды анықтауды жетілдіреді",
    summaryKz: "Машиналық оқыту әдістері спутник суреттерінен заңсыз полигондарды табу дәлдігін арттырады.",
    link: "https://www.sciencedaily.com/news/earth_climate/environmental_issues/",
    source: "ScienceDaily",
    date: new Date().toISOString(),
  },
];

// Module-level daily cache (survives between requests on the same instance)
let cache: { at: number; articles: Article[] } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.at < 86400_000) {
    return NextResponse.json({ articles: cache.articles, cached: true });
  }

  try {
    const raw: { title: string; link: string; date: string; desc: string; source: string }[] = [];
    for (const feed of FEEDS) {
      try {
        const res = await fetch(feed.url, { next: { revalidate: 86400 }, headers: { "User-Agent": "EcoWatchAI/1.0" } });
        if (!res.ok) continue;
        const xml = await res.text();
        const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/g) ?? [];
        for (const block of itemBlocks.slice(0, 4)) {
          const pick = (tag: string) =>
            (block.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`))?.[1] ?? "").trim();
          const title = pick("title");
          const link = pick("link");
          if (title && link)
            raw.push({
              title,
              link,
              date: pick("pubDate") || new Date().toISOString(),
              desc: pick("description").replace(/<[^>]+>/g, "").slice(0, 300),
              source: feed.source,
            });
        }
      } catch {
        // skip failing feed
      }
    }

    if (raw.length === 0) {
      return NextResponse.json({ articles: FALLBACK, fallback: true });
    }

    const top = raw.slice(0, 6);
    let articles: Article[];

    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      const openai = new OpenAI({ apiKey });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "Сен ғылыми мақалаларды қазақшаға аударып, қысқаша түйіндейтін көмекшісің. Тек JSON қайтар.",
          },
          {
            role: "user",
            content: `Мына мақалалардың әрқайсысына қазақша атау (titleKz) және 1-2 сөйлемдік қазақша түйін (summaryKz) жаз. JSON: {"items":[{"titleKz":"...","summaryKz":"..."}]} — реті сақталсын. Мақалалар: ${JSON.stringify(top.map((t) => ({ title: t.title, desc: t.desc })))}`,
          },
        ],
      });
      const translated = JSON.parse(completion.choices[0].message.content ?? '{"items":[]}').items ?? [];
      articles = top.map((t, i) => ({
        title: t.title,
        titleKz: translated[i]?.titleKz ?? t.title,
        summaryKz: translated[i]?.summaryKz ?? t.desc,
        link: t.link,
        source: t.source,
        date: t.date,
      }));
    } else {
      articles = top.map((t) => ({
        title: t.title,
        titleKz: t.title,
        summaryKz: t.desc,
        link: t.link,
        source: t.source,
        date: t.date,
      }));
    }

    cache = { at: Date.now(), articles };
    return NextResponse.json({ articles });
  } catch (err) {
    console.error("Articles error:", err);
    return NextResponse.json({ articles: FALLBACK, fallback: true });
  }
}
