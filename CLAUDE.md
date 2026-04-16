# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**STRANGE SIGNALS** — An interactive paranormal-sightings correlation map visualizing **~385K geocoded records** across three categories (UFO/UAP, Bigfoot/Sasquatch, Haunted Places) with 11 toggleable overlay datasets and an in-browser **Signal Analyst** AI (Anthropic Messages API). Historical coverage spans **593 BC → present**, worldwide. Static HTML/CSS/JS — no build toolchain.

## How to Run

### First-time setup (data pipeline)

```bash
pip install -r requirements.txt
bash setup_sightings.sh               # Downloads 9 CSV sources + builds Excel + JSON (~276K records)
python geocode_nuforc_hf.py --run     # OPTIONAL: geocode HuggingFace NUFORC (adds ~109K → 385K total)
```

The HF NUFORC step is optional because its gazetteer download is slow and the app works fine at 276K records. Run it if you want worldwide city-level coverage. Output lands in `data/sightings_map_data.json` (git-ignored).

### Development

```bash
python -m http.server 8002            # Serve from project root (matches .claude/launch.json)
# Open http://localhost:8002
```

The app is fully static — you can also open `index.html` directly, but a local server is needed for `fetch('data/...')` and Web Workers.

## File Map

```
index.html                  HTML shell — CDN refs (Leaflet, Turf, D3, html2canvas), all <link> and <script> tags
strange-signals.js          Main app — IIFE-wrapped. Map, markers, views, correlation, timeline, filters, URL state, overlays
strange-signals.css         Main styles — CSS custom props, layout, sidebar, charts, scanline effect
ai-assistant.js             Signal Analyst (Anthropic Messages API, 24 tools, tool-use loop, streaming)
ai-assistant.css            Chat panel styles — bubbles, typing indicator, settings gear, error toast
window-manager.js           Floating draggable/resizable window system (used by AI reports, temporal overlay)
window-manager.css          Window chrome — titlebar, resize handles, z-stacking, minimize animation
signal-charts.js            D3 chart rendering (bar/line/pie/scatter) — used for inline AI reports
signal-reports.js           Report generation — creates draggable HTML report windows, downloadable export
highlight-layer.js          Radar-ping + labeled spotlight animations driven by the AI assistant
annotations.js              User map annotations (6 pin types, localStorage persistence, JSON export/import)
annotations.css             Annotation toolbar + pin marker styles
parse-worker.js             Web Worker: off-main-thread JSON parse + per-category batching
hex-worker.js               Web Worker: hex-grid binning via Turf.js for correlation analysis

DATA PIPELINE (Python 3)
  setup_sightings.sh          Top-level runner. Downloads 9 CSVs, then invokes the builders below.
  build_sightings_workbook.py Consolidates raw CSVs → 10-tab Excel workbook
  export_map_data.py          Excel → compact array-based JSON (sightings_map_data.json)
  build_population_grid.py    US census tract → per-capita grid (us_population_density.json)
  build_overlay_data.py       Orchestrates the overlay builders below
    build_airspace_data.py       FAA special use airspace zones
    build_cave_data.py           US cave systems and karst regions
    build_cryptid_data.py        Curated non-Bigfoot cryptids
    build_earthquake_data.py     USGS FDSNWS M2.5+ catalog
    build_fireball_data.py       NASA CNEOS atmospheric bolides
    build_geomagnetic_data.py    NOAA G3+ geomagnetic storms
    build_missing411_data.py     Missing 411 National Park cases
  geocode_nuforc_hf.py        Standalone: HF NUFORC gazetteer geocoding (~109K records, optional)

  data/
    sightings_map_data.json    Generated: ~385K records (git-ignored)
    us_population_density.json Per-capita grid for population-adjusted correlation (committed)
    military_bases.json        98 military/DOE installations (committed)
    restricted_airspace.json   105 FAA restricted/MOA/warning zones (committed)
    national_parks.json        National Parks polygons (committed)
    historic_sites.json        NRHP historic sites (committed)
    usgs_earthquakes.json      20K USGS M2.5+ earthquakes 2019-2025 (committed)
    us_caves.json              104 major US cave systems (committed)
    nasa_fireballs.json        29 NASA CNEOS fireball detections (committed)
    cryptid_sightings.json     105 non-Bigfoot cryptid locations (committed)
    missing411.json            71 Missing 411 disappearance cases (committed)
    geomagnetic_storms.json    92 G3+ geomagnetic storms 1950-2026 (committed)
    raw/                       Downloaded CSVs (git-ignored)
    *.xlsx                     Generated Excel workbook (git-ignored)

DOCS
  README.md                   Public-facing feature list, screenshots, quickstart
  CONTRIBUTING.md             Contributor guidelines
  LICENSE                     MIT
  docs/index.html             GitHub Pages landing page
  docs/superpowers/           Phase-by-phase implementation plans and design specs
  screenshots/                PNG marketing imagery used by docs/index.html and README

CONFIG
  .claude/launch.json         Dev server configs (strange-signals on 8002 + branch previews)
  .env.example                Template (ANTHROPIC_API_KEY — BUT key is actually entered via UI gear, not env)
  .env                        Git-ignored secrets (optional — UI handles keys via localStorage)
  .gitignore                  Excludes: .env, data/raw/, data/*.xlsx, __pycache__, .claude/worktrees/, etc.
  requirements.txt            Python deps: pandas, openpyxl, numpy, python-dotenv
```

