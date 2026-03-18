# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**STRANGE SIGNALS** — An interactive paranormal sightings correlation map visualizing 258K+ geocoded records across three categories: UFO/UAP, Bigfoot/Sasquatch, and Haunted Places. Features five analysis modes plus an advanced correlation suite with SIGNAL AI assistant.

## How to Run

### First-time setup (data pipeline)
```bash
pip install -r requirements.txt
bash setup_sightings.sh            # Downloads 5 datasets + builds JSON (~184K records)
```

### Development
```bash
python -m http.server 8001         # Serve from project root
# Open http://localhost:8001
```

## File Map

```
index.html                 HTML shell — structure, CDN refs, links CSS/JS
strange-signals.css        All styles — CSS vars, layout, sidebar, charts
strange-signals.js         All logic (~1500 lines) — IIFE-wrapped app code

DATA PIPELINE (Python 3)
  setup_sightings.sh         Downloads 5 raw CSV datasets from GitHub/TidyTuesday
  build_sightings_workbook.py  Consolidates CSVs → 7-tab Excel workbook
  export_map_data.py         Excel → compact JSON for the map
  build_overlay_data.py      Population density grids + military bases overlay
  build_population_grid.py   Per-capita correlation data

  data/
    military_bases.json      Curated overlay dataset (committed)
    sightings_map_data.json  Generated: 184K records loaded by the map (git-ignored)
    raw/                     Downloaded CSVs (git-ignored)
    *.xlsx                   Generated Excel (git-ignored)

CONFIG
  .claude/launch.json        Dev server: python -m http.server 8001
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
| **Data Loading** | Async fetch + batched processing (30K records per animation frame) |

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

### Datasets (5 sources, ~184K records combined)
1. **UFO NUFORC** (TidyTuesday 2023) — ~96K sightings
2. **UFO planetsig** — ~80K geocoded NUFORC reports
3. **Bigfoot BFRO detailed** — ~5K reports with weather/terrain data
4. **Bigfoot BFRO locations** — ~4.2K lightweight location-only records
5. **Haunted Places (Shadowlands)** — ~11K US ghost/haunting locations

## Coding Conventions

- **No build tools.** Static HTML/CSS/JS app. No webpack, vite, npm, bundlers.
- **IIFE pattern** — all JS wrapped in `(function(){ 'use strict'; ... })();`
- **CDN for libraries** — reference via unpkg.com URLs in HTML `<script>` tags
- **Compact data format** — arrays (not objects) for large datasets to minimize JSON size
- **CSS custom properties** — `:root` variables for all colors, fonts, spacing
- **Git-ignore generated data** — only source code committed; data rebuilt from pipeline
