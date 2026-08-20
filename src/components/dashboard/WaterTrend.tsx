"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Waves, Loader2, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLang } from "@/lib/i18n";
import { TierBadge } from "@/components/ui/TierBadge";
import { ModuleMissing } from "@/components/ui/ModuleMissing";
import { hasModule } from "@/data/regions";
import { useRegion } from "@/store/useRegionStore";

interface Trend {
  river: string; unit: string; changePct: number; trend: string;
  yearly: { year: string; discharge: number }[];
}

export function WaterTrend() {
  const { tr } = useLang();
  const region = useRegion();
  const [data, setData] = useState<Trend | null>(null);
  const [error, setError] = useState(false);
  // Өзен нүктелерінің тізілімі жоқ аймақ — басқа өзеннің трендісі жарамсыз
  const missing = !hasModule(region, "riverFlow");
  // Қай аймақ үшін жүктелді — «жүктелуде» күйі осыдан шығарылады
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loading = !missing && loadedFor !== region.id;

  useEffect(() => {
    if (missing || loadedFor === region.id) return;
    fetch(`/api/water-trend?region=${region.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (d.error) { setData(null); setError(true); return; }
        setData(d);
        setError(false);
      })
      .catch(() => { setData(null); setError(true); })
      .finally(() => setLoadedFor(region.id));
  }, [region.id, missing, loadedFor]);

  const TrendIcon = data?.trend === "азайды" ? TrendingDown : data?.trend === "артты" ? TrendingUp : Minus;
  const trendCls = data?.trend === "азайды" ? "text-red-300" : data?.trend === "артты" ? "text-sky-300" : "text-neutral-300";

  return (
    <Card className="border-teal-500/20 bg-teal-500/[0.04]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-white">
          <TierBadge tier="model" />
          <Waves className="h-4 w-4 text-teal-400" />
          {data ? `${tr("Су деңгейінің өзгерісі")} — ${data.river} (2020→${tr("қазір")})` : tr("Су деңгейінің өзгерісі — өзен ағыны")}
        </CardTitle>
        <p className="text-[13px] text-neutral-400">
          {tr("Жылдық орташа өзен ағыны — GloFAS (Copernicus)")}
        </p>
      </CardHeader>
      <CardContent>
        {missing ? (
          <ModuleMissing module="riverFlow" region={region} />
        ) : loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-neutral-400">
            <Loader2 className="h-4 w-4 animate-spin" /> {tr("Жүктелуде…")}
          </div>
        ) : error || !data ? (
          <p className="py-4 text-sm text-neutral-400">
            {tr("Су деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді.")}
          </p>
        ) : (
          <>
            <div className="mb-2 flex items-center gap-2">
              <TrendIcon className={`h-5 w-5 ${trendCls}`} />
              <span className={`text-lg font-bold ${trendCls}`}>
                {data.changePct > 0 ? "+" : ""}{data.changePct}%
              </span>
              <span className="text-xs text-neutral-400">
                {tr("2020-дан бері ағын")} {tr(data.trend)}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={data.yearly} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: "#a3a3a3" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#a3a3a3" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#171717", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#fff" }}
                  formatter={(v) => [`${v} ${data.unit}`, tr("ағын")]}
                />
                <Bar dataKey="discharge" radius={[3, 3, 0, 0]}>
                  {data.yearly.map((_, i) => (
                    <Cell key={i} fill={i === data.yearly.length - 1 ? "#2dd4bf" : "#0d9488"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-1 text-[12px] text-neutral-400">
              {tr("river_discharge (m³/s) — өзен деңгейі/көлемінің нақты прокси-көрсеткіші. Дереккөз: GloFAS.")}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
