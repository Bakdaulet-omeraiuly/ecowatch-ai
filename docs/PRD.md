# EcoWatch AI — Product Requirements Document

## Overview

EcoWatch AI is a geospatial intelligence platform that uses AI and satellite imagery to detect illegal dumping sites. Environmental agencies, municipalities, NGOs, researchers, and citizens can submit coordinates or upload imagery to receive AI-powered risk assessments and environmental impact reports.

---

## Problem Statement

Illegal waste dumping causes significant environmental damage, yet monitoring vast geographic areas manually is costly and slow. Regulatory agencies lack scalable tools to prioritize inspections or respond proactively.

## Solution

A web platform where users submit a location (map click or coordinates), and EcoWatch AI:
1. Fetches satellite imagery for that area
2. Runs AI analysis (OpenAI Vision) to detect signs of illegal dumping
3. Generates an environmental risk score with an explanation
4. Displays historical trends and aggregate statistics on a dashboard

---

## Target Users

| User | Primary Need |
|---|---|
| Environmental agency staff | Prioritize field inspections with AI triage |
| Municipal workers | Monitor jurisdictions for compliance violations |
| NGO / researchers | Gather data for reports and advocacy |
| Citizens | Report suspected sites quickly |

---

## Core Features (MVP)

### 1. Interactive Map (Mapbox)
- Full-screen map as the primary UI surface
- Click anywhere to select an area of interest
- Display detected sites as color-coded markers (risk level: low / medium / high / critical)
- Cluster markers at zoom-out; expand on zoom-in

### 2. AI Site Analysis
- User selects a location on the map
- System fetches a satellite tile for that bounding box
- OpenAI Vision API analyzes the image for:
  - Waste accumulation indicators
  - Vegetation damage
  - Unusual land discoloration
  - Vehicle tracks / access roads to remote areas
- Returns: risk score (0–100), confidence %, detected features list, recommended action

### 3. Report Panel (Side Drawer)
- Opens after analysis completes
- Shows: satellite image preview, risk score gauge, AI findings breakdown, timestamp, coordinates
- "Export PDF" button (browser print / jsPDF)
- "Flag for inspection" action (marks site as reported in local state)

### 4. Dashboard / Analytics
- Summary stats: total sites analyzed, high-risk count, sites flagged, trend over time
- Recharts line chart: analyses per day
- Recharts bar chart: risk level distribution
- Recent activity feed

### 5. Site History
- Persistent list of all analyzed locations (localStorage for MVP)
- Filter by risk level, date range
- Click to re-open any report

### 6. Citizen Photo Reports + Cross-Verification ⭐
- Photo upload: drag & drop on desktop, direct camera capture on mobile
- Browser geolocation auto-fills coordinates (manual map-pick fallback)
- AI analyzes the ground-level photo (waste type, scale, hazard level)
- Automatic cross-verification: satellite tile for the same coordinates is
  fetched and analyzed together with the photo in one multi-image AI request
- Verification status (confirmed / unconfirmed / contradicted) shown on the
  report; confirmed sites get a distinct ✅ marker and elevated priority

### 7. Ecosystem Disruption Detection & Forecasting 🔮
- AI assesses each analyzed site for ecosystem damage signals: vegetation
  loss, water body shrinkage/contamination, soil salinization, habitat
  fragmentation
- **Forecast engine:** based on accumulated analyses + seeded historical
  trends, AI generates a 6–12 month projection per site and per district
  ("If unaddressed, degradation will likely spread to X within Y months")
- Dashboard "Forecast" tab: projected risk trend lines (dashed = forecast),
  AI-written regional outlook summary, top-3 sites needing urgent action

### 8. Mosquito Risk Module (Atyrau-specific) 🦟
- Mosquito breeding hotspots correlate with stagnant water — which IS
  visible from satellite (Zhaiyk floodplain, spring flood pools, blocked
  drainage)
- Satellite analysis prompt extended with: standing water detection,
  floodplain proximity, drainage condition
- **Mosquito Risk Index (0–100)** per location, computed from: standing
  water presence (AI) + season (spring flood = peak) + distance to river
  + temperature (seeded climate data)
- Map layer toggle: 🦟 mosquito risk heatmap over the region
- Seasonal forecast chart: projected mosquito activity by month with peak
  warnings (May–July flood season)
- Citizen reports can be tagged "mosquito breeding site" (stagnant water
  photo) and feed the index

### 9. Regional Ecology Analytics
- Extended dashboard for Atyrau region: issue-type breakdown (oil / dumping /
  degradation), district comparison, air quality (AQI) trends, Zhaiyk river
  pollution index, verification funnel
- Mapbox heatmap layer toggle showing risk density across the region
- Live data from user analyses + seeded realistic historical dataset

---

## Out of Scope (MVP)

- Real satellite imagery API integration (use Mapbox Static Images or simulated tiles)
- User authentication / multi-tenant accounts
- Backend database persistence
- Mobile native app
- Real-time alerts / push notifications

---

## Success Metrics (Hackathon Demo)

- End-to-end flow works: select location → AI analysis → risk report in < 15 seconds
- Map shows at least 20 pre-seeded demo sites across different risk levels
- Dashboard charts render with meaningful data
- UI is polished, responsive (desktop-first), with smooth Framer Motion transitions

---

## Non-Functional Requirements

- **Performance:** Analysis response < 10s (OpenAI call + rendering)
- **Accessibility:** WCAG AA color contrast on risk badges
- **Responsiveness:** Functional on 1280px+ screens (demo machine); graceful degradation to 768px
- **Error states:** Friendly messages if OpenAI API fails; retry button
