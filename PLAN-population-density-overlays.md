# STRANGE SIGNALS: Population Density Normalization & Overlay Datasets

## Status: Implementation Plan (March 2026)

---

## 1. Population Density Normalization (PRIMARY)

### Problem
Every sightings heatmap is really just a population map. Dense metro areas dominate because
more people = more reports. We need per-capita normalization so genuinely anomalous hotspots
(rural areas with disproportionate sighting density) stand out.

### Data Source: US Census Bureau 2020 Gazetteer + Population Estimates
- **Gazetteer file**: `2020_Gaz_counties_national.txt` from Census Bureau
  - URL: `https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/2020_Gaz_counties_national.txt`
  - Contains: GEOID (FIPS), county name, land area (sq mi), lat/lon of internal point
  - Tab-delimited, ~3,200 rows (one per county)
- **Population data**: Census 2020 county population estimates
  - URL: `https://www2.census.gov/programs-surveys/popest/datasets/2020-2023/counties/totals/co-est2023-alldata.csv`
  - Contains: STATE FIPS, COUNTY FIPS, population estimates 2020-2023
- **Alternative (simpler)**: SimpleMaps US Counties free CSV
  - URL: `https://simplemaps.com/data/us-counties` (requires attribution)
  - Contains: county, state, lat, lng, population, density, FIPS -- all in one file

### Chosen Approach
Build a lightweight JSON lookup: a grid of population density values covering the continental US.
At runtime, when rendering the "per capita" heatmap, divide each sighting's weight by the
local population density.

**Implementation steps:**

1. **Python pipeline** (`build_population_grid.py`):
   - Download Census Gazetteer + population CSV
   - Join on FIPS code to get: county centroid (lat/lon), land area (sq mi), population
   - Compute density = population / land_area for each county
   - Build a spatial grid (~0.5 degree resolution) covering the continental US
   - For each grid cell, find nearest county centroid and assign its density
   - Export as compact JSON: `data/us_population_density.json`
   - Format: `{ "resolution": 0.5, "lat_min": 24, "lat_max": 50, "lon_min": -125, "lon_max": -66, "grid": [[density_values...], ...] }`
   - File size estimate: ~5-15 KB (very compact)

2. **JS integration** (strange-signals.js):
   - Load `data/us_population_density.json` alongside sightings data
   - Add `getPopDensity(lat, lon)` function that looks up the grid
   - In `renderHeatmap()`, add per-capita mode:
     - Each point gets weight = 1 / (popDensity + baseline) instead of flat 0.6
     - Baseline prevents division by zero in unpopulated cells
   - Add toggle in sidebar (checkbox under LAYERS or VIEW MODE section)

3. **UI** (sightings-map.html):
   - Add "PER CAPITA" toggle button next to HEAT view mode
   - When active, heatmap weights are divided by population density
   - Visual indicator: different gradient or label showing mode

### Heatmap Tuning
Current radius at zoom 4 is 18px. With per-capita normalization, we should:
- Reduce radius slightly at low zooms (15px at zoom 4) to show tighter hotspots
- Increase blur ratio from 0.6 to 0.7 for smoother per-capita visualization
- Consider log-scale population density to prevent extreme rural amplification

---

## 2. Overlay Datasets Research

### A. Military Bases / Restricted Areas -- FEASIBLE, HIGH VALUE
- **Source**: USDOT Bureau of Transportation Statistics
- **URL**: `https://geodata.bts.gov/datasets/military-bases/explore`
- **Format**: GeoJSON via ArcGIS REST API, also CSV
- **API**: `https://geo.dot.gov/server/rest/services/Hosted/Military_Bases_DS/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson`
- **Content**: ~800 DoD installations with name, branch, location, boundaries
- **Size**: Moderate (points + some polygons)
- **Feasibility**: HIGH -- direct GeoJSON download, well-structured data
- **Paranormal relevance**: Area 51, Wright-Patterson AFB, military test sites are
  historically associated with UFO sightings. Correlation analysis possible.

### B. Geological Fault Lines -- FEASIBLE, MEDIUM VALUE
- **Source**: GEM Global Active Faults Database (GEMScienceTools on GitHub)
- **URL**: `https://github.com/GEMScienceTools/gem-global-active-faults`
- **Format**: GeoJSON (line features)
- **Raw file**: `geojson/gem_active_faults.geojson` (~13MB global, need to filter to US)
- **Alternative**: USGS Quaternary Fault Database (KMZ, would need conversion)
- **Content**: Active fault traces with kinematics, slip rate, geometry
- **Feasibility**: MEDIUM -- large file needs US-only filtering in pipeline
- **Paranormal relevance**: Geological stress = piezoelectric emissions, "earthlights"
  hypothesis connects tectonic activity to anomalous light phenomena

### C. Nuclear Facilities -- FEASIBLE, HIGH VALUE
- **Source**: GeoNuclearData (GitHub: cristianst85/GeoNuclearData)
- **URL**: `https://github.com/cristianst85/GeoNuclearData`
- **Format**: CSV with lat/lon
- **Content**: Nuclear power plants worldwide (filter to US, ~60 sites)
- **Also**: DOE national labs, weapons facilities
- **Feasibility**: HIGH -- small dataset, simple CSV
- **Paranormal relevance**: Nuclear sites historically correlated with UFO reports
  (Malmstrom AFB incidents, Oak Ridge, Hanford, etc.)

### D. Native American Sacred Sites -- DIFFICULT
- **Sources**: No comprehensive public dataset exists
- **NPS provides**: Some data on registered sacred sites but incomplete
- **Feasibility**: LOW -- sensitive data, not freely available in GIS format
- **Alternative**: Could use tribal land boundaries from Census TIGER files

### E. Magnetic Anomaly Data -- DIFFICULT
- **Source**: NOAA EMAG2 (Earth Magnetic Anomaly Grid)
- **Format**: NetCDF or GeoTIFF (heavy processing needed)
- **Feasibility**: LOW for a static JS app -- too much data processing
- **Alternative**: Could pre-process to a simplified grid in Python pipeline

### F. Weather/Lightning Data -- MODERATE
- **Source**: NOAA Severe Weather Data Inventory
- **Feasibility**: MEDIUM -- large datasets, would need significant processing

### G. Deep Cave Systems -- MODERATE
- **Source**: National Speleological Society, various state geological surveys
- **Feasibility**: MEDIUM -- no single comprehensive dataset, scattered sources

---

## 3. Implementation Priority

### Phase 1 (This session):
1. Population density normalization (per-capita heatmap)
2. Heatmap radius tuning
3. Military bases overlay toggle

### Phase 2 (Future):
4. Nuclear facilities overlay
5. Fault lines overlay (filtered to US)
6. Additional datasets as research yields good sources

---

## 4. Technical Notes

- All overlay data will be loaded as separate JSON files from `data/`
- Python scripts handle data download + processing
- JS loads overlays lazily (only when toggled on)
- Overlays render as Leaflet layers with toggle controls in sidebar
- No npm/build tools -- everything stays as static HTML/CSS/JS
- CDN libraries only for new dependencies (if any needed)
