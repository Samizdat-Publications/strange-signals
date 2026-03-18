"""
STRANGE SIGNALS - HuggingFace NUFORC Geocoding Pipeline
========================================================
Geocodes ~147K NUFORC records from HuggingFace (kcimc dataset) using a
three-tier strategy that costs $0:

  Tier 1: Static gazetteer lookup (Census Bureau + GeoNames) -- instant, ~85-90%
  Tier 2: Nominatim API for unmatched locations -- 1 req/sec, free
  Tier 3: Manual review export for remaining stragglers

Usage:
  # Step 1: Download source data (run once)
  python geocode_nuforc_hf.py --download

  # Step 2: Run full pipeline
  python geocode_nuforc_hf.py --run

  # Step 3 (optional): Resume Nominatim geocoding if interrupted
  python geocode_nuforc_hf.py --resume-nominatim

  # Step 4: Export final geocoded dataset for Strange Signals integration
  python geocode_nuforc_hf.py --export

Output: data/nuforc_hf_geocoded.csv (full dataset with lat/lon)
"""

import os
import sys
import json
import time
import csv
import argparse
import hashlib
from pathlib import Path
from collections import Counter

import pandas as pd
import numpy as np

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
DATA_DIR = Path("data")
RAW_DIR = DATA_DIR / "raw"
CACHE_DIR = DATA_DIR / "geocode_cache"

# Source files
HF_NUFORC_URL = "https://huggingface.co/datasets/kcimc/NUFORC/resolve/main/nuforc.json?download=true"
CENSUS_GAZETTEER_URL = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_place_national.zip"
GEONAMES_CITIES_URL = "https://download.geonames.org/export/dump/cities1000.zip"

# File paths
HF_RAW = RAW_DIR / "nuforc_hf.json"
CENSUS_GAZ = RAW_DIR / "census_gazetteer.tsv"
GEONAMES_CITIES = RAW_DIR / "geonames_cities1000.txt"
UNIQUE_LOCATIONS = DATA_DIR / "nuforc_hf_unique_locations.csv"
GAZETTEER_MATCHED = DATA_DIR / "nuforc_hf_gazetteer_matched.csv"
NOMINATIM_CACHE = CACHE_DIR / "nominatim_results.csv"
FINAL_OUTPUT = DATA_DIR / "nuforc_hf_geocoded.csv"
UNMATCHED_EXPORT = DATA_DIR / "nuforc_hf_unmatched_for_review.csv"

# US state name to abbreviation mapping
US_STATES = {
    'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
    'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
    'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
    'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
    'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
    'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN',
    'mississippi': 'MS', 'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE',
    'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
    'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC',
    'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK', 'oregon': 'OR',
    'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
    'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
    'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA',
    'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
    'district of columbia': 'DC', 'puerto rico': 'PR',
}
# Reverse mapping
US_ABBREV_TO_STATE = {v: k.title() for k, v in US_STATES.items()}

# Canadian provinces
CA_PROVINCES = {
    'alberta': 'AB', 'british columbia': 'BC', 'manitoba': 'MB',
    'new brunswick': 'NB', 'newfoundland and labrador': 'NL',
    'nova scotia': 'NS', 'northwest territories': 'NT', 'nunavut': 'NU',
    'ontario': 'ON', 'prince edward island': 'PE', 'quebec': 'QC',
    'saskatchewan': 'SK', 'yukon': 'YT',
}


