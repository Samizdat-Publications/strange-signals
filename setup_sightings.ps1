# Setup script for Windows PowerShell: downloads all paranormal sighting datasets,
# builds Excel workbook, and exports map JSON.
#
# Usage: powershell -ExecutionPolicy Bypass -File setup_sightings.ps1

Write-Host "================================================================="
Write-Host "  PARANORMAL SIGHTINGS DATASET SETUP"
Write-Host "================================================================="
Write-Host ""

# Install Python dependencies
Write-Host "Installing Python dependencies..."
python3 -m pip install pandas openpyxl
Write-Host ""

# Create data directories
New-Item -ItemType Directory -Force -Path "data/raw" | Out-Null

Write-Host "--- Downloading datasets ---"
Write-Host ""

$downloads = @(
    @{
        Label = "[1/6] UFO Sightings - NUFORC (TidyTuesday 2023, ~97K records)..."
        File  = "data/raw/ufo_sightings_tidytuesday.csv"
        Url   = "https://raw.githubusercontent.com/rfordatascience/tidytuesday/main/data/2023/2023-06-20/ufo_sightings.csv"
    },
    @{
        Label = "[2/6] UFO Places - geocoding table for NUFORC sightings..."
        File  = "data/raw/ufo_places_tidytuesday.csv"
        Url   = "https://raw.githubusercontent.com/rfordatascience/tidytuesday/main/data/2023/2023-06-20/places.csv"
    },
    @{
        Label = "[3/6] UFO Sightings - planetsig geocoded+time-standardized (~80K)..."
        File  = "data/raw/ufo_planetsig.csv"
        Url   = "https://raw.githubusercontent.com/planetsig/ufo-reports/master/csv-data/ufo-scrubbed-geocoded-time-standardized.csv"
    },
    @{
        Label = "[4/6] Bigfoot Sightings - BFRO detailed (TidyTuesday, ~5K with weather)..."
        File  = "data/raw/bigfoot_tidytuesday.csv"
        Url   = "https://raw.githubusercontent.com/rfordatascience/tidytuesday/main/data/2022/2022-09-13/bigfoot.csv"
    },
    @{
        Label = "[5/6] Bigfoot Sightings - BFRO locations (~4.2K lightweight)..."
        File  = "data/raw/bigfoot_bfro.csv"
        Url   = "https://raw.githubusercontent.com/Christopher1994-1/bigfoot-dataset-website/master/bfro_locations.csv"
    },
    @{
        Label = "[6/6] Haunted Places - Shadowlands (TidyTuesday, ~11K US)..."
        File  = "data/raw/haunted_places.csv"
        Url   = "https://raw.githubusercontent.com/rfordatascience/tidytuesday/main/data/2023/2023-10-10/haunted_places.csv"
    }
)

foreach ($dl in $downloads) {
    Write-Host $dl.Label
    Invoke-WebRequest -Uri $dl.Url -OutFile $dl.File -UseBasicParsing
}

Write-Host ""
Write-Host "--- Building Excel workbook ---"
python3 build_sightings_workbook.py

Write-Host ""
Write-Host "--- Exporting map data ---"
python3 export_map_data.py

Write-Host ""
Write-Host "================================================================="
Write-Host "  SETUP COMPLETE!"
Write-Host "================================================================="
Write-Host ""
Write-Host "Files created:"
Write-Host "  data/paranormal_sightings_consolidated.xlsx  - All datasets in one workbook (7 tabs)"
Write-Host "  data/sightings_map_data.json                 - Combined data for interactive map"
Write-Host ""
Write-Host "Open sightings-map.html in a browser to view the interactive map."
Write-Host "(Must serve via HTTP: python3 -m http.server 8000)"
