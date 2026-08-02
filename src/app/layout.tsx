import type { Metadata, Viewport } from "next";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL, siteJsonLd } from "@/lib/seo";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "mapbox-gl/dist/mapbox-gl.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FloatingReportButton } from "@/components/layout/FloatingReportButton";
import { DisclaimerBanner } from "@/components/layout/DisclaimerBanner";
import { Toaster } from "@/components/ui/sonner";
import { PWARegister } from "@/components/layout/PWARegister";
import { LanguageProvider } from "@/lib/i18n";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

export const viewport: Viewport = {
  themeColor: "#059669",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="kk"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
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
      <body className="flex min-h-full flex-col bg-neutral-950 text-neutral-100">
        <LanguageProvider>
          <Navbar />
          <main className="flex-1 pt-14">
            <DisclaimerBanner />
            {children}
          </main>
          <Footer />
          <FloatingReportButton />
          <Toaster position="top-center" richColors />
          <PWARegister />
        </LanguageProvider>
      </body>
    </html>
  );
}
