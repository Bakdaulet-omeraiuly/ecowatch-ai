"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Leaf } from "lucide-react";

const links = [
  { href: "/map", label: "Карта" },
  { href: "/dashboard", label: "Аналитика" },
  { href: "/report", label: "Хабарлау" },
  { href: "/alerts", label: "Ескертулер" },
];

export function Navbar() {
  const pathname = usePathname();
  return (
    <header className="fixed top-0 z-50 w-full border-b border-white/10 bg-neutral-950/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold text-white">
          <Leaf className="h-5 w-5 text-emerald-400" />
          EcoWatch <span className="text-emerald-400">AI</span>
          <span className="ml-2 hidden rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-normal text-emerald-300 sm:inline">
            Атырау облысы
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                pathname === l.href
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "text-neutral-400 hover:bg-white/5 hover:text-white"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
