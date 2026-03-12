#!/usr/bin/env python3
"""
Export sighting datasets as compact JSON for the interactive map.
Uses clustering-friendly format to keep file sizes manageable.
"""

import pandas as pd
import json
import os

RAW_DIR = os.path.join(os.path.dirname(__file__), "data", "raw")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "data")


def export_ufo():
    """Export UFO sightings as JSON array with minimal fields for mapping."""
    print("Exporting UFO data...")
    sightings = pd.read_csv(os.path.join(RAW_DIR, "ufo_sightings.csv"), low_memory=False)
    places = pd.read_csv(os.path.join(RAW_DIR, "ufo_places.csv"), low_memory=False)

    places_dedup = places.drop_duplicates(subset=["city", "state", "country_code"])
    merged = sightings.merge(
        places_dedup[["city", "state", "country_code", "latitude", "longitude"]],
        on=["city", "state", "country_code"],
        how="left",
    )
    merged = merged.dropna(subset=["latitude", "longitude"])

    records = []
    for _, r in merged.iterrows():
        dt = pd.to_datetime(r["reported_date_time"], errors="coerce")
        records.append({
            "lat": round(float(r["latitude"]), 4),
            "lng": round(float(r["longitude"]), 4),
            "date": dt.strftime("%Y-%m-%d") if pd.notna(dt) else "",
            "city": str(r["city"]) if pd.notna(r["city"]) else "",
            "state": str(r["state"]) if pd.notna(r["state"]) else "",
            "shape": str(r["shape"]) if pd.notna(r["shape"]) else "",
            "summary": str(r["summary"])[:200] if pd.notna(r["summary"]) else "",
        })

    out_path = os.path.join(OUTPUT_DIR, "ufo_map.json")
    with open(out_path, "w") as f:
        json.dump(records, f, separators=(",", ":"))
    print(f"  {len(records)} UFO records -> {os.path.getsize(out_path) / 1e6:.1f} MB")


def export_bigfoot():
    """Export Bigfoot sightings as JSON."""
    print("Exporting Bigfoot data...")
    df = pd.read_csv(os.path.join(RAW_DIR, "bfro_reports_geocoded.csv"), low_memory=False)
    df = df.dropna(subset=["latitude", "longitude"])

    records = []
    for _, r in df.iterrows():
        dt = pd.to_datetime(r["date"], errors="coerce")
        records.append({
            "lat": round(float(r["latitude"]), 4),
            "lng": round(float(r["longitude"]), 4),
            "date": dt.strftime("%Y-%m-%d") if pd.notna(dt) else "",
            "state": str(r["state"]) if pd.notna(r["state"]) else "",
            "county": str(r["county"]) if pd.notna(r["county"]) else "",
            "class": str(r["classification"]) if pd.notna(r["classification"]) else "",
            "title": str(r["title"])[:200] if pd.notna(r["title"]) else "",
            "summary": str(r["observed"])[:200] if pd.notna(r["observed"]) else "",
        })

    out_path = os.path.join(OUTPUT_DIR, "bigfoot_map.json")
    with open(out_path, "w") as f:
        json.dump(records, f, separators=(",", ":"))
    print(f"  {len(records)} Bigfoot records -> {os.path.getsize(out_path) / 1e6:.1f} MB")


def export_haunted():
    """Export Haunted Places as JSON."""
    print("Exporting Haunted Places data...")
    df = pd.read_csv(os.path.join(RAW_DIR, "haunted_places.csv"), low_memory=False)
    df = df.dropna(subset=["latitude", "longitude"])

    records = []
    for _, r in df.iterrows():
        records.append({
            "lat": round(float(r["latitude"]), 4),
            "lng": round(float(r["longitude"]), 4),
            "city": str(r["city"]) if pd.notna(r["city"]) else "",
            "state": str(r["state_abbrev"]) if pd.notna(r["state_abbrev"]) else "",
            "location": str(r["location"])[:200] if pd.notna(r["location"]) else "",
            "summary": str(r["description"])[:200] if pd.notna(r["description"]) else "",
        })

    out_path = os.path.join(OUTPUT_DIR, "haunted_map.json")
    with open(out_path, "w") as f:
        json.dump(records, f, separators=(",", ":"))
    print(f"  {len(records)} Haunted records -> {os.path.getsize(out_path) / 1e6:.1f} MB")


if __name__ == "__main__":
    export_ufo()
    export_bigfoot()
    export_haunted()
    print("Done!")
