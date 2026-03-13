#!/usr/bin/env python3
"""
Consolidate multiple paranormal/anomalous sighting datasets into a single
Excel workbook with each dataset on its own tab, plus a Combined_All tab
with normalized columns for mapping overlays.

All records are geocoded (latitude/longitude). Records without valid
coordinates are dropped.

Datasets:
  Tab 1: UFO_NUFORC_97K      — NUFORC sightings (2023), merged with places for lat/lon
  Tab 2: UFO_Geocoded_80K    — NUFORC geocoded + time-standardized (planetsig)
  Tab 3: Bigfoot_Detailed    — BFRO via TidyTuesday (~5K, with weather/moon data)
  Tab 4: Bigfoot_Locations   — BFRO report locations (~4.2K, lightweight)
  Tab 5: Haunted_Places      — Shadowlands Haunted Places Index (~11K, US)
  Tab 6: Combined_All        — Union of all with normalized columns for mapping
  Tab 7: Summary             — Dataset metadata and record counts
"""

import pandas as pd
import numpy as np
import os

RAW = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "raw")
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")


def clean_coords(df, lat_col="latitude", lon_col="longitude"):
    """Drop rows with missing/invalid coordinates."""
    df = df.copy()
    df[lat_col] = pd.to_numeric(df[lat_col], errors="coerce")
    df[lon_col] = pd.to_numeric(df[lon_col], errors="coerce")
    df = df.dropna(subset=[lat_col, lon_col])
    df = df[(df[lat_col].between(-90, 90)) & (df[lon_col].between(-180, 180))]
    df = df[~((df[lat_col] == 0) & (df[lon_col] == 0))]
    return df


def load_ufo_nuforc():
    """NUFORC 2023 TidyTuesday (~97K) merged with places for lat/lon."""
    print("  [1/5] UFO NUFORC (TidyTuesday 2023)...")
    sightings = pd.read_csv(os.path.join(RAW, "ufo_sightings_tidytuesday.csv"), low_memory=False)
    places = pd.read_csv(os.path.join(RAW, "ufo_places_tidytuesday.csv"), low_memory=False)

    places_dedup = places.drop_duplicates(subset=["city", "state", "country_code"])
    merged = sightings.merge(
        places_dedup[["city", "state", "country_code", "latitude", "longitude",
                       "population", "elevation_m", "timezone"]],
        on=["city", "state", "country_code"],
        how="left",
    )

    before = len(merged)
    merged = clean_coords(merged)
    print(f"         {len(merged):,} / {before:,} geocoded ({len(merged)/before*100:.1f}%)")
    return merged


def load_ufo_planetsig():
    """planetsig NUFORC geocoded+time-standardized (~80K)."""
    print("  [2/5] UFO planetsig (80K geocoded)...")
    cols = [
        "datetime", "city", "state", "country", "shape", "duration_seconds",
        "duration_text", "description", "date_posted", "latitude", "longitude"
    ]
    df = pd.read_csv(os.path.join(RAW, "ufo_planetsig.csv"), header=None, names=cols, low_memory=False)
    before = len(df)
    df = clean_coords(df)
    print(f"         {len(df):,} / {before:,} with valid coordinates")
    return df


def load_bigfoot_detailed():
    """BFRO via TidyTuesday (~5K, detailed with weather/moon)."""
    print("  [3/5] Bigfoot BFRO detailed (TidyTuesday)...")
    df = pd.read_csv(os.path.join(RAW, "bigfoot_tidytuesday.csv"), low_memory=False)
    before = len(df)
    df = clean_coords(df)
    print(f"         {len(df):,} / {before:,} geocoded")
    return df


def load_bigfoot_locations():
    """BFRO report locations (~4.2K lightweight)."""
    print("  [4/5] Bigfoot BFRO locations...")
    df = pd.read_csv(os.path.join(RAW, "bigfoot_bfro.csv"), low_memory=False)
    before = len(df)
    df = clean_coords(df)
    print(f"         {len(df):,} / {before:,} geocoded")
    return df


