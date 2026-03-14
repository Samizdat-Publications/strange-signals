# CLAUDE.md - AI Assistant Guide for STRANGE SIGNALS

## Project Overview

**STRANGE SIGNALS** is a paranormal sightings data correlation and visualization map. It displays 184K+ UFO/UAP, Bigfoot, and haunted place records on an interactive map with spatial correlation analysis, hex-bin density visualization, heatmaps, and a D3-powered timeline.

**This is a standalone project.** It has no association with GardenSync or any other project. Do not reference, import, or conflate code from other repositories.

## Tech Stack

- **Frontend:** Single self-contained HTML file with inline CSS and JS (no framework, no build step)
- **Maps:** Leaflet.js 1.9.4, Leaflet.markercluster 1.5.3, Leaflet.heat 0.2.0
- **Data Viz:** D3.js v7 (timeline histogram with brush filtering), Turf.js v7 (geospatial hex-binning, Pearson correlation)
- **Data Pipeline:** Python 3 (pandas, openpyxl) for downloading and consolidating datasets
- **Dependencies:** All frontend libs loaded via CDN from unpkg.com — no npm/package.json
- **Fonts:** Orbitron (display), Space Mono (monospace)

## File Structure

```
sightings-map.html              # Main application (self-contained HTML/CSS/JS)
setup_sightings.sh              # Downloads 5 TidyTuesday datasets + planetsig data
build_sightings_workbook.py     # Consolidates CSVs into Excel workbook
export_map_data.py              # Exports consolidated JSON for the map
.gitignore                      # Excludes data/, __pycache__, .DS_Store
CLAUDE.md                       # This file
```

## Running the Application

### First-time setup (data pipeline)
```bash
pip install pandas openpyxl
bash setup_sightings.sh         # Downloads datasets, builds workbook + JSON
```

### Serving the app
```bash
python3 -m http.server 8000
# Open http://localhost:8000/sightings-map.html in browser
```

The app loads `data/sightings_map_data.json` via fetch — it must be served over HTTP, not opened as a local file.

## Code Architecture (sightings-map.html)

The entire app is a single HTML file (~1,074 lines) with inline `<style>` and `<script>` blocks.

### CSS (lines 13-209)
- CSS custom properties for theming (`--bg`, `--green`, `--cyan`, `--pink`, `--orange`, `--purple`)
- Fixed layout: header (52px) + sidebar (320px) + map + timeline (180px)
- Mobile breakpoint at 768px with slide-out sidebar

### HTML (lines 211-382)
- Loading screen with radar animation
- Header with view mode nav + search
- Sidebar: layers, view mode, correlation controls, filters, stats, proximity, keyboard shortcuts
- Main area: map container + timeline panel

### JavaScript (lines 390-1071)
Self-executing IIFE with these major systems:

| Function | Purpose |
|---|---|
| `init()` | Data loading, progress UI, bootstraps everything |
| `applyFilters()` | Filters by category, year range, state, subcategory, timeline brush |
| `renderMarkers()` | Clustered marker view with proximity popups |
| `renderHeatmap()` | Per-category heat layers |
| `renderHexbin()` | Turf.js hex grid with Viridis color scale |
| `runCorrelation(catA, catB)` | Pearson r across hex cells, hotspot detection |
| `buildTimeline()` | D3 stacked bar chart with brush-to-filter |
| `setView(view)` | Switch between markers/heatmap/hexbin/correlation |
| `saveState()` / `loadState()` | URL hash persistence for sharing |
| `exportCSV()` | Download filtered data as CSV |
| `geocodeSearch(query)` | Nominatim OSM location lookup |

### Data format
Records are arrays: `[lat, lon, category, date, location, subcategory, description]`
- Category 0 = UFO/UAP, 1 = Bigfoot/Sasquatch, 2 = Haunted Place
- Field indices defined in constant `F = {LAT:0, LON:1, CAT:2, DATE:3, LOC:4, SUB:5, DESC:6}`

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| 1/2/3 | Toggle UFO / Bigfoot / Haunted layers |
| M/H/X/C | Switch to Markers / Heatmap / Hex / Correlation view |
| / | Focus search box |
| S | Toggle sidebar |
| Esc | Reset brush + blur search |

## Coding Conventions

- Vanilla ES6+ JavaScript — no framework, no modules, no TypeScript
- Compact/minified style for CSS; readable style for JS
- IIFE pattern wraps all JS to avoid globals
- All state is in closure variables (`allData`, `filteredCat`, `currentView`, etc.)
- Named functions, not classes
- CSS custom properties for all colors and layout dimensions
- Python scripts use pandas + standard library

## Important Notes

- The `data/` directory is gitignored — raw CSVs and generated JSON are not committed
- `setup_sightings.sh` downloads from TidyTuesday GitHub repos and planetsig
- The map defaults to center US (39.5, -98.35) at zoom 4
- Correlation engine does point-in-polygon for each hex cell — can be slow with large hex counts
- Timeline only shows years 1900-2030; older records are excluded from the histogram