## Technical Architecture

### Data Format

`data/sightings_map_data.json` — compact array-based for small payload:

```json
{
  "categories": ["UFO/UAP", "Bigfoot/Sasquatch", "Haunted Place"],
  "fields": ["lat", "lon", "cat", "date", "location", "subcategory", "description"],
  "data": [[39.12, -84.56, 0, "2020-01-15", "Cincinnati, OH", "triangle", "Bright light..."], ...]
}
```

Records are flat arrays, not objects. Field indices in `strange-signals.js`:

```js
const F = {LAT:0, LON:1, CAT:2, DATE:3, LOC:4, SUB:5, DESC:6};
```

Overlay JSON files use their own per-file field maps (`MF` for military, `AF` for airspace, `CF` for caves, etc.).

### JS Architecture (strange-signals.js)

Everything wrapped in `(function(){ 'use strict'; ... })();` and uses module-scoped constants — no globals leak except `TABLER_SVG` and `tablerIcon()`.

| Section | What It Does |
|---------|--------------|
| **Constants** | `CAT_COLORS`, `CAT_NAMES`, `CAT_RGB`, field index `F`, `TABLER_SVG` registry |
| **State** | `allData`, `filteredCat[3]`, `currentView`, layer refs, analysis caches |
| **Map Init** | Leaflet dark CARTO tile layer, centered on US (39.5, -98.35, zoom 4) |
| **Icons** | `TABLER_SVG` registry of 15 inline Tabler SVGs + `tablerIcon(name,color,size)` helper |
| **Markers** | `makePopup()` with proximity analysis, `createMarker()`, delegated popup toggle |
| **Analysis** | `pearsonR()`, `buildSpatialIndex()`, `getOrBuildHexData()` with cache invalidation on filter change |
| **Correlation** | Five sub-modes — see "Correlation Analysis" below |
| **Views** | markers, heatmap, hexbin, correlation — dispatched via `renderCurrentView()` |
| **Timeline** | D3 stacked bar chart with year brush for filtering |
| **Filters** | Year range, state, subcategory text, timeline brush — all call `applyFilters()` |
| **URL State** | Map position, zoom, view mode, layers, filters, overlays → `location.hash` via URLSearchParams |
| **Overlays** | 11 toggleable layers, lazy-loaded on first toggle |
| **Data Loading** | `parse-worker.js` decodes JSON off-main-thread, batched rendering (5K markers per `setTimeout` chunk) |

### Web Workers

| Worker | Invoked From | Message In | Message Out |
|--------|--------------|-----------|-------------|
| **parse-worker.js** | `parseInWorker()` in strange-signals.js | `ArrayBuffer` of JSON text | `{type:'batch', cat, records}` (repeated), then `{type:'done', total}` or `{type:'error'}` |
| **hex-worker.js** | `getOrBuildHexData()` in strange-signals.js | `{bbox, cellSide, points:Float64Array, nCats}` | `{type:'progress', pct, stage}` → `{type:'result', gridJSON, counts}` or `{type:'error'}` |

Both workers fall back to main-thread computation if `Worker` construction fails.

### Views and Correlation Modes

`currentView` has four values, dispatched in `renderCurrentView()`:

| View | Renders |
|------|---------|
| `markers` | Leaflet MarkerCluster with Tabler icon divIcons |
| `heatmap` | Three blended `leaflet-heat` layers (one per category) |
| `hexbin` | Turf-generated hex grid with viridis scale, click for detail panel |
| `correlation` | Dispatches on `corrSubMode` below |

Correlation sub-modes (`corrSubMode`):

