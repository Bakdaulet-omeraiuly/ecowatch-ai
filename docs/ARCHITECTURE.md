# EcoWatch AI — System Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (Client)                      │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Mapbox GL   │  │  React UI    │  │   Recharts    │  │
│  │  (map view)  │  │  shadcn/ui   │  │  (dashboard)  │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────────┘  │
│         │                 │                               │
│         └────────┬────────┘                               │
│                  │                                        │
│         Next.js App Router (pages + layout)               │
│                  │                                        │
└──────────────────┼────────────────────────────────────────┘
                   │ fetch / Server Actions
┌──────────────────┼────────────────────────────────────────┐
│            Next.js API Routes (Edge-compatible)           │
│                                                           │
│  POST /api/analyze   ──►  OpenAI Vision API              │
│  GET  /api/sites     ──►  Static seed data (JSON)        │
│  POST /api/report    ──►  In-memory / localStorage       │
└───────────────────────────────────────────────────────────┘
```

---

## Component Architecture

```
app/
├── layout.tsx                  Root layout (fonts, providers)
├── page.tsx                    Home → redirects to /map
│
├── map/
│   └── page.tsx                Main map experience
│
├── dashboard/
│   └── page.tsx                Analytics & stats
│
└── api/
    ├── analyze/route.ts        AI analysis endpoint
    ├── sites/route.ts          Seed sites data
    └── report/route.ts         Community reports

components/
├── map/
│   ├── MapContainer.tsx        Mapbox GL wrapper
│   ├── SiteMarker.tsx          Individual map pin
│   ├── MarkerCluster.tsx       Cluster logic
│   └── LocationPicker.tsx      Click-to-select overlay
│
├── analysis/
│   ├── AnalysisDrawer.tsx      Slide-in report panel
│   ├── RiskGauge.tsx           Radial score visualization
│   ├── FindingsList.tsx        AI findings breakdown
│   └── SatellitePreview.tsx    Image thumbnail
│
├── dashboard/
│   ├── StatsCards.tsx          Summary KPI cards
│   ├── TrendChart.tsx          Recharts line chart
│   ├── RiskDistribution.tsx    Recharts bar chart
│   └── ActivityFeed.tsx        Recent analyses list
│
├── dashboard-charts/
│   ├── IssueBreakdown.tsx      Donut: oil/dumping/degradation
│   ├── DistrictComparison.tsx  Horizontal bars per district
│   ├── AirQualityChart.tsx     AQI over time + WHO line
│   └── RiverQualityChart.tsx   Zhaiyk pollution index
│
├── report/
│   ├── PhotoUpload.tsx         Drag & drop + mobile camera capture
│   ├── GeoLocator.tsx          Browser GPS + manual map-pick fallback
│   ├── ReportForm.tsx          Community submission form
│   ├── VerificationBadge.tsx   confirmed / unconfirmed / contradicted
│   └── SiteHistory.tsx         Past analyses list
│
└── ui/                         shadcn/ui components (auto-generated)
```

---

## Analysis Modes

The platform supports three analysis modes through a single endpoint
(`POST /api/analyze` with `mode: "satellite" | "photo" | "combined"`):

### Mode 1 — Satellite (top-down screening)

```
1. User clicks map → coordinates captured (lat, lng, zoom)
2. MapContainer calls /api/analyze with { mode: "satellite", lat, lng }
3. API route:
   a. Constructs Mapbox Static Image URL for that location
   b. Sends image URL + satellite-specific prompt to OpenAI Vision (gpt-4o)
   c. Parses structured JSON response
   d. Returns: { riskScore, confidence, features[], recommendation, imageUrl }
4. AnalysisDrawer opens with animation (Framer Motion)
5. Site is saved to localStorage history
6. Map marker added at coordinates, colored by risk level (🛰 style)
```

### Mode 2 — Citizen Photo (ground-level report)

```
1. User uploads/captures a photo (drag & drop, or <input capture="environment">
   on mobile — opens camera directly)
2. Browser Geolocation API auto-fills coordinates (manual map-pick fallback)
3. Photo sent as base64 directly to /api/analyze { mode: "photo", image, lat, lng }
   — no file storage server needed; only a thumbnail kept in localStorage
4. Ground-level prompt: waste type, estimated volume, oil spill vs household
   waste classification, hazard level
5. Map marker added with citizen-report style (📸)
```

### Mode 3 — Combined (cross-verification) ⭐

```
1. Triggered automatically after a citizen photo report
2. API fetches the satellite tile for the same coordinates
3. BOTH images sent in a single GPT-4o Vision request (multi-image input)
4. Cross-verification prompt: does the satellite view corroborate the
   ground-level evidence?
