# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**STRANGE SIGNALS** — An interactive paranormal sightings correlation map visualizing 276K+ geocoded records across three categories: UFO/UAP, Bigfoot/Sasquatch, and Haunted Places. Features five analysis modes plus an advanced correlation suite with SIGNAL AI assistant. Includes historical data back to 593 BC and worldwide coverage.

## How to Run

### First-time setup (data pipeline)
```bash
pip install -r requirements.txt
bash setup_sightings.sh            # Downloads 10 datasets + builds JSON (~276K records)
```

### Development
```bash
python -m http.server 8002         # Serve from project root (matches .claude/launch.json)
# Open http://localhost:8002
```

## File Map

```
index.html                 HTML shell — structure, CDN refs, links CSS/JS
strange-signals.css        All styles — CSS vars, layout, sidebar, charts
strange-signals.js         Main app logic — IIFE-wrapped
parse-worker.js            Web Worker: off-main-thread JSON parsing
hex-worker.js              Web Worker: hex-grid correlation computation
data-worker.js             Web Worker: async JSON load + parse + validation (large datasets)
ai-assistant.js            SIGNAL AI assistant (Anthropic API, tool use)
signal-charts.js           Correlation chart rendering (D3)
signal-reports.js          Report generation for SIGNAL AI
annotations.js             User-drawn map annotations layer
highlight-layer.js         Map highlighting layer
window-manager.js          Floating window / panel manager

DATA PIPELINE (Python 3)
  setup_sightings.sh         Downloads 10 raw datasets from GitHub/TidyTuesday/RR0
  build_sightings_workbook.py  Consolidates CSVs → 10-tab Excel workbook
  export_map_data.py         Excel → compact JSON for the map
  build_overlay_data.py      Population density grids + military bases overlay
  build_population_grid.py   Per-capita correlation data
  build_fireball_data.py     NASA CNEOS fireball detections
  build_earthquake_data.py   USGS FDSNWS earthquake catalog
  build_cryptid_data.py      Curated non-Bigfoot cryptid sightings
  build_missing411_data.py   Missing 411 disappearance cases
  build_geomagnetic_data.py  NOAA geomagnetic storm events
  build_cave_data.py         US cave systems and karst regions
  build_airspace_data.py     FAA special use airspace zones

  data/
    military_bases.json      98 military/DOE installations (committed)
    restricted_airspace.json 105 FAA restricted/MOA/warning zones (committed)
    usgs_earthquakes.json    20K USGS M2.5+ earthquakes 2019-2025 (committed)
    us_caves.json            104 major US cave systems (committed)
    nasa_fireballs.json      29 NASA CNEOS fireball detections (committed)
    cryptid_sightings.json   105 non-Bigfoot cryptid locations (committed)
    missing411.json          71 Missing 411 disappearance cases (committed)
    geomagnetic_storms.json  92 G3+ geomagnetic storms 1950-2026 (committed)
    sightings_map_data.json  Generated: 276K records loaded by the map (git-ignored)
    raw/                     Downloaded CSVs (git-ignored)
    *.xlsx                   Generated Excel (git-ignored)

CONFIG
  .claude/launch.json        Dev server: python -m http.server 8002
  .env                       API keys (git-ignored — see .env.example)
  .env.example               Template for .env
  requirements.txt           Python deps: pandas, openpyxl, numpy, python-dotenv
```

## Technical Architecture

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
| **Analysis** | `pearsonR()`, `buildSpatialIndex()`, `getOrBuildHexData()` with caching |
| **Correlation** | Spatial (2-cat hex Pearson), Matrix (3x3 SVG), Temporal (D3 rolling+seasonal), Cluster Detection (BFS on hex adjacency), Nearest-Neighbor (grid-indexed NN distances) |
| **Views** | markers, heatmap, hexbin, correlation — dispatched via `renderCurrentView()` |
| **Timeline** | D3 stacked bar chart with year brush for filtering |
| **Filters** | Year range, state, subcategory text, timeline brush integration |
| **URL State** | Map position, zoom, view mode, layers, filters saved to URL hash |
| **Overlays** | 10 toggleable layers: military, airspace, earthquakes, caves, fireballs, cryptids, missing411, geomagnetic storms, parks, historic sites — lazy-loaded on toggle |
| **Data Loading** | Web Worker async JSON load + parse + validation (with main-thread fallback); batched rendering (5K markers per setTimeout chunk) |

### CSS Architecture (strange-signals.css)
- CSS custom properties in `:root` for theming (dark sci-fi aesthetic)
- Fonts: Orbitron (display), Space Mono (body) — Google Fonts CDN
- Layout: fixed header + sidebar (650px, collapsible) + map + timeline panel
- Mobile responsive at 768px breakpoint
- Scanline overlay effect on sidebar for retro CRT feel

### CDN Dependencies (loaded in index.html)
| Library | Version | Purpose |
|---------|---------|---------|
| Leaflet | 1.9.4 | Map rendering, markers, popups |
| Leaflet MarkerCluster | 1.5.3 | Dynamic cluster visualization |
| leaflet-heat | 0.2.0 | Heatmap overlay |
| Turf.js | 7 | Geospatial analysis (hexGrid, distance, bbox, centroid, booleanPointInPolygon) |
| D3.js | 7 | Timeline, correlation charts |
| html2canvas | 1.4.1 | Snapshot export (P key) |

### Core Datasets (sources combined; totals after dedup)
1. **UFO NUFORC** (TidyTuesday 2023) — ~96K sightings
2. **UFO planetsig** — ~80K geocoded NUFORC reports
3. **Bigfoot BFRO detailed** — ~5K reports with weather/terrain data
4. **Bigfoot BFRO locations** — ~4.2K lightweight location-only records
5. **Haunted Places (Shadowlands)** — ~11K US ghost/haunting locations
6. **UFO CORGIS** — ~60K NUFORC with nested columns
7. **UFO wlouie1** — ~80K geocoded (includes ~3.6K Canadian)
8. **Larry Hatch *U* Database** (RR0) — ~18K historical worldwide UFO cases (593 BC–2003)

### Overlay Datasets (7 additional sources)
6. **Restricted Airspace** — 105 FAA zones (Restricted, MOA, Warning, Prohibited, Alert)
7. **USGS Earthquakes** — 20K M2.5+ events (2019-2025) for earthquake-lights hypothesis
8. **US Cave Systems** — 104 major caves/karst for Bigfoot/Missing 411 correlation
9. **NASA Fireballs** — 29 CNEOS detections over continental US (1994-2026)
10. **Cryptid Sightings** — 105 non-Bigfoot cryptids (Mothman, Jersey Devil, Champ, etc)
11. **Missing 411** — 71 National Park disappearance cases
12. **Geomagnetic Storms** — 92 G3+ storms (1950-2026) as temporal timeline overlay

## Coding Conventions

- **No build tools.** Static HTML/CSS/JS app. No webpack, vite, npm, bundlers.
- **IIFE pattern** — all JS wrapped in `(function(){ 'use strict'; ... })();`
- **CDN for libraries** — reference via unpkg.com URLs in HTML `<script>` tags
- **Compact data format** — arrays (not objects) for large datasets to minimize JSON size
- **CSS custom properties** — `:root` variables for all colors, fonts, spacing
- **Git-ignore generated data** — only source code committed; data rebuilt from pipeline
