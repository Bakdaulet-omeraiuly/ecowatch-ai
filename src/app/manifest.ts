import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Jaiyq — Қазақстан мен Каспий жағалауының экологиялық мониторингі",
    short_name: "Jaiyq",
    description:
      "Спутник пен AI арқылы қоқыс, мұнай ластануы, жер деградациясы, ауа сапасы және маса тәуекелін бақылау",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#059669",
    lang: "kk",
    orientation: "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