5. Returns verificationStatus: "confirmed" | "unconfirmed" | "contradicted"
6. Confirmed sites get a distinct ✅ marker and elevated priority
```

---

## AI Prompt Design

Three separate prompts, one per mode. All share the same system context:

**System prompt (shared):**
> You are an environmental monitoring AI for the Atyrau region of Kazakhstan — an oil-producing area on the Caspian Sea coast, crossed by the Zhaiyk (Ural) river. You analyze imagery for oil pollution, illegal dumping, and land degradation. Respond only with valid JSON.

**Satellite prompt:**
> Analyze this satellite image. Return JSON: { "riskScore": 0-100, "confidence": 0-100, "riskLevel": "low|medium|high|critical", "oilPollution": boolean, "illegalDumping": boolean, "landDegradation": boolean, "detectedFeatures": string[], "vegetationDamage": boolean, "accessRoutes": boolean, "recommendation": string, "summary": string }

**Ground photo prompt:**
> Analyze this ground-level photo taken by a citizen. Classify the issue. Return JSON: { "riskScore", "confidence", "riskLevel", "issueType": "oil_spill|household_waste|construction_waste|industrial|land_degradation|other", "estimatedScale": "small|medium|large", "hazardous": boolean, "detectedFeatures": string[], "recommendation", "summary" }

**Cross-verification prompt (2 images):**
> Image 1 is a citizen ground-level photo; image 2 is the satellite view of the same coordinates. Does the satellite view corroborate the ground evidence? Return JSON: { ...all satellite fields, "verificationStatus": "confirmed|unconfirmed|contradicted", "verificationNotes": string }

---

## Ecosystem Forecasting Engine

No ML training needed — forecasting is done with GPT-4o reasoning over
structured data, which is realistic for an MVP and demos well:

```
1. Input: site's analysis history + district seed trends (ecologyStats.ts)
2. POST /api/forecast { siteId | district }
3. Prompt: "Given these risk scores over time and regional context
   (oil industry, Caspian coast, flood seasons), project the 6–12 month
   trajectory. Return JSON: { projectedScores: [{month, score}],
   trend: 'improving|stable|degrading', drivers: string[],
   outlook: string, urgentSites: string[] }"
4. Dashboard renders solid line (history) + dashed line (forecast)
```

## Mosquito Risk Module

The breeding-site signal (stagnant water) is satellite-visible, so it reuses
the existing pipeline with an extended prompt:

```
Satellite prompt additions:
  "standingWater": boolean, "waterBodies": string[],
  "floodplainIndicators": boolean, "drainageBlocked": boolean

Mosquito Risk Index (computed in lib/mosquito.ts, no extra AI call):
  MRI = 40·standingWater + 20·floodplainProximity(lat,lng)
      + 25·seasonFactor(month)   // May–Jul flood season = 1.0
      + 15·tempFactor(month)     // from seeded climate table

Map: separate 🦟 heatmap layer (toggle), weighted by MRI
Dashboard: seasonal activity chart (12 months, peak warnings)
Citizen reports: "mosquito breeding site" tag feeds MRI for that cell
```

## Analytics Module (Regional Ecology Dashboard)

A dedicated `/dashboard` section presenting Atyrau region ecology at a glance.
Data sources: live user analyses (Zustand store) + seeded historical dataset
(`src/data/ecologyStats.ts`) for charts that need time depth.

| Block | Visualization | Source |
|---|---|---|
| KPI cards | Total analyzed, high-risk sites, confirmed reports, avg risk score | Live store |
| Risk trend | Recharts area chart — analyses & avg risk per day | Live + seed |
| Risk distribution | Bar chart by risk level | Live store |
| Issue breakdown | Donut chart — oil / dumping / degradation share | Live + seed |
| District comparison | Horizontal bars — Atyrau city, Tengiz, Kulsary, Inderbor, Makat | Seed |
| Air quality (AQI) | Line chart, monthly, with WHO threshold line | Seed (realistic mock) |
| Zhaiyk river quality | Line chart — pollution index over time | Seed (realistic mock) |
| Verification funnel | Reported → AI-analyzed → confirmed → flagged for inspection | Live store |
| Heatmap layer | Mapbox heatmap of risk density (toggle on map page) | Live + seed |

---

## State Management

- **Global state:** Zustand store
  - `sites[]` — all analyzed + seeded sites
  - `selectedSite` — currently open in drawer
  - `isAnalyzing` — loading state
  - `reportedSites[]` — community submissions

- **Persistence:** `localStorage` via Zustand persist middleware

- **No external database** for MVP — all data is client-side or seeded JSON

---

## Key Dependencies

| Package | Purpose |
|---|---|
| `next` 15 | Framework, API routes, SSR |
| `mapbox-gl` | Interactive satellite map |
| `react-map-gl` | React wrapper for Mapbox |
| `openai` | Vision API calls (server-side) |
| `zustand` | Client state management |
| `framer-motion` | UI animations |
| `recharts` | Dashboard charts |
| `shadcn/ui` | UI component library |
| `tailwindcss` | Styling |
| `zod` | API response validation |

---

## Environment Variables

```env
NEXT_PUBLIC_MAPBOX_TOKEN=pk.xxx
OPENAI_API_KEY=sk-xxx
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Security Considerations

- OpenAI API key is server-side only (API route, never exposed to client)
- Mapbox public token is scoped to the domain
- No user data is persisted server-side — all local storage
- Input coordinates are validated with Zod before API calls
