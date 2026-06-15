"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";

// Trash detection via Roboflow hosted model (trash-detection). Boxes are
// returned in image-pixel coordinates and drawn on a canvas overlay.

interface Detection {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
  label: string;
  score: number;
}

const LABEL_KZ: Record<string, string> = {
  garbage: "қоқыс",
  trash: "қоқыс",
  litter: "қалдық",
};

export function WasteDetector({ photo }: { photo: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [detections, setDetections] = useState<Detection[]>([]);

  const run = async () => {
    setStatus("loading");
    try {
      const res = await fetch("/api/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: photo }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDetections(data.predictions ?? []);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => {
    if (status === "done") draw(detections);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, detections]);

  const draw = (results: Detection[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = new Image();
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      ctx.lineWidth = Math.max(2, img.naturalWidth / 250);
      ctx.font = `bold ${Math.max(13, img.naturalWidth / 40)}px sans-serif`;
      for (const d of results) {
        ctx.strokeStyle = "#f97316";
        ctx.strokeRect(d.xmin, d.ymin, d.xmax - d.xmin, d.ymax - d.ymin);
        const text = `${LABEL_KZ[d.label] ?? d.label} ${Math.round(d.score * 100)}%`;
        ctx.fillStyle = "#f97316";
        const tw = ctx.measureText(text).width + 8;
        ctx.fillRect(d.xmin, Math.max(0, d.ymin - 22), tw, 22);
        ctx.fillStyle = "#000";
        ctx.fillText(text, d.xmin + 4, Math.max(15, d.ymin - 6));
      }
    };
    img.src = photo;
  };

  return (
    <div className="space-y-2">
      {status === "idle" && (
        <Button variant="outline" size="sm" onClick={run} className="w-full">
          <ScanSearch className="mr-1 h-4 w-4" /> AI детектормен қоқысты анықтау
        </Button>
      )}
      {status === "loading" && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 py-3 text-sm text-neutral-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Қоқыс детекторы талдап жатыр…
        </div>
      )}
      {status === "error" && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
          Детектор уақытша қолжетімсіз. Қайталап көріңіз.
        </p>
      )}
      {status === "done" && (
        <>
          <canvas ref={canvasRef} className="w-full rounded-lg border border-white/10" />
          <div className="rounded-lg bg-white/5 p-2 text-xs text-neutral-300">
            {detections.length > 0 ? (
              <>
                <b className="text-orange-300">{detections.length}</b> қоқыс аймағы анықталды
                {detections.length > 0 &&
                  ` · орташа сенімділік ${Math.round((detections.reduce((a, d) => a + d.score, 0) / detections.length) * 100)}%`}
              </>
            ) : (
              "Қоқыс анықталмады — фото басқа нысанды көрсетуі мүмкін."
            )}
          </div>
          <p className="text-[10px] text-neutral-500">
            Roboflow trash-detection моделі (нақты қоқыс датасетінде оқытылған).
          </p>
        </>
      )}
    </div>
  );
}
