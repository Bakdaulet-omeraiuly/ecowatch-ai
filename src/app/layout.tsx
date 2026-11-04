import type { Metadata, Viewport } from "next";
import {
  GOOGLE_VERIFICATION, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL, siteJsonLd,
} from "@/lib/seo";
import { PT_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import "mapbox-gl/dist/mapbox-gl.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FloatingReportButton } from "@/components/layout/FloatingReportButton";
import { DisclaimerBanner } from "@/components/layout/DisclaimerBanner";
import { StaleDataBanner } from "@/components/layout/StaleDataBanner";
import { Toaster } from "@/components/ui/sonner";
import { PWARegister } from "@/components/layout/PWARegister";
import { LanguageProvider } from "@/lib/i18n";
import { SkipLink } from "@/components/layout/SkipLink";
import { ScaleScope } from "@/components/layout/ScaleScope";
import { AppFrame } from "@/components/layout/AppFrame";

// PT Sans: кириллица мен қазақ әріптері (Ә, І, Ң, Ғ, Ү, Ұ, Қ, Ө, Һ) бар
const ptSans = PT_Sans({
  variable: "--font-pt-sans",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  weight: ["400", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // metadataBase БОЛМАСА OG-суреті мен canonical сілтемелері салыстырмалы
  // болып қалады да, әлеуметтік желілер оларды аша алмайды.
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    // Ішкі беттер өз атауын береді, ол осы үлгіге түседі
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "экология", "ауа сапасы", "Атырау", "Қазақстан", "Каспий", "мониторинг",
    "ШРК", "Қазгидромет", "спутник", "Copernicus", "Sentinel", "экологиялық карта",
  ],
  authors: [{ name: SITE_NAME }],
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Jaiyq" },
  icons: { apple: "/apple-icon.png" },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "kk_KZ",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: SITE_TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og.png"],
  },
  // Google Search Console растауы — `<meta name="google-site-verification">`
  // тегін Next.js өзі шығарады
  verification: { google: GOOGLE_VERIFICATION },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

export const viewport: Viewport = {
  themeColor: "#0b3a6b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="kk"
      className={`${ptSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Құрылымдық дерек (JSON-LD) — Google-ге «бұл қандай сайт, қандай
            ұйым, қандай деректер жиынтығы» дегенді түсіндіреді. Ойдан
            ештеңе жазылмаған: бәрі жобаның нақты сипаттамасы. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd()) }}
        />
      </head>
      <body className="flex min-h-full flex-col bg-white text-neutral-900">
        <LanguageProvider>
          <SkipLink />
          <AppFrame>
            <Navbar />
            <main id="main" tabIndex={-1} className="flex min-h-0 flex-1 flex-col">
              <DisclaimerBanner />
              <StaleDataBanner />
              <ScaleScope>{children}</ScaleScope>
            </main>
            <Footer />
          </AppFrame>
          <FloatingReportButton />
          <Toaster position="top-center" richColors />
          <PWARegister />
        </LanguageProvider>
      </body>
    </html>
  );
}
