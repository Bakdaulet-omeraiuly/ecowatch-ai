# EcoWatch AI — Folder Structure

```
ecowatch-ai/
│
├── .env.local                        # API keys (gitignored)
├── .env.example                      # Template for env vars
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
│
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── FOLDER_STRUCTURE.md
│   └── ROADMAP.md
│
├── public/
│   ├── logo.svg
│   └── demo-sites.json               # Pre-seeded illegal dump locations
│
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── globals.css
│   │   ├── layout.tsx                # Root layout (metadata, fonts, providers)
│   │   ├── page.tsx                  # Landing page / hero
│   │   │
│   │   ├── map/
│   │   │   └── page.tsx              # Main map view
│   │   │
│   │   ├── dashboard/
│   │   │   └── page.tsx              # Analytics dashboard
│   │   │
│   │   └── api/
│   │       ├── analyze/
│   │       │   └── route.ts          # POST: AI site analysis
│   │       ├── sites/
│   │       │   └── route.ts          # GET: seed sites data
│   │       └── report/
│   │           └── route.ts          # POST: community report submission
│   │
│   ├── components/
│   │   ├── ui/                       # shadcn/ui auto-generated components
│   │   │   ├── button.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── card.tsx
│   │   │   ├── drawer.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── progress.tsx
│   │   │   ├── separator.tsx
│   │   │   ├── skeleton.tsx
│   │   │   └── toast.tsx
│   │   │
│   │   ├── map/
│   │   │   ├── MapContainer.tsx      # Mapbox GL map, handles clicks & markers
│   │   │   ├── SiteMarker.tsx        # Individual risk-level pin
│   │   │   ├── MapControls.tsx       # Zoom, style toggle (satellite/street)
│   │   │   └── LocationSearch.tsx    # Address → coordinates input
│   │   │
│   │   ├── analysis/
│   │   │   ├── AnalysisDrawer.tsx    # Slide-in panel with full report
│   │   │   ├── RiskGauge.tsx         # Circular score meter (0–100)
│   │   │   ├── RiskBadge.tsx         # low/medium/high/critical pill
│   │   │   ├── FindingsList.tsx      # Detected features checklist
│   │   │   ├── SatellitePreview.tsx  # Static image thumbnail
│   │   │   └── AnalysisLoader.tsx    # Skeleton / loading state
│   │   │
│   │   ├── dashboard/
│   │   │   ├── StatsGrid.tsx         # 4 KPI summary cards
│   │   │   ├── TrendChart.tsx        # Recharts line chart (analyses/day)
│   │   │   ├── RiskDistribution.tsx  # Recharts bar chart (risk breakdown)
│   │   │   └── RecentActivity.tsx    # Last 10 analyses feed
│   │   │
│   │   ├── report/
│   │   │   ├── ReportForm.tsx        # Community submission form
│   │   │   └── SiteHistoryPanel.tsx  # Sidebar list of past analyses
│   │   │
│   │   └── layout/
│   │       ├── Navbar.tsx            # Top navigation bar
│   │       ├── Sidebar.tsx           # Collapsible left sidebar
│   │       └── Providers.tsx         # Zustand, Toaster, theme wrappers
│   │
│   ├── lib/
│   │   ├── openai.ts                 # OpenAI client singleton
│   │   ├── mapbox.ts                 # Mapbox helpers (static image URL builder)
│   │   ├── risk.ts                   # Risk score → color/label utilities
│   │   └── utils.ts                  # cn(), formatters, etc.
│   │
│   ├── store/
│   │   ├── useSitesStore.ts          # Zustand: sites, selected, history
│   │   └── useUIStore.ts             # Zustand: drawer open, loading states
│   │
│   ├── types/
│   │   ├── site.ts                   # Site, AnalysisResult, RiskLevel types
│   │   └── api.ts                    # API request/response schemas (Zod)
│   │
│   └── data/
│       └── seedSites.ts              # 20+ pre-seeded demo sites with mock scores
```
