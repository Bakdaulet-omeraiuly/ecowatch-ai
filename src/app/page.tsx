"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Satellite, Camera, LineChart, Bug, ArrowRight, Leaf,
  BookOpen, ExternalLink, Wind, MapPin, Bell, Shield,
  Droplets, Users, CheckCircle, ChevronRight, GitCompare,
  FileText, Sparkles, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLang } from "@/lib/i18n";
import { HeroBackground } from "@/components/layout/HeroBackground";
import { RegionPicker } from "@/components/layout/RegionPicker";
import { useRegion } from "@/store/useRegionStore";

interface Article {
  title: string;
  titleKz: string;
  summaryKz: string;
  link: string;
  source: string;
  date: string;
}

interface LiveStats {
  aqi: number | null;
  pm25: number | null;
  temp: number | null;
  humidity: number | null;
}

/* ── анимацияланған санағыш ───────────────────────────────────────── */
function AnimatedNum({ to }: { to: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (to <= 0) { setVal(0); return; }
    let cur = 0;
    const step = Math.max(1, Math.ceil(to / 35));
    const id = setInterval(() => {
      cur = Math.min(cur + step, to);
      setVal(cur);
      if (cur >= to) clearInterval(id);
    }, 28);
    return () => clearInterval(id);
  }, [to]);
  return <>{val.toLocaleString("ru-RU")}</>;
}

