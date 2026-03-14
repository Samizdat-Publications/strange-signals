# CLAUDE.md - AI Assistant Guide for strange-signals

## Project Overview

This repository contains two web applications served as static sites:

1. **GardenSync** — An interactive garden planner with companion planting, grow scheduling, journaling, and a Claude AI assistant ("Garden Buddy"). Built for the Food Not Bombs Canton community garden.
2. **STRANGE SIGNALS** — A paranormal sightings correlation map visualizing 184K+ UFO, Bigfoot, and haunted place records with spatial analysis.

## Tech Stack

- **Frontend:** Vanilla HTML5/CSS3/ES6+ JavaScript (no framework, no build step)
- **Maps:** Leaflet.js, Leaflet.markercluster, Leaflet.heat
- **Data Viz:** D3.js (timeline), Turf.js (geospatial/hex-binning)
- **OCR:** Tesseract.js (seed packet scanning)
- **AI:** Anthropic Claude API (Garden Buddy assistant)
- **Backend/Data:** Python 3 (pandas, openpyxl) for data ingestion
- **State:** localStorage (no database)
- **Dependencies:** All loaded via CDN — no npm/package.json

## File Structure

```
index.html          # GardenSync main application
app.js              # GardenSync core logic (5,900+ lines)
styles.css          # Shared styles for both apps (4,000+ lines)
sightings-map.html  # STRANGE SIGNALS paranormal map
guide.html          # GardenSync user documentation
demo-data.json      # Sample garden state for demos
proxy.py            # CORS proxy server (port 8080)
setup_sightings.sh  # Downloads datasets, builds workbook + JSON
build_sightings_workbook.py  # Consolidates CSVs into Excel
export_map_data.py  # Exports JSON for the sightings map
.gitignore          # Excludes data/, __pycache__, .DS_Store
```

## Running the Applications

### GardenSync
```bash
python3 proxy.py
# Opens at http://localhost:8080
```

### STRANGE SIGNALS (first-time setup)
```bash
pip install pandas openpyxl
bash setup_sightings.sh    # Downloads datasets + builds JSON
python3 -m http.server 8000
# Open sightings-map.html in browser
```

## Development Workflow

- **No build step.** Edit HTML/JS/CSS and reload the browser.
- **No package manager.** All frontend dependencies are CDN-linked.
- **No linter/formatter configured.** Follow existing code style conventions.
- **No test suite.** Test manually in the browser.
- **No CI/CD pipeline.**

## Code Architecture

### GardenSync (app.js)

- **Global `state` object** tracks beds, plants, undo/redo, UI state
- **localStorage** for persistence — saves garden state, custom seeds, journal entries
- **Plant library** — 37+ plants with spacing, companions, enemies, days-to-harvest metadata
- **Tab-based UI** — Bed Planner, Grow Schedule, Planting Log, Harvest, Volunteers, Climate Data, Visualize

Key modules/functions:
- Plant library & search (`matchPlantSearch`, `getFilteredSortedPlants`)
- Bed management (`initGardenBeds`, `placePlant`, `renderPlacedPlants`)
- Companion visualization (`showCompanionIndicators`, `drawCompanionLines`)
- Bed templates (7 pre-made layouts)
- Custom seed creation with OCR (`Tesseract.js`)
- Claude AI assistant (Garden Buddy — FAB chat panel)
- Auto-organization (`autoOrganizeBed`)
- Theme toggle (light/dark via CSS custom properties)
- URL state persistence (base64-encoded garden plans)

### STRANGE SIGNALS (sightings-map.html)

- **Leaflet map** with 4 view modes: Markers, Heatmap, Hex Density, Correlation
- **D3 timeline** — stacked bar chart with brush-to-filter by year
- **Correlation engine** — hex-bin Pearson r calculation, hotspot detection
- **URL hash state** for sharing map position/filters

Key functions:
- `buildTimeline()` — D3 stacked histogram
- `setView()` — switch visualization modes
- `correlationAnalysis()` — Turf.js hexGrid + Pearson r
- `applyFilters()` — category, year, state, search filtering
- `exportVisibleData()` — CSV export

## Coding Conventions

- Vanilla JS with ES6+ features (arrow functions, template literals, destructuring)
- No TypeScript — plain `.js` files
- Procedural/modular style with named functions (not class-based)
- CSS custom properties for theming (`--emerald`, `--teal`, `--red`, `--amber`)
- Inline `<script>` blocks in HTML files for the sightings map; separate `app.js` for GardenSync
- Python scripts use standard library + pandas

## Important Notes

- `app.js` is large (~268 KB, ~6K lines). Changes should target specific functions.
- The `data/` directory is gitignored — raw datasets are downloaded via `setup_sightings.sh`.
- `proxy.py` handles CORS proxying for Claude and Gemini API calls (configured on lines 17-18).
- `demo-data.json` provides a ready-made garden state for testing without manual setup.
