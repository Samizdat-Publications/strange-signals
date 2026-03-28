#!/usr/bin/env python3
"""
NASA Fireball Data Fetcher
Downloads fireball/bolide data from NASA SSD API and exports as compact JSON overlay.
Target: data/nasa_fireballs.json
"""

import urllib.request
import json

def fetch_nasa_fireballs():
    """Fetch fireball data from NASA SSD API with location data."""
    url = "https://ssd-api.jpl.nasa.gov/fireball.api?date-min=1900-01-01&req-loc=true"
    print(f"Fetching from: {url}")

    try:
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read().decode('utf-8'))
        print(f"✓ Downloaded {len(data.get('data', []))} records from NASA API")
        return data
    except Exception as e:
        print(f"✗ Error fetching data: {e}")
        raise

def filter_continental_us(lat, lon):
    """Check if coordinates are in continental US bounding box."""
    # Continental US: 24-50°N, -125 to -66°W
    return 24 <= lat <= 50 and -125 <= lon <= -66

def round_coord(value, decimals=4):
    """Round coordinate to specified decimal places."""
    return round(float(value), decimals)

def parse_nasa_fireball_data(api_data):
    """
    Parse NASA API response and extract relevant fields.
    API returns: {fields: [...], data: [[...], ...]}
    Fields: ['date', 'energy', 'impact-e', 'lat', 'lat-dir', 'lon', 'lon-dir', 'alt', 'vel']
    """
    api_fields = api_data.get('fields', [])
    api_records = api_data.get('data', [])

    print(f"\nAPI fields: {api_fields}")
    print(f"Processing {len(api_records)} records...")

    # Map API field names to indices
    field_map = {field: idx for idx, field in enumerate(api_fields)}

    output_records = []
    skipped = 0
    success = 0

    for record in api_records:
        try:
            # Get field indices
            date_idx = field_map.get('date')
            lat_idx = field_map.get('lat')
            lat_dir_idx = field_map.get('lat-dir')
            lon_idx = field_map.get('lon')
            lon_dir_idx = field_map.get('lon-dir')
            energy_idx = field_map.get('energy')
            velocity_idx = field_map.get('vel')
            altitude_idx = field_map.get('alt')

            # Extract raw values
            if date_idx is None or lat_idx is None or lon_idx is None:
                skipped += 1
                continue

            date_str = str(record[date_idx]).split()[0] if date_idx < len(record) else "Unknown"
            lat_val = float(record[lat_idx]) if lat_idx < len(record) else None
            lon_val = float(record[lon_idx]) if lon_idx < len(record) else None

            if lat_val is None or lon_val is None:
                skipped += 1
                continue

            # Apply direction modifiers (N/S for lat, E/W for lon)
            if lat_dir_idx < len(record) and record[lat_dir_idx] == 'S':
                lat_val = -lat_val
            if lon_dir_idx < len(record) and record[lon_dir_idx] == 'W':
                lon_val = -lon_val

            # Filter to continental US
            if not filter_continental_us(lat_val, lon_val):
                skipped += 1
                continue

            # Extract energy, velocity, altitude (or None if not available)
            energy_val = None
            if energy_idx is not None and energy_idx < len(record):
                try:
                    energy_val = float(record[energy_idx])
                except (ValueError, TypeError):
                    pass

            velocity_val = None
            if velocity_idx is not None and velocity_idx < len(record):
                try:
                    velocity_val = float(record[velocity_idx])
                except (ValueError, TypeError):
                    pass

            altitude_val = None
            if altitude_idx is not None and altitude_idx < len(record):
                try:
                    altitude_val = float(record[altitude_idx])
                except (ValueError, TypeError):
                    pass

            # Round coordinates
            lat_rounded = round_coord(lat_val, 4)
            lon_rounded = round_coord(lon_val, 4)

            output_records.append([
                lat_rounded,
                lon_rounded,
                date_str,
                energy_val,
                velocity_val,
                altitude_val
            ])
            success += 1

        except (ValueError, IndexError, TypeError) as e:
            skipped += 1
            continue

    print(f"✓ Filtered to continental US: {len(output_records)} records")
    print(f"  Skipped: {skipped} (missing fields or out of bounds)")

    return output_records

def save_fireball_json(records, output_path):
    """Save records as compact JSON overlay file."""
    output_data = {
        "fields": ["lat", "lon", "date", "energy_kt", "velocity_kms", "altitude_km"],
        "data": records
    }

    with open(output_path, 'w') as f:
        json.dump(output_data, f, separators=(',', ':'))

    print(f"\n✓ Saved {len(records)} fireball records to: {output_path}")
    return output_data

def print_summary_stats(records):
    """Print summary statistics about the dataset."""
    if not records:
        print("\n⚠ No records to summarize")
        return

    # Extract date range
    dates = [r[2] for r in records if r[2] != "Unknown"]
    if dates:
        dates_sorted = sorted(dates)
        print(f"\nDataset Summary:")
        print(f"  Total records: {len(records)}")
        print(f"  Date range: {dates_sorted[0]} to {dates_sorted[-1]}")
        print(f"  Latitude range: {min(r[0] for r in records):.4f}°N to {max(r[0] for r in records):.4f}°N")
        print(f"  Longitude range: {min(r[1] for r in records):.4f}°W to {max(r[1] for r in records):.4f}°W")

        # Energy stats (if available)
        energies = [r[3] for r in records if r[3] is not None]
        if energies:
            print(f"  Energy range: {min(energies):.4f} - {max(energies):.4f} kt")
            print(f"  Avg energy: {sum(energies) / len(energies):.4f} kt")

        # Velocity stats (if available)
        velocities = [r[4] for r in records if r[4] is not None]
        if velocities:
            print(f"  Velocity range: {min(velocities):.2f} - {max(velocities):.2f} km/s")
            print(f"  Avg velocity: {sum(velocities) / len(velocities):.2f} km/s")

def main():
    """Main entry point."""
    print("=" * 60)
    print("NASA Fireball Data Export for Strange Signals")
    print("=" * 60)

    # Fetch data from API
    api_data = fetch_nasa_fireballs()

    # Parse and filter
    records = parse_nasa_fireball_data(api_data)

    # Save to JSON
    output_path = "data/nasa_fireballs.json"
    save_fireball_json(records, output_path)

    # Print stats
    print_summary_stats(records)
    print("\n✓ Complete! Ready to integrate into Strange Signals map.")

if __name__ == "__main__":
    main()