| Mode | Inputs | Outputs |
|------|--------|---------|
| `spatial` | Category A + B (sighting 0-2 or overlay name), hex size | Pearson r, p-value, hex layer |
| `matrix` | Hex size | 3×3 heatmap with significance markers (*, **, ***) |
| `temporal` | (all data in date range) | Rolling 5-year r + seasonal pattern chart (opens in WindowManager) |
| `clusters` | Min sightings + hex size | Array of `{centroid, label, composition}` rendered as circles |
| `nearest` | (none) | Grid-indexed NN distances, mean/median/stddev per category pair |

### Overlay Layers (11 total)

Lazy-loaded on first toggle. Each has its own Leaflet layer group and JSON source.

| Label | ID | Data file | Visual |
|-------|-----|-----------|--------|
| UFO / UAP | `layer-ufo` | sightings_map_data.json | Clustered Tabler `ufo` marker |
| Bigfoot / Sasquatch | `layer-bigfoot` | sightings_map_data.json | Clustered Tabler `paw` marker |
| Haunted Places | `layer-haunted` | sightings_map_data.json | Clustered Tabler `ghost` marker |
| Military / DOE Sites | `layer-military` | military_bases.json | Tabler `shield`, branch-color tooltip |
| Restricted Airspace | `layer-airspace` | restricted_airspace.json | Tabler `radar` + L.circle boundary |
| National Parks | `layer-parks` | national_parks.json | Tabler `trees` |
| USGS Earthquakes | `layer-earthquakes` | usgs_earthquakes.json | Tabler `activity`, sized by magnitude |
| US Cave Systems | `layer-caves` | us_caves.json | Tabler `mountain` |
| NASA Fireballs | `layer-fireballs` | nasa_fireballs.json | Tabler `meteor` |
| Cryptid Sightings | `layer-cryptids` | cryptid_sightings.json | Tabler `eye` |
| Missing 411 Cases | `layer-missing411` | missing411.json | Tabler `alertTriangle` |
| Geomagnetic Storms | `layer-geomagnetic` | geomagnetic_storms.json | Timeline bands (temporal overlay) |
| Historic Sites (NRHP) | `layer-historic` | historic_sites.json | Tabler `buildingCastle` |
| Per Capita Heatmap | `layer-percapita` | us_population_density.json | `leaflet-heat` layer |

### Signal Analyst AI (ai-assistant.js)

- **Anthropic Messages API** with streaming + tool use (`anthropic-version: 2023-06-01`, `anthropic-dangerous-direct-browser-access: true`)
- API key entered via the gear icon (top-right of the chat panel), stored in browser `localStorage` only — **never** shipped to any server but Anthropic
- Default model: `claude-sonnet-4-6` (switchable to Haiku 4.5 / Opus 4.6 in settings)
- Conversation persists in localStorage across reloads
- **24 tools** declared in the `TOOLS` array:
  - Map control: `zoom_to_region`, `set_filters`, `set_view_mode`, `toggle_overlay`, `get_active_overlays`, `get_statistics`
  - Spatial analysis: `run_spatial_correlation`, `run_matrix_correlation`, `detect_clusters`, `run_temporal_analysis`, `compare_regions`, `find_anomalies`, `get_hex_analysis`, `get_nearby_overlays`, `get_sightings_in_area`, `query_temporal`
  - Output: `render_chart`, `generate_report`, `export_findings`, `highlight_areas`
  - Annotations: `add_annotation`, `remove_annotation`, `list_annotations`, `clear_annotations`

Tool results flow back through the usual `tool_use` / `tool_result` content blocks.

### CSS Architecture

Four CSS files, all loaded from `index.html`:

1. **window-manager.css** — loaded first, so window chrome layers under everything
2. **ai-assistant.css** — chat panel
3. **annotations.css** — pin toolbar and markers
4. **strange-signals.css** — main app styles (loaded last, wins specificity)

Conventions:
- CSS custom properties in `:root` for all colors, fonts, spacing
- Fonts: **Orbitron** (display), **Space Mono** (body) — Google Fonts (preconnected)
- Fixed header + collapsible sidebar (650px) + map + bottom timeline panel
- Mobile breakpoint at 768px
- Scanline overlay on sidebar for retro CRT feel
- Every color is a `var(--name)` — don't hard-code hex values in new code

### CDN Dependencies

All loaded from unpkg.com in `index.html` with Subresource Integrity (SRI) hashes. Version bumps require regenerating the `integrity=""` attribute.

