# CLAUDE.md — Project Instructions for Claude Code

> This file is read automatically at the start of every Claude Code session.
> It gives Claude full context on the project so you don't have to re-explain anything.

## Project Overview

This repository contains two independent web applications served from the same directory:

### STRANGE SIGNALS (primary focus)
An interactive paranormal sightings correlation map visualizing 184K+ geocoded records across three categories: UFO/UAP, Bigfoot/Sasquatch, and Haunted Places. Features five analysis modes plus an advanced correlation suite.

- **Entry point:** `sightings-map.html`
- **URL:** `http://localhost:8001/sightings-map.html`

### GardenSync (secondary — do not modify unless asked)
A garden bed planner for Food Not Bombs Canton with AI assistant integration.

- **Entry point:** `index.html`
- **Files:** `index.html`, `app.js` (6K lines), `styles.css` (4K lines), `guide.html`, `demo-data.json`
- **DO NOT** refactor, restructure, or modify GardenSync files unless explicitly asked.

---

## File Map

```
STRANGE SIGNALS
  sightings-map.html        HTML shell (~250 lines) — structure, CDN refs, links CSS/JS
  strange-signals.css        All styles (~250 lines) — CSS vars, layout, sidebar, charts
  strange-signals.js         All logic (~1360 lines) — IIFE-wrapped app code

GARDENSYNC (do not touch)
  index.html                 GardenSync UI
  app.js                     GardenSync logic (271KB — leave alone)
  styles.css                 GardenSync styles (104KB — leave alone)
  guide.html                 GardenSync user guide
  demo-data.json             GardenSync demo state

SHARED
  proxy.py                   CORS proxy (port 8080) for Gemini + Claude APIs
                             Reads keys from .env or request headers
                             Only used by GardenSync — STRANGE SIGNALS has no API calls

DATA PIPELINE (Python 3)
  setup_sightings.sh         Downloads 5 raw CSV datasets from GitHub/TidyTuesday
  build_sightings_workbook.py  Consolidates CSVs → 7-tab Excel workbook
  export_map_data.py         Excel → compact JSON for the map

  data/
    sightings_map_data.json  Generated: 184K records loaded by the map (git-ignored)
    raw/                     Downloaded CSVs (git-ignored)
    *.xlsx                   Generated Excel (git-ignored)

CONFIG
  .claude/launch.json        Dev server: python -m http.server 8001
  .env                       API keys (git-ignored — see .env.example)
  .env.example               Template for .env
  requirements.txt           Python deps: pandas, openpyxl, numpy, python-dotenv
  .gitignore                 Ignores .env, data/raw/, data/*.xlsx, data/*.json
```

---

## How to Run

### First-time setup (data pipeline)
```bash
pip install -r requirements.txt
bash setup_sightings.sh            # Downloads datasets + builds JSON (~184K records)
```

### Development (STRANGE SIGNALS)
```bash
python -m http.server 8001         # Serve from project root
# Open http://localhost:8001/sightings-map.html
```

### With API proxy (for GardenSync AI features only)
```bash
cp .env.example .env               # Fill in API keys
python proxy.py                    # Serves on port 8080 with CORS proxy
```

---

## STRANGE SIGNALS — Technical Architecture

### Data Format
The map loads `data/sightings_map_data.json`:
```json
{
  "categories": ["UFO/UAP", "Bigfoot/Sasquatch", "Haunted Place"],
  "fields": ["lat", "lon", "cat", "date", "location", "subcategory", "description"],
  "data": [[39.12, -84.56, 0, "2020-01-15", "Cincinnati, OH", "triangle", "Bright light..."], ...]
}
```
Records are flat arrays (not objects) for compact JSON. Field indices:
```js
const F = {LAT:0, LON:1, CAT:2, DATE:3, LOC:4, SUB:5, DESC:6};
```

### JS Architecture (strange-signals.js)
Everything is wrapped in an IIFE `(function(){ 'use strict'; ... })();`

