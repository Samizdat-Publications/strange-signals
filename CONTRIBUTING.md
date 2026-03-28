# Contributing to Strange Signals

Thanks for your interest in contributing! This guide will help you get started.

## Development Setup

1. Fork and clone the repository
2. Install Python 3.8+ and run `pip install -r requirements.txt`
3. Run the data pipeline: `bash setup_sightings.sh`
4. Start the dev server: `python -m http.server 8001`
5. Open `http://localhost:8001`

## Project Structure

This is a **zero-build static web app**. There is no webpack, npm, or bundler. All JavaScript is vanilla ES5/6 loaded via `<script>` tags. Libraries are loaded from CDN.

- `index.html` — HTML structure and CDN references
- `strange-signals.css` — All styles (CSS custom properties for theming)
- `strange-signals.js` — Main application logic (~2800 lines, IIFE-wrapped)
- `ai-assistant.js` — SIGNAL AI assistant integration
- `signal-reports.js` — Report generation and export
- `data/` — Generated and curated datasets

## How to Contribute

### Adding Overlay Datasets

1. Create a JSON file in `data/` with an array of objects containing at minimum `lat`, `lon`, and a `name` field
2. Add a toggle in the sidebar section of `index.html` (follow the existing pattern)
3. Add render/remove functions in `strange-signals.js` (see `renderMilitaryBases()` as a template)
4. Wire the toggle with `wireOverlayToggle()` in the initialization section
5. Add metadata to `OVERLAY_META` for correlation support
6. Update the SIGNAL AI system prompt in `ai-assistant.js` if the overlay should be AI-queryable

### Adding Analysis Features

- All analysis code lives in `strange-signals.js` within the correlation section
- Follow existing patterns: spatial correlation uses hex-binned Pearson, temporal uses rolling windows
- Expose public API methods via the `StrangeSignals` object at the bottom of the IIFE

### Code Style

- Use `var` or `let`/`const` consistently within a section
- IIFE wrapping: `(function(){ 'use strict'; ... })();`
- Inline styles for dynamically created elements (map popups, chart SVGs)
- CSS custom properties for all theme colors
- No external build tools or transpilation

### Commit Messages

Use conventional commit format:
- `feat:` — New features
- `fix:` — Bug fixes
- `docs:` — Documentation changes
- `refactor:` — Code restructuring without behavior changes

## Reporting Issues

Please include:
- Browser and version
- Steps to reproduce
- Screenshots if visual
- Console errors if applicable

## Data Pipeline

The data pipeline downloads raw CSVs, consolidates them into an Excel workbook, and exports compact JSON:

```
setup_sightings.sh → build_sightings_workbook.py → export_map_data.py
```

Generated data files (`sightings_map_data.json`, `*.xlsx`, `data/raw/`) are git-ignored. Only source code, overlay JSON files, and build scripts are committed.
