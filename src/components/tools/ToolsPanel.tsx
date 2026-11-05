"use client";

import { BarChart3, Bell, ClipboardList, Grid3x3, MessageSquareWarning, ShieldCheck, Wind } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useMapToolsStore, type ToolKey } from "@/store/useMapToolsStore";
import { AreaReportTool } from "./AreaReportTool";
import { TrajectoryTool } from "./TrajectoryTool";
import { JournalTool } from "./JournalTool";
import { ReviewTool } from "./ReviewTool";
import { WatchTool } from "./WatchTool";
import { PriorityTool } from "./PriorityTool";
import { ComplaintsTool } from "./ComplaintsTool";

const TOOLS: { key: ToolKey; label: string; who: string; icon: typeof BarChart3 }[] = [
  { key: "area", label: "Аймақ есебі", who: "ғалым · қызметкер", icon: BarChart3 },
  { key: "trajectory", label: "Ауа қайдан келді", who: "инспектор · ғалым", icon: Wind },
  { key: "journal", label: "Далалық журнал", who: "қызметкер · ғалым", icon: ClipboardList },
  { key: "review", label: "Детекцияны растау", who: "инспектор", icon: ShieldCheck },
  { key: "complaints", label: "Шағымдар картада", who: "инспектор · барлығы", icon: MessageSquareWarning },
  { key: "watch", label: "Менің аймақтарым", who: "барлығы", icon: Bell },
  { key: "priority", label: "Көгалдандыру басымдығы", who: "әкімдік", icon: Grid3x3 },
];

// Карта құралдары — қызметкер мен ғалымның жұмыс кеңістігі.
// Дизайн: docs/superpowers/specs/2026-11-04-map-tools-design.md
export function ToolsPanel() {
  const { tr } = useLang();
  const { tool, setTool } = useMapToolsStore();
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1.5" role="tablist" aria-label={tr("Құралдар")}>
        {TOOLS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} type="button" role="tab" aria-selected={tool === t.key} onClick={() => setTool(t.key)}
              className={`flex items-start gap-1.5 rounded-md border px-2 py-1.5 text-left text-sm ${tool === t.key ? "border-brand bg-brand/5" : "border-neutral-200 hover:bg-neutral-50"}`}>
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
              <span><span className="font-medium text-neutral-900">{tr(t.label)}</span><br /><span className="text-[11px] text-neutral-600">{tr(t.who)}</span></span>
            </button>
          );
        })}
      </div>
      <div role="tabpanel">
        {tool === "area" && <AreaReportTool />}
        {tool === "trajectory" && <TrajectoryTool />}
        {tool === "journal" && <JournalTool />}
        {tool === "review" && <ReviewTool />}
        {tool === "complaints" && <ComplaintsTool />}
        {tool === "watch" && <WatchTool />}
        {tool === "priority" && <PriorityTool />}
      </div>
    </div>
  );
}
