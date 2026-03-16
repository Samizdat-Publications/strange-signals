#!/usr/bin/env bash
# Setup script: downloads pre-built map data from a GitHub release,
# or falls back to building from raw datasets if the release isn't available.
#
# Usage: bash setup_sightings.sh
#        bash setup_sightings.sh --rebuild   # force full rebuild from raw CSVs

set -e

REPO="Samizdat-Publications/strange-signals"
RELEASE_TAG="data-v1"
DATA_FILE="data/sightings_map_data.json"

echo "================================================================="
echo "  PARANORMAL SIGHTINGS DATASET SETUP"
echo "================================================================="
echo ""

mkdir -p data/raw

# --- Try downloading pre-built data from GitHub release ---
if [ "$1" != "--rebuild" ] && [ ! -f "$DATA_FILE" ]; then
    echo "Downloading pre-built map data from GitHub release..."
    RELEASE_URL="https://github.com/${REPO}/releases/download/${RELEASE_TAG}/sightings_map_data.json.gz"
    if curl -fSL -o data/sightings_map_data.json.gz "$RELEASE_URL" 2>/dev/null; then
        echo "Decompressing..."
        gunzip -f data/sightings_map_data.json.gz
        echo ""
        echo "================================================================="
        echo "  SETUP COMPLETE (from pre-built release)"
        echo "================================================================="
        echo ""
        echo "  $DATA_FILE is ready (~20MB, 184K+ records)"
        echo ""
        echo "Open sightings-map.html in a browser to view the interactive map."
        echo "(Must serve via HTTP: python3 -m http.server 8000)"
        exit 0
    else
        echo "Release not found — falling back to full build from raw datasets."
        rm -f data/sightings_map_data.json.gz
        echo ""
    fi
fi

if [ -f "$DATA_FILE" ] && [ "$1" != "--rebuild" ]; then
    echo "$DATA_FILE already exists. Use --rebuild to regenerate."
    exit 0
fi

# --- Full build from raw CSVs ---
echo "Installing Python dependencies..."
pip install pandas openpyxl 2>/dev/null || pip3 install pandas openpyxl
echo ""

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
echo "================================================================="
echo "  SETUP COMPLETE!"
echo "================================================================="
echo ""
echo "Files created:"
echo "  data/paranormal_sightings_consolidated.xlsx  - All datasets in one workbook (7 tabs)"
echo "  data/sightings_map_data.json                 - Combined data for interactive map"
echo ""
echo "Open sightings_map.html in a browser to view the interactive map."
echo "(Must serve via HTTP: python3 -m http.server 8000)"
