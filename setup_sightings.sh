#!/usr/bin/env bash
# Setup script: downloads all paranormal sighting datasets, builds Excel workbook,
# and exports map JSON.
#
# Datasets:
#   - UFO/UAP sightings (NUFORC via TidyTuesday 2023, ~97K records)
#   - UFO/UAP sightings (planetsig geocoded, ~80K records)
#   - Bigfoot/Sasquatch (BFRO via TidyTuesday, ~5K with weather data)
#   - Bigfoot/Sasquatch (BFRO locations, ~4.2K lightweight)
#   - Haunted Places (Shadowlands via TidyTuesday, ~11K US locations)
#
# Usage: bash setup_sightings.sh

set -e

echo "================================================================="
echo "  PARANORMAL SIGHTINGS DATASET SETUP"
echo "================================================================="
echo ""

# Install Python dependencies
echo "Installing Python dependencies..."
pip install pandas openpyxl 2>/dev/null || pip3 install pandas openpyxl
echo ""

# Create data directories
mkdir -p data/raw

echo "--- Downloading datasets ---"
echo ""

echo "[1/6] UFO Sightings - NUFORC (TidyTuesday 2023, ~97K records)..."
curl -L -o data/raw/ufo_sightings_tidytuesday.csv \
    "https://raw.githubusercontent.com/rfordatascience/tidytuesday/main/data/2023/2023-06-20/ufo_sightings.csv"

echo "[2/6] UFO Places - geocoding table for NUFORC sightings..."
curl -L -o data/raw/ufo_places_tidytuesday.csv \
    "https://raw.githubusercontent.com/rfordatascience/tidytuesday/main/data/2023/2023-06-20/places.csv"

echo "[3/6] UFO Sightings - planetsig geocoded+time-standardized (~80K)..."
curl -L -o data/raw/ufo_planetsig.csv \
    "https://raw.githubusercontent.com/planetsig/ufo-reports/master/csv-data/ufo-scrubbed-geocoded-time-standardized.csv"

echo "[4/6] Bigfoot Sightings - BFRO detailed (TidyTuesday, ~5K with weather)..."
curl -L -o data/raw/bigfoot_tidytuesday.csv \
    "https://raw.githubusercontent.com/rfordatascience/tidytuesday/main/data/2022/2022-09-13/bigfoot.csv"

echo "[5/6] Bigfoot Sightings - BFRO locations (~4.2K lightweight)..."
curl -L -o data/raw/bigfoot_bfro.csv \
    "https://raw.githubusercontent.com/Christopher1994-1/bigfoot-dataset-website/master/bfro_locations.csv"

echo "[6/6] Haunted Places - Shadowlands (TidyTuesday, ~11K US)..."
curl -L -o data/raw/haunted_places.csv \
    "https://raw.githubusercontent.com/rfordatascience/tidytuesday/main/data/2023/2023-10-10/haunted_places.csv"

echo ""
echo "--- Building Excel workbook ---"
python3 build_sightings_workbook.py

echo ""
echo "--- Exporting map data ---"
python3 export_map_data.py

echo ""
echo "--- Building population density grid ---"
python3 build_population_grid.py

echo ""
echo "================================================================="
echo "  SETUP COMPLETE!"
echo "================================================================="
echo ""
echo "Files created:"
echo "  data/paranormal_sightings_consolidated.xlsx  - All datasets in one workbook (7 tabs)"
echo "  data/sightings_map_data.json                 - Combined data for interactive map"
echo "  data/us_population_density.json              - Population density grid for per-capita mode"
echo "  data/military_bases.json                     - US military/DOE installation locations"
echo ""
echo "Tabs in the workbook:"
echo "  Summary             - Dataset metadata"
echo "  UFO_NUFORC_97K      - NUFORC sightings with city geocoding (~96K)"
echo "  UFO_Geocoded_80K    - NUFORC geocoded time-standardized (~80K)"
echo "  Bigfoot_Detailed    - BFRO with weather/moon data (~4K)"
echo "  Bigfoot_Locations   - BFRO report locations (~4.2K)"
echo "  Haunted_Places      - Shadowlands haunted places (~9.7K)"
echo "  Combined_All        - Union of all datasets, normalized for mapping (~184K)"
echo ""
echo "Open sightings_map.html in a browser to view the interactive map."
echo "(Must serve via HTTP: python3 -m http.server 8000)"