def load_haunted_places():
    """Shadowlands Haunted Places (~11K US)."""
    print("  [5/5] Haunted Places (Shadowlands)...")
    df = pd.read_csv(os.path.join(RAW, "haunted_places.csv"), low_memory=False)
    before = len(df)
    df = clean_coords(df)
    print(f"         {len(df):,} / {before:,} geocoded")
    return df


def truncate(val, maxlen=500):
    if pd.isna(val):
        return ""
    s = str(val)
    return s[:maxlen] + "..." if len(s) > maxlen else s


def build_combined(ufo_nuforc, ufo_planetsig, bigfoot_det, bigfoot_loc, haunted):
    """Build a single normalized dataset for mapping overlays."""
    print("\n  Building Combined_All...")
    frames = []

    # UFO NUFORC
    df = ufo_nuforc.copy()
    frames.append(pd.DataFrame({
        "category": "UFO/UAP",
        "subcategory": df.get("shape", ""),
        "date": pd.to_datetime(df["reported_date_time"], errors="coerce").dt.strftime("%Y-%m-%d"),
        "time": pd.to_datetime(df["reported_date_time"], errors="coerce").dt.strftime("%H:%M"),
        "latitude": df["latitude"],
        "longitude": df["longitude"],
        "city": df.get("city", ""),
        "state": df.get("state", ""),
        "country": df.get("country_code", ""),
        "description": df.get("summary", "").apply(lambda x: truncate(x)),
        "source": "NUFORC (TidyTuesday 2023)",
    }))

    # UFO planetsig
    df = ufo_planetsig.copy()
    frames.append(pd.DataFrame({
        "category": "UFO/UAP",
        "subcategory": df.get("shape", ""),
        "date": df["datetime"].apply(lambda x: str(x)[:10] if pd.notna(x) else ""),
        "time": df["datetime"].apply(lambda x: str(x)[11:16] if pd.notna(x) and len(str(x)) > 11 else ""),
        "latitude": df["latitude"],
        "longitude": df["longitude"],
        "city": df.get("city", ""),
        "state": df.get("state", ""),
        "country": df.get("country", ""),
        "description": df.get("description", "").apply(lambda x: truncate(x)),
        "source": "NUFORC (planetsig geocoded)",
    }))

    # Bigfoot detailed
    df = bigfoot_det.copy()
    frames.append(pd.DataFrame({
        "category": "Bigfoot/Sasquatch",
        "subcategory": df.get("classification", ""),
        "date": pd.to_datetime(df["date"], errors="coerce").dt.strftime("%Y-%m-%d"),
        "time": "",
        "latitude": df["latitude"],
        "longitude": df["longitude"],
        "city": "",
        "state": df.get("state", ""),
        "country": "US",
        "description": df.get("observed", "").apply(lambda x: truncate(x)),
        "source": "BFRO (TidyTuesday detailed)",
    }))

    # Bigfoot locations
    df = bigfoot_loc.copy()
    frames.append(pd.DataFrame({
        "category": "Bigfoot/Sasquatch",
        "subcategory": df.get("classification", ""),
        "date": df["timestamp"].apply(lambda x: str(x)[:10] if pd.notna(x) else ""),
        "time": "",
        "latitude": df["latitude"],
        "longitude": df["longitude"],
        "city": "",
        "state": "",
        "country": "US",
        "description": df.get("title", "").apply(lambda x: truncate(x)),
        "source": "BFRO (locations)",
    }))

    # Haunted Places
    df = haunted.copy()
    frames.append(pd.DataFrame({
        "category": "Haunted Place",
        "subcategory": "Ghost/Haunting",
        "date": "",
        "time": "",
        "latitude": df["latitude"],
        "longitude": df["longitude"],
        "city": df.get("city", ""),
        "state": df.get("state_abbrev", ""),
        "country": df.get("country", "United States"),
        "description": df.get("description", "").apply(lambda x: truncate(x)),
        "source": "Shadowlands Haunted Places",
    }))

    combined = pd.concat(frames, ignore_index=True)
    print(f"         {len(combined):,} total records")

    # Deduplicate: same category + lat + lon + date
    before = len(combined)
    combined = combined.drop_duplicates(
        subset=["category", "latitude", "longitude", "date"], keep="first"
    )
    if len(combined) < before:
        print(f"         Removed {before - len(combined):,} duplicates -> {len(combined):,} unique")

    return combined


