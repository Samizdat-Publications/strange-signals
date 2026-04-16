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
    print("  [1/7] UFO NUFORC (TidyTuesday 2023)...")
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
    print("  [2/7] UFO planetsig (80K geocoded)...")
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
    print("  [3/7] Bigfoot BFRO detailed (TidyTuesday)...")
    df = pd.read_csv(os.path.join(RAW, "bigfoot_tidytuesday.csv"), low_memory=False)
    before = len(df)
    df = clean_coords(df)
    print(f"         {len(df):,} / {before:,} geocoded")
    return df


def load_bigfoot_locations():
    """BFRO report locations (~4.2K lightweight)."""
    print("  [4/7] Bigfoot BFRO locations...")
    df = pd.read_csv(os.path.join(RAW, "bigfoot_bfro.csv"), low_memory=False)
    before = len(df)
    df = clean_coords(df)
    print(f"         {len(df):,} / {before:,} geocoded")
    return df


def load_haunted_places():
    """Shadowlands Haunted Places (~11K US)."""
    print("  [5/7] Haunted Places (Shadowlands)...")
    df = pd.read_csv(os.path.join(RAW, "haunted_places.csv"), low_memory=False)
    before = len(df)
    df = clean_coords(df)
    print(f"         {len(df):,} / {before:,} geocoded")
    return df


def load_ufo_corgis():
    """CORGIS UFO sightings (~80K with nested column names)."""
    path = os.path.join(RAW, "ufo_corgis.csv")
    if not os.path.exists(path):
        print("  [6/7] UFO CORGIS - file not found, skipping")
        return pd.DataFrame()
    print("  [6/7] UFO CORGIS (80K nested columns)...")
    df = pd.read_csv(path, low_memory=False)
    # Strip whitespace from column names (CORGIS has trailing spaces on some)
    df.columns = df.columns.str.strip()
    df = df.rename(columns={
        "Location.Coordinates.Latitude": "latitude",
        "Location.Coordinates.Longitude": "longitude",
        "Location.City": "city",
        "Location.State": "state",
        "Location.Country": "country",
        "Data.Shape": "shape",
        "Data.Description excerpt": "description",
    })
    # Reconstruct date from year/month/day columns
    # Note: CORGIS uses "Date.Sighted.Day" (singular) not "Dates.Sighted.Day"
    day_col = "Date.Sighted.Day" if "Date.Sighted.Day" in df.columns else "Dates.Sighted.Day"
    df["date"] = pd.to_datetime({
        "year": df["Dates.Sighted.Year"],
        "month": df["Dates.Sighted.Month"].clip(1, 12),
        "day": df[day_col].clip(1, 31)
    }, errors="coerce").dt.strftime("%Y-%m-%d")
    before = len(df)
    df = clean_coords(df)
    print(f"         {len(df):,} / {before:,} with valid coordinates")
    return df


def load_haunted_kaggle():
    """Kaggle Haunted Places expanded (~10K)."""
    path = os.path.join(RAW, "haunted_kaggle.csv")
    if not os.path.exists(path) or os.path.getsize(path) < 100:
        print("  [7/7] Haunted Kaggle - file not found or invalid, skipping")
        return pd.DataFrame()
    print("  [7/7] Haunted Places Kaggle (expanded)...")
    df = pd.read_csv(path, low_memory=False)
    before = len(df)
    df = clean_coords(df)
    print(f"         {len(df):,} / {before:,} geocoded")
    return df


def load_ufo_wlouie1():
    """wlouie1 NUFORC geocoded (~80K, includes ~3.6K Canadian sightings)."""
    path = os.path.join(RAW, "ufo_wlouie1.csv")
    if not os.path.exists(path):
        print("  [8/8] UFO wlouie1 - file not found, skipping")
        return None
    print("  [8/8] UFO Sightings wlouie1 (NUFORC geocoded, ~80K)...")
    df = pd.read_csv(path, low_memory=False)
    # Columns: datetime, city, state_province, ufo_shape, duration_described, description, latitude, longitude
    df = df.rename(columns={
        "state_province": "state",
        "ufo_shape": "shape",
    })
    before = len(df)
    df = clean_coords(df)
    print(f"         {len(df):,} / {before:,} with valid coordinates")
    return df


