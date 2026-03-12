#!/usr/bin/env python3
"""
Consolidate UAP/UFO, Bigfoot, and Haunted Places sighting datasets
into a single geocoded Excel workbook with one tab per dataset.

Data sources:
- NUFORC UFO Sightings (via TidyTuesday / rfordatascience)
- BFRO Bigfoot Reports (via guyroyse/bigfoot-redis)
- Shadowlands Haunted Places (via TidyTuesday / rfordatascience)
"""

import pandas as pd
import os
import sys

RAW_DIR = os.path.join(os.path.dirname(__file__), "data", "raw")
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "data", "sightings_consolidated.xlsx")


def load_ufo_sightings():
    """Load and geocode NUFORC UFO sightings by joining with places table."""
    print("Loading UFO sightings...")
    sightings = pd.read_csv(os.path.join(RAW_DIR, "ufo_sightings.csv"), low_memory=False)
    places = pd.read_csv(os.path.join(RAW_DIR, "ufo_places.csv"), low_memory=False)

    # Join sightings with places to get lat/lon
    places_dedup = places.drop_duplicates(subset=["city", "state", "country_code"])
    merged = sightings.merge(
        places_dedup[["city", "state", "country_code", "latitude", "longitude",
                       "timezone", "population", "elevation_m"]],
        on=["city", "state", "country_code"],
        how="left",
    )

    # Standardize output columns
    result = pd.DataFrame({
        "date": pd.to_datetime(merged["reported_date_time"], errors="coerce").dt.strftime("%Y-%m-%d"),
        "time": pd.to_datetime(merged["reported_date_time"], errors="coerce").dt.strftime("%H:%M"),
        "city": merged["city"],
        "state": merged["state"],
        "country": merged["country_code"],
        "latitude": merged["latitude"],
        "longitude": merged["longitude"],
        "shape": merged["shape"],
        "duration_seconds": merged["duration_seconds"],
        "duration_text": merged["reported_duration"],
        "summary": merged["summary"],
        "day_part": merged["day_part"],
        "posted_date": merged["posted_date"],
        "source": "NUFORC",
    })

    # Drop rows with no coordinates
    geocoded = result.dropna(subset=["latitude", "longitude"])
    print(f"  UFO sightings: {len(result)} total, {len(geocoded)} geocoded")
    return geocoded


def load_bigfoot_sightings():
    """Load BFRO Bigfoot sighting reports (already geocoded)."""
    print("Loading Bigfoot sightings...")
    df = pd.read_csv(os.path.join(RAW_DIR, "bfro_reports_geocoded.csv"), low_memory=False)

    result = pd.DataFrame({
        "date": pd.to_datetime(df["date"], errors="coerce").dt.strftime("%Y-%m-%d"),
        "title": df["title"],
        "observed": df["observed"],
        "location_details": df["location_details"],
        "county": df["county"],
        "state": df["state"],
        "latitude": df["latitude"],
        "longitude": df["longitude"],
        "classification": df["classification"],
        "temperature_high": df["temperature_high"],
        "temperature_low": df["temperature_low"],
        "humidity": df["humidity"],
        "cloud_cover": df["cloud_cover"],
        "moon_phase": df["moon_phase"],
        "precip_type": df["precip_type"],
        "visibility": df["visibility"],
        "wind_speed": df["wind_speed"],
        "uv_index": df["uv_index"],
        "report_number": df["number"],
        "source": "BFRO",
    })

    geocoded = result.dropna(subset=["latitude", "longitude"])
    print(f"  Bigfoot sightings: {len(result)} total, {len(geocoded)} geocoded")
    return geocoded


def load_haunted_places():
    """Load Shadowlands Haunted Places (already geocoded)."""
    print("Loading Haunted Places...")
    df = pd.read_csv(os.path.join(RAW_DIR, "haunted_places.csv"), low_memory=False)

    result = pd.DataFrame({
        "city": df["city"],
        "state": df["state"],
        "state_abbrev": df["state_abbrev"],
        "country": df["country"],
        "location": df["location"],
        "description": df["description"],
        "latitude": df["latitude"],
        "longitude": df["longitude"],
        "city_latitude": df["city_latitude"],
        "city_longitude": df["city_longitude"],
        "source": "Shadowlands",
    })

    geocoded = result.dropna(subset=["latitude", "longitude"])
    print(f"  Haunted places: {len(result)} total, {len(geocoded)} geocoded")
    return geocoded


def main():
    print("=" * 60)
    print("SIGHTING DATASET CONSOLIDATOR")
    print("=" * 60)

    ufo = load_ufo_sightings()
    bigfoot = load_bigfoot_sightings()
    haunted = load_haunted_places()

    # Write to Excel with one tab per dataset
    print(f"\nWriting to {OUTPUT_FILE}...")
    with pd.ExcelWriter(OUTPUT_FILE, engine="openpyxl") as writer:
        ufo.to_excel(writer, sheet_name="UFO_Sightings_NUFORC", index=False)
        bigfoot.to_excel(writer, sheet_name="Bigfoot_Sightings_BFRO", index=False)
        haunted.to_excel(writer, sheet_name="Haunted_Places", index=False)

        # Summary tab
        summary = pd.DataFrame({
            "Dataset": ["UFO Sightings (NUFORC)", "Bigfoot Sightings (BFRO)", "Haunted Places (Shadowlands)"],
            "Records": [len(ufo), len(bigfoot), len(haunted)],
            "Source": [
                "National UFO Reporting Center via TidyTuesday",
                "Bigfoot Field Researchers Org via bigfoot-redis",
                "Shadowlands Haunted Places Index via TidyTuesday",
            ],
            "Geocoded": ["Yes", "Yes", "Yes"],
            "Notes": [
                "~97K sightings, joined with places for lat/lon",
                "~4.5K reports with weather data, moon phase, etc.",
                "~11K US haunted locations with descriptions",
            ],
        })
        summary.to_excel(writer, sheet_name="Summary", index=False)

    file_size_mb = os.path.getsize(OUTPUT_FILE) / (1024 * 1024)
    print(f"Done! File size: {file_size_mb:.1f} MB")
    print(f"Output: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
