# Phase 2: Data Expansion, Visual Reports & Polish — Design Spec

**Date:** 2026-03-17
**Status:** Draft
**Author:** Claude (brainstorming with Stewart)

## Goal

Expand the Strange Signals dataset with new sources, give SIGNAL the ability to render inline charts and generate investigation reports, and fix known bugs.

## Scope

Three sub-projects, built in order:

1. **Data Source Expansion** — integrate new datasets, increase N across all 3 categories
2. **SIGNAL Visual Output & Reports** — inline charts in chat, HTML report generation
3. **Polish & Fixes** — NN bug, additional SIGNAL tools, UX improvements

---

## Sub-Project A: Data Source Expansion

### Problem

We have 183K records from 5 sources across 3 categories. The Bigfoot category has only ~4.2K records (2.3% of total), and the Haunted Places category has ~8.8K (4.8%). Several public datasets with direct download URLs can increase our N.

### Available New Datasets (Verified Curl-able)

| # | Source | Records (est.) | Category | Direct Download URL |
|---|--------|---------------|----------|-----|
| 7 | CORGIS UFO Sightings | ~80K | UFO/UAP | `https://corgis-edu.github.io/corgis/datasets/csv/ufo_sightings/ufo_sightings.csv` |
| 8 | Haunted Places (Kaggle mirror on GitHub) | ~10K | Haunted | `https://raw.githubusercontent.com/sujaykapadnis/haunted-places/main/haunted_places.csv` |

**Dropped sources:**
- timothyrenner/nuforc_sightings_data — uses DVC, not directly curl-able; data.world requires API auth
- timothyrenner/bfro_sightings_data — also DVC-managed, no raw CSV in repo
- Kaggle datasets requiring `kaggle` CLI auth — breaks the simple `bash setup_sightings.sh` workflow
- Kaggle Cryptid Database — synthetic data, not real sightings

**Note on the Kaggle haunted places mirror:** The URL above assumes the dataset is mirrored on GitHub. If the raw URL returns 404 at pipeline time, the download step will fail and the pipeline continues with existing sources. We will verify this URL before implementation and find an alternative if needed.

### Deferred: 4th Category (Cryptids)

No legitimate geocoded cryptid sighting database (beyond Bigfoot/BFRO) exists in a downloadable format. The Kaggle "Cryptid Database" is synthetic. Deferring until real data becomes available.

### Strategy: Incremental Addition

The existing pipeline handles this cleanly:
- Add new `curl` download steps to `setup_sightings.sh`
- Add new loader functions to `build_sightings_workbook.py`
- The dedup step `(category, lat, lon, date)` handles cross-source overlap
- `export_map_data.py` reads Combined_All unchanged — the output JSON just has more rows

### CORGIS Loader Details

The CORGIS CSV uses nested column names (`Location.Coordinates.Latitude`, `Location.State`, `Dates.Sighted.Year`, etc.). The new loader normalizes these to match our schema:

```python
def load_ufo_corgis():
    df = pd.read_csv(os.path.join(RAW, "ufo_corgis.csv"), low_memory=False)
    df = df.rename(columns={
        "Location.Coordinates.Latitude": "latitude",
        "Location.Coordinates.Longitude": "longitude",
        "Location.City": "city",
        "Location.State": "state",
        "Location.Country": "country",
        "Data.Shape": "shape",
        "Data.Description excerpt": "description",
    })
    # Reconstruct date from year/month/day columns
    df["date"] = pd.to_datetime({
        "year": df["Dates.Sighted.Year"],
        "month": df["Dates.Sighted.Month"].clip(1,12),
        "day": df["Dates.Sighted.Day"].clip(1,31)
    }, errors="coerce").dt.strftime("%Y-%m-%d")
    df = clean_coords(df)
    return df
```

**Note on date handling:** Clipping month to 1-12 and day to 1-31 can produce invalid dates (e.g., Feb 31). The `errors="coerce"` converts these to NaT, resulting in empty date strings. This is acceptable — those records will not dedup against dated records from other sources, and empty dates are already common in the Haunted Places category.

### JSON File Size Assessment

Current `sightings_map_data.json` size: ~22MB for 183K records (~120 bytes/record average).
After expansion: ~218K records → ~26MB estimated. This is within acceptable limits:
- Fetch time on broadband: <2 seconds additional
- The existing batched rAF processing handles 30K records per frame
- The loading screen already shows progress during data processing

