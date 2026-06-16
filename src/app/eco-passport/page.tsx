"use client";

import { useEffect, useState } from "react";
import { Printer, Leaf, Wind, Droplets, Bug, Flame, Mountain, AlertTriangle } from "lucide-react";

interface EnvData {
  current: {
    temperature: number | null;
    humidity: number | null;
    windSpeed: number | null;
    europeanAqi: number | null;
    pm2_5: number | null;
    pm10: number | null;
    no2: number | null;
    so2: number | null;
  };
}

const YEAR = new Date().getFullYear();
const TODAY = new Date().toLocaleDateString("kk-KZ", { year: "numeric", month: "long", day: "numeric" });

function riskLabel(score: number | null) {
  if (score === null) return { text: "Деректер жоқ", cls: "text-neutral-400" };
  if (score >= 70) return { text: "Критикалық", cls: "text-red-400" };
  if (score >= 50) return { text: "Жоғары", cls: "text-orange-400" };
  if (score >= 30) return { text: "Орташа", cls: "text-yellow-400" };
  return { text: "Төмен", cls: "text-emerald-400" };
}

function aqiLabel(aqi: number | null) {
  if (aqi === null) return { text: "Деректер жоқ", cls: "text-neutral-400" };
  if (aqi > 80) return { text: "Өте жаман", cls: "text-red-400" };
  if (aqi > 50) return { text: "Жаман", cls: "text-orange-400" };
  if (aqi > 25) return { text: "Қанағаттанарлық", cls: "text-yellow-400" };
  if (aqi > 10) return { text: "Жақсы", cls: "text-emerald-400" };
  return { text: "Өте жақсы", cls: "text-emerald-300" };
}