export default function Home() {
  // Таңдалған аймақ — басты беттегі тірі дерек те, мәтін де осыған қарай
  const region = useRegion();
  const { t, lang } = useLang();
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [live, setLive] = useState<LiveStats>({ aqi: null, pm25: null, temp: null, humidity: null });
  const [reportCount, setReportCount] = useState<number | null>(null);

  const FEATURES = [
    { icon: Satellite, color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20",     t: "feat.sat.t",      d: "feat.sat.d",      href: "/map" },
    { icon: Camera,    color: "text-violet-400",  bg: "bg-violet-500/10 border-violet-500/20", t: "feat.cross.t",    d: "feat.cross.d",    href: "/report" },
    { icon: LineChart, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", t: "feat.forecast.t", d: "feat.forecast.d", href: "/dashboard" },
    { icon: Bug,       color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/20", t: "feat.mosquito.t", d: "feat.mosquito.d", href: "/map" },
    { icon: GitCompare,color: "text-pink-400",    bg: "bg-pink-500/10 border-pink-500/20",     t: "feat.compare.t",  d: "feat.compare.d",  href: "/compare" },
    { icon: Bell,      color: "text-yellow-400",  bg: "bg-yellow-500/10 border-yellow-500/20", t: "feat.alerts.t",   d: "feat.alerts.d",   href: "/alerts" },
  ] as const;

  const HOW = [
    { step: "01", icon: MapPin,      t: "how.1.t", d: "how.1.d" },
    { step: "02", icon: Satellite,   t: "how.2.t", d: "how.2.d" },
    { step: "03", icon: CheckCircle, t: "how.3.t", d: "how.3.d" },
  ] as const;

  useEffect(() => {
    fetch(`/api/environment?region=${region.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.current) return;
        setLive({
          aqi:      d.current.europeanAqi ?? null,
          pm25:     d.current.pm2_5 ?? null,
          temp:     d.current.temperature ?? null,
          humidity: d.current.humidity ?? null,
        });
      })
      .catch(() => {});
    // Аймақ ауысса — тірі дерек қайта сұралады
  }, [region.id]);

  useEffect(() => {
    fetch("/api/articles")
      .then((r) => r.json())
      .then((d) => setArticles(d.articles ?? []))
      .catch(() => setArticles([]));
  }, []);

  useEffect(() => {
    fetch(`/api/reports`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setReportCount(Array.isArray(d?.reports) ? d.reports.length : 0))
      .catch(() => setReportCount(0));
  }, []);

  /* ── ауа сапасы жапсырмасы ──────────────────────────────────────── */
  const aqiInfo = (() => {
    if (live.aqi == null) return null;
    if (live.aqi <= 20) return { key: "live.air.clean",     color: "text-emerald-400" } as const;
    if (live.aqi <= 40) return { key: "live.air.moderate",  color: "text-yellow-400" } as const;
    if (live.aqi <= 60) return { key: "live.air.sensitive", color: "text-orange-400" } as const;
    return                 { key: "live.air.poor",      color: "text-red-400" } as const;
  })();

  /* ── «Бүгінгі эко-жағдай» қорытынды сөйлемі (нақты деректерден) ──── */
  const ecoSummary = (() => {
    if (live.aqi == null || live.temp == null) return null;
    const airWord = t(aqiInfo!.key as never);
    const pmHigh = live.pm25 != null && live.pm25 > 25;
    if (lang === "en") {
      return `Today in ${region.name} it's ${live.temp.toFixed(0)}°C, air quality is "${airWord.toLowerCase()}" (AQI ${live.aqi}). ` +
        (pmHigh
          ? `PM2.5 is above the limit (${live.pm25!.toFixed(0)} µg/m³) — sensitive people should limit time outdoors.`
          : `PM2.5 level is within the norm.`);
    }
    if (lang === "ru") {
      return `Сегодня в ${region.name} ${live.temp.toFixed(0)}°C, качество воздуха — «${airWord.toLowerCase()}» (AQI ${live.aqi}). ` +
        (pmHigh
          ? `PM2.5 выше нормы (${live.pm25!.toFixed(0)} мкг/м³) — чувствительным людям стоит сократить время на улице.`
          : `Уровень PM2.5 в пределах нормы.`);
    }
    return `Бүгін ${region.name} қаласында ${live.temp.toFixed(0)}°C, ауа сапасы — «${airWord.toLowerCase()}» (AQI ${live.aqi}). ` +
      (pmHigh
        ? `PM2.5 нормадан жоғары (${live.pm25!.toFixed(0)} мкг/м³) — сезімтал адамдарға далада аз болған жөн.`
        : `PM2.5 деңгейі норма шегінде.`);
  })();

  return (
    <div className="relative overflow-x-hidden">
      {/* Hero background — тақырыптық иллюстрация (фото емес) */}
      <HeroBackground />

      {/* Hero */}
      <section className="relative mx-auto max-w-5xl px-4 pb-10 pt-28 text-center sm:pt-36">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
            <Leaf className="h-3.5 w-3.5" /> {t("hero.badge")}
          </div>
          <h1 className="text-6xl font-bold tracking-tight text-white sm:text-8xl">Jaiyq</h1>
          <div className="mt-3 flex justify-center">
            <RegionPicker />
          </div>
          <p className="mt-2 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">{t("hero.sub")}</p>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-neutral-300 sm:text-lg">{t("hero.desc")}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="gap-2 bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-500">
              <Link href="/map"><Satellite className="h-4 w-4" /> {t("hero.openMap")} <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="gap-2 border-white/20 text-white hover:bg-white/10">
              <Link href="/report"><Camera className="h-4 w-4" /> {t("hero.report")}</Link>
            </Button>
          </div>
        </motion.div>

        {/* Эко-жағдай жолағы */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="mx-auto mt-8 flex max-w-2xl items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.07] px-4 py-3 text-left backdrop-blur"
        >
          <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
          <div>
            <p className="text-xs font-semibold text-emerald-300">{t("summary.title")}</p>
            {ecoSummary ? (
              <p className="mt-0.5 text-sm leading-relaxed text-neutral-200">{ecoSummary}</p>
            ) : (
              <p className="mt-0.5 text-sm text-neutral-500">{t("summary.loading")}</p>
            )}
          </div>
        </motion.div>

        {/* Live stats */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left backdrop-blur">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-neutral-500"><Wind className="h-3.5 w-3.5" /> {t("live.air")}</div>
            {live.aqi != null ? (
              <><p className={`text-3xl font-bold ${aqiInfo?.color}`}>{live.aqi}</p>
              <p className="mt-0.5 text-xs text-neutral-400">{t(aqiInfo!.key as never)} · {t("live.aqiUnit")}</p></>
            ) : <Skeleton className="mt-1 h-8 w-16 bg-white/5" />}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left backdrop-blur">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-neutral-500"><Wind className="h-3.5 w-3.5" /> PM2.5 · мкг/м³</div>
            {live.pm25 != null ? (
              <><p className={`text-3xl font-bold ${live.pm25 > 25 ? "text-orange-400" : "text-emerald-400"}`}>{live.pm25.toFixed(1)}</p>
              <p className="mt-0.5 text-xs text-neutral-400">{live.pm25 > 25 ? t("live.pm.high") : t("live.pm.norm")}</p></>
            ) : <Skeleton className="mt-1 h-8 w-20 bg-white/5" />}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left backdrop-blur">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-neutral-500"><TrendingUp className="h-3.5 w-3.5" /> {t("live.temp")}</div>
            {live.temp != null ? (
              <><p className="text-3xl font-bold text-sky-400">{live.temp.toFixed(0)}°C</p>
              <p className="mt-0.5 text-xs text-neutral-400">{t("live.atyrauCity")}</p></>
            ) : <Skeleton className="mt-1 h-8 w-16 bg-white/5" />}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left backdrop-blur">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-neutral-500"><Droplets className="h-3.5 w-3.5" /> {t("live.humidity")}</div>
            {live.humidity != null ? (
              <><p className="text-3xl font-bold text-cyan-400">{live.humidity.toFixed(0)}%</p>
              <p className="mt-0.5 text-xs text-neutral-400">{t("live.atyrauCity")}</p></>
            ) : <Skeleton className="mt-1 h-8 w-16 bg-white/5" />}
          </div>
        </motion.div>
        <p className="mt-2 text-[11px] text-neutral-600">{t("live.note")}</p>
      </section>

      {/* Platform stats — анимацияланған */}
      <section className="relative mx-auto max-w-5xl px-4 py-12">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
            <p className="text-xl font-bold text-white sm:text-2xl">118 500 км²</p>
            <p className="mt-1 text-xs font-medium text-emerald-400">{t("stats.area")}</p>
            <p className="mt-0.5 text-[11px] text-neutral-500">{t("stats.areaSub")}</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.08 }}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
            <p className="text-xl font-bold text-emerald-400 sm:text-2xl">
              {reportCount != null ? <AnimatedNum to={reportCount} /> : "…"}
            </p>
            <p className="mt-1 text-xs font-medium text-emerald-400">{t("stats.reports")}</p>
            <p className="mt-0.5 text-[11px] text-neutral-500">{t("stats.reportsSub")}</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.16 }}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
            <p className="text-xl font-bold text-white sm:text-2xl">2000–2025</p>
            <p className="mt-1 text-xs font-medium text-emerald-400">{t("stats.years")}</p>
            <p className="mt-0.5 text-[11px] text-neutral-500">{t("stats.yearsSub")}</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.24 }}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
            <p className="text-xl font-bold text-white sm:text-2xl">GPT-4o</p>
            <p className="mt-1 text-xs font-medium text-emerald-400">{t("stats.refresh")}</p>
            <p className="mt-0.5 text-[11px] text-neutral-500">{t("stats.refreshSub")}</p>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="relative mx-auto max-w-5xl px-4 py-12">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-8 text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">{t("feat.title")}</h2>
          <p className="mt-2 text-sm text-neutral-400">{t("feat.subtitle")}</p>
        </motion.div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div key={f.t} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.4 }}>
              <Link href={f.href} className={`group flex flex-col rounded-2xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg ${f.bg}`}>
                <f.icon className={`mb-3 h-7 w-7 ${f.color}`} />
                <h3 className="mb-1.5 font-semibold text-white">{t(f.t)}</h3>
                <p className="flex-1 text-sm leading-relaxed text-neutral-400">{t(f.d)}</p>
                <div className={`mt-4 flex items-center gap-1 text-xs font-medium ${f.color}`}>{t("feat.open")} <ChevronRight className="h-3.5 w-3.5" /></div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="relative mx-auto max-w-5xl px-4 py-16">
        <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 sm:p-12">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-10 text-center">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">{t("how.title")}</h2>
            <p className="mt-2 text-sm text-neutral-400">{t("how.subtitle")}</p>
          </motion.div>
          <div className="grid gap-8 sm:grid-cols-3">
            {HOW.map((h, i) => (
              <motion.div key={h.step} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }} className="relative text-center">
                {i < HOW.length - 1 && <div className="absolute left-[calc(50%+40px)] top-6 hidden w-[calc(100%-80px)] border-t border-dashed border-white/10 sm:block" />}
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-emerald-500/10"><h.icon className="h-6 w-6 text-emerald-400" /></div>
                <p className="mb-1 text-xs font-bold tracking-widest text-emerald-500">{h.step}</p>
                <h3 className="mb-1.5 font-semibold text-white">{t(h.t)}</h3>
                <p className="text-sm leading-relaxed text-neutral-400">{t(h.d)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick nav */}
      <section className="relative mx-auto max-w-5xl px-4 py-8">
        <div className="grid gap-3 sm:grid-cols-3">
          <Link href="/dashboard" className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-all hover:border-emerald-500/30 hover:bg-emerald-500/5">
            <LineChart className="mb-3 h-6 w-6 text-emerald-400" />
            <p className="font-semibold text-white">{t("qn.dash.t")}</p>
            <p className="mt-1 text-xs text-neutral-400">{t("qn.dash.d")}</p>
            <p className="mt-3 flex items-center gap-1 text-xs font-medium text-emerald-400">{t("qn.enter")} <ChevronRight className="h-3.5 w-3.5" /></p>
          </Link>
          <Link href="/moderation" className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-all hover:border-violet-500/30 hover:bg-violet-500/5">
            <Shield className="mb-3 h-6 w-6 text-violet-400" />
            <p className="font-semibold text-white">{t("qn.mod.t")}</p>
            <p className="mt-1 text-xs text-neutral-400">{t("qn.mod.d")}</p>
            <p className="mt-3 flex items-center gap-1 text-xs font-medium text-violet-400">{t("qn.enter")} <ChevronRight className="h-3.5 w-3.5" /></p>
          </Link>
          <Link href="/eco-passport" className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-all hover:border-sky-500/30 hover:bg-sky-500/5">
            <FileText className="mb-3 h-6 w-6 text-sky-400" />
            <p className="font-semibold text-white">{t("qn.pass.t")}</p>
            <p className="mt-1 text-xs text-neutral-400">{t("qn.pass.d")}</p>
            <p className="mt-3 flex items-center gap-1 text-xs font-medium text-sky-400">{t("qn.enter")} <ChevronRight className="h-3.5 w-3.5" /></p>
          </Link>
        </div>
      </section>

      {/* Science articles */}
      <section className="relative mx-auto max-w-5xl px-4 py-12">
        <div className="mb-6">
          <h2 className="flex items-center gap-2 text-xl font-bold text-white"><BookOpen className="h-5 w-5 text-emerald-400" /> {t("art.title")}</h2>
          <p className="mt-1 text-sm text-neutral-400">{t("art.subtitle")}</p>
        </div>
        {articles === null ? (
          <div className="grid gap-3 sm:grid-cols-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl bg-white/5" />)}</div>
        ) : articles.length === 0 ? (
          <p className="text-sm text-neutral-500">{t("art.empty")}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {articles.slice(0, 6).map((a, i) => (
              <motion.a key={a.link + i} href={a.link} target="_blank" rel="noopener noreferrer"
                initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06, duration: 0.35 }}
                className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-all hover:border-emerald-500/30 hover:bg-emerald-500/5">
                <div className="mb-2 flex items-center gap-2 text-[11px] text-neutral-500">
                  <span className="rounded-md bg-white/10 px-1.5 py-0.5">{a.source}</span>
                  <span className="ml-auto">{a.date}</span>
                  <ExternalLink className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <h3 className="mb-1.5 text-sm font-semibold leading-snug text-white group-hover:text-emerald-300">{a.titleKz}</h3>
                <p className="line-clamp-5 text-xs leading-relaxed text-neutral-400">{a.summaryKz}</p>
                <p className="mt-2 line-clamp-1 text-[10px] italic text-neutral-600">{a.title}</p>
              </motion.a>
            ))}
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="relative mx-auto max-w-5xl px-4 pb-20 pt-8">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20"><Users className="h-7 w-7 text-emerald-400" /></div>
          <h2 className="text-2xl font-bold text-white sm:text-3xl">{t("cta.title")}</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-neutral-400">{t("cta.desc")}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-500">
              <Link href="/report"><Camera className="mr-2 h-4 w-4" /> {t("cta.report")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10">
              <Link href="/map"><Satellite className="mr-2 h-4 w-4" /> {t("cta.explore")}</Link>
            </Button>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
