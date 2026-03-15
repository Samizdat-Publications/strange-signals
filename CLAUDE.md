# Strange Signals — Project Context

## What This Is
Interactive paranormal sightings correlation map ("STRANGE SIGNALS") visualizing 184K+ records of UFO/UAP, Bigfoot/Sasquatch, and Haunted Place sightings across the US. Built as a single-page app.

## Architecture
- **`sightings-map.html`** — The entire Strange Signals app (HTML + CSS + JS in one file). Uses Leaflet, D3, Turf.js, leaflet.heat, MarkerCluster, html2canvas.
- **`setup_sightings.sh`** — Downloads 5 raw datasets from GitHub
- **`build_sightings_workbook.py`** — Consolidates raw CSVs into Excel workbook (7 tabs)
- **`export_map_data.py`** — Exports compact JSON for the map from Excel
- **`demo-data.json`** — Demo data for the GardenSync app (separate project in same repo)
- **`index.html` / `app.js` / `styles.css` / `guide.html` / `proxy.py`** — GardenSync community garden app (separate project, shares repo)

## Key Features (Strange Signals)
- 4 visualization modes: clustered markers, heatmap, hexbin density, Pearson correlation
- D3 timeline with brushable year filtering
- Proximity analysis on marker click
- Sidebar filters: year range, state, subcategory, per-category toggles
- CSV export, PNG map screenshot export, geocode search
- Insights panel: top states, peak years, most common shapes (key: I)
- Dark/light theme toggle with localStorage persistence (key: T)
- Progressive data loading with download progress indicator
- Spatial-indexed correlation engine for fast hex-based analysis
- URL state persistence, keyboard shortcuts

## Data Pipeline
```
setup_sightings.sh → data/raw/*.csv → build_sightings_workbook.py → data/*.xlsx → export_map_data.py → data/sightings_map_data.json
```

## Current Status
- MVP complete — research-focused single-user tool for paranormal sighting analysis
- Future: mine additional datasets and add to the platform
- UI/UX polish pass completed:
  - Fixed WCAG AA color contrast (`--text-dim` bumped to `#8a9ab0`)
  - Added aria-labels on all form inputs, icon buttons, and SVG elements
  - Added `resp.ok` check and `json.data` validation on data fetch
  - Added retry button on load failure
  - Added empty state overlay when filters return zero results
  - Added "RENDERING..." indicator during view switches
  - Added help text for correlation analysis, timeline, and filters
  - Added title tooltips on all view mode buttons
  - Added small phone breakpoint (`<400px`)
  - Increased mobile touch targets to 44px minimum
  - Upgraded to semantic HTML (`<main>`, `<section>`, `<h2>`)
  - Extracted `NUM_CATS` constant to replace hardcoded `3`
  - Removed dead code (`proxMarkers`, `collA` + stale comments)
- Feature additions completed:
  - PNG map screenshot export (via html2canvas)
  - Insights panel with category breakdown, top states, peak years, top shapes
  - Grid-based spatial index for correlation engine (~10x faster)
  - Streaming download with progress indicator
  - Dark/light theme toggle with CARTO tile layer swap

## Conventions
- Strange Signals is a single-file app — all changes go in `sightings-map.html`
- Categories are indexed 0=UFO/UAP, 1=Bigfoot/Sasquatch, 2=Haunted Place
- Field indices: F={LAT:0, LON:1, CAT:2, DATE:3, LOC:4, SUB:5, DESC:6}
- CSS variables defined in `:root` block at top of `<style>`
- No build system — static files served directly
