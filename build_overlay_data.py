#!/usr/bin/env python3
"""
Download and process overlay datasets for the STRANGE SIGNALS map.

Currently supports:
  - US Military Bases (USDOT/DoD via ArcGIS FeatureServer)

Usage:
    python build_overlay_data.py

Output:
    data/military_bases.json
"""

import json
import os
import urllib.request

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "data")

# Military Bases via ArcGIS REST API (GeoJSON query)
MILITARY_URL = (
    "https://geo.dot.gov/server/rest/services/Hosted/Military_Bases_DS/FeatureServer/0"
    "/query?where=1%3D1&outFields=SITE_NAME,OPER_STAT,JOINT_BASE,BRANCH"
    "&returnGeometry=true&f=geojson&resultRecordCount=2000"
)
MILITARY_OUTPUT = os.path.join(DATA_DIR, "military_bases.json")


def download_json(url):
    """Download JSON from a URL."""
    print(f"  Fetching: {url[:80]}...")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def build_military_bases():
    """Download and process military bases to compact JSON."""
    print("\n--- Military Bases ---")

    try:
        geojson = download_json(MILITARY_URL)
    except Exception as e:
        print(f"  ERROR fetching military bases: {e}")
        print("  Trying fallback approach...")
        # Fallback: try the older MapServer endpoint
        fallback_url = (
            "https://maps.bts.dot.gov/services/rest/services/appServices"
            "/MilitaryBases/MapServer/0/query?where=1%3D1"
            "&outFields=SITE_NAME,OPER_STAT,JOINT_BASE,BRANCH"
            "&returnGeometry=true&f=geojson&resultRecordCount=2000"
        )
        try:
            geojson = download_json(fallback_url)
        except Exception as e2:
            print(f"  ERROR with fallback: {e2}")
            return False

    features = geojson.get("features", [])
    print(f"  Received {len(features)} features")

    # Extract just the point data we need
    bases = []
    for f in features:
        geom = f.get("geometry", {})
        props = f.get("properties", {})

        # Handle both Point and Polygon geometries
        if geom.get("type") == "Point":
            coords = geom["coordinates"]
            lon, lat = coords[0], coords[1]
        elif geom.get("type") in ("Polygon", "MultiPolygon"):
            # Use centroid approximation
            if geom["type"] == "Polygon":
                ring = geom["coordinates"][0]
            else:
                ring = geom["coordinates"][0][0]
            lon = sum(c[0] for c in ring) / len(ring)
            lat = sum(c[1] for c in ring) / len(ring)
        else:
            continue

        # Filter to continental US
        if not (24 <= lat <= 50 and -125 <= lon <= -66):
            continue

        name = props.get("SITE_NAME", "Unknown")
        branch = props.get("BRANCH", "")
        status = props.get("OPER_STAT", "")

        bases.append([
            round(lat, 4),
            round(lon, 4),
            name,
            branch,
            status,
        ])

    # Sort by name
    bases.sort(key=lambda b: b[2])

    output = {
        "fields": ["lat", "lon", "name", "branch", "status"],
        "data": bases,
    }

    with open(MILITARY_OUTPUT, "w") as f:
        json.dump(output, f, separators=(",", ":"))

    size_kb = os.path.getsize(MILITARY_OUTPUT) / 1024
    print(f"  {len(bases)} continental US bases")
    print(f"  Output: {MILITARY_OUTPUT} ({size_kb:.1f} KB)")
    return True


def main():
    print("=" * 60)
    print("  OVERLAY DATASET BUILDER")
    print("=" * 60)

    os.makedirs(DATA_DIR, exist_ok=True)

    build_military_bases()

    print("\nDone!")


if __name__ == "__main__":
    main()