| Section | What It Does |
|---------|-------------|
| **Constants** | `CAT_COLORS`, `CAT_NAMES`, `CAT_RGB`, field index map `F` |
| **State** | `allData`, `filteredCat[3]`, `currentView`, layer refs, analysis caches |
| **Map Init** | Leaflet dark CARTO tile layer, centered on US (39.5, -98.35, zoom 4) |
| **Markers** | `makeIcon()`, `makePopup()` with proximity analysis, `createMarker()` |
| **Analysis Infrastructure** | `pearsonR()`, `buildSpatialIndex()`, `getOrBuildHexData()` with caching |
| **Correlation Sub-Modes** | Spatial (2-cat hex Pearson), Matrix (3x3 SVG), Temporal (D3 rolling+seasonal), Cluster Detection (BFS on hex adjacency), Nearest-Neighbor (grid-indexed NN distances) |
| **Views** | markers, heatmap, hexbin, correlation — dispatched via `renderCurrentView()` |
| **Timeline** | D3 stacked bar chart with year brush for filtering |
| **Filters** | Year range, state, subcategory text, timeline brush integration |
| **URL State** | Map position, zoom, view mode, layers, filters saved to URL hash |
| **Data Loading** | Async fetch + batched processing (30K records per animation frame) |

### CSS Architecture (strange-signals.css)
- CSS custom properties in `:root` for theming (dark sci-fi aesthetic)
- Fonts: Orbitron (display), Space Mono (body) — loaded via Google Fonts CDN
- Layout: fixed header + sidebar (650px, collapsible) + map + timeline panel
- Mobile responsive at 768px breakpoint
- Scanline overlay effect on sidebar for retro CRT feel

### CDN Dependencies (loaded in sightings-map.html)
| Library | Version | Purpose |
|---------|---------|---------|
| Leaflet | 1.9.4 | Map rendering, markers, popups |
| Leaflet MarkerCluster | 1.5.3 | Dynamic cluster visualization |
| leaflet-heat | 0.2.0 | Heatmap overlay |
| Turf.js | 7 | Geospatial analysis (hexGrid, distance, bbox, centroid, booleanPointInPolygon) |
| D3.js | 7 | Timeline, correlation charts (scales, axes, brush, stacked bars, line charts) |

### Datasets (5 sources, ~184K records combined)
1. **UFO NUFORC** (TidyTuesday 2023) — ~96K sightings, merged with places table for geocoding
2. **UFO planetsig** — ~80K geocoded NUFORC reports with standardized timestamps
3. **Bigfoot BFRO detailed** — ~5K reports with weather, moon phase, terrain data
4. **Bigfoot BFRO locations** — ~4.2K lightweight location-only records
5. **Haunted Places (Shadowlands)** — ~11K US ghost/haunting locations

---

## Coding Conventions

- **No build tools.** Static HTML/CSS/JS app. No webpack, vite, npm, bundlers.
- **IIFE pattern** — all JS wrapped in `(function(){ 'use strict'; ... })();`
- **CDN for libraries** — reference via unpkg.com URLs in HTML `<script>` tags
- **Compact data format** — arrays (not objects) for large datasets to minimize JSON size
- **CSS custom properties** — `:root` variables for all colors, fonts, spacing
- **Git-ignore generated data** — only source code committed; data rebuilt from pipeline
- **Commit messages** — imperative mood, explain "why" not "what"

---

## Changelog

| Commit | What Was Built |
|--------|---------------|
| `c7be284` | Initial paranormal sightings dataset consolidator + interactive map |
| `9449b86` | Expanded to 184K+ records across 5 datasets with deduplication |
| `e4fac24` | Full-featured map: markers, heatmap, hexbin, correlation, timeline, filters, keyboard shortcuts, URL state, CSV export |
| `0fdbde8` | Advanced correlation suite: 3x3 matrix (SVG), temporal dashboard (rolling + seasonal D3 charts), cluster detection (BFS on hex adjacency), nearest-neighbor analysis with attraction zones |
| `32d621b` | Project restructuring: split monolith into CSS/JS/HTML, added .env secrets management, requirements.txt, CLAUDE.md |
| `2608a04` | Bug fixes: heatmap visibility (rgba gradients, dynamic radius/maxZoom), hex/corr auto-scaling (zoom-adaptive cell sizes), temporal close button (pink button styling) |

---

## What Could Be Built Next

- AI-powered anomaly narrative generation (would use proxy.py + Claude API)
- Additional data sources (cattle mutilation, crop circles, EM anomaly databases)
- Time-lapse animation mode (play sightings chronologically)
- User annotations / bookmarked locations
- Shareable analysis snapshots (encode analysis state in URL)
- Monte Carlo significance testing for correlation p-values
- Data source quality scoring and confidence intervals