**If the JSON exceeds 30MB**, we will add gzip serving (a one-line change to the Python dev server, or a simple `Content-Encoding: gzip` header on any real host). No structural changes needed.

### Haunted Places GitHub Mirror Loader

```python
def load_haunted_kaggle():
    df = pd.read_csv(os.path.join(RAW, "haunted_kaggle.csv"), low_memory=False)
    df = clean_coords(df)
    return df
```

This dataset likely overlaps heavily with our existing Shadowlands data. The dedup step handles this — we expect a modest ~2-3K net new records.

### Pipeline Validation

After running the expanded pipeline, print before/after counts per source:

```
Source                     Raw      After Dedup
UFO_NUFORC_97K            96,512   96,512
UFO_Geocoded_80K          80,332   80,332
UFO_CORGIS_80K            80,000   ~12,000 (heavy overlap expected)
Bigfoot_Detailed          4,586    4,586
Bigfoot_Locations          4,207    4,207
Haunted_Places            8,773    8,773
Haunted_Kaggle            10,000   ~2,500 (overlap with Shadowlands)
TOTAL (combined)          ~284K    ~197K+ (after dedup)

Note: The ~87K reduction from raw to deduped is expected — NUFORC data
appears in all 3 UFO sources with heavy overlap.
```

### Expected Results

| Category | Current | After Expansion (est.) |
|----------|---------|----------------------|
| UFO/UAP | ~170K | ~182K+ (CORGIS adds ~12K net) |
| Bigfoot/Sasquatch | ~4.2K | ~4.2K (no new source) |
| Haunted Places | ~8.8K | ~11K+ (Kaggle mirror adds ~2.5K net) |
| **Total** | **~183K** | **~197K+** |

### What Changes

**Files modified:**
- `setup_sightings.sh` — add download steps 7-8
- `build_sightings_workbook.py` — add `load_ufo_corgis()`, `load_haunted_kaggle()`, extend `build_combined()`

**Files unchanged:**
- `export_map_data.py` — reads Combined_All, which now has more rows
- `strange-signals.js` — no changes; larger dataset loads the same way
- `index.html` — no changes

---

## Sub-Project B: SIGNAL Visual Output & Reports

### Problem

SIGNAL currently responds with text only. When analyzing correlations, clusters, or patterns, users can't see charts inline — they have to mentally connect the text response to what's on the map.

### Design: Inline Charts in Chat

Add a new tool `render_chart` that SIGNAL can call to embed a D3-rendered SVG chart directly in a chat message bubble.

#### Chart Types and Data Formats

Each chart type has a specific data shape:

| Type | Data Properties | Use Case |
|------|----------------|----------|
| **Bar** | `label` (string), `value` (number), `color` (optional) | Category counts, per-state breakdowns |
| **Line** | `label` (string, x-axis category), `value` (number), `color` (optional) | Temporal trends — labels are years/months |
| **Pie** | `label` (string), `value` (number), `color` (optional) | Category proportions |
| **Scatter** | `x` (number), `y` (number), `label` (optional), `color` (optional) | Correlation visualization (x=catA count, y=catB count) |

#### Tool Schema

```js
{
  name: 'render_chart',
  description: 'Render an inline chart in the chat. Bar/line/pie use label+value. Scatter uses x+y.',
  input_schema: {
    type: 'object',
    properties: {
      chart_type: { type: 'string', enum: ['bar', 'line', 'pie', 'scatter'] },
      title: { type: 'string' },
      data: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', description: 'Category label (bar/line/pie)' },
            value: { type: 'number', description: 'Y-axis value (bar/line/pie)' },
            x: { type: 'number', description: 'X coordinate (scatter only)' },
            y: { type: 'number', description: 'Y coordinate (scatter only)' },
            color: { type: 'string' }
          }
        }
      },
      x_label: { type: 'string' },
      y_label: { type: 'string' }
    },
    required: ['chart_type', 'data']
  }
}
```

**Validation:** The schema does not enforce per-type required properties (bar needs label+value, scatter needs x+y). Validation is handled at render time in `signal-charts.js` — missing properties result in the data point being skipped with no crash.

#### Rendering Flow