def ensure_dirs():
    """Create data directories if they don't exist."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Step 0: Download source files
# ---------------------------------------------------------------------------
def download_sources():
    """Download HuggingFace NUFORC, Census Gazetteer, and GeoNames cities."""
    import urllib.request
    import zipfile

    ensure_dirs()

    # HuggingFace NUFORC JSON
    if not HF_RAW.exists():
        print(f"Downloading HuggingFace NUFORC dataset (~25MB)...")
        urllib.request.urlretrieve(HF_NUFORC_URL, HF_RAW)
        print(f"  Saved to {HF_RAW}")
    else:
        print(f"  Already have {HF_RAW}")

    # Census Bureau Gazetteer
    census_zip = RAW_DIR / "census_gazetteer.zip"
    if not CENSUS_GAZ.exists():
        print(f"Downloading US Census Gazetteer...")
        urllib.request.urlretrieve(CENSUS_GAZETTEER_URL, census_zip)
        with zipfile.ZipFile(census_zip, 'r') as zf:
            # Find the .txt file inside
            txt_files = [f for f in zf.namelist() if f.endswith('.txt')]
            if txt_files:
                with zf.open(txt_files[0]) as src, open(CENSUS_GAZ, 'wb') as dst:
                    dst.write(src.read())
        census_zip.unlink()
        print(f"  Saved to {CENSUS_GAZ}")
    else:
        print(f"  Already have {CENSUS_GAZ}")

    # GeoNames cities1000 (cities with population > 1000, worldwide)
    geonames_zip = RAW_DIR / "cities1000.zip"
    if not GEONAMES_CITIES.exists():
        print(f"Downloading GeoNames cities1000 (~9MB)...")
        urllib.request.urlretrieve(GEONAMES_CITIES_URL, geonames_zip)
        with zipfile.ZipFile(geonames_zip, 'r') as zf:
            txt_files = [f for f in zf.namelist() if f.endswith('.txt')]
            if txt_files:
                with zf.open(txt_files[0]) as src, open(GEONAMES_CITIES, 'wb') as dst:
                    dst.write(src.read())
        geonames_zip.unlink()
        print(f"  Saved to {GEONAMES_CITIES}")
    else:
        print(f"  Already have {GEONAMES_CITIES}")

    print("\nAll source files downloaded.")


# ---------------------------------------------------------------------------
# Step 1: Parse NUFORC and extract unique locations
# ---------------------------------------------------------------------------
def parse_nuforc_and_extract_locations():
    """Parse the HF NUFORC JSON and build a unique locations lookup table."""
    print("\n--- Step 1: Parse NUFORC + extract unique locations ---")

    print(f"Loading {HF_RAW}...")
    with open(HF_RAW, 'r', encoding='utf-8') as f:
        records = json.load(f)
    print(f"  Loaded {len(records):,} raw records")

    # Extract city, state, country from each record
    # HF NUFORC fields vary -- inspect first record
    if records:
        print(f"  Sample record keys: {list(records[0].keys())[:10]}")

    locations = []
    for rec in records:
        # HF NUFORC uses a combined "Location" field like "Huntsville, TX, USA"
        loc_raw = (rec.get('Location') or '').strip()
        parts = [p.strip() for p in loc_raw.split(',')]

        city = ''
        state = ''
        country = ''

        if len(parts) >= 3:
            city = parts[0]
            state = parts[1]
            country = parts[2]
        elif len(parts) == 2:
            city = parts[0]
            state = parts[1]
        elif len(parts) == 1:
            city = parts[0]

        # Normalize
        city_clean = city.title().strip()
        state_clean = state.strip().upper()
        country = country.strip()

        # Build a location key
        loc_key = f"{city_clean}|{state_clean}|{country}"
        locations.append(loc_key)

    # Count unique locations
    loc_counts = Counter(locations)
    print(f"  Total records: {len(records):,}")
    print(f"  Unique city|state|country combos: {len(loc_counts):,}")

    # Save unique locations with counts
    rows = []
    for loc_key, count in loc_counts.most_common():
        city, state, country = loc_key.split('|')
        rows.append({
            'city': city,
            'state': state,
            'country': country,
            'record_count': count,
            'loc_key': loc_key,
        })

    df_locs = pd.DataFrame(rows)
    df_locs.to_csv(UNIQUE_LOCATIONS, index=False)
    print(f"  Saved {len(df_locs):,} unique locations to {UNIQUE_LOCATIONS}")
    print(f"  Top 10 locations by record count:")
    for _, row in df_locs.head(10).iterrows():
        print(f"    {row['city']}, {row['state']} ({row['country']}): {row['record_count']:,} records")

    return df_locs


# ---------------------------------------------------------------------------
# Step 2: Build gazetteers
# ---------------------------------------------------------------------------
def build_census_gazetteer():
    """Load Census Bureau places gazetteer into a lookup dict."""
    print("\n  Loading Census Gazetteer...")
    df = pd.read_csv(CENSUS_GAZ, sep='\t', dtype=str, encoding='latin-1')
    df.columns = df.columns.str.strip()

    # Census gazetteer has columns like: USPS, GEOID, ANSICODE, NAME, ...INTPTLAT, INTPTLONG
    # Find lat/lon columns
    lat_col = [c for c in df.columns if 'LAT' in c.upper()][0]
    lon_col = [c for c in df.columns if 'LONG' in c.upper()][0]
    name_col = [c for c in df.columns if c.upper() == 'NAME'][0]
    state_col = [c for c in df.columns if c.upper() == 'USPS'][0]

    lookup = {}
    for _, row in df.iterrows():
        city = str(row[name_col]).strip().title()
        state = str(row[state_col]).strip().upper()
        try:
            lat = float(str(row[lat_col]).strip().lstrip('+'))
            lon = float(str(row[lon_col]).strip())
            if -90 <= lat <= 90 and -180 <= lon <= 180:
                # Remove common suffixes for fuzzy matching
                city_base = city
                for suffix in [' City', ' Town', ' Village', ' Borough', ' Cdp',
                               ' Municipality', ' Plantation']:
                    if city_base.endswith(suffix):
                        city_base = city_base[:-len(suffix)]

                key_exact = f"{city}|{state}"
                key_base = f"{city_base}|{state}"
                lookup[key_exact.upper()] = (lat, lon)
                if key_base.upper() != key_exact.upper():
                    lookup[key_base.upper()] = (lat, lon)
        except (ValueError, TypeError):
            continue

    print(f"    Loaded {len(lookup):,} place entries")
    return lookup


def build_geonames_gazetteer():
    """Load GeoNames cities1000 into a lookup dict."""
    print("  Loading GeoNames cities1000...")
    # GeoNames format: tab-separated, no header
    # Columns: geonameid, name, asciiname, alternatenames, latitude, longitude,
    #          feature_class, feature_code, country_code, cc2, admin1, admin2,
    #          admin3, admin4, population, elevation, dem, timezone, modification_date
    cols = ['geonameid', 'name', 'asciiname', 'alternatenames', 'latitude',
            'longitude', 'feature_class', 'feature_code', 'country_code', 'cc2',
            'admin1', 'admin2', 'admin3', 'admin4', 'population', 'elevation',
            'dem', 'timezone', 'modification_date']

    df = pd.read_csv(GEONAMES_CITIES, sep='\t', header=None, names=cols,
                     dtype=str, encoding='utf-8', quoting=csv.QUOTE_NONE)

    lookup = {}
    for _, row in df.iterrows():
        try:
            lat = float(row['latitude'])
            lon = float(row['longitude'])
            name = str(row['asciiname']).strip().title()
            country = str(row['country_code']).strip().upper()
            admin1 = str(row['admin1']).strip() if pd.notna(row['admin1']) else ''

            # For US entries, admin1 is the FIPS state code -- map to abbreviation
            # For other countries, use country code as the state-level key
            if country == 'US':
                # GeoNames US admin1 = 2-letter FIPS state code (matches USPS)
                state = admin1.upper()
            elif country == 'CA':
                state = admin1.upper()
            else:
                state = country

            key = f"{name}|{state}".upper()
            # Prefer higher-population entries
            existing = lookup.get(key)
            if existing is None:
                lookup[key] = (lat, lon)
        except (ValueError, TypeError):
            continue

    print(f"    Loaded {len(lookup):,} city entries (worldwide)")
    return lookup


# ---------------------------------------------------------------------------
# Step 3: Gazetteer matching (Tier 1)
# ---------------------------------------------------------------------------
def match_gazetteers(df_locs):
    """Match unique locations against Census + GeoNames gazetteers."""
    print("\n--- Step 2: Gazetteer matching (Tier 1) ---")

    census = build_census_gazetteer()
    geonames = build_geonames_gazetteer()

    results = []
    matched = 0
    unmatched = 0

    for _, row in df_locs.iterrows():
        city = row['city'].strip()
        state = row['state'].strip().upper()
        country = row['country'].strip().upper()

        lat, lon, source = None, None, None

        # Build lookup key -- try multiple strategies
        keys_to_try = []

        # Direct match
        keys_to_try.append(f"{city}|{state}".upper())

        # Try without parenthetical content: "Springfield (east)" -> "Springfield"
        if '(' in city:
            city_clean = city[:city.index('(')].strip()
            keys_to_try.append(f"{city_clean}|{state}".upper())

        # Try without trailing directional: "Springfield North" -> "Springfield"
        for direction in ['North', 'South', 'East', 'West', 'Northeast',
                          'Northwest', 'Southeast', 'Southwest']:
            if city.endswith(f' {direction}'):
                city_trimmed = city[:-len(f' {direction}')]
                keys_to_try.append(f"{city_trimmed}|{state}".upper())

        # Try Census first (US-specific, higher quality), then GeoNames
        for key in keys_to_try:
            if key in census:
                lat, lon = census[key]
                source = 'census'
                break

        if lat is None:
            for key in keys_to_try:
                if key in geonames:
                    lat, lon = geonames[key]
                    source = 'geonames'
                    break

        if lat is not None:
            matched += 1
        else:
            unmatched += 1

        results.append({
            'city': row['city'],
            'state': row['state'],
            'country': row['country'],
            'record_count': row['record_count'],
            'loc_key': row['loc_key'],
            'lat': lat,
            'lon': lon,
            'geocode_source': source or '',
        })

    df_results = pd.DataFrame(results)
    df_results.to_csv(GAZETTEER_MATCHED, index=False)

    matched_records = df_results[df_results['lat'].notna()]['record_count'].sum()
    total_records = df_results['record_count'].sum()

    print(f"\n  Gazetteer results:")
    print(f"    Unique locations matched: {matched:,} / {len(df_locs):,} ({matched/len(df_locs)*100:.1f}%)")
    print(f"    Records covered: {matched_records:,} / {total_records:,} ({matched_records/total_records*100:.1f}%)")
    print(f"    Unmatched locations: {unmatched:,}")
    print(f"  Saved to {GAZETTEER_MATCHED}")

    return df_results


# ---------------------------------------------------------------------------
# Step 4: Nominatim geocoding for unmatched (Tier 2)
# ---------------------------------------------------------------------------
def geocode_nominatim(df_results):
    """Geocode unmatched locations using Nominatim (1 req/sec)."""
    import urllib.request
    import urllib.parse

    print("\n--- Step 3: Nominatim geocoding (Tier 2) ---")

    unmatched = df_results[df_results['lat'].isna()].copy()
    # Sort by record count descending -- geocode the most impactful locations first
    unmatched = unmatched.sort_values('record_count', ascending=False)

    print(f"  {len(unmatched):,} unique locations need Nominatim geocoding")
    total_records_affected = unmatched['record_count'].sum()
    print(f"  These cover {total_records_affected:,} sighting records")
    est_minutes = len(unmatched) / 60
    print(f"  Estimated time at 1 req/sec: {est_minutes:.0f} minutes ({est_minutes/60:.1f} hours)")

    # Load existing cache if resuming
    cache = {}
    if NOMINATIM_CACHE.exists():
        df_cache = pd.read_csv(NOMINATIM_CACHE, dtype=str)
        for _, row in df_cache.iterrows():
            cache[row['loc_key']] = {
                'lat': float(row['lat']) if row['lat'] and row['lat'] != '' else None,
                'lon': float(row['lon']) if row['lon'] and row['lon'] != '' else None,
                'display_name': row.get('display_name', ''),
            }
        print(f"  Loaded {len(cache):,} cached Nominatim results")

    # Geocode
    new_results = []
    geocoded = 0
    failed = 0
    skipped = 0
    total = len(unmatched)

    for i, (_, row) in enumerate(unmatched.iterrows()):
        loc_key = row['loc_key']

        # Skip if already cached
        if loc_key in cache:
            skipped += 1
            continue

        city = row['city']
        state = row['state']
        country = row['country']

        # Build query string
        # Map NUFORC country codes to full names
        country_map = {'us': 'United States', 'usa': 'United States',
                       'ca': 'Canada', 'gb': 'United Kingdom',
                       'uk': 'United Kingdom', 'au': 'Australia',
                       'de': 'Germany', 'fr': 'France'}
        country_full = country_map.get(country.lower(), country)

        # Build a reasonable query
        parts = [p for p in [city, state, country_full] if p]
        query = ', '.join(parts)

        if not query.strip():
            cache[loc_key] = {'lat': None, 'lon': None, 'display_name': ''}
            failed += 1
            continue

        # Nominatim request
        params = urllib.parse.urlencode({
            'q': query,
            'format': 'json',
            'limit': 1,
            'addressdetails': 0,
        })
        url = f"https://nominatim.openstreetmap.org/search?{params}"

        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': 'StrangeSignals/1.0 (paranormal-sightings-map; stewartgregerson@gmail.com)'
            })
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode('utf-8'))

            if data:
                lat = float(data[0]['lat'])
                lon = float(data[0]['lon'])
                display = data[0].get('display_name', '')
                cache[loc_key] = {'lat': lat, 'lon': lon, 'display_name': display}
                geocoded += 1
            else:
                cache[loc_key] = {'lat': None, 'lon': None, 'display_name': ''}
                failed += 1

        except Exception as e:
            cache[loc_key] = {'lat': None, 'lon': None, 'display_name': f'ERROR: {e}'}
            failed += 1

        # Progress logging
        done = geocoded + failed
        if done % 100 == 0 or done == total - skipped:
            pct = done / max(total - skipped, 1) * 100
            print(f"    [{done:,}/{total-skipped:,}] ({pct:.1f}%) -- {geocoded:,} geocoded, {failed:,} failed")

        # Save cache periodically (every 500 requests)
        if done % 500 == 0:
            _save_nominatim_cache(cache)

        # Rate limit: 1 request per second
        time.sleep(1.1)

    # Final cache save
    _save_nominatim_cache(cache)

    print(f"\n  Nominatim results:")
    print(f"    Newly geocoded: {geocoded:,}")
    print(f"    Failed/empty: {failed:,}")
    print(f"    Skipped (cached): {skipped:,}")
    print(f"  Cache saved to {NOMINATIM_CACHE}")

    return cache


def _save_nominatim_cache(cache):
    """Persist Nominatim cache to disk."""
    rows = []
    for loc_key, data in cache.items():
        rows.append({
            'loc_key': loc_key,
            'lat': data['lat'] if data['lat'] is not None else '',
            'lon': data['lon'] if data['lon'] is not None else '',
            'display_name': data.get('display_name', ''),
        })
    pd.DataFrame(rows).to_csv(NOMINATIM_CACHE, index=False)


# ---------------------------------------------------------------------------
# Step 5: Merge and export
# ---------------------------------------------------------------------------
def merge_and_export(nominatim_cache=None):
    """Merge gazetteer + Nominatim results back to full NUFORC dataset."""
    print("\n--- Step 4: Merge + export final geocoded dataset ---")

    # Load the gazetteer-matched locations
    df_gaz = pd.read_csv(GAZETTEER_MATCHED, dtype={'lat': float, 'lon': float})

    # Apply Nominatim results on top
    if nominatim_cache is None and NOMINATIM_CACHE.exists():
        nominatim_cache = {}
        df_nom = pd.read_csv(NOMINATIM_CACHE, dtype=str)
        for _, row in df_nom.iterrows():
            if row['lat'] and row['lat'] != '':
                nominatim_cache[row['loc_key']] = {
                    'lat': float(row['lat']),
                    'lon': float(row['lon']),
                }

    if nominatim_cache:
        for i, row in df_gaz.iterrows():
            if pd.isna(row['lat']) and row['loc_key'] in nominatim_cache:
                cached = nominatim_cache[row['loc_key']]
                if cached.get('lat') is not None:
                    df_gaz.at[i, 'lat'] = cached['lat']
                    df_gaz.at[i, 'lon'] = cached['lon']
                    df_gaz.at[i, 'geocode_source'] = 'nominatim'

    # Build location -> coords lookup from merged results
    loc_lookup = {}
    for _, row in df_gaz.iterrows():
        if pd.notna(row['lat']):
            loc_lookup[row['loc_key']] = (row['lat'], row['lon'], row['geocode_source'])

    # Now load full NUFORC dataset and apply coordinates
    print(f"  Loading full NUFORC dataset from {HF_RAW}...")
    with open(HF_RAW, 'r', encoding='utf-8') as f:
        records = json.load(f)

    output_rows = []
    geocoded = 0
    not_geocoded = 0

    for rec in records:
        # Parse combined Location field: "City, State, Country"
        loc_raw = (rec.get('Location') or '').strip()
        parts = [p.strip() for p in loc_raw.split(',')]
        city = parts[0].title() if len(parts) >= 1 else ''
        state = parts[1].strip().upper() if len(parts) >= 2 else ''
        country = parts[2].strip() if len(parts) >= 3 else ''
        loc_key = f"{city}|{state}|{country}"

        coords = loc_lookup.get(loc_key)
        lat = coords[0] if coords else None
        lon = coords[1] if coords else None
        geo_src = coords[2] if coords else ''

        if lat is not None:
            geocoded += 1
        else:
            not_geocoded += 1

        # Parse date from "Occurred" field: "2014-09-21 13:00:00 Local"
        occurred = (rec.get('Occurred') or '').strip()
        date_time = occurred.replace(' Local', '').replace(' Pacific', '').strip()

        output_rows.append({
            'date_time': date_time,
            'city': city,
            'state': state,
            'country': country,
            'shape': rec.get('Shape', ''),
            'duration': rec.get('Duration', ''),
            'summary': rec.get('Summary', rec.get('Text', '')),
            'posted': rec.get('Posted', ''),
            'lat': lat,
            'lon': lon,
            'geocode_source': geo_src,
        })

    df_out = pd.DataFrame(output_rows)
    df_out.to_csv(FINAL_OUTPUT, index=False)

    # Export unmatched for manual review
    df_unmatched = df_gaz[df_gaz['lat'].isna()].sort_values('record_count', ascending=False)
    df_unmatched.to_csv(UNMATCHED_EXPORT, index=False)

    total = geocoded + not_geocoded
    print(f"\n  Final results:")
    print(f"    Total records: {total:,}")
    print(f"    Geocoded: {geocoded:,} ({geocoded/total*100:.1f}%)")
    print(f"    Not geocoded: {not_geocoded:,} ({not_geocoded/total*100:.1f}%)")
    print(f"    Unmatched unique locations: {len(df_unmatched):,}")
    print(f"\n  Output files:")
    print(f"    {FINAL_OUTPUT} -- full geocoded dataset")
    print(f"    {UNMATCHED_EXPORT} -- locations that need manual review ({len(df_unmatched):,} unique)")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def run_full_pipeline():
    """Run the complete geocoding pipeline."""
    ensure_dirs()

    # Step 1: Parse and extract unique locations
    df_locs = parse_nuforc_and_extract_locations()

    # Step 2: Gazetteer matching
    df_results = match_gazetteers(df_locs)

    # Step 3: Nominatim for unmatched
    nom_cache = geocode_nominatim(df_results)

    # Step 4: Merge and export
    merge_and_export(nom_cache)

    print("\n=== Pipeline complete! ===")
    print(f"Final geocoded dataset: {FINAL_OUTPUT}")
    print(f"Ready for Strange Signals integration via export_map_data.py")


def main():
    parser = argparse.ArgumentParser(description='STRANGE SIGNALS NUFORC HF Geocoding Pipeline')
    parser.add_argument('--download', action='store_true',
                        help='Download source data files')
    parser.add_argument('--run', action='store_true',
                        help='Run full geocoding pipeline')
    parser.add_argument('--resume-nominatim', action='store_true',
                        help='Resume Nominatim geocoding for unmatched locations')
    parser.add_argument('--export', action='store_true',
                        help='Export final geocoded dataset (skip geocoding)')
    args = parser.parse_args()

    if args.download:
        download_sources()
    elif args.run:
        download_sources()
        run_full_pipeline()
    elif args.resume_nominatim:
        if not GAZETTEER_MATCHED.exists():
            print("ERROR: Run --run first to generate gazetteer matches.")
            sys.exit(1)
        df_results = pd.read_csv(GAZETTEER_MATCHED, dtype={'lat': float, 'lon': float})
        nom_cache = geocode_nominatim(df_results)
        merge_and_export(nom_cache)
    elif args.export:
        merge_and_export()
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
