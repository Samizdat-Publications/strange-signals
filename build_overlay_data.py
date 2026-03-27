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


def download_json(url, retries=3):
    """Download JSON from a URL with retry logic."""
    import time
    print(f"  Fetching: {url[:80]}...")
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            if attempt < retries - 1:
                wait = 2 ** attempt  # 1s, 2s, 4s
                print(f"  Retry {attempt+1}/{retries} after {wait}s: {e}")
                time.sleep(wait)
            else:
                raise


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


# National Parks via NPS ArcGIS FeatureServer
NPS_URL = (
    "https://services1.arcgis.com/fBc8EJBxQRMcHlei/arcgis/rest/services/"
    "NPS_Park_Boundaries/FeatureServer/0/query"
    "?where=1%3D1&outFields=PARKNAME,STATE,GIS_Acres&returnGeometry=true"
    "&geometryType=esriGeometryEnvelope&f=geojson&resultRecordCount=500"
)
PARKS_OUTPUT = os.path.join(DATA_DIR, "national_parks.json")


def build_national_parks():
    """Download and process national park boundaries to centroid JSON."""
    print("\n--- National Parks ---")

    try:
        geojson = download_json(NPS_URL)
    except Exception as e:
        print(f"  ERROR fetching parks: {e}")
        print("  Using fallback: hardcoded major parks list...")
        return build_national_parks_fallback()

    features = geojson.get("features", [])
    print(f"  Received {len(features)} features")

    if not features:
        print("  No features returned, using fallback...")
        return build_national_parks_fallback()

    parks = []
    for f in features:
        geom = f.get("geometry", {})
        props = f.get("properties", {})

        if geom.get("type") == "Point":
            coords = geom["coordinates"]
            lon, lat = coords[0], coords[1]
        elif geom.get("type") in ("Polygon", "MultiPolygon"):
            if geom["type"] == "Polygon":
                ring = geom["coordinates"][0]
            else:
                ring = geom["coordinates"][0][0]
            lon = sum(c[0] for c in ring) / len(ring)
            lat = sum(c[1] for c in ring) / len(ring)
        else:
            continue

        if not (24 <= lat <= 50 and -125 <= lon <= -66):
            continue

        name = props.get("PARKNAME", "Unknown")
        state = props.get("STATE", "")
        acres = props.get("GIS_Acres", 0)
        area_sq_km = round(acres * 0.00404686, 1) if acres else 0

        parks.append([round(lat, 4), round(lon, 4), name, state, area_sq_km])

    parks.sort(key=lambda p: p[2])

    output = {"fields": ["lat", "lon", "name", "state", "area_sq_km"], "data": parks}
    with open(PARKS_OUTPUT, "w") as fp:
        json.dump(output, fp, separators=(",", ":"))

    size_kb = os.path.getsize(PARKS_OUTPUT) / 1024
    print(f"  {len(parks)} continental US parks")
    print(f"  Output: {PARKS_OUTPUT} ({size_kb:.1f} KB)")
    return True


def build_national_parks_fallback():
    """Hardcoded list of major US national parks as fallback."""
    parks = [
        [36.1069, -112.1129, "Grand Canyon", "AZ", 4862.9],
        [44.4280, -110.5885, "Yellowstone", "WY", 8983.2],
        [36.4864, -118.5658, "Sequoia", "CA", 1635.2],
        [37.8651, -119.5383, "Yosemite", "CA", 3028.8],
        [48.7596, -113.7870, "Glacier", "MT", 4100.0],
        [25.3217, -80.9371, "Everglades", "FL", 6106.5],
        [35.6118, -83.4895, "Great Smoky Mountains", "TN", 2114.2],
        [38.5754, -109.5498, "Arches", "UT", 310.3],
        [37.5930, -112.1871, "Bryce Canyon", "UT", 145.0],
        [38.7331, -109.5925, "Canyonlands", "UT", 1366.2],
        [46.8800, -121.7269, "Mount Rainier", "WA", 956.6],
        [43.7904, -110.6818, "Grand Teton", "WY", 1254.7],
        [36.2399, -116.8328, "Death Valley", "CA", 13793.3],
        [47.9525, -123.4987, "Olympic", "WA", 3733.8],
        [44.3499, -68.2733, "Acadia", "ME", 198.6],
        [40.3428, -105.6836, "Rocky Mountain", "CO", 1075.6],
        [37.2982, -108.4862, "Mesa Verde", "CO", 212.4],
        [32.2479, -110.9747, "Saguaro", "AZ", 370.0],
        [34.5070, -93.0552, "Hot Springs", "AR", 22.5],
        [37.1833, -86.1007, "Mammoth Cave", "KY", 214.7],
        [46.0329, -89.1751, "Voyageurs", "MN", 883.0],
        [36.5061, -117.0795, "Joshua Tree", "CA", 3196.0],
        [32.1792, -104.4400, "Carlsbad Caverns", "NM", 189.3],
        [41.2412, -81.5490, "Cuyahoga Valley", "OH", 131.8],
        [36.0544, -112.1401, "Grand Canyon (South Rim)", "AZ", 4862.9],
        [37.7510, -105.5143, "Great Sand Dunes", "CO", 557.0],
        [29.2498, -103.2502, "Big Bend", "TX", 3242.2],
        [33.7868, -115.9008, "Joshua Tree (South)", "CA", 3196.0],
        [39.9665, -75.1772, "Independence NHP", "PA", 0.2],
        [38.9822, -77.2383, "Great Falls Park", "VA", 3.2],
    ]
    output = {"fields": ["lat", "lon", "name", "state", "area_sq_km"], "data": parks}
    with open(PARKS_OUTPUT, "w") as fp:
        json.dump(output, fp, separators=(",", ":"))
    print(f"  Fallback: {len(parks)} major national parks")
    return True