1. Claude calls `render_chart` as a tool use
2. `executeTool('render_chart', input)` in ai-assistant.js delegates to `SignalCharts.render(container, input)`
3. The chart SVG is appended to the chat messages area as a div with class `signal-msg chart`
4. The tool returns a text description (e.g., "Bar chart rendered: UFO 170K, Bigfoot 4.2K, Haunted 8.8K") so Claude has context for its follow-up text
5. Claude's next text message appears after the chart in the conversation flow

#### Chart Sizing

Charts use SVG `viewBox` with `width="100%"` on the container. The actual chart dimensions are computed from `container.clientWidth` at render time. This handles WindowManager resize automatically. Default aspect ratio: 16:9 for bar/line, 1:1 for pie, 4:3 for scatter.

**New file:** `signal-charts.js` (~200 lines) — IIFE exposing `window.SignalCharts = { render(container, opts) }` with rendering functions for each chart type.

### Design: Report Generation

Add a `generate_report` tool that creates a full-page HTML investigation report in a new WindowManager window.

#### Tool Schema

```js
{
  name: 'generate_report',
  description: 'Generate an investigation report with narrative sections and optional charts. Opens in a draggable window.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      sections: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            heading: { type: 'string' },
            text: { type: 'string' },
            chart: {
              type: 'object',
              description: 'Optional inline chart — same format as render_chart',
              properties: {
                chart_type: { type: 'string', enum: ['bar', 'line', 'pie', 'scatter'] },
                data: { type: 'array' },
                title: { type: 'string' }
              }
            }
          },
          required: ['heading', 'text']
        }
      }
    },
    required: ['title', 'sections']
  }
}
```

#### Rendering

The report opens as a WindowManager window containing:
- Report title and `Generated by SIGNAL — {timestamp}` header
- Sections with headings, narrative text, and optional inline charts
- A **"Download HTML"** button that generates a self-contained HTML file:
  - All CSS inlined (dark theme with hardcoded color values, not CSS variable references)
  - Static SVG snapshots (no D3 dependency)
  - Meta viewport tag for mobile readability
  - Standalone — opens correctly in any browser without the app

**New file:** `signal-reports.js` (~250 lines) — IIFE exposing `window.SignalReports = { create(opts) }`. Uses `SignalCharts.render()` for inline charts.

### What Changes

**New files:**
- `signal-charts.js` — D3 chart rendering for inline chat charts + reports
- `signal-reports.js` — Report generation, download HTML serialization

**Modified files:**
- `ai-assistant.js` — add `render_chart` and `generate_report` tools to TOOLS array and `executeTool()` switch
- `ai-assistant.css` — add `.signal-chart` container styles (max-width, margin, border-radius)
- `index.html` — add `<script>` refs for new files (before ai-assistant.js)
- SIGNAL system prompt — append these lines:
  ```
  You can render inline charts (bar, line, pie, scatter) in the chat using the render_chart tool. Use charts to visualize data patterns when they'd be clearer than text.
  You can generate full investigation reports with the generate_report tool. Reports open in a new window and can be downloaded as standalone HTML files.
  You can compare two regions side-by-side with compare_regions, and export analysis results as CSV with export_findings.
  ```

---

## Sub-Project C: Polish & Fixes

### NN Bug Fix

**File:** `strange-signals.js` lines 830-862
**Bug:** `d3.mean(distances)` and `d3.deviation(distances)` return `undefined` when the distances array is empty or all-Infinity. This crashes `.toFixed(1)` on line 861 and the comparison `r.meanDist<50` on line 860.

**Fix:** Guard in `computeNNAnalysis()`:

1. Add source category empty check (alongside the existing target check):
```js
if(!filteredCat[a].length){
  for(let b=0;b<3;b++) if(a!==b){results[a][b]=null;step++}
  continue;
}
```

2. Guard when building results:
```js
results[a][b] = {
  meanDist: d3.mean(distances) ?? null,
  medianDist: d3.median(distances) ?? null,
  stdDev: d3.deviation(distances) ?? null,
  sampleN: sampledA.length
};
```

3. Guard in `renderNNResults()`:
```js
const r = results[a]?.[b];
if (!r || r.meanDist === null) { html += '<td>N/A</td>'; continue }
```

### Additional SIGNAL Tools

**1. `compare_regions`** — Compare sighting statistics between two geographic areas.