def load_larry_hatch():
    """Larry Hatch *U* Database (RR0 digitization) — ~18K historical UFO cases, 593 BC to 2003."""
    path = os.path.join(RAW, "tier1", "uDb", "data", "udb", "output", "u.csv")
    if not os.path.exists(path):
        print("  [9/9] Larry Hatch U Database - file not found, skipping")
        return None
    print("  [9/9] Larry Hatch *U* Database (18K historical, 593 BC–2003)...")
    df = pd.read_csv(path, low_memory=False, encoding="utf-8")
    # Columns: id, year, month, day, time, location, stateOrProvince, title,
    #          description, locale, duration, credibility, locationFlags,
    #          longitude, latitude, elevation, relativeAltitude, ref,
    #          strangeness, miscellaneousFlags, continent, country, ...
    before = len(df)
    df = clean_coords(df)
    print(f"         {len(df):,} / {before:,} with valid coordinates")

    # Build a date string from year/month/day columns
    def build_date(row):
        y = row.get("year", "")
        m = row.get("month", "")
        d = row.get("day", "")
        try:
            yr = int(y)
        except (ValueError, TypeError):
            return ""
        # For BCE dates, just use the year
        if yr < 0:
            return f"{yr}"
        parts = [f"{yr:04d}"]
        try:
            mo = int(m)
            if 1 <= mo <= 12:
                parts.append(f"{mo:02d}")
                try:
                    da = int(d)
                    if 1 <= da <= 31:
                        parts.append(f"{da:02d}")
                except (ValueError, TypeError):
                    pass
        except (ValueError, TypeError):
            pass
        return "-".join(parts)

    df["date_str"] = df.apply(build_date, axis=1)
    return df


def load_nuforc_hf():
    """HuggingFace NUFORC geocoded (~116K after geocoding, ~50K net new after dedup)."""
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        "data", "nuforc_hf_geocoded.csv")
    if not os.path.exists(path):
        print("  [10/10] HuggingFace NUFORC - file not found, skipping")
        print("          Run: python geocode_nuforc_hf.py --run")
        return None
    print("  [10/10] HuggingFace NUFORC geocoded (~116K)...")
    df = pd.read_csv(path, low_memory=False)
    before = len(df)
    # Filter to only geocoded rows
    df = df.dropna(subset=["lat", "lon"])
    df = df.rename(columns={"lat": "latitude", "lon": "longitude"})
    df = clean_coords(df)
    print(f"         {len(df):,} / {before:,} with valid coordinates")
    # Parse date from date_time column (e.g., "2014-09-21 13:00:00")
    df["date"] = df["date_time"].apply(
        lambda x: str(x)[:10] if pd.notna(x) and len(str(x)) >= 10 else "")
    df["time"] = df["date_time"].apply(
        lambda x: str(x)[11:16] if pd.notna(x) and len(str(x)) > 11 else "")
    return df


def truncate(val, maxlen=500):
    if pd.isna(val):
        return ""
    s = str(val)
    return s[:maxlen] + "..." if len(s) > maxlen else s


def clean_for_excel(df):
    """Remove illegal characters that openpyxl cannot handle."""
    import re
    ILLEGAL_RE = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f]')
    for col in df.select_dtypes(include=['object']).columns:
        df[col] = df[col].apply(lambda x: ILLEGAL_RE.sub('', str(x)) if pd.notna(x) else x)
    return df


