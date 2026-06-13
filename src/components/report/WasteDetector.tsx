"use client";

import { useRef, useState } from "react";
import { Loader2, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";

// In-browser object detection (YOLO-family: YOLOS-tiny via transformers.js).
// Runs fully on-device — no server, no API key. Waste-relevant COCO classes
// are highlighted as detected litter.

interface Detection {
  score: number;
  label: string;
  box: { xmin: number; ymin: number; xmax: number; ymax: number };
}

// COCO classes that typically appear in litter / illegal dumping
const WASTE_LABELS = new Set([
  "bottle", "cup", "wine glass", "bowl", "vase", "handbag", "backpack",
  "suitcase", "book", "cell phone", "tin can", "can",
]);

const LABEL_KZ: Record<string, string> = {
  bottle: "бөтелке", cup: "стақан", "wine glass": "бокал", bowl: "ыдыс",
  vase: "құмыра", handbag: "сөмке", backpack: "рюкзак", suitcase: "чемодан",
  book: "қағаз/кітап", "cell phone": "техника", "tin can": "консерві банка", can: "банка",
};

// Lazy singleton detector
let detectorPromise: Promise<(img: string, opts?: object) => Promise<Detection[]>> | null = null;
async function getDetector() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const { pipeline } = await import("@huggingface/transformers");
      const pipe = await pipeline("object-detection", "Xenova/yolos-tiny");
      return pipe as unknown as (img: string, opts?: object) => Promise<Detection[]>;
    })();
  }
  return detectorPromise;
}

export function WasteDetector({ photo }: { photo: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [detections, setDetections] = useState<Detection[]>([]);

  const run = async () => {
    setStatus("loading");
    try {
      const detector = await getDetector();
      const results = await detector(photo, { threshold: 0.4, percentage: false });
      setDetections(results);
      draw(results);
      setStatus("done");
    } catch (e) {
      console.error("YOLO error:", e);
      setStatus("error");
    }
  };

  const draw = (results: Detection[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = new Image();
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      ctx.lineWidth = Math.max(2, img.naturalWidth / 300);
      ctx.font = `${Math.max(12, img.naturalWidth / 45)}px sans-serif`;
      for (const d of results) {
        const isWaste = WASTE_LABELS.has(d.label);
        const color = isWaste ? "#f97316" : "#38bdf8";
        const { xmin, ymin, xmax, ymax } = d.box;
        ctx.strokeStyle = color;
        ctx.strokeRect(xmin, ymin, xmax - xmin, ymax - ymin);
        const text = `${LABEL_KZ[d.label] ?? d.label} ${Math.round(d.score * 100)}%`;
        ctx.fillStyle = color;
        const tw = ctx.measureText(text).width + 8;
        ctx.fillRect(xmin, Math.max(0, ymin - 20), tw, 20);
        ctx.fillStyle = "#000";
        ctx.fillText(text, xmin + 4, Math.max(14, ymin - 5));
      }
    };
    img.src = photo;
  };

  const wasteCount = detections.filter((d) => WASTE_LABELS.has(d.label)).length;

  return (
    <div className="space-y-2">
      {status === "idle" && (
        <Button variant="outline" size="sm" onClick={run} className="w-full">
          <ScanSearch className="mr-1 h-4 w-4" /> YOLO арқылы қоқысты анықтау
        </Button>
      )}
      {status === "loading" && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 py-3 text-sm text-neutral-400">
          <Loader2 className="h-4 w-4 animate-spin" /> YOLO моделі жүктеліп, талдап жатыр…
        </div>
      )}
      {status === "error" && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
          Модель жүктелмеді. Интернетті тексеріп, қайталаңыз.
        </p>
      )}
      {status === "done" && (
        <>
          <canvas ref={canvasRef} className="w-full rounded-lg border border-white/10" />
          <div className="rounded-lg bg-white/5 p-2 text-xs text-neutral-300">
            <b className="text-orange-300">{wasteCount}</b> қоқысқа қатысты зат анықталды
            {detections.length > wasteCount && ` (барлығы ${detections.length} объект)`}.
            {wasteCount > 0 && (
              <span className="ml-1 text-neutral-400">
                {[...new Set(detections.filter((d) => WASTE_LABELS.has(d.label)).map((d) => LABEL_KZ[d.label] ?? d.label))].join(", ")}
              </span>
            )}
          </div>
          <p className="text-[10px] text-neutral-500">
            YOLOS-tiny моделі браузерде on-device жұмыс істейді (transformers.js). Қызғылт сары —
            қоқысқа қатысты, көк — басқа объект.
          </p>
        </>
      )}
    </div>
  );
}