```js
{
  name: 'compare_regions',
  description: 'Compare sighting statistics between two US states or coordinate regions.',
  input_schema: {
    type: 'object',
    properties: {
      region_a: {
        type: 'object',
        properties: {
          state: { type: 'string', description: 'US state code (e.g. OH)' },
          lat: { type: 'number' }, lon: { type: 'number' },
          radius_km: { type: 'number', default: 100 }
        }
      },
      region_b: {
        type: 'object',
        properties: {
          state: { type: 'string' },
          lat: { type: 'number' }, lon: { type: 'number' },
          radius_km: { type: 'number', default: 100 }
        }
      }
    },
    required: ['region_a', 'region_b']
  }
}
```

**Resolution order:** If `state` is provided, use its centroid from `STATE_CENTROIDS` as lat/lon with default `radius_km=100`. Explicit `lat`/`lon` overrides `state`. Then query `StrangeSignals.getSightingsInArea()` for each region, return counts and top subcategories, and call `render_chart` with a grouped bar comparison.

**2. `export_findings`** — Export data as a downloadable CSV.

This differs from the existing sidebar "EXPORT CSV" button (which exports all visible sightings). `export_findings` exports specific analysis results:

```js
{
  name: 'export_findings',
  description: 'Export analysis results as a downloadable CSV. Types: sightings (filtered), clusters, correlation_matrix.',
  input_schema: {
    type: 'object',
    properties: {
      export_type: { type: 'string', enum: ['sightings', 'clusters', 'correlation_matrix'] }
    },
    required: ['export_type']
  }
}
```

- `sightings`: Same as existing export (wrapper for existing functionality, SIGNAL-invocable)
- `clusters`: Detected cluster centroids, sizes, category breakdowns
- `correlation_matrix`: The 3x3 r/p-value matrix as CSV

### UX Improvements

Items already implemented (no work needed): auto-resize textarea, clear chat button, Shift+Enter for newline.

**New items:**

1. **Typing indicator** — Show a pulsing "SIGNAL is analyzing..." indicator between user message send and first streamed token. CSS animation with 3 bouncing dots.

2. **Friendly API error messages** — Catch common errors and display user-friendly messages:
   - 401: "API key not set or invalid. Click the gear icon to configure."
   - 429: "Rate limited. Please wait a moment and try again."
   - Network error: "Unable to reach the API. Check your internet connection."
   - Generic: "Something went wrong. [Show details]" with expandable raw error.

### What Changes

**Modified files:**
- `strange-signals.js` — NN bug fix (~6 lines changed)
- `ai-assistant.js` — 2 new tools, typing indicator, error handling
- `ai-assistant.css` — typing indicator styles (`.signal-typing` with bouncing dots animation)

---

## Architecture Summary

```
PHASE 2 CHANGES
================

Python Pipeline (Sub-Project A)
  setup_sightings.sh          + 2 new download steps
  build_sightings_workbook.py + 2 new loader functions

New JS Files (Sub-Project B)
  signal-charts.js            D3 chart rendering (bar/line/pie/scatter)
  signal-reports.js           Report window generation + Download HTML

Modified JS (Sub-Projects B + C)
  ai-assistant.js             + render_chart, generate_report, compare_regions,
                                export_findings tools; typing indicator; error handling
  strange-signals.js          NN bug fix (6 lines)

Modified HTML/CSS (Sub-Projects B + C)
  index.html                  + 2 script refs
  ai-assistant.css            + .signal-chart styles, .signal-typing animation

Public API surface:
  window.SignalCharts = { render(container, opts) }
  window.SignalReports = { create(opts) }
```

## Testing Strategy

- **Sub-Project A:** Run `bash setup_sightings.sh`, verify new CSVs download, verify `build_sightings_workbook.py` prints increased counts per source, verify `sightings_map_data.json` file size is within expected range, load map and verify new record count in stats panel.
- **Sub-Project B:** Open SIGNAL, ask "show me a bar chart of sightings by category", verify SVG renders inline. Ask "generate a report on Ohio correlations", verify WindowManager window opens with formatted content. Click "Download HTML", verify standalone file opens in a new browser tab.
- **Sub-Project C:** Navigate to CORR → NEAREST → COMPUTE DISTANCES with Bigfoot or Haunted toggled off, verify no crash. Send message with invalid API key, verify friendly error. Send message, verify typing indicator appears.
