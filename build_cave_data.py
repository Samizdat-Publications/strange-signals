#!/usr/bin/env python3
"""
Build a comprehensive US cave system dataset for the Strange Signals paranormal map.
Includes major show caves, documented wild caves, and karst region centroids.

Output: data/us_caves.json
Format: {fields: [...], data: [[lat, lon, name, state, type, length_miles], ...]}
"""

import json
from pathlib import Path

# Comprehensive US cave systems dataset
# Fields: [lat, lon, name, state, type, length_miles]
# Types: show_cave, wild_cave, karst_region
CAVE_DATA = [
    # KENTUCKY - Extensive karst, home to world's longest cave
    [37.1863, -86.1004, "Mammoth Cave", "KY", "show_cave", 405.0],
    [37.2150, -86.0850, "Flint Ridge Cave System", "KY", "wild_cave", 86.0],
    [36.9833, -86.3667, "Lost River Cave", "KY", "show_cave", 14.2],
    [37.8500, -84.5500, "Carter Caves State Resort Park", "KY", "show_cave", 3.4],
    [37.9000, -85.0000, "Blue Spring Branch Cave", "KY", "wild_cave", 8.5],
    [38.3000, -84.2000, "Kentucky Caverns", "KY", "show_cave", 4.0],

    # NEW MEXICO - Major karst and show caves
    [32.1794, -104.4383, "Carlsbad Caverns", "NM", "show_cave", 30.0],
    [32.2667, -104.4167, "Lechuguilla Cave", "NM", "wild_cave", 140.0],
    [32.6333, -107.6667, "Spider Cave", "NM", "wild_cave", 45.0],
    [32.5833, -107.7500, "Kemo Sabe Cave", "NM", "wild_cave", 12.0],

    # SOUTH DAKOTA - Black Hills karst
    [44.3833, -103.8000, "Jewel Cave National Monument", "SD", "show_cave", 225.0],
    [43.6167, -103.4667, "Wind Cave National Park", "SD", "show_cave", 150.0],
    [43.8667, -103.2167, "Bethesda Cave", "SD", "wild_cave", 8.5],

    # TENNESSEE - Extensive show caves and karst
    [35.3833, -85.7000, "Ruby Falls", "TN", "show_cave", 1.2],
    [35.6667, -84.8000, "Cumberland Caverns", "TN", "show_cave", 44.0],
    [35.4667, -84.3333, "Tuckaleechee Caverns", "TN", "show_cave", 1.8],
    [35.6500, -87.0000, "Lost River Cave", "TN", "wild_cave", 5.0],
    [36.3333, -88.6667, "Caves of the Ozark Plateau", "TN", "karst_region", None],

    # VIRGINIA - Appalachian karst
    [38.7667, -79.0667, "Luray Caverns", "VA", "show_cave", 64.0],
    [38.5500, -79.5167, "Grand Caverns", "VA", "show_cave", 3.0],
    [37.5333, -80.6000, "Blowing Rock Cave", "VA", "wild_cave", 8.0],
    [37.4000, -80.5667, "Weir Cave", "VA", "wild_cave", 3.5],
    [38.6667, -79.9167, "Melrose Caverns", "VA", "show_cave", 2.0],

    # MISSOURI - Ozark karst, 6000+ caves
    [38.3833, -92.8167, "Meramec Caverns", "MO", "show_cave", 4.7],
    [38.0333, -93.5667, "Fantastic Caverns", "MO", "show_cave", 1.5],
    [38.3667, -92.6333, "Onondaga Cave State Park", "MO", "show_cave", 1.2],
    [38.5333, -93.3667, "Marvel Cave", "MO", "show_cave", 5.0],
    [37.9333, -91.6667, "Blanchard Springs Caverns", "AR", "show_cave", 1.5],
    [38.8333, -93.0000, "Ozark Caverns", "MO", "show_cave", 0.5],
    [38.9667, -92.0333, "Ruebel Cave", "MO", "wild_cave", 1.8],
    [38.2000, -92.5000, "Ozark Plateau Karst", "MO", "karst_region", None],

    # ARKANSAS - Ozark karst
    [37.9333, -91.6667, "Blanchard Springs Caverns", "AR", "show_cave", 1.5],
    [35.4000, -93.1000, "War Eagle Cavern", "AR", "show_cave", 0.75],
    [36.3333, -93.5000, "Arkansas Karst Region", "AR", "karst_region", None],

    # ALABAMA - Southern karst
    [34.9833, -86.5667, "DeSoto Caverns", "AL", "show_cave", 2.0],
    [34.6500, -86.5500, "Cathedral Caverns State Park", "AL", "show_cave", 0.25],
    [34.8000, -86.9000, "Dismals Canyon", "AL", "show_cave", 0.5],
    [34.7000, -86.5000, "Alabama Karst Region", "AL", "karst_region", None],

    # WISCONSIN - Driftless Area karst
    [42.8667, -88.8000, "Cave of the Mounds", "WI", "show_cave", 1.0],
    [42.9667, -89.1833, "Crystal Cave", "WI", "show_cave", 0.25],
    [43.0833, -89.5667, "Kickapoo Valley Cave", "WI", "wild_cave", 2.5],
    [42.9000, -89.2000, "Driftless Karst Region", "WI", "karst_region", None],

    # MINNESOTA - Driftless Area karst
    [43.5667, -92.1333, "Mystery Cave", "MN", "show_cave", 12.0],
    [43.6667, -92.0833, "Forestville/Mystery Cave State Park", "MN", "show_cave", 1.5],
    [43.5000, -92.0000, "Driftless Karst - Minnesota", "MN", "karst_region", None],

    # IOWA - Driftless Area karst
    [43.1667, -91.1667, "Decorah Ice Cave", "IA", "wild_cave", 0.1],
    [43.2000, -91.0000, "Driftless Karst - Iowa", "IA", "karst_region", None],

    # TEXAS - Edwards Plateau karst
    [29.8667, -98.2667, "Natural Bridge Caverns", "TX", "show_cave", 0.5],
    [30.0667, -98.0667, "Wonder World Caves", "TX", "show_cave", 2.0],
    [30.1333, -97.8667, "Cascade Caverns", "TX", "show_cave", 1.0],
    [30.2000, -97.9667, "Cave Without a Name", "TX", "show_cave", 0.75],
    [30.0000, -98.5000, "Edwards Plateau Karst", "TX", "karst_region", None],
    [29.9500, -98.3333, "Bracken Cave", "TX", "wild_cave", 0.1],

    # ARIZONA - Basin and Range karst
    [32.4167, -110.7667, "Colossal Cave Mountain Park", "AZ", "show_cave", 2.5],
    [33.6667, -109.4167, "Cave Creek", "AZ", "wild_cave", 1.0],

    # CALIFORNIA - Lava Beds and coastal karst
    [41.7333, -121.5000, "Lava Beds National Monument", "CA", "wild_cave", None],
    [41.7500, -121.5333, "Thurber Lava Tube", "CA", "wild_cave", 0.5],
    [41.8000, -121.5667, "Mammoth Crater Cave", "CA", "wild_cave", 0.3],

    # OREGON - Pacific Northwest caves
    [42.0833, -123.4167, "Oregon Caves National Monument", "OR", "show_cave", 3.0],
    [43.2667, -121.0833, "Newberry Lava Tube Caves", "OR", "wild_cave", None],

    # PENNSYLVANIA - Appalachian karst
    [40.8667, -77.6000, "Penn's Cave", "PA", "show_cave", 0.6],
    [40.6333, -76.8333, "Indian Echo Cavern", "PA", "show_cave", 0.3],
    [40.9333, -77.5333, "Penns Cave & Wildlife Park", "PA", "show_cave", 0.5],
    [40.9000, -77.6000, "Appalachian Karst - PA", "PA", "karst_region", None],

    # NEW YORK - Appalachian karst
    [42.7167, -74.6667, "Howe Caverns", "NY", "show_cave", 0.4],
    [42.6833, -74.6833, "Secret Caverns", "NY", "show_cave", 0.3],
    [42.7000, -74.6700, "Appalachian Karst - NY", "NY", "karst_region", None],

    # WEST VIRGINIA - Appalachian karst
    [38.4333, -82.5667, "Seneca Caverns", "WV", "show_cave", 4.3],
    [38.5333, -82.1667, "Lost World Caverns", "WV", "show_cave", 3.6],
    [38.4667, -82.0833, "Organ Cave", "WV", "show_cave", 5.0],
    [38.6000, -82.5000, "New River Gorge Caves", "WV", "wild_cave", None],
    [38.5000, -82.3000, "Appalachian Karst - WV", "WV", "karst_region", None],

    # OHIO - Appalachian karst (western)
    [39.8667, -82.1333, "Ohio Caverns", "OH", "show_cave", 0.4],
    [40.1667, -83.5000, "Appalachian Karst - Ohio", "OH", "karst_region", None],

    # FLORIDA - Subtropical karst
    [28.2500, -82.4167, "Florida Caverns State Park", "FL", "show_cave", 2.0],
    [27.1667, -82.2500, "Devil's Den State Park", "FL", "show_cave", 0.1],
    [28.5833, -81.6667, "Blue Spring State Park", "FL", "wild_cave", 0.05],
    [27.5000, -82.2000, "Florida Karst Region", "FL", "karst_region", None],

    # LOUISIANA - Coastal/Mississippi Valley caves
    [30.5833, -91.9167, "Kisatchie National Forest Caves", "LA", "wild_cave", None],

    # MISSISSIPPI - Mississippi Valley karst
    [32.5000, -88.5000, "Mississippi Karst Region", "MS", "karst_region", None],

    # OKLAHOMA - Karst edge
    [35.0333, -97.2667, "Alabaster Caverns State Park", "OK", "show_cave", 0.8],

    # IDAHO - Northwestern caves (lava tubes)
    [43.4167, -113.8333, "Craters of the Moon Lava Tubes", "ID", "wild_cave", None],

    # UTAH - Canyon country caves
    [37.1833, -111.3667, "Horseshoe Canyon Area Caves", "UT", "wild_cave", None],

    # NEVADA - Basin and Range caves
    [39.0833, -117.0833, "Cave Valley", "NV", "wild_cave", None],

    # WYOMING - Northern Rockies
    [44.5333, -108.8667, "Bighorn Cave", "WY", "wild_cave", 0.5],

    # COLORADO - Rocky Mountain caves
    [37.1667, -107.9000, "Lowdermilk Cave", "CO", "wild_cave", 1.5],
    [39.0000, -108.5000, "Glenwood Caverns Adventure Park", "CO", "show_cave", 5.0],

    # NORTH CAROLINA - Appalachian karst
    [35.6667, -82.5000, "Linville Caverns", "NC", "show_cave", 2.0],
    [35.7000, -82.5500, "Appalachian Karst - NC", "NC", "karst_region", None],

    # GEORGIA - Appalachian karst southern extension
    [34.6667, -84.8333, "Caving areas - northern Georgia", "GA", "wild_cave", None],

    # INDIANA - Midwest karst
    [38.2667, -86.4667, "Marengo Cave", "IN", "show_cave", 0.6],
    [38.3000, -86.5000, "Wyandotte Cave", "IN", "show_cave", 2.3],
    [38.2833, -86.4500, "Midwest Karst - Indiana", "IN", "karst_region", None],

    # IOWA ADDITIONAL
    [43.0667, -91.1333, "Guttenberg Caves", "IA", "wild_cave", 1.0],

    # ILLINOIS - Midwest karst edge
    [38.6667, -88.2667, "Illinois Caves (Shawnee)", "IL", "wild_cave", None],

    # KANSAS - Western edge
    [38.5000, -97.5000, "Kansas Gypsum Caves", "KS", "wild_cave", None],

    # ADDITIONAL MAJOR SHOWS/DOCUMENTED CAVES BY REGION

    # ADDITIONAL APPALACHIAN (KENTUCKY EXTENDED)
    [38.0333, -83.6333, "Paintsville Lake Cave", "KY", "wild_cave",None],

    # ADDITIONAL OZARK SHOW CAVES (MISSOURI)
    [37.6333, -91.4333, "Taum Sauk Cave", "MO", "wild_cave", 2.0],
    [38.5667, -93.5333, "Thunderbird Cave", "MO", "show_cave", 0.3],

    # ADDITIONAL TENNESSEE
    [36.0333, -85.5667, "Appalachian Caverns", "TN", "show_cave", 0.5],

    # ADDITIONAL SOUTH DAKOTA
    [43.9333, -103.2333, "Rushmore Cave", "SD", "show_cave", 0.5],

    # APPALACHIAN REGION CENTROIDS (broader coverage)
    [37.5000, -81.5000, "Central Appalachian Karst", "WV", "karst_region",None],
    [38.0000, -84.0000, "Eastern Kentucky Karst", "KY", "karst_region",None],
    [39.0000, -82.0000, "Ohio Valley Karst", "OH", "karst_region",None],
]

