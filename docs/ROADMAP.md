# EcoWatch AI — Development Roadmap (5–6 Days)

## Timeline Overview

```
Day 1  │ Project setup + map foundation
Day 2  │ AI analysis pipeline (core feature)
Day 3  │ Analysis UI + report drawer
Day 4  │ Dashboard + analytics
Day 5  │ Polish, landing page, demo data
Day 6  │ Buffer: testing, bug fixes, demo prep
```

---

## Day 1 — Foundation & Map

**Goal:** Working map with clickable locations and seed data displayed.

- [ ] `npx create-next-app` with TypeScript + Tailwind
- [ ] Install and configure all dependencies
- [ ] Set up `.env.local` (Mapbox token, OpenAI key)
- [ ] Configure shadcn/ui (init + install needed components)
- [ ] Build `Navbar` and root layout with providers
- [ ] Integrate `react-map-gl` with Mapbox satellite style
- [ ] Create `MapContainer` with click handler (captures lat/lng)
- [ ] Create seed data: 20+ sites across different risk levels in `seedSites.ts`
- [ ] `GET /api/sites` route serving seed data
- [ ] Render `SiteMarker` pins on map, color-coded by risk level
- [ ] Set up Zustand stores (`useSitesStore`, `useUIStore`)

**Done when:** Map loads with satellite view, seed markers appear, clicking logs coordinates.

---

## Day 2 — AI Analysis Pipeline

**Goal:** Clicking the map triggers real AI analysis and returns structured results.

- [ ] Build `POST /api/analyze` route
  - Accept `{ lat, lng }`
  - Construct Mapbox Static Image URL for that location
  - Send to OpenAI gpt-4o Vision with analysis prompt
  - Parse and validate JSON response with Zod
  - Return `AnalysisResult`
- [ ] Create OpenAI client in `lib/openai.ts`
- [ ] Create Mapbox static image URL builder in `lib/mapbox.ts`
- [ ] Define all TypeScript types in `types/site.ts` and `types/api.ts`
- [ ] Wire map click → loading state → API call → store update
- [ ] Test end-to-end analysis flow with real coordinates

**Done when:** Clicking anywhere on map returns a real AI risk score in < 15s.

---

## Day 3 — Analysis UI (Report Drawer)

**Goal:** Beautiful, information-rich report panel opens after every analysis.

- [ ] Build `AnalysisDrawer` (Framer Motion slide-in from right)
- [ ] `SatellitePreview` — shows the analyzed Mapbox static image
- [ ] `RiskGauge` — circular meter (SVG or radial chart) showing 0–100 score
- [ ] `RiskBadge` — low / medium / high / critical with color coding
- [ ] `FindingsList` — checklist of detected environmental features
- [ ] Recommendation text block with action buttons (Flag / Export)
- [ ] `AnalysisLoader` skeleton shown during API call
- [ ] Save analysis to localStorage history via Zustand persist
- [ ] New marker added to map at analyzed location after completion
- [ ] `SiteHistoryPanel` in sidebar — list of past analyses, clickable

**Done when:** Full report appears with satellite image, score, findings, and history persists on refresh.

---

## Day 4 — Dashboard, Forecasting & Mosquito Module

**Goal:** Analytics dashboard, forecast engine, mosquito risk layer.

- [ ] `POST /api/forecast` — GPT reasoning over history + seed trends
- [ ] Forecast tab: solid (history) + dashed (projection) trend lines, AI outlook text
- [ ] Extend satellite prompt with standing-water / floodplain fields
- [ ] `lib/mosquito.ts` — Mosquito Risk Index (no extra AI call)
- [ ] 🦟 heatmap layer toggle + seasonal activity chart

- [ ] `dashboard/page.tsx` layout
- [ ] `StatsGrid` — 4 cards: Total Analyzed, High Risk Sites, Sites Flagged, Avg Risk Score
- [ ] `TrendChart` — line chart of analyses per day (Recharts)
- [ ] `RiskDistribution` — bar chart of risk level counts (Recharts)
- [ ] `RecentActivity` — last 10 analyses feed with timestamps
- [ ] `ReportForm` — community submission form (coordinates + description + photo)
- [ ] `POST /api/report` route (stores to Zustand, displays on map as community marker)
- [ ] Distinct marker style for community-reported vs AI-analyzed sites
- [ ] Dashboard reads from Zustand store (reflects real user actions)

**Done when:** Dashboard shows live stats, reports appear on map after form submission.

---

## Day 5 — Polish & Landing Page

**Goal:** Demo-ready, visually impressive product.

- [ ] Landing page (`/`) — hero with product pitch, key stats, CTA to `/map`
- [ ] Framer Motion animations on all page transitions
- [ ] Map style toggle (satellite ↔ street)
- [ ] `LocationSearch` — geocode an address into map coordinates
- [ ] Responsive layout at 768px+ (sidebar collapses)
- [ ] Dark mode (shadcn default or manual Tailwind dark class)
- [ ] Error states: API failure toast, empty state for no analyses yet
- [ ] Favicon, og:image, page metadata
- [ ] Export report as PDF (browser `window.print()` with print stylesheet)
- [ ] Final review of all copy and labels

**Done when:** Landing page → map → analysis → dashboard flow is smooth and polished.

---

## Day 6 — Buffer & Demo Prep

**Goal:** Everything works reliably for the demo.

- [ ] Fix all bugs found during Day 5 testing
- [ ] Pre-load 5–8 demo analyses in localStorage as default state
- [ ] Prepare a 2-minute demo script walking through the golden path
- [ ] Test on a clean browser (no stored state)
- [ ] Verify OpenAI responses are consistent for demo locations
- [ ] Deploy to Vercel (optional but recommended)

---

## Risk Mitigation

| Risk | Mitigation |
|---|---|
| OpenAI Vision slow / expensive | Cache results by coordinates; use mock responses as fallback |
| Mapbox static image URL issues | Test URL format early (Day 2); have a placeholder fallback |
| AI returns malformed JSON | Zod validation + retry logic with prompt correction |
| Time overrun | Dashboard (Day 4) is lower priority; ship map + analysis first |

---

## Definition of MVP (Minimum for Demo)

1. Interactive satellite map with seed sites
2. Click → AI analysis → risk report in one flow
3. Report drawer with score, image, and findings
4. Site history that persists across page reloads
5. Basic dashboard with stats and one chart
