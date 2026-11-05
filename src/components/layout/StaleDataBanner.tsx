"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { oldest, staleAge } from "@/lib/staleData";

// P3.6: shown when the service worker answered from the offline cache (or the
// browser is offline). States the age of the OLDEST cached value on the page.
export function StaleDataBanner() {
  const { tr } = useLang();
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "jaiyq-stale" && typeof e.data.cachedAt === "number") {
        setCachedAt((c) => oldest(c, e.data.cachedAt)); setNow(Date.now());
      }
    };
    const onOff = () => setOffline(true);
    const onOn = () => { setOffline(false); setCachedAt(null); };
    navigator.serviceWorker?.addEventListener("message", onMsg);
    window.addEventListener("offline", onOff);
    window.addEventListener("online", onOn);
    const t = window.setInterval(() => setNow(Date.now()), 60e3);
    return () => {
      navigator.serviceWorker?.removeEventListener("message", onMsg);
      window.removeEventListener("offline", onOff);
      window.removeEventListener("online", onOn);
      window.clearInterval(t);
    };
  }, []);

  if (!offline && cachedAt === null) return null;
  const age = cachedAt === null ? null : staleAge(cachedAt, now);
  const unit = age && tr(age.unit === "min" ? "мин" : age.unit === "h" ? "сағ" : "күн");
  return (
    <div role="status" className="border-b border-neutral-300 bg-white px-4 py-2 text-sm text-amber-900 border-l-4 border-l-amber-600">
      <div className="mx-auto flex max-w-6xl items-start gap-2">
        <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>
          <strong>{tr("Ескірген дерек")}:</strong>{" "}
          {age
            ? `${tr("желі жоқ немесе әлсіз — кейбір мәндер кэштен көрсетілген, ең ескісі")} ${age.value} ${unit} ${tr("бұрын алынған")}.`
            : tr("желі жоқ — жаңа деректер жүктелмейді; кэште жоқ мән «дерек жоқ» деп көрсетіледі.")}
        </p>
      </div>
    </div>
  );
}
