"use client";

import { useLang } from "@/lib/i18n";
import { fmtAtyrau, MetaList } from "@/components/air/SourceBadge";

// CAMS моделінің алты өрісті метадерегі (дереккөз, бірлік, уақыт, жиілік, сапа,
// белгісіздік). Модель — өлшем емес: әр жерде осы жазба бар.
export function ModelCaption({
  fetchedAt,
  unit,
  tone = "light",
}: {
  fetchedAt: string | null | undefined;
  unit?: string | null;
  tone?: "light" | "dark";
}) {
  const { t, lang } = useLang();
  return (
    <MetaList
      tone={tone}
      rows={[
        { k: t("air.source"), v: "Copernicus CAMS · Open-Meteo" },
        { k: t("air.unit"), v: unit || "—" },
        { k: t("air.time.fetch"), v: fmtAtyrau(fetchedAt, lang) },
        { k: t("air.freq"), v: t("air.freq.hourly") },
        {
          k: t("air.quality"),
          v: (
            <>
              {t("air.q.model")} ·{" "}
              <a href="/validation" className="underline underline-offset-2 hover:text-[#0b3a6b]">
                {t("foot.validation")}
              </a>
            </>
          ),
        },
        { k: t("air.uncertainty"), v: t("air.u.notEst") },
      ]}
    />
  );
}