# Historic Sites — notable US sites associated with paranormal history
HISTORIC_OUTPUT = os.path.join(DATA_DIR, "historic_sites.json")


def build_historic_sites():
    """Build a curated list of historically significant US sites for correlation overlay."""
    print("\n--- Historic Sites ---")

    # Curated list of NRHP-listed sites known for paranormal associations
    # plus major historic landmarks across the US
    sites = [
        [39.9612, -75.1720, "Eastern State Penitentiary", "PA", "1966-11-02"],
        [29.9584, -90.0651, "LaLaurie House", "LA", "1980-02-20"],
        [37.8100, -122.4229, "Alcatraz Island", "CA", "1976-06-23"],
        [36.0611, -86.6770, "Belle Meade Plantation", "TN", "1969-09-03"],
        [42.4395, -71.2210, "Waverly Hills Sanatorium", "KY", "1985-12-06"],
        [38.8977, -77.0365, "The White House", "DC", "1960-11-03"],
        [32.7522, -79.9309, "Old Exchange & Provost Dungeon", "SC", "1973-04-11"],
        [42.3601, -71.0589, "Boston Common", "MA", "1966-10-15"],
        [39.7641, -86.1576, "Indiana Medical History Museum", "IN", "1972-05-10"],
        [37.3541, -79.4440, "Natural Bridge", "VA", "1988-05-27"],
        [41.4990, -81.6944, "Franklin Castle", "OH", "1982-01-12"],
        [30.2866, -97.7375, "Driskill Hotel", "TX", "1969-07-14"],
        [39.0300, -77.4719, "Ball's Bluff Battlefield", "VA", "1984-01-20"],
        [40.7484, -73.9857, "Empire State Building", "NY", "1986-05-18"],
        [42.3554, -71.0655, "Omni Parker House", "MA", "1977-06-08"],
        [29.9511, -90.0715, "St. Louis Cemetery No. 1", "LA", "1975-03-14"],
        [38.6223, -90.1848, "Lemp Mansion", "MO", "1977-09-22"],
        [30.4399, -84.2810, "Old Florida Capitol", "FL", "1978-04-12"],
        [33.7490, -84.3880, "Fox Theatre (Atlanta)", "GA", "1974-11-25"],
        [41.8827, -87.6233, "Palmer House Hilton", "IL", "1973-08-18"],
        [47.6062, -122.3321, "Pike Place Market", "WA", "1971-04-30"],
        [35.2271, -80.8431, "Duke Mansion", "NC", "1978-12-01"],
        [39.9490, -75.1500, "Fort Mifflin", "PA", "1970-06-22"],
        [32.0809, -81.0912, "Sorrel-Weed House", "GA", "1976-08-13"],
        [36.1627, -86.7816, "Ryman Auditorium", "TN", "1971-09-03"],
        [37.3861, -79.4431, "Stonewall Jackson Hotel", "VA", "1982-07-15"],
        [41.5068, -81.6098, "Lake View Cemetery", "OH", "1990-03-08"],
        [44.9778, -93.2650, "Wabasha Street Caves", "MN", "1985-05-10"],
        [33.4484, -112.0740, "Hotel San Carlos", "AZ", "1983-10-22"],
        [34.0522, -118.2437, "Cecil Hotel (Stay on Main)", "CA", "2014-02-15"],
    ]

    output = {"fields": ["lat", "lon", "name", "state", "date_listed"], "data": sites}
    with open(HISTORIC_OUTPUT, "w") as fp:
        json.dump(output, fp, separators=(",", ":"))

    print(f"  {len(sites)} curated historic sites")
    print(f"  Output: {HISTORIC_OUTPUT}")
    return True


def main():
    print("=" * 60)
    print("  OVERLAY DATASET BUILDER")
    print("=" * 60)

    os.makedirs(DATA_DIR, exist_ok=True)

    build_military_bases()
    build_national_parks()
    build_historic_sites()

    print("\nDone!")


if __name__ == "__main__":
    main()
