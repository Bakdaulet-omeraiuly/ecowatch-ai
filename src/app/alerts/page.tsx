"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { BellRing, Building2, CheckCircle2, MapPin, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useSitesStore } from "@/store/useSitesStore";
import { liveStatus, STATUS_UI } from "@/lib/alerts";
import { RISK_COLORS, RISK_LABELS_KZ } from "@/lib/risk";
import type { AlertStatus } from "@/types/site";

const PIPELINE: AlertStatus[] = ["sent", "acknowledged", "inspecting", "resolved"];

export default function AlertsPage() {
  const userAlerts = useSitesStore((s) => s.alerts);
  const resolveAlert = useSitesStore((s) => s.resolveAlert);

  const all = useMemo(
    () => [...userAlerts].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [userAlerts]
  );

  const counts = useMemo(() => {
    const c = { sent: 0, acknowledged: 0, inspecting: 0, resolved: 0 };
    all.forEach((a) => c[liveStatus(a)]++);
    return c;
  }, [all]);

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <BellRing className="h-6 w-6 text-red-400" /> Хабарлау орталығы
        </h1>
        <p className="text-sm text-neutral-400">
          Тәуекелі жоғары нүктелер бойынша жауапты органдарға автоматты жіберілген хабарламалар
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {PIPELINE.map((st) => (
          <Card key={st} className="border-white/10 bg-white/[0.03]">
            <CardContent className="pt-3 pb-3 text-center">
              <div className="text-xl font-bold text-white">{counts[st]}</div>
              <div className={`mx-auto mt-1 w-fit rounded-full px-2 py-0.5 text-[10px] ${STATUS_UI[st].cls}`}>
                {STATUS_UI[st].label}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {all.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-10 text-center text-sm text-neutral-400">
          Әзірге ескертулер жоқ. Картада талдау жасаңыз — тәуекелі жоғары (55+) нүктелер бойынша
          хабарламалар осында автоматты пайда болады.
        </div>
      )}

      <div className="space-y-3">
        {all.map((alert, i) => {
          const status = liveStatus(alert);
          const stepIdx = PIPELINE.indexOf(status);
          const isUserAlert = userAlerts.some((a) => a.id === alert.id);
          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.05, 0.5) }}
            >
              <Card className="border-white/10 bg-white/[0.03]">
                <CardContent className="space-y-3 pt-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge
                          style={{
                            backgroundColor: `${RISK_COLORS[alert.riskLevel]}22`,
                            color: RISK_COLORS[alert.riskLevel],
                          }}
                        >
                          {RISK_LABELS_KZ[alert.riskLevel]} · {alert.riskScore}
                        </Badge>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_UI[status].cls}`}>
                          {STATUS_UI[status].label}
                        </span>
                      </div>
                      <h3 className="mt-1.5 text-sm font-semibold text-white">{alert.siteName}</h3>
                      <p className="flex items-center gap-1 text-xs text-neutral-500">
                        <MapPin className="h-3 w-3" /> {alert.lat.toFixed(4)}, {alert.lng.toFixed(4)} ·{" "}
                        {new Date(alert.createdAt).toLocaleDateString("kk-KZ")}
                      </p>
                    </div>
                    {isUserAlert && status !== "resolved" && (
                      <Button size="sm" variant="outline" onClick={() => resolveAlert(alert.id)}>
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Шешілді деп белгілеу
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 rounded-lg bg-white/5 p-2.5 text-xs text-neutral-300">
                    <Building2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    <div>
                      <b className="text-white">{alert.recipient}</b>
                      <div className="text-neutral-400">{alert.reason}</div>
                    </div>
                  </div>

                  {/* Status pipeline */}
                  <div className="flex items-center gap-1">
                    {PIPELINE.map((st, idx) => (
                      <div key={st} className="flex flex-1 items-center gap-1">
                        <div
                          className={`h-1.5 flex-1 rounded-full ${
                            idx <= stepIdx ? "bg-emerald-500" : "bg-white/10"
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-[10px] text-neutral-500">
                    <span className="flex items-center gap-1">
                      <Send className="h-3 w-3" /> Жіберілді
                    </span>
                    <span>Қабылданды</span>
                    <span>Тексеруде</span>
                    <span>Шешілді</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <p className="text-center text-[11px] text-neutral-600">
        Демо режимі: хабарламалар жүйе ішінде модельденеді. Өндірісте — e-eGov / email / Telegram
        интеграциясы арқылы нақты жіберіледі.
      </p>
    </div>
  );
}
