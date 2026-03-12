#!/usr/bin/env bash
# Setup script: downloads datasets, builds Excel workbook, and exports map JSON.
# Usage: bash setup_sightings.sh

set -e

echo "=== Paranormal Sightings Dataset Setup ==="

# Install Python dependencies
pip install pandas openpyxl requests 2>/dev/null || pip3 install pandas openpyxl requests

# Create data directories
mkdir -p data/raw

echo ""
echo "--- Downloading datasets ---"

echo "[1/3] UFO Sightings (NUFORC via TidyTuesday)..."
curl -L -o data/raw/ufo_sightings.csv \
    "https://raw.githubusercontent.com/rfordatascience/tidytuesday/main/data/2023/2023-06-20/ufo_sightings.csv"
curl -L -o data/raw/ufo_places.csv \
    "https://raw.githubusercontent.com/rfordatascience/tidytuesday/main/data/2023/2023-06-20/places.csv"

echo "[2/3] Bigfoot Sightings (BFRO)..."
curl -L -o data/raw/bfro_reports_geocoded.csv \
    "https://raw.githubusercontent.com/guyroyse/bigfoot-redis/master/bfro_reports_geocoded.csv"

echo "[3/3] Haunted Places (Shadowlands via TidyTuesday)..."
curl -L -o data/raw/haunted_places.csv \
    "https://raw.githubusercontent.com/rfordatascience/tidytuesday/main/data/2023/2023-10-10/haunted_places.csv"

echo ""
echo "--- Building Excel workbook ---"
python3 build_sightings_workbook.py

echo ""
echo "--- Exporting map data ---"
python3 export_map_data.py

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Files created:"
echo "  data/sightings_consolidated.xlsx  - All datasets in one Excel workbook"
echo "  data/ufo_map.json                 - UFO data for interactive map"
echo "  data/bigfoot_map.json             - Bigfoot data for interactive map"
echo "  data/haunted_map.json             - Haunted places data for interactive map"
echo ""
echo "Open sightings-map.html in a browser to view the interactive map."
echo "(Must serve via HTTP, e.g.: python3 -m http.server 8000)"
