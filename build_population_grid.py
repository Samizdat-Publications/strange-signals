#!/usr/bin/env python3
"""
Build a US population density grid for per-capita sighting normalization.

Downloads Census county-level data (Gazetteer + Population Estimates),
computes population density per county, then rasterizes to a regular grid
covering the continental US. Output is a compact JSON file loaded by the map.

Usage:
    python build_population_grid.py

Output:
    data/us_population_density.json
"""

import csv
import io
import json
import math
import os
import urllib.request
import zipfile

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "data")
RAW_DIR = os.path.join(DATA_DIR, "raw")
OUTPUT = os.path.join(DATA_DIR, "us_population_density.json")

# Census 2020 Gazetteer: county centroids + land area (zip archive)
GAZETTEER_URL = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/2020_Gaz_counties_national.zip"
GAZETTEER_ZIP = os.path.join(RAW_DIR, "2020_Gaz_counties_national.zip")
GAZETTEER_FILE = os.path.join(RAW_DIR, "2020_Gaz_counties_national.txt")

# Census county population estimates 2020-2023
POP_URL = "https://www2.census.gov/programs-surveys/popest/datasets/2020-2023/counties/totals/co-est2023-alldata.csv"
POP_FILE = os.path.join(RAW_DIR, "co-est2023-alldata.csv")

# Grid parameters for continental US
LAT_MIN = 24.0
LAT_MAX = 50.0
LON_MIN = -125.0
LON_MAX = -66.0
RESOLUTION = 0.25  # degrees per grid cell (~28km at mid-latitudes)


def download_file(url, dest):
    """Download a file if it doesn't already exist."""
    if os.path.exists(dest):
        print(f"  Already downloaded: {os.path.basename(dest)}")
        return
    print(f"  Downloading: {url}")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as resp:
            data = resp.read()
        with open(dest, "wb") as f:
            f.write(data)
        print(f"  Saved: {dest} ({len(data) / 1024:.0f} KB)")
    except Exception as e:
        print(f"  ERROR downloading {url}: {e}")
        raise


def parse_gazetteer(filepath):
    """Parse Census Gazetteer file for county centroids and land area."""
    counties = {}
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        header = f.readline().strip().split("\t")
        # Column names: USPS, GEOID, ANSICODE, NAME, ALAND, AWATER, ALAND_SQMI, AWATER_SQMI, INTPTLAT, INTPTLONG
        col_idx = {col.strip(): i for i, col in enumerate(header)}

        for line in f:
            parts = line.strip().split("\t")
            if len(parts) < len(col_idx):
                continue

            try:
                geoid = parts[col_idx["GEOID"]].strip()
                name = parts[col_idx["NAME"]].strip()
                aland_sqmi = float(parts[col_idx["ALAND_SQMI"]].strip())
                lat = float(parts[col_idx["INTPTLAT"]].strip())
                lon = float(parts[col_idx["INTPTLONG"]].strip())

                if aland_sqmi > 0 and LAT_MIN <= lat <= LAT_MAX and LON_MIN <= lon <= LON_MAX:
                    counties[geoid] = {
                        "name": name,
                        "lat": lat,
                        "lon": lon,
                        "area_sqmi": aland_sqmi,
                    }
            except (ValueError, KeyError):
                continue

    return counties


def parse_population(filepath):
    """Parse Census population estimates CSV."""
    pop_by_fips = {}
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                state_fips = row["STATE"].strip().zfill(2)
                county_fips = row["COUNTY"].strip().zfill(3)
                if county_fips == "000":
                    continue  # state-level row
                geoid = state_fips + county_fips
                # Use POPESTIMATE2020 (Census 2020 base)
                pop = int(row.get("POPESTIMATE2020", row.get("CENSUS2020POP", "0")))
                pop_by_fips[geoid] = pop
            except (ValueError, KeyError):
                continue
    return pop_by_fips