def build_summary(datasets):
    """Build a summary metadata tab."""
    rows = []
    source_urls = {
        "UFO_NUFORC_97K": "https://github.com/rfordatascience/tidytuesday/tree/main/data/2023/2023-06-20",
        "UFO_Geocoded_80K": "https://github.com/planetsig/ufo-reports",
        "Bigfoot_Detailed": "https://github.com/rfordatascience/tidytuesday/tree/main/data/2022/2022-09-13",
        "Bigfoot_Locations": "https://github.com/Christopher1994-1/bigfoot-dataset-website",
        "Haunted_Places": "https://github.com/rfordatascience/tidytuesday/tree/main/data/2023/2023-10-10",
    }
    descriptions = {
        "UFO_NUFORC_97K": "NUFORC UFO/UAP sightings (rescraped 2023), merged with city geocoding table",
        "UFO_Geocoded_80K": "NUFORC sightings, geocoded and time-standardized (1949-2014)",
        "Bigfoot_Detailed": "BFRO Bigfoot/Sasquatch reports with weather, moon phase, temperature data",
        "Bigfoot_Locations": "BFRO report locations (lightweight: title, classification, lat/lon)",
        "Haunted_Places": "Shadowlands Haunted Places Index — US ghost/haunting locations",
        "Combined_All": "All datasets merged with normalized columns (category, lat, lon, date, etc.)",
    }
    for name, df in datasets.items():
        if name == "Summary":
            continue
        rows.append({
            "Sheet Name": name,
            "Records": len(df),
            "Description": descriptions.get(name, ""),
            "Source URL": source_urls.get(name, "Combined from all sources"),
            "All Geocoded": "Yes",
            "Columns": ", ".join(df.columns[:15].tolist()) + ("..." if len(df.columns) > 15 else ""),
        })
    return pd.DataFrame(rows)


def main():
    print("=" * 65)
    print("  PARANORMAL SIGHTINGS DATASET CONSOLIDATOR")
    print("  Building comprehensive geocoded Excel workbook")
    print("=" * 65)
    print()
    print("Loading datasets...")

    ufo_nuforc = load_ufo_nuforc()
    ufo_planetsig = load_ufo_planetsig()
    bigfoot_det = load_bigfoot_detailed()
    bigfoot_loc = load_bigfoot_locations()
    haunted = load_haunted_places()

    combined = build_combined(ufo_nuforc, ufo_planetsig, bigfoot_det, bigfoot_loc, haunted)

    datasets = {
        "UFO_NUFORC_97K": ufo_nuforc,
        "UFO_Geocoded_80K": ufo_planetsig,
        "Bigfoot_Detailed": bigfoot_det,
        "Bigfoot_Locations": bigfoot_loc,
        "Haunted_Places": haunted,
        "Combined_All": combined,
    }

    summary = build_summary(datasets)
    datasets["Summary"] = summary

    # Print final summary
    print("\n" + "=" * 65)
    print("  FINAL DATASET SUMMARY")
    print("=" * 65)
    total = 0
    for name, df in datasets.items():
        if name != "Summary":
            total += len(df)
            print(f"  {name:25s}  {len(df):>9,} rows")
    print(f"  {'TOTAL':25s}  {total:>9,} rows")
    print()

    # Write Excel
    output_path = os.path.join(OUT_DIR, "paranormal_sightings_consolidated.xlsx")
    os.makedirs(OUT_DIR, exist_ok=True)
    print(f"Writing Excel workbook: {output_path}")

    with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
        # Write Summary first
        summary.to_excel(writer, sheet_name="Summary", index=False)
        for name, df in datasets.items():
            if name == "Summary":
                continue
            safe = name[:31]
            print(f"  Writing '{safe}' ({len(df):,} rows)...")
            df.to_excel(writer, sheet_name=safe, index=False)

    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"\nDone! Output: {output_path}")
    print(f"File size: {size_mb:.1f} MB")
    print(f"Tabs: Summary, " + ", ".join(k for k in datasets if k != "Summary"))


if __name__ == "__main__":
    main()
