import type { Metadata } from "next";

// ІЗДЕУ ЖҮЙЕЛЕРІ ҮШІН ОРТАҚ БАПТАУ (SEO).
//
// НЕГЕ КЕРЕК: бұған дейін 15 беттің тек біреуінде өз тақырыбы болатын.
// Қалғаны іздеу нәтижесінде бірдей жазумен шығатын — «Jaiyq — Атырау
// облысының экологиялық мониторингі» — сондықтан «эко-паспорт», «заңнама»,
// «аналитика» беттерін бір-бірінен ажырату мүмкін емес еді.
//
// Беттердің басым бөлігі `"use client"` болғандықтан олар `metadata`
// экспорттай алмайды. Шешім — әр бағытта кішкентай `layout.tsx` (сервер
// компоненті) тұрады да, тек метадеректі береді.

/** Сайттың канондық мекенжайы. Vercel-де айнымалымен ауыстыруға болады. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://ecojaiyq.com";

export const SITE_NAME = "Jaiyq";

export const SITE_TITLE =
  "Jaiyq — Қазақстан мен Каспий жағалауының экологиялық мониторингі";

export const SITE_DESCRIPTION =
  "Спутник деректері мен ресми модельдер арқылы ауа сапасын, су режимін, " +
  "өрт қаупін, топырақ деградациясын және маса тәуекелін бақылайтын ашық " +
  "платформа. Әр көрсеткіш ҚР гигиеналық нормативтерімен салыстырылады.";

/** Бүкіл сайтқа ортақ кілт сөздер — беттің өзінікі оған қосылады */
const BASE_KEYWORDS = [
  "экология", "ауа сапасы", "Атырау", "Қазақстан", "Каспий",
  "мониторинг", "ШРК", "Қазгидромет", "спутник", "Copernicus",
];

interface PageSeo {
  title: string;
  description: string;
  /** Бет мекенжайы, мыс. "/dashboard" */
  path: string;
  keywords?: string[];
  /** Индекстеуге жарамайды (қызметтік бет) */
  noindex?: boolean;
}

/**
 * Бет үшін толық метадерек жасау.
 *
 * `title` бүкіл сайттың атауымен бірігеді (layout-тағы `template` арқылы),
 * сондықтан мұнда тек беттің өз атауы жазылады.
 */
export function pageMeta({ title, description, path, keywords = [], noindex }: PageSeo): Metadata {
  const url = `${SITE_URL}${path}`;
  return {
    title,
    description,
    keywords: [...BASE_KEYWORDS, ...keywords],
    alternates: { canonical: url },
    openGraph: {
      title: `${title} · ${SITE_NAME}`,
      description,
      url,
      siteName: SITE_NAME,
      locale: "kk_KZ",
      type: "website",
      images: [{ url: "/og.png", width: 1200, height: 630, alt: SITE_TITLE }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · ${SITE_NAME}`,
      description,
      images: ["/og.png"],
    },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

/**
 * Іздеу жүйелеріне арналған құрылымдық дерек (JSON-LD).
 *
 * Google-ға «бұл не» дегенді түсіндіреді: ұйым, сайт және деректер
 * жиынтығы. Ойдан ештеңе жазылмаған — бәрі жобаның нақты сипаттамасы.
 */
export function siteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        inLanguage: "kk",
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#org`,
        name: SITE_NAME,
        url: SITE_URL,
        description:
          "Қазақстан мен Каспий жағалауының экологиялық мониторинг платформасы",
        areaServed: [
          { "@type": "Place", name: "Атырау облысы, Қазақстан" },
          { "@type": "Place", name: "Каспий теңізінің жағалауы" },
        ],
      },
      {
        "@type": "Dataset",
        "@id": `${SITE_URL}/#dataset`,
        name: "Jaiyq экологиялық көрсеткіштері",
        description:
          "Ауа сапасы, су режимі, өрт қаупі, құрғақшылық, топырақ және маса " +
          "тәуекелі бойынша сағат сайын жаңаратын ашық деректер. Дереккөздері: " +
          "Copernicus CAMS, Sentinel-1/2, ECMWF, GloFAS, NASA FIRMS.",
        inLanguage: "kk",
        isAccessibleForFree: true,
        creator: { "@id": `${SITE_URL}/#org` },
        spatialCoverage: { "@type": "Place", name: "Қазақстан, Каспий жағалауы" },
        distribution: [
          {
            "@type": "DataDownload",
            encodingFormat: "text/csv",
            contentUrl: `${SITE_URL}/api/export?dataset=air`,
          },
        ],
      },
    ],
  };
}