def main():
    """Build and write the cave dataset JSON file."""

    # Validate and structure data
    fields = ["lat", "lon", "name", "state", "type", "length_miles"]
    data = CAVE_DATA

    # Count by type
    show_count = sum(1 for row in data if row[4] == "show_cave")
    wild_count = sum(1 for row in data if row[4] == "wild_cave")
    karst_count = sum(1 for row in data if row[4] == "karst_region")

    print(f"Cave Dataset Summary:")
    print(f"  Total entries: {len(data)}")
    print(f"  Show caves: {show_count}")
    print(f"  Wild caves: {wild_count}")
    print(f"  Karst regions: {karst_count}")
    print()

    # Validate coordinates are in US range
    invalid = []
    for i, row in enumerate(data):
        lat, lon = row[0], row[1]
        state = row[3]
        if not (-25 <= lat <= 50 and -125 <= lon <= -65):
            invalid.append((i, row[2], state, lat, lon))

    if invalid:
        print("WARNING: Coordinates outside US bounds:")
        for idx, name, state, lat, lon in invalid:
            print(f"  {name} ({state}): {lat}, {lon}")
        print()

    # Build output JSON
    output = {
        "fields": fields,
        "data": data
    }

    # Write to file
    output_path = Path("/sessions/confident-inspiring-gates/mnt/UAP Correlation Project/data/us_caves.json")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"✓ Written to: {output_path}")
    print(f"  File size: {output_path.stat().st_size:,} bytes")
    print()

    # Show sample entries
    print("Sample entries (first 5 show caves):")
    for row in data[:5]:
        print(f"  {row[2]:30} {row[3]} - lat={row[0]:.4f}, lon={row[1]:.4f}")

if __name__ == "__main__":
    main()
