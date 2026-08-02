import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// robots.txt — іздеу боты сайтқа келгенде БІРІНШІ осыны сұрайды.
// Бұған дейін файл мүлдем жоқ болатын.
//
// Қызметтік бағыттар индекстелмейді:
//   /api      — JSON эндпоинттер, іздеу нәтижесінде керегі жоқ
//   /moderation — азаматтық хабарламаларды тексеру беті (әкімшілік)

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/moderation"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
