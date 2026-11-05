"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CheckCircle2, MapPin, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TierBadge } from "@/components/ui/TierBadge";
import { useSitesStore } from "@/store/useSitesStore";
import { liveStatus, STATUS_UI } from "@/lib/alerts";
import { RISK_COLORS, RISK_LABELS_KZ } from "@/lib/risk";
import { useLang } from "@/lib/i18n";

// Тәуекел ескертулері — ОСЫ браузерде AI талдауы жоғары тәуекел (55+) деп
// бағалаған нүктелер. Ешбір органға автоматты жіберілмейді; мәртебе тек
// пайдаланушының өз белгісі (ашық / шешілді). Органға жіберу — талдау
// панеліндегі «Тиісті органға жіберу» батырмасы (Telegram модераторы).
export default function AlertsPage() {
  const { tr, lang } = useLang();
  const alerts = useSitesStore((s) => s.alerts);
  const resolveAlert = useSitesStore((s) => s.resolveAlert);

  const all = useMemo(() => [...alerts].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)), [alerts]);
  const open = all.filter((a) => liveStatus(a) !== "resolved").length;
  const locale = lang === "ru" ? "ru-RU" : lang === "en" ? "en-GB" : "kk-KZ";

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:py-10">
      <header>
        <h1 className="text-2xl font-bold text-[#0b3a6b] sm:text-3xl">{tr("Тәуекел ескертулері")}</h1>
        <p className="mt-2 max-w-3xl text-sm text-neutral-700">
          {tr("Осы браузерде AI талдауы тәуекелі жоғары (55+) деп бағалаған нүктелер. Ешбір органға автоматты жіберілмейді — органға жіберу үшін картадағы талдау панелінде «Тиісті органға жіберу» батырмасын басыңыз.")}
        </p>
        <div className="mt-2"><TierBadge tier="ai" tone="light" /></div>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:max-w-sm">
        <div className="rounded-lg border border-neutral-300 bg-white p-3">
          <dt className="text-xs text-neutral-600">{tr("Ашық")}</dt>
          <dd className="text-2xl font-bold tabular-nums text-neutral-900">{open}</dd>
        </div>
        <div className="rounded-lg border border-neutral-300 bg-white p-3">
          <dt className="text-xs text-neutral-600">{tr("Шешілді")}</dt>
          <dd className="text-2xl font-bold tabular-nums text-neutral-900">{all.length - open}</dd>
        </div>
      </dl>

      {all.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-400 bg-neutral-50 p-8 text-center text-sm text-neutral-700">
          <p>{tr("Әзірге ескерту жоқ. Картада AI талдау жасағанда тәуекелі жоғары нүктелер осында сақталады.")}</p>
          <Link href="/map" className="mt-3 inline-flex min-h-[44px] items-center rounded border border-[#0b3a6b] px-4 font-bold text-[#0b3a6b] hover:bg-[#0b3a6b] hover:text-white">
            {tr("Картаны ашу")}
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {all.map((alert) => {
            const status = liveStatus(alert);
            return (
              <li key={alert.id} className="rounded-lg border border-neutral-300 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: `${RISK_COLORS[alert.riskLevel]}1f`, color: RISK_COLORS[alert.riskLevel] }}>
                        <TriangleAlert className="h-3 w-3" aria-hidden />{tr(RISK_LABELS_KZ[alert.riskLevel])} · {alert.riskScore}
                      </span>
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_UI[status].cls}`}>{tr(STATUS_UI[status].label)}</span>
                    </div>
                    <h2 className="mt-1.5 font-semibold text-neutral-900">{tr(alert.siteName)}</h2>
                    <p className="flex items-center gap-1 text-xs text-neutral-600">
                      <MapPin className="h-3 w-3" aria-hidden /> {alert.lat.toFixed(4)}, {alert.lng.toFixed(4)} · {new Date(alert.createdAt).toLocaleDateString(locale)}
                    </p>
                  </div>
                  {status !== "resolved" && (
                    <Button size="sm" variant="outline" onClick={() => resolveAlert(alert.id)}>
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" aria-hidden /> {tr("Шешілді деп белгілеу")}
                    </Button>
                  )}
                </div>
                <p className="mt-2 text-sm text-neutral-800">{tr(alert.reason)}</p>
                <p className="mt-1 text-xs text-neutral-600">{tr("Ұсынылатын жауапты орган")}: <b>{tr(alert.recipient)}</b></p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