export default function EcoPassportPage() {
  const [env, setEnv] = useState<EnvData | null>(null);
  const [reports, setReports] = useState<number>(0);
  const [confirmed, setConfirmed] = useState<number>(0);
  const [flares, setFlares] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/environment")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setEnv(d))
      .catch(() => {});

    fetch("/api/reports")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.reports) return;
        setReports(d.reports.length);
        setConfirmed(d.reports.filter((r: { verification_status: string }) => r.verification_status === "confirmed").length);
      })
      .catch(() => {});

    fetch("/api/flares")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setFlares(d.flares?.length ?? 0))
      .catch(() => {});
  }, []);

  const aqi = env?.current?.europeanAqi ?? null;
  const aqiLbl = aqiLabel(aqi);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      {/* Action bar — hidden on print */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-white">Эко паспорт</h1>
          <p className="text-sm text-neutral-400">Атырау облысының жылдық экологиялық паспорты</p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20"
        >
          <Printer className="h-4 w-4" />
          PDF / басып шығару
        </button>
      </div>

      {/* Passport document */}
      <div
        className="space-y-5 rounded-xl border border-white/10 bg-white/[0.03] p-6 print:border-0 print:bg-white print:text-black print:shadow-none"
        id="passport-doc"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 pb-4 print:border-gray-200">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 print:text-green-700">
              <Leaf className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-widest">Jaiyq · Экологиялық мониторинг</span>
            </div>
            <h2 className="mt-1 text-xl font-bold text-white print:text-black">
              Атырау облысының экологиялық паспорты — {YEAR} жыл
            </h2>
            <p className="text-sm text-neutral-400 print:text-gray-500">
              Жасалған күні: {TODAY} · Деректер нақты уақытта
            </p>
          </div>
          <div className="text-right text-xs text-neutral-500 print:text-gray-400">
            <div>Дереккөздер:</div>
            <div>Copernicus CAMS</div>
            <div>Open-Meteo</div>
            <div>NASA FIRMS</div>
          </div>
        </div>

        {/* 1. Ауа сапасы */}
        <Section icon={Wind} title="Ауа сапасы" color="text-sky-400">
          <Row label="EU AQI (Copernicus CAMS, нақты)">
            <span className={`font-bold ${aqiLbl.cls}`}>{aqi ?? "—"} — {aqiLbl.text}</span>
          </Row>
          <Row label="PM2.5"><Val v={env?.current?.pm2_5} unit="µg/m³" warn={15} /></Row>
          <Row label="PM10"><Val v={env?.current?.pm10} unit="µg/m³" warn={50} /></Row>
          <Row label="NO₂"><Val v={env?.current?.no2} unit="µg/m³" warn={40} /></Row>
          <Row label="SO₂"><Val v={env?.current?.so2} unit="µg/m³" warn={125} /></Row>
          <Row label="Температура"><Val v={env?.current?.temperature} unit="°C" /></Row>
          <Row label="Ылғалдылық"><Val v={env?.current?.humidity} unit="%" /></Row>
          <Row label="Жел жылдамдығы"><Val v={env?.current?.windSpeed} unit="км/сағ" /></Row>
        </Section>

        {/* 2. Газ факелдері */}
        <Section icon={Flame} title="Газ факелдері (мұнай-газ саласы)" color="text-orange-400">
          <Row label="Анықталған жану нүктесі (соңғы 2 күн)">
            <span className={`font-bold ${(flares ?? 0) > 5 ? "text-orange-400" : "text-emerald-400"}`}>
              {flares === null ? "Жүктелуде…" : flares}
            </span>
          </Row>
          <Row label="Дереккөз">NASA FIRMS VIIRS (375 м ажыратымдылық)</Row>
          <Row label="Аймақ">Атырау облысы шекарасы ішінде ғана</Row>
        </Section>

        {/* 3. Азаматтық хабарламалар */}
        <Section icon={AlertTriangle} title="Азаматтық хабарламалар" color="text-yellow-400">
          <Row label="Жіберілген хабарламалар (барлық уақытта)">{reports}</Row>
          <Row label="AI растаған хабарламалар">
            <span className="font-bold text-emerald-400">{confirmed}</span>
          </Row>
          <Row label="Расталу пайызы">
            {reports > 0 ? `${Math.round((confirmed / reports) * 100)}%` : "—"}
          </Row>
        </Section>

        {/* 4. Экологиялық жалпы баға */}
        <Section icon={Mountain} title="Жалпы экологиялық жағдай" color="text-emerald-400">
          <Row label="Платформа бағасы">
            {(() => {
              if (aqi === null) return <span className="text-neutral-400">Деректер жоқ</span>;
              const r = aqi > 50 ? 65 : aqi > 25 ? 40 : 20;
              const lbl = riskLabel(r);
              return <span className={`font-bold ${lbl.cls}`}>{lbl.text} ({r}/100)</span>;
            })()}
          </Row>
          <Row label="Деградациялық тренд">Мониторинг жүргізілуде</Row>
          <Row label="Ұсыныс">
            {(aqi ?? 0) > 50
              ? "Ауа сапасы нашар — сезімтал топтарға сыртқа шықпаған дұрыс"
              : "Қазіргі жағдай қалыпты деңгейде — мониторингті жалғастыру ұсынылады"}
          </Row>
        </Section>

        {/* Footer */}
        <div className="border-t border-white/10 pt-4 text-xs text-neutral-500 print:border-gray-200 print:text-gray-400">
          <p>
            Бұл паспорт <b className="text-white print:text-black">Jaiyq</b> платформасының нақты уақыттағы
            ресми дереккөздерден (Copernicus CAMS, Open-Meteo, NASA FIRMS) алынған деректер негізінде
            автоматты жасалады. Жалған дерек қолданылмайды.
          </p>
          <p className="mt-1">
            Платформа: Атырау облысы · jaiyq.vercel.app · Hakaton жобасы
          </p>
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .print\\:hidden { display: none !important; }
          .print\\:text-black { color: black !important; }
          .print\\:text-gray-500 { color: #6b7280 !important; }
          .print\\:text-gray-400 { color: #9ca3af !important; }
          .print\\:border-0 { border: none !important; }
          .print\\:border-gray-200 { border-color: #e5e7eb !important; }
          .print\\:bg-white { background: white !important; }
        }
      `}</style>
    </div>
  );
}

function Section({ icon: Icon, title, color, children }: { icon: React.ElementType; title: string; color: string; children: React.ReactNode }) {
  return (
    <div>
      <div className={`mb-2 flex items-center gap-2 text-sm font-semibold ${color} print:text-black`}>
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <div className="rounded-lg border border-white/5 bg-white/[0.03] print:border-gray-100 print:bg-gray-50">
        {children}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/5 px-3 py-2 last:border-0 print:border-gray-100">
      <span className="text-xs text-neutral-400 print:text-gray-500">{label}</span>
      <span className="text-right text-xs text-white print:text-black">{children}</span>
    </div>
  );
}

function Val({ v, unit, warn }: { v: number | null | undefined; unit: string; warn?: number }) {
  if (v === null || v === undefined) return <span className="text-neutral-400">—</span>;
  const isWarn = warn !== undefined && v > warn;
  return (
    <span className={isWarn ? "font-bold text-orange-400" : "text-white print:text-black"}>
      {v} {unit}{isWarn ? " ⚠" : ""}
    </span>
  );
}
