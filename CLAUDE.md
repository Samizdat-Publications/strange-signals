# CLAUDE.md — Strange Signals / GardenSync

## Project Overview

A dual-purpose web application:

1. **GardenSync** — Community garden planner for Food Not Bombs Canton, OH (Zone 6a). Features bed planning, companion planting, harvest tracking, volunteer management, and an AI garden assistant.
2. **Strange Signals** — Paranormal sightings data pipeline and interactive map (184K+ records: UFO, Bigfoot, haunted places).

Anarchist/mutual aid ethos throughout the UI and messaging.

## Tech Stack

- **Frontend:** Vanilla JavaScript (no framework, no build tools, no npm)
- **Backend/Proxy:** Python 3 (`proxy.py` — CORS proxy on port 8080)
- **Data Processing:** Python 3 (pandas, openpyxl, numpy)
- **Maps:** Leaflet with marker clustering (`sightings-map.html`)
- **AI:** Claude API (Sonnet 4) via proxy, with tool calling
- **Storage:** Browser localStorage (all `gardensync_*` keys)
- **Styling:** CSS custom properties, dark/light theming

## Repository Structure

```
├── index.html                  # Main GardenSync SPA (757 lines)
├── app.js                      # Core application logic (5,977 lines)
├── styles.css                  # All styling with theme support (4,039 lines)
├── guide.html                  # User documentation
├── demo-data.json              # Pre-loaded example garden state
├── sightings-map.html          # Paranormal sightings interactive map
├── proxy.py                    # CORS proxy server for API calls
├── setup_sightings.sh          # Downloads paranormal datasets
├── build_sightings_workbook.py # Consolidates CSVs into Excel workbook
├── export_map_data.py          # Exports sightings as compact JSON
└── .gitignore                  # Ignores __pycache__, *.xlsx, data/raw
```

Generated directories (not in git): `data/raw/`, `data/*.xlsx`, `data/*.json`

## Running the Application

```bash
# Serve the app with API proxying
python3 proxy.py
# Open http://localhost:8080

# Build paranormal sightings data (optional)
bash setup_sightings.sh
```

No build step required — static files served directly.

## Code Architecture

### Initialization

All subsystems initialize via a list of init functions in `app.js` (around line 714). Each is wrapped in try/catch so one failure doesn't break the app:

```
Navigation, CustomSeeds, PlantPalette, GardenBeds, BedSelector,
QuickAdd, BedTemplates, ThemeToggle, ToolbarButtons, Volunteers,
ClimateCharts, RainBarrelCalc, Visualizer, BedJournal, PlantingLog,
CalendarExport, HarvestLog, HarvestGoals, DataExportImport,
KeyboardShortcuts, LoadSavedState, ShareURL, Weather, TodayDashboard,
GardenBuddy
```

### State Management

- Global `state` object holds 4 beds and metadata
- Auto-saved to localStorage on every change
- Undo/redo stack (max 50 operations)
- No external state library

### Key Data Structures

**Plant Library** (lines 7–590 of `app.js`): 37+ plant objects with:
- Spacing, harvest days, water/sun needs
- Companion/enemy plant relationships
- Zone 6a sowing schedules (relative to frost dates)
- Care notes and seed starting instructions

**Bed Templates** (7 templates): Pre-configured layouts like Three Sisters, Salsa Garden.

### localStorage Keys

All prefixed with `gardensync_`:
- `_state` — Serialized beds array
- `_bed_sizes` / `_bed_names` — Bed dimensions and names
- `_theme` — `'dark'` or `'light'`
- `_plantlog` / `_harvest_goal` — Tracking data
- `_claude_key` — API key
- `_gb_conversation` — AI chat history

## Code Conventions

### JavaScript
- **Procedural/functional style** — no classes
- **Module pattern** — each feature is an `init*()` function
- **DOM access** — `querySelector` / `querySelectorAll` throughout
- **Naming** — camelCase for functions/variables, snake_case for data keys
- **No transpilation** — ES6+ features used directly (template literals, arrow functions, destructuring)

### CSS
- Custom properties for theming (dark default, light via `[data-theme="light"]`)
- OLED-optimized dark theme (true blacks)
- Design: sharp/industrial aesthetic (2px border-radius), punk typography
- Fonts: Anton (display), Space Mono (monospace), Barlow Condensed (body)
- Color palette: emerald/teal primary, red accents, amber warnings

### Python
- Standard library plus pandas/openpyxl/numpy for data processing
- Scripts are standalone — run directly, no package structure

## AI Integration (Garden Buddy)

Located in later sections of `app.js` (line 5000+):
- Uses Claude Sonnet 4 via `/api/claude/` proxy endpoint
- Tool calling with agentic loops (max 5 iterations)
- Tools: `place_plant`, `apply_template`, `organize_bed`, `rename_bed`, `get_schedule_advice`
- Token usage tracking displayed in UI
- Chat history persisted in localStorage

## Hardcoded Values

- **USDA Zone:** 6a (Canton, OH)
- **Last frost:** April 18
- **First frost:** October 28
- **Grid methodology:** Square Foot Gardening (SFG)

## Testing & Quality

- No automated tests, test runners, or CI/CD
- No linting or type checking configured
- Manual testing via the app and `guide.html`

## Data Pipeline (Sightings)

1. `setup_sightings.sh` — Downloads 5 CSV datasets (NUFORC, TidyTuesday UFO, BFRO Bigfoot, Shadowlands haunted places)
2. `build_sightings_workbook.py` — Normalizes and consolidates into Excel (7 tabs)
3. `export_map_data.py` — Exports compact JSON for the Leaflet map

## Important Notes for AI Assistants

- **Single-file architecture**: `app.js` is ~6K lines. All features live there. Do not split without explicit request.
- **No build tools**: Changes take effect immediately on reload. No compilation or bundling.
- **localStorage is the database**: There is no backend database. All user data lives in the browser.
- **Error isolation**: Always wrap new init functions in try/catch to match the existing pattern.
- **Zone 6a assumptions**: Frost dates and plant schedules are hardcoded for Canton, OH.
- **Theme support**: Any new UI must support both dark and light themes using CSS custom properties.
- **No dependencies to install**: Frontend has zero npm dependencies. Python needs pandas/openpyxl/numpy only for data scripts.
- **Anarchist voice**: UI copy follows mutual aid / Food Not Bombs messaging conventions.
