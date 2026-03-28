#!/usr/bin/env python3
"""
Fetch USGS earthquake data and convert to Strange Signals overlay format.
"""

import urllib.request
import json
import csv
from io import StringIO
from datetime import datetime

# USGS FDSNWS query parameters
USGS_URL = "https://earthquake.usgs.gov/fdsnws/event/1/query"
params = {
    "format": "csv",
    "starttime": "1900-01-01",
    "endtime": "2025-12-31",
    "minmagnitude": "2.5",
    "minlatitude": "24",
    "maxlatitude": "50",
    "minlongitude": "-125",
    "maxlongitude": "-66",
    "orderby": "time",
    "limit": "20000"
}

# Build query string
query_string = "&".join([f"{k}={v}" for k, v in params.items()])
full_url = f"{USGS_URL}?{query_string}"

print(f"Fetching USGS earthquake data...")
print(f"URL: {full_url}")

try:
    # Fetch the CSV data
    with urllib.request.urlopen(full_url, timeout=60) as response:
        csv_data = response.read().decode('utf-8')

    print(f"Downloaded {len(csv_data)} bytes")

    # Parse CSV
    csv_reader = csv.DictReader(StringIO(csv_data))
    records = list(csv_reader)

    print(f"Parsed {len(records)} earthquake records")

    # Convert to Strange Signals format
    # Expected fields in USGS CSV: time, latitude, longitude, depth, mag, place
    overlay_data = {
        "fields": ["lat", "lon", "date", "magnitude", "depth_km", "place"],
        "data": []
    }

    skipped = 0
    for record in records:
        try:
            # Parse time to extract date (YYYY-MM-DD)
            time_str = record.get('time', '')
            if time_str:
                # Format is typically "2023-01-15T12:34:56.123Z"
                date_part = time_str.split('T')[0]
            else:
                date_part = "1900-01-01"

            # Round coordinates to 4 decimal places
            lat = round(float(record.get('latitude', 0)), 4)
            lon = round(float(record.get('longitude', 0)), 4)
            mag = float(record.get('mag', 0))
            depth = float(record.get('depth', 0))
            place = record.get('place', 'Unknown')

            # Add to data array
            overlay_data['data'].append([
                lat,
                lon,
                date_part,
                mag,
                depth,
                place
            ])
        except (ValueError, KeyError) as e:
            skipped += 1
            continue

    print(f"Converted {len(overlay_data['data'])} records (skipped {skipped})")

    # Save as JSON
    output_path = "data/usgs_earthquakes.json"
    with open(output_path, 'w') as f:
        json.dump(overlay_data, f, separators=(',', ':'), indent=None)

    print(f"\nSaved to: {output_path}")

    # Print summary stats
    if overlay_data['data']:
        mags = [r[3] for r in overlay_data['data']]
        depths = [r[4] for r in overlay_data['data']]
        dates = [r[2] for r in overlay_data['data']]

        print(f"\nSummary Statistics:")
        print(f"  Total records: {len(overlay_data['data'])}")
        print(f"  Magnitude range: {min(mags):.1f} - {max(mags):.1f}")
        print(f"  Depth range: {min(depths):.1f} - {max(depths):.1f} km")
        print(f"  Date range: {min(dates)} to {max(dates)}")
        print(f"  JSON file size: {len(json.dumps(overlay_data))} bytes")

        # Sample records
        print(f"\nFirst 3 records:")
        for i, r in enumerate(overlay_data['data'][:3]):
            print(f"  {i+1}. Lat={r[0]}, Lon={r[1]}, Date={r[2]}, Mag={r[3]}, Depth={r[4]}km, Place={r[5]}")

except urllib.error.URLError as e:
    print(f"Error fetching data: {e}")
    print(f"\nTrying with minmagnitude=3.0 and limit=10000...")

    # Retry with higher magnitude threshold
    params['minmagnitude'] = '3.0'
    params['limit'] = '10000'
    query_string = "&".join([f"{k}={v}" for k, v in params.items()])
    full_url = f"{USGS_URL}?{query_string}"

    print(f"Retrying with URL: {full_url}")

    try:
        with urllib.request.urlopen(full_url, timeout=60) as response:
            csv_data = response.read().decode('utf-8')

        print(f"Downloaded {len(csv_data)} bytes")

        # Parse CSV
        csv_reader = csv.DictReader(StringIO(csv_data))
        records = list(csv_reader)

        print(f"Parsed {len(records)} earthquake records")

        # Convert to Strange Signals format
        overlay_data = {
            "fields": ["lat", "lon", "date", "magnitude", "depth_km", "place"],
            "data": []
        }

        skipped = 0
        for record in records:
            try:
                time_str = record.get('time', '')
                if time_str:
                    date_part = time_str.split('T')[0]
                else:
                    date_part = "1900-01-01"

                lat = round(float(record.get('latitude', 0)), 4)
                lon = round(float(record.get('longitude', 0)), 4)
                mag = float(record.get('mag', 0))
                depth = float(record.get('depth', 0))
                place = record.get('place', 'Unknown')

                overlay_data['data'].append([
                    lat,
                    lon,
                    date_part,
                    mag,
                    depth,
                    place
                ])
            except (ValueError, KeyError) as e:
                skipped += 1
                continue

        print(f"Converted {len(overlay_data['data'])} records (skipped {skipped})")

        # Save as JSON
        output_path = "data/usgs_earthquakes.json"
        with open(output_path, 'w') as f:
            json.dump(overlay_data, f, separators=(',', ':'), indent=None)

        print(f"\nSaved to: {output_path}")

        # Print summary stats
        if overlay_data['data']:
            mags = [r[3] for r in overlay_data['data']]
            depths = [r[4] for r in overlay_data['data']]
            dates = [r[2] for r in overlay_data['data']]

            print(f"\nSummary Statistics:")
            print(f"  Total records: {len(overlay_data['data'])}")
            print(f"  Magnitude range: {min(mags):.1f} - {max(mags):.1f}")
            print(f"  Depth range: {min(depths):.1f} - {max(depths):.1f} km")
            print(f"  Date range: {min(dates)} to {max(dates)}")
            print(f"  JSON file size: {len(json.dumps(overlay_data))} bytes")

            # Sample records
            print(f"\nFirst 3 records:")
            for i, r in enumerate(overlay_data['data'][:3]):
                print(f"  {i+1}. Lat={r[0]}, Lon={r[1]}, Date={r[2]}, Mag={r[3]}, Depth={r[4]}km, Place={r[5]}")

    except Exception as e2:
        print(f"Retry failed: {e2}")
