"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Satellite, Camera, LineChart, Bug, ArrowRight, Leaf, BookOpen, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface Article {
  title: string;
  titleKz: string;
  summaryKz: string;
  link: string;
  source: string;
  date: string;
}

const features = [
  { icon: Satellite, title: "Спутник талдауы", desc: "Картаның кез келген нүктесін басыңыз — AI спутник суретінен мұнай, қоқыс, деградацияны анықтайды" },
  { icon: Camera, title: "Кросс-верификация", desc: "Азамат фотосы + спутник суреті бір AI сұранысында салыстырылып, мәселе расталады" },
  { icon: LineChart, title: "AI болжамы", desc: "Жинақталған деректер негізінде 6 айлық экологиялық тренд проекциясы" },
  { icon: Bug, title: "Маса индексі", desc: "Тұрған су + тасқын маусымы + өзенге жақындық → аймақтық маса тәуекел картасы" },
];

export default function Home() {
  const [articles, setArticles] = useState<Article[] | null>(null);

  useEffect(() => {
    fetch("/api/articles")
      .then((r) => r.json())
      .then((d) => setArticles(d.articles ?? []))
      .catch(() => setArticles([]));
  }, []);

  return (
    <div className="relative">
      {/* Hero background — aerial view of Atyrau city at sunset (Ural river visible) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[640px] overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://upload.wikimedia.org/wikipedia/commons/4/48/Atyrau_City_2025.jpg')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/55 via-neutral-950/75 to-neutral-950" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 py-16 sm:py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
          <Leaf className="h-3.5 w-3.5" /> Атырау облысына арналған экологиялық AI платформа
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
          EcoWatch <span className="text-emerald-400">AI</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-neutral-400 sm:text-lg">
          Спутник суреттері мен жасанды интеллект арқылы қоқыс полигондарын, мұнай ластануын,
          жер деградациясын және маса көбею ошақтарын анықтаймыз — болжам жасап, шара ұсынамыз.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/map">
              Картаны ашу <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/report">Мәселе хабарлау</Link>
          </Button>
        </div>
      </motion.div>

      <div className="mt-20 grid gap-4 sm:grid-cols-2">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.1, duration: 0.4 }}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
          >
            <f.icon className="mb-3 h-6 w-6 text-emerald-400" />
            <h3 className="mb-1 font-semibold text-white">{f.title}</h3>
            <p className="text-sm text-neutral-400">{f.desc}</p>
          </motion.div>
        ))}
      </div>

      {/* Science articles — refreshed daily */}
      <div className="mt-20">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-white">
              <BookOpen className="h-5 w-5 text-emerald-400" /> Экология ғылымы
            </h2>
            <p className="text-sm text-neutral-400">
              ScienceDaily және Phys.org дереккөздерінен — күн сайын жаңарады, AI қазақшаға түйіндейді
            </p>
          </div>
        </div>

        {articles === null ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl bg-white/5" />
            ))}
          </div>
        ) : articles.length === 0 ? (
          <p className="text-sm text-neutral-500">Мақалалар уақытша қолжетімсіз.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {articles.map((a, i) => (
              <motion.a
                key={a.link + i}
                href={a.link}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07, duration: 0.35 }}
                className="group rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/5"
              >
                <div className="mb-1.5 flex items-center gap-2 text-[11px] text-neutral-500">
                  <span className="rounded bg-white/10 px-1.5 py-0.5">{a.source}</span>
                  <ExternalLink className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <h3 className="mb-1 text-sm font-semibold text-white group-hover:text-emerald-300">
                  {a.titleKz}
                </h3>
                <p className="line-clamp-2 text-xs text-neutral-400">{a.summaryKz}</p>
                <p className="mt-1.5 text-[10px] italic text-neutral-600">{a.title}</p>
              </motion.a>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
