import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { FACILITIES } from "@/data/facilities";

// sitemap.xml — Google-ге сайттың барлық беті туралы бірден хабарлайды.
//
// НЕГЕ КЕРЕК: карта беті ауыр JS болғандықтан бот ішкі сілтемелерді толық
// аралап шықпауы мүмкін. Sitemap болса — беттерді іздеп жүрудің қажеті жоқ.
//
// `priority` — беттің салыстырмалы маңызы, `changeFrequency` — жаңару жиілігі.
// Тірі деректі беттер жиі жаңарады, құқықтық беттер сирек.

const STATIC: { path: string; priority: number; freq: MetadataRoute.Sitemap[0]["changeFrequency"] }[] = [
  { path: "", priority: 1.0, freq: "daily" },
  { path: "/map", priority: 0.9, freq: "hourly" },
  { path: "/dashboard", priority: 0.9, freq: "hourly" },
  { path: "/eco-passport", priority: 0.8, freq: "daily" },
  { path: "/methodology", priority: 0.8, freq: "weekly" },
  { path: "/methodology/jaiyq-mri", priority: 0.7, freq: "monthly" },
  { path: "/legislation", priority: 0.7, freq: "monthly" },
  { path: "/caspian", priority: 0.7, freq: "daily" },
  { path: "/alerts", priority: 0.6, freq: "hourly" },
  { path: "/compare", priority: 0.5, freq: "monthly" },
  { path: "/report", priority: 0.5, freq: "monthly" },
  { path: "/privacy", priority: 0.2, freq: "yearly" },
  { path: "/terms", priority: 0.2, freq: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const pages: MetadataRoute.Sitemap = STATIC.map((p) => ({
    url: `${SITE_URL}${p.path}`,
    lastModified: now,
    changeFrequency: p.freq,
    priority: p.priority,
  }));

  // Объект карталары — тізілімдегі әр кәсіпорынның жеке беті
  for (const f of FACILITIES) {
    pages.push({
      url: `${SITE_URL}/object/${f.id}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.6,
    });
  }
  return pages;
}