def build_combined(ufo_nuforc, ufo_planetsig, bigfoot_det, bigfoot_loc, haunted,
                   ufo_corgis=None, haunted_kaggle=None, ufo_wlouie1=None,
                   larry_hatch=None, nuforc_hf=None):
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

    # UFO CORGIS
    if ufo_corgis is not None and len(ufo_corgis) > 0:
        df = ufo_corgis.copy()
        frames.append(pd.DataFrame({
            "category": "UFO/UAP",
            "subcategory": df.get("shape", ""),
            "date": df.get("date", ""),
            "time": "",
            "latitude": df["latitude"],
            "longitude": df["longitude"],
            "city": df.get("city", ""),
            "state": df.get("state", ""),
            "country": df.get("country", ""),
            "description": df.get("description", "").apply(lambda x: truncate(x)),
            "source": "CORGIS UFO Sightings",
        }))

    # Haunted Kaggle
    if haunted_kaggle is not None and len(haunted_kaggle) > 0:
        df = haunted_kaggle.copy()
        frames.append(pd.DataFrame({
            "category": "Haunted Place",
            "subcategory": "Ghost/Haunting",
            "date": "",
            "time": "",
            "latitude": df["latitude"],
            "longitude": df["longitude"],
            "city": df.get("city", ""),
            "state": df.get("state_abbrev", df.get("state", "")),
            "country": df.get("country", "United States"),
            "description": df.get("description", "").apply(lambda x: truncate(x)),
            "source": "Kaggle Haunted Places",
        }))

    # Larry Hatch *U* Database (historical UFO cases, 593 BC – 2003)
    if larry_hatch is not None and len(larry_hatch) > 0:
        df = larry_hatch.copy()
        frames.append(pd.DataFrame({
            "category": "UFO/UAP",
            "subcategory": df.get("typeOfUfoCraftFlags", ""),
            "date": df.get("date_str", ""),
            "time": df.get("time", ""),
            "latitude": df["latitude"],
            "longitude": df["longitude"],
            "city": df.get("location", ""),
            "state": df.get("stateOrProvince", ""),
            "country": df.get("country", ""),
            "description": df.get("description", "").apply(lambda x: truncate(x)),
            "source": "Larry Hatch *U* Database (RR0)",
        }))

    # HuggingFace NUFORC (geocoded via gazetteer + Nominatim)
    if nuforc_hf is not None and len(nuforc_hf) > 0:
        df = nuforc_hf.copy()
        frames.append(pd.DataFrame({
            "category": "UFO/UAP",
            "subcategory": df.get("shape", ""),
            "date": df.get("date", ""),
            "time": df.get("time", ""),
            "latitude": df["latitude"],
            "longitude": df["longitude"],
            "city": df.get("city", ""),
            "state": df.get("state", ""),
            "country": df.get("country", ""),
            "description": df.get("summary", "").apply(lambda x: truncate(x)),
            "source": "HuggingFace NUFORC (kcimc, geocoded)",
        }))

    # UFO wlouie1 (includes Canadian sightings)
    if ufo_wlouie1 is not None and len(ufo_wlouie1) > 0:
        df = ufo_wlouie1.copy()
        # Map Canadian province codes to country
        canadian_provinces = {'ab','bc','mb','nb','nf','ns','nt','on','pe','pq','qc','sa','sk','yk','yt'}
        states = df.get("state", pd.Series(dtype=str)).fillna("").str.strip().str.lower()
        country = states.apply(lambda s: "CA" if s in canadian_provinces else "US")
        frames.append(pd.DataFrame({
            "category": "UFO/UAP",
            "subcategory": df.get("shape", ""),
            "date": df["datetime"].apply(lambda x: str(x)[:10] if pd.notna(x) else ""),
            "time": df["datetime"].apply(lambda x: str(x)[11:16] if pd.notna(x) and len(str(x)) > 11 else ""),
            "latitude": df["latitude"],
            "longitude": df["longitude"],
            "city": df.get("city", ""),
            "state": df.get("state", ""),
            "country": country,
            "description": df.get("description", "").apply(lambda x: truncate(x)),
            "source": "NUFORC (wlouie1 geocoded)",
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

    def safe_load(name, loader):
        """Load a dataset, returning empty DataFrame on failure."""
        try:
            result = loader()
            if result is None:
                return pd.DataFrame()
            return result
        except Exception as e:
            print(f"  WARNING: Failed to load {name}: {e}")
            return pd.DataFrame()

    ufo_nuforc = safe_load("UFO NUFORC", load_ufo_nuforc)
    ufo_planetsig = safe_load("UFO planetsig", load_ufo_planetsig)
    bigfoot_det = safe_load("Bigfoot detailed", load_bigfoot_detailed)
    bigfoot_loc = safe_load("Bigfoot locations", load_bigfoot_locations)
    haunted = safe_load("Haunted Places", load_haunted_places)
    ufo_corgis = safe_load("UFO CORGIS", load_ufo_corgis)
    haunted_kaggle = safe_load("Haunted Kaggle", load_haunted_kaggle)
    ufo_wlouie1 = safe_load("UFO wlouie1", load_ufo_wlouie1)
    larry_hatch = safe_load("Larry Hatch", load_larry_hatch)
    nuforc_hf = safe_load("NUFORC HF", load_nuforc_hf)

    combined = build_combined(ufo_nuforc, ufo_planetsig, bigfoot_det, bigfoot_loc, haunted,
                              ufo_corgis=ufo_corgis, haunted_kaggle=haunted_kaggle,
                              ufo_wlouie1=ufo_wlouie1, larry_hatch=larry_hatch,
                              nuforc_hf=nuforc_hf)

    datasets = {
        "UFO_NUFORC_97K": ufo_nuforc,
        "UFO_Geocoded_80K": ufo_planetsig,
        "Bigfoot_Detailed": bigfoot_det,
        "Bigfoot_Locations": bigfoot_loc,
        "Haunted_Places": haunted,
        "Combined_All": combined,
    }
    if ufo_corgis is not None and len(ufo_corgis) > 0:
        datasets["UFO_CORGIS_80K"] = ufo_corgis
    if haunted_kaggle is not None and len(haunted_kaggle) > 0:
        datasets["Haunted_Kaggle"] = haunted_kaggle
    if ufo_wlouie1 is not None and len(ufo_wlouie1) > 0:
        # Truncate descriptions for Excel (wlouie1 has very long descriptions)
        wl = ufo_wlouie1.copy()
        if "description" in wl.columns:
            wl["description"] = wl["description"].apply(lambda x: truncate(x, 2000))
        datasets["UFO_Wlouie1_80K"] = wl
    if larry_hatch is not None and len(larry_hatch) > 0:
        lh = larry_hatch.copy()
        if "description" in lh.columns:
            lh["description"] = lh["description"].apply(lambda x: truncate(x, 2000))
        datasets["UFO_LarryHatch_18K"] = lh
    if nuforc_hf is not None and len(nuforc_hf) > 0:
        hf = nuforc_hf.copy()
        if "summary" in hf.columns:
            hf["summary"] = hf["summary"].apply(lambda x: truncate(x, 2000))
        datasets["UFO_HF_NUFORC_116K"] = hf

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
            clean_for_excel(df).to_excel(writer, sheet_name=safe, index=False)

    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"\nDone! Output: {output_path}")
    print(f"File size: {size_mb:.1f} MB")
    print(f"Tabs: Summary, " + ", ".join(k for k in datasets if k != "Summary"))


if __name__ == "__main__":
    main()
