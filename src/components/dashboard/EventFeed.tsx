"use client";

import { useEffect, useState } from "react";
import { Activity, Loader2, MapPin, Scale } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLang } from "@/lib/i18n";
import { useRegion } from "@/store/useRegionStore";

// ОҚИҒАЛАР ТАСПАСЫ — нақты уақыттағы экологиялық оқиғалар.
//
// Түс кодтары: 🟥 заң нормасы асқан · 🟧 ескерту · 🟨 назар аудару.
// «Бәрі тыныш» деген жалған тыныштық болмауы үшін қолжетімсіз дереккөздер
// де ашық көрсетіледі.

type Severity = "critical" | "warning" | "notice" | "info";

interface EcoEvent {
  id: string; time: string; severity: Severity;
  layer: string; layerEmoji: string;
  title: string; value: string | null; detail: string;
  source: string; legal?: string; coords?: [number, number];
}

interface Data {
  fetchedAt: string;
  count: number;
  bySeverity: { critical: number; warning: number; notice: number };
  events: EcoEvent[];
  unavailable: string[];
  note: string;
}

const SEV: Record<Severity, { dot: string; border: string; label: string }> = {
  critical: { dot: "bg-red-500", border: "border-l-red-500", label: "норма асқан" },
  warning: { dot: "bg-orange-500", border: "border-l-orange-500", label: "ескерту" },
  notice: { dot: "bg-amber-400", border: "border-l-amber-400", label: "назар аудару" },
  info: { dot: "bg-emerald-500", border: "border-l-emerald-500", label: "ақпарат" },
};

function timeAgo(iso: string, tr: (s: string) => string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return tr("жаңа ғана");
  if (min < 60) return `${min} ${tr("мин бұрын")}`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ${tr("сағ бұрын")}`;
  const d = Math.round(h / 24);
  return `${d} ${tr("күн бұрын")}`;
}

export function EventFeed({ limit }: { limit?: number }) {
  const { tr } = useLang();
  const region = useRegion();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/events?region=${region.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [region.id]);

  const shown = limit ? data?.events.slice(0, limit) : data?.events;

  return (
    <Card className="border-white/10 bg-white/[0.02]">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm text-white">
          <Activity className="h-4 w-4 text-neutral-300" />
          {tr("Оқиғалар таспасы")}
          {data && (
            <span className="flex items-center gap-1.5 text-[10px]">
              {data.bySeverity.critical > 0 && (
                <span className="rounded-full border border-red-400/40 bg-red-500/15 px-1.5 py-0.5 text-red-200">
                  {data.bySeverity.critical} 🟥
                </span>
              )}
              {data.bySeverity.warning > 0 && (
                <span className="rounded-full border border-orange-400/30 bg-orange-500/10 px-1.5 py-0.5 text-orange-200">
                  {data.bySeverity.warning} 🟧
                </span>
              )}
            </span>
          )}
        </CardTitle>
        <p className="text-[11px] text-neutral-400">
          {tr("Әр оқиға — нақты дерек нүктесі, жаңалық емес")}
        </p>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-neutral-400">
            <Loader2 className="h-4 w-4 animate-spin" /> {tr("Жиналуда…")}
          </div>
        ) : error || !data ? (
          <p className="py-4 text-sm text-neutral-400">
            {tr("Дереккөздер уақытша қолжетімсіз")}
          </p>
        ) : !shown?.length ? (
          <div className="py-4">
            <p className="text-sm text-neutral-300">{tr("Тіркелген оқиға жоқ")}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
              {tr(
                "Бұл — барлық көрсеткіш норма шегінде және жаңа детекция жоқ дегенді " +
                "білдіреді. Дереккөз қолжетімсіз болса, ол төменде көрсетіледі."
              )}
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {shown.map((e) => {
              const s = SEV[e.severity];
              const open = expanded === e.id;
              return (
                <li key={e.id}>
                  <button
                    onClick={() => setExpanded(open ? null : e.id)}
                    className={`w-full rounded-r-lg border-l-2 bg-white/[0.02] px-2.5 py-2 text-left transition hover:bg-white/[0.05] ${s.border}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-[12px] text-neutral-100">
                            {e.layerEmoji} {e.title}
                          </span>
                          {e.value && (
                            <span className="text-[12px] font-semibold text-white">{e.value}</span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-neutral-500">
                          <span>{timeAgo(e.time, tr)}</span>
                          <span>·</span>
                          <span>{e.layer}</span>
                          {e.legal && (
                            <>
                              <span>·</span>
                              <span className="inline-flex items-center gap-0.5 text-red-300/80">
                                <Scale className="h-2.5 w-2.5" /> {e.legal}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {open && (
                      <div className="mt-2 space-y-1 border-t border-white/10 pt-2 text-[10px] leading-relaxed">
                        <p className="text-neutral-300">{e.detail}</p>
                        <p className="text-neutral-500">
                          {tr("Дереккөз")}: {e.source}
                        </p>
                        <p className="text-neutral-500">
                          {tr("Уақыты")}: {e.time.replace("T", " ").slice(0, 16)} UTC
                        </p>
                        {e.coords && (
                          <p className="inline-flex items-center gap-1 text-neutral-500">
                            <MapPin className="h-2.5 w-2.5" />
                            {e.coords[0].toFixed(4)}, {e.coords[1].toFixed(4)}
                          </p>
                        )}
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {data && data.unavailable.length > 0 && (
          <p className="mt-2.5 border-t border-white/10 pt-2 text-[10px] leading-relaxed text-amber-200/70">
            ⚠ {tr("Қолжетімсіз дереккөздер")}: {data.unavailable.join(", ")}.{" "}
            {tr("Бұл тектегі оқиғалар тізімде жоқ — «бәрі тыныш» дегенді білдірмейді.")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
