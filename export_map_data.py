#!/usr/bin/env python3
"""
Export consolidated sighting data as compact JSON for the interactive map.

Reads the Combined_All sheet from the Excel workbook and outputs a minimal
JSON file optimized for Leaflet marker clustering.

Format: { categories: [...], fields: [...], data: [[lat,lon,cat,date,loc,sub,desc], ...] }
"""

import pandas as pd
import gzip
import json
import os
import sys

WORKBOOK = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        "data", "paranormal_sightings_consolidated.xlsx")
OUTPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                      "data", "sightings_map_data.json")


def main():
    print("Exporting map data from Excel workbook...")

    if not os.path.exists(WORKBOOK):
        print(f"ERROR: Workbook not found at {WORKBOOK}")
        print("Run build_sightings_workbook.py first.")
        sys.exit(1)

    df = pd.read_excel(WORKBOOK, sheet_name="Combined_All")
    print(f"  Read {len(df):,} records from Combined_All")

    cat_map = {"UFO/UAP": 0, "Bigfoot/Sasquatch": 1, "Haunted Place": 2}

    # Filter to valid categories
    df = df[df["category"].isin(cat_map.keys())].copy()

    # Vectorized field preparation
    df["cat"] = df["category"].map(cat_map)
    df["latitude"] = pd.to_numeric(df["latitude"], errors="coerce").round(4)
    df["longitude"] = pd.to_numeric(df["longitude"], errors="coerce").round(4)

    # Drop invalid coords
    df = df.dropna(subset=["latitude", "longitude"])

    # Fill NaN with empty strings for text fields
    for col in ["city", "state", "date", "subcategory", "description"]:
        if col in df.columns:
            df[col] = df[col].fillna("")

    # Build location string
    df["loc"] = df.apply(
        lambda r: ", ".join(p for p in [str(r.get("city", "")), str(r.get("state", ""))] if p),
        axis=1,
    )

    # Truncate fields
    df["date_str"] = df["date"].astype(str).str[:10].replace("nan", "")
    df["sub"] = df["subcategory"].astype(str).replace("nan", "")
    df["desc"] = df["description"].astype(str).str[:500].replace("nan", "")

    # Build records as list of lists (vectorized via itertuples — 10x faster than iterrows)
    records = []
    for r in df.itertuples(index=False):
        records.append([
            float(r.latitude),
            float(r.longitude),
            int(r.cat),
            r.date_str if r.date_str != "nan" else "",
            r.loc,
            r.sub if r.sub != "nan" else "",
            r.desc if r.desc != "nan" else "",
        ])

    output = {
        "categories": ["UFO/UAP", "Bigfoot/Sasquatch", "Haunted Place"],
        "fields": ["lat", "lon", "cat", "date", "location", "subcategory", "description"],
        "data": records,
    }

    # Serialize to JSON bytes once, then gzip. We commit ONLY the .gz —
    # the app fetches .json.gz and decompresses in-browser via
    # DecompressionStream, which cuts first-load network transfer ~75%.
    payload = json.dumps(output, separators=(",", ":"), ensure_ascii=False).encode("utf-8")

    gz_path = OUTPUT + ".gz"
    with gzip.open(gz_path, "wb", compresslevel=9) as f:
        f.write(payload)

    # Remove any legacy uncompressed copy so the repo only carries the .gz.
    if os.path.exists(OUTPUT):
        os.remove(OUTPUT)

    raw_mb = len(payload) / (1024 * 1024)
    gz_mb = os.path.getsize(gz_path) / (1024 * 1024)
    print(f"  Exported {len(records):,} records -> {gz_path}")
    print(f"  Raw: {raw_mb:.1f} MB  ->  gzipped: {gz_mb:.1f} MB ({gz_mb/raw_mb*100:.0f}% of original)")


if __name__ == "__main__":
    main()