def build_density_grid(counties, pop_by_fips):
    """Build a regular grid of population density values."""
    # Merge county + population data
    county_data = []
    for geoid, info in counties.items():
        pop = pop_by_fips.get(geoid, 0)
        if pop > 0 and info["area_sqmi"] > 0:
            density = pop / info["area_sqmi"]
            county_data.append({
                "lat": info["lat"],
                "lon": info["lon"],
                "density": density,
                "pop": pop,
                "area": info["area_sqmi"],
                "name": info["name"],
            })

    print(f"  {len(county_data)} counties with valid population + area data")

    # Compute grid dimensions
    n_rows = int((LAT_MAX - LAT_MIN) / RESOLUTION)
    n_cols = int((LON_MAX - LON_MIN) / RESOLUTION)
    print(f"  Grid: {n_rows} rows x {n_cols} cols = {n_rows * n_cols} cells at {RESOLUTION} degree resolution")

    # For each grid cell, find the nearest county centroid
    # and assign its density. Use inverse-distance weighting
    # from nearby counties for smoother results.
    grid = []
    for row in range(n_rows):
        grid_row = []
        cell_lat = LAT_MAX - (row + 0.5) * RESOLUTION  # top to bottom
        for col in range(n_cols):
            cell_lon = LON_MIN + (col + 0.5) * RESOLUTION

            # Find counties within ~1 degree and do IDW
            best_dist = float("inf")
            best_density = 0
            weighted_sum = 0
            weight_total = 0

            for c in county_data:
                dlat = c["lat"] - cell_lat
                dlon = (c["lon"] - cell_lon) * math.cos(math.radians(cell_lat))
                dist = math.sqrt(dlat ** 2 + dlon ** 2)

                if dist < 1.5:  # within ~1.5 degrees
                    w = 1.0 / (dist + 0.01) ** 2
                    weighted_sum += c["density"] * w
                    weight_total += w

                if dist < best_dist:
                    best_dist = dist
                    best_density = c["density"]

            if weight_total > 0:
                density = weighted_sum / weight_total
            else:
                density = best_density if best_dist < 5 else 0

            # Round to reduce file size
            grid_row.append(round(density, 1))
        grid.append(grid_row)

    return grid


def main():
    print("=" * 60)
    print("  POPULATION DENSITY GRID BUILDER")
    print("=" * 60)
    print()

    os.makedirs(RAW_DIR, exist_ok=True)

    # Download datasets
    print("Downloading Census data...")
    download_file(GAZETTEER_URL, GAZETTEER_ZIP)
    # Extract zip if txt doesn't exist
    if not os.path.exists(GAZETTEER_FILE):
        print(f"  Extracting {os.path.basename(GAZETTEER_ZIP)}...")
        with zipfile.ZipFile(GAZETTEER_ZIP, "r") as zf:
            # Find the txt file inside
            txt_files = [n for n in zf.namelist() if n.endswith(".txt")]
            if txt_files:
                with zf.open(txt_files[0]) as src, open(GAZETTEER_FILE, "wb") as dst:
                    dst.write(src.read())
                print(f"  Extracted: {GAZETTEER_FILE}")
            else:
                raise FileNotFoundError("No .txt file found inside gazetteer zip")
    download_file(POP_URL, POP_FILE)

    # Parse data
    print("\nParsing Gazetteer (county centroids + area)...")
    counties = parse_gazetteer(GAZETTEER_FILE)
    print(f"  {len(counties)} continental US counties found")

    print("\nParsing population estimates...")
    pop_by_fips = parse_population(POP_FILE)
    print(f"  {len(pop_by_fips)} county population records")

    # Build grid
    print("\nBuilding population density grid...")
    grid = build_density_grid(counties, pop_by_fips)

    # Compute stats
    all_vals = [v for row in grid for v in row if v > 0]
    if all_vals:
        print(f"\n  Density stats (people per sq mi):")
        print(f"    Min: {min(all_vals):.1f}")
        print(f"    Max: {max(all_vals):.1f}")
        print(f"    Median: {sorted(all_vals)[len(all_vals)//2]:.1f}")
        print(f"    Mean: {sum(all_vals)/len(all_vals):.1f}")

    # Output
    output = {
        "resolution": RESOLUTION,
        "lat_min": LAT_MIN,
        "lat_max": LAT_MAX,
        "lon_min": LON_MIN,
        "lon_max": LON_MAX,
        "rows": len(grid),
        "cols": len(grid[0]) if grid else 0,
        "grid": grid,
    }

    os.makedirs(DATA_DIR, exist_ok=True)
    with open(OUTPUT, "w") as f:
        json.dump(output, f, separators=(",", ":"))

    size_kb = os.path.getsize(OUTPUT) / 1024
    print(f"\n  Output: {OUTPUT}")
    print(f"  File size: {size_kb:.1f} KB")
    print("\nDone!")


if __name__ == "__main__":
    main()