| Library | Version | Purpose |
|---------|---------|---------|
| Leaflet | 1.9.4 | Map rendering, markers, popups |
| Leaflet MarkerCluster | 1.5.3 | Dynamic cluster visualization |
| leaflet-heat | 0.2.0 | Heatmap overlay |
| Turf.js | 7 | Geospatial analysis (`hexGrid`, `distance`, `bbox`, `centroid`, `booleanPointInPolygon`) |
| D3.js | 7 | Timeline, correlation charts, AI chart rendering |
| html2canvas | 1.4.1 | Snapshot export (P key) |
| CARTO Dark Matter tiles | — | Basemap (not a JS dep — just a tile URL) |
| Google Fonts | — | Orbitron + Space Mono |

### Keyboard Shortcuts

Registered in `strange-signals.js` via `document.addEventListener('keydown', ...)`:

| Key | Action |
|-----|--------|
| `1`, `2`, `3` | Toggle UFO / Bigfoot / Haunted layer visibility |
| `M` | Switch to markers view |
| `H` | Switch to heatmap view |
| `X` | Switch to hex density view |
| `C` | Switch to correlation view |
| `/` | Focus the search box |
| `S` | Toggle sidebar |
| `T` | Toggle timeline panel |
| `R` | Reset map to US center/zoom 4 |
| `F` | Fullscreen map (collapse sidebar + timeline) |
| `A` | Enter annotation mode |
| `P` | Export PNG snapshot (html2canvas) |
| `?` | Show shortcuts overlay |
| `Escape` | Close open windows, else reset filters + blur search |

Pressing `Enter` inside year/state/subcategory inputs triggers `applyFilters()`.

### URL Hash Persistence

State is serialized to `location.hash` via `URLSearchParams` so views are shareable:

| Param | Meaning |
|-------|---------|
| `lat`, `lng`, `z` | Map center + zoom |
| `v` | Current view (`markers`/`heatmap`/`hexbin`/`correlation`) |
| `l` | 3-char bitstring: UFO, Bigfoot, Haunted visibility |
| `yf`, `yt` | Year filter (from, to) |
| `sf` | State filter |
| `sub` | Subcategory / shape filter |
| `csm` | Correlation sub-mode |
| `pc` | Per-capita mode toggle |
| `mil`, `air`, `eq`, `cav`, `fb`, `cry`, `m411`, `geo`, `parks`, `historic` | Overlay toggle states (`1` = on) |

Restored on page load before data rendering.

## Coding Conventions

- **No build tools.** Static HTML/CSS/JS. No webpack, vite, npm, bundlers. Don't introduce any.
- **IIFE pattern** — all JS wrapped in `(function(){ 'use strict'; ... })();`
- **CDN for libraries** — reference via unpkg.com URLs in HTML `<script>` tags, **always with SRI `integrity`** attributes
- **Compact data format** — arrays (not objects) for large datasets to minimize JSON size
- **CSS custom properties** — `:root` variables for all colors, fonts, spacing. Don't hard-code hex values.
- **Git-ignore generated data** — only source code committed; the big JSON is rebuilt from pipeline
- **XSS hardening** — user-supplied strings (sighting descriptions, AI error payloads) go through `escHtml()` / `escapeHtml()` before being concatenated into `innerHTML`. Prefer `textContent` + `createElement` for new code.
- **No hex-value hardcoding in markers** — use `CAT_COLORS[catIdx]` or `var(--name)` so the theme stays consistent.

## Git Workflow

- **Default branch is `main`** (not master). Local `master` in older worktrees may be stale — always PR against `main`.
- **Squash-merge + branch delete** is the standard for every PR. The user's standing preference is for feature branches to be squash-merged and worktrees cleaned up at the end of the task, no prompting needed.
- **Worktrees live in `.claude/worktrees/`** and are git-ignored. Windows/OneDrive sometimes locks worktree files — if `git worktree remove --force` fails with permission denied, fall back to `powershell Remove-Item -Recurse -Force <path>` on both the worktree dir and `.git/worktrees/<name>`, then `git worktree prune`.
- **PR descriptions** should include a `## Summary` section (1–3 bullets) and a `## Test plan` checklist.

## Verification Before Shipping

When the change is observable in the browser, use the Claude Preview MCP (`preview_start`, `preview_eval`, `preview_screenshot`) — don't ask the user to check manually. The relevant launch config is `strange-signals` on port 8002 (root of repo). Additional branch-specific configs can be added to `.claude/launch.json` when previewing work-in-progress branches.

Sanity checks after map-data changes:
- `document.getElementById('stat-total').textContent` reads current filtered record count
- `count-0` / `count-1` / `count-2` DOM ids hold per-category counts
- `document.querySelectorAll('.layer-row[data-glyph] svg').length` should be 3 (confirms Tabler icons render)
