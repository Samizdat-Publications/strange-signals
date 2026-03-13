#!/usr/bin/env python3
"""
Export consolidated sighting data as compact JSON for the interactive map.

Reads the Combined_All sheet from the Excel workbook and outputs a minimal
JSON file optimized for Leaflet marker clustering.

Format: { categories: [...], fields: [...], data: [[lat,lon,cat,date,loc,sub], ...] }
"""

import pandas as pd
import json
import os

WORKBOOK = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        "data", "paranormal_sightings_consolidated.xlsx")
OUTPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                      "data", "sightings_map_data.json")


def main():
    print("Exporting map data from Excel workbook...")

    if not os.path.exists(WORKBOOK):
        print(f"ERROR: Workbook not found at {WORKBOOK}")
        print("Run build_sightings_workbook.py first.")
        return

    df = pd.read_excel(WORKBOOK, sheet_name="Combined_All")
    print(f"  Read {len(df):,} records from Combined_All")

    cat_map = {"UFO/UAP": 0, "Bigfoot/Sasquatch": 1, "Haunted Place": 2}

    records = []
    for _, r in df.iterrows():
        cat = cat_map.get(r["category"], -1)
        if cat == -1:
            continue

        city = str(r.get("city", "")) if pd.notna(r.get("city")) else ""
        state = str(r.get("state", "")) if pd.notna(r.get("state")) else ""
        loc_parts = [p for p in [city, state] if p]
        loc = ", ".join(loc_parts)
        date = str(r.get("date", ""))[:10] if pd.notna(r.get("date")) else ""
        sub = str(r.get("subcategory", "")) if pd.notna(r.get("subcategory")) else ""

        records.append([
            round(float(r["latitude"]), 4),
            round(float(r["longitude"]), 4),
            cat,
            date,
            loc,
            sub,
        ])

    output = {
        "categories": ["UFO/UAP", "Bigfoot/Sasquatch", "Haunted Place"],
        "fields": ["lat", "lon", "cat", "date", "location", "subcategory"],
        "data": records,
    }

    with open(OUTPUT, "w") as f:
        json.dump(output, f, separators=(",", ":"))

    size_mb = os.path.getsize(OUTPUT) / (1024 * 1024)
    print(f"  Exported {len(records):,} records -> {OUTPUT}")
    print(f"  File size: {size_mb:.1f} MB")


if __name__ == "__main__":
    main()
