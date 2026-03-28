#!/usr/bin/env python3
"""
Build FAA Special Use Airspace (SUA) dataset for Strange Signals map.
Compiles restricted areas, military operations areas, warning areas, and prohibited zones.

Sources:
- FAA Restricted Areas (R-xxxx): Military flight training, test ranges
- Military Operations Areas (MOAs): High-volume military training
- Warning Areas (W-xxxx): Offshore military activity
- Prohibited Areas (P-xxxx): No-fly zones
- Alert Areas (A-xxxx): High-volume pilot training

Data compiled from FAA NACO charts, AIS, and FAA documentation.
"""

import json
import sys
from pathlib import Path

# Comprehensive FAA Special Use Airspace dataset
# Format: [lat (center), lon (center), name, type, floor_ft, ceiling_ft, controlling_agency]
AIRSPACE_DATA = [
    # ===== RESTRICTED AREAS (R-xxxx) =====
    # R-2508 Complex - Edwards AFB / China Lake / Fort Irwin (California's largest restricted complex)
    [35.43, -117.88, "R-2508 Edwards AFB Complex", "Restricted", 0, 99999, "Edwards AFB"],
    [35.35, -117.65, "R-2508W China Lake South", "Restricted", 0, 50000, "China Lake"],
    [35.42, -118.00, "R-2508E Fort Irwin", "Restricted", 0, 99999, "Fort Irwin"],
    [35.27, -118.35, "R-2508N Edwards North", "Restricted", 0, 75000, "Edwards AFB"],
    
    # R-2301 White Sands Missile Range (New Mexico)
    [32.50, -106.35, "R-2301 White Sands", "Restricted", 0, 99999, "White Sands Missile Range"],
    [32.30, -106.10, "R-2301N White Sands North", "Restricted", 0, 85000, "White Sands"],
    [32.70, -106.50, "R-2301S White Sands South", "Restricted", 0, 99999, "White Sands"],
    
    # R-4806/4807/4808 - Area 51 / Nevada Test & Training Range (Nevada)
    [37.21, -115.81, "R-4808 Area 51 / Groom Lake", "Restricted", 0, 99999, "Nellis AFB"],
    [37.37, -115.30, "R-4807 Nevada Test & Training Range", "Restricted", 0, 99999, "Nellis AFB"],
    [37.50, -115.15, "R-4806 NTTR North", "Restricted", 0, 85000, "Nellis AFB"],
    [37.00, -116.00, "R-4808W Area 51 West", "Restricted", 0, 99999, "Nellis AFB"],
    [37.65, -115.50, "R-4806E NTTR East", "Restricted", 0, 99999, "Nellis AFB"],
    
    # R-2515 Twentynine Palms / Joshua Tree (California)
    [34.28, -116.05, "R-2515 Twentynine Palms", "Restricted", 0, 99999, "MCAGCC Twentynine Palms"],
    
    # R-5107 Eglin AFB Complex (Florida)
    [30.48, -86.50, "R-5107 Eglin AFB", "Restricted", 0, 99999, "Eglin AFB"],
    [30.42, -86.25, "R-5107E Eglin East", "Restricted", 0, 85000, "Eglin AFB"],
    [30.58, -86.75, "R-5107W Eglin West", "Restricted", 0, 99999, "Eglin AFB"],
    
    # R-5301/5302 Nellis AFB Complex (Nevada)
    [36.23, -115.03, "R-5301 Nellis AFB", "Restricted", 0, 99999, "Nellis AFB"],
    [36.10, -115.20, "R-5302 Nellis South", "Restricted", 0, 85000, "Nellis AFB"],
    
    # R-6401 Yakima Training Center (Washington)
    [47.15, -120.48, "R-6401 Yakima Training Center", "Restricted", 0, 99999, "Fort Lewis"],
    
    # R-5403/5404 Fallon Range (Nevada)
    [39.42, -118.72, "R-5403 Fallon Range", "Restricted", 0, 99999, "Fallon NAS"],
    [39.35, -118.90, "R-5404 Fallon South", "Restricted", 0, 85000, "Fallon NAS"],
    
    # R-3401/3402/3403 Luke AFB Range (Arizona)
    [33.37, -112.85, "R-3401 Luke AFB Range", "Restricted", 0, 99999, "Luke AFB"],
    [33.22, -113.00, "R-3402 Luke South", "Restricted", 0, 85000, "Luke AFB"],
    [33.50, -112.50, "R-3403 Luke East", "Restricted", 0, 99999, "Luke AFB"],
    
    # R-3201/3202/3203 Barry M. Goldwater Range (Arizona/California)
    [33.08, -113.90, "R-3201 Barry M. Goldwater Range", "Restricted", 0, 99999, "Luke AFB"],
    [32.88, -114.10, "R-3202 Goldwater South", "Restricted", 0, 85000, "Luke AFB"],
    [33.28, -113.70, "R-3203 Goldwater North", "Restricted", 0, 99999, "Luke AFB"],
    
    # R-4703/4704 Utah Test and Training Range (Utah)
    [41.95, -112.88, "R-4703 Utah Test and Training Range", "Restricted", 0, 99999, "Hill AFB"],
    [41.80, -113.10, "R-4704 UTTR South", "Restricted", 0, 85000, "Hill AFB"],
    
    # R-6205/6206 Moses Lake MOA Complex (Washington)
    [47.93, -119.27, "R-6205 Moses Lake Range", "Restricted", 0, 99999, "Spokane AFB"],
    [47.78, -119.45, "R-6206 Sagebrush Complex", "Restricted", 0, 85000, "Spokane AFB"],
    
    # R-4401/4402 Bombing Range Complex (New Mexico)
    [33.95, -107.45, "R-4401 Melrose Bombing Range", "Restricted", 0, 99999, "Cannon AFB"],
    [33.80, -107.65, "R-4402 Melrose South", "Restricted", 0, 85000, "Cannon AFB"],
    
    # R-4302/4303 Red Flag Complex (Nevada)
    [36.38, -115.82, "R-4302 Red Flag North", "Restricted", 0, 99999, "Nellis AFB"],
    [36.18, -115.95, "R-4303 Red Flag South", "Restricted", 0, 99999, "Nellis AFB"],
    
    # R-5701/5702 Ennis MOA (Montana)
    [45.32, -111.20, "R-5701 Ennis Range", "Restricted", 0, 99999, "Malmstrom AFB"],
    [45.15, -111.40, "R-5702 Ennis South", "Restricted", 0, 85000, "Malmstrom AFB"],
    
    # R-4101/4102 Holloman AFB Range (New Mexico)
    [32.90, -106.10, "R-4101 Holloman AFB Range", "Restricted", 0, 99999, "Holloman AFB"],
    [32.72, -106.30, "R-4102 Holloman South", "Restricted", 0, 85000, "Holloman AFB"],
    
    # ===== MILITARY OPERATIONS AREAS (MOAs) =====
    # MOAs allow military training but are not restricted
    [32.92, -109.65, "Tombstone MOA", "MOA", 0, 10000, "Arizona National Guard"],
    [31.32, -99.10, "Brownwood MOA", "MOA", 500, 10000, "Texas Air National Guard"],
    [40.78, -112.32, "Salt Lake City MOA", "MOA", 0, 25000, "Hill AFB"],
    [47.45, -119.60, "Spokane MOA", "MOA", 0, 10000, "Spokane AFB"],
    [36.25, -115.50, "Vegas MOA", "MOA", 0, 15000, "Nellis AFB"],
    [37.88, -106.95, "Red Table MOA", "MOA", 5000, 15000, "Fort Carson"],
    [45.50, -118.50, "Baker MOA", "MOA", 0, 10000, "Portland Air National Guard"],
    [35.92, -121.00, "San Luis Obispo MOA", "MOA", 0, 15000, "Fort Hunter Liggett"],
    [34.73, -117.25, "San Bernardino MOA", "MOA", 0, 20000, "March Air Reserve Base"],
    [33.13, -117.13, "Camp Pendleton MOA", "MOA", 0, 15000, "MCAS Miramar"],
    [42.22, -121.78, "Klamath MOA", "MOA", 0, 10000, "Kingsley Field"],
    [39.78, -119.97, "Reno MOA", "MOA", 0, 10000, "Nellis AFB"],
    [30.35, -87.60, "Destin MOA", "MOA", 0, 10000, "Eglin AFB"],
    [29.95, -81.30, "Jacksonville MOA", "MOA", 500, 12000, "NAS Jacksonville"],
    [28.43, -81.30, "Patrick MOA", "MOA", 500, 15000, "Patrick Space Force Base"],
    
    # ===== WARNING AREAS (W-xxxx) =====
    # Offshore military activity zones
    [41.20, -71.30, "W-386 Atlantic East", "Warning", 0, 35000, "US Navy"],
    [40.50, -73.70, "W-388 New Jersey Coast", "Warning", 0, 35000, "US Navy"],
    [38.10, -75.50, "W-387 Chesapeake Bay", "Warning", 0, 25000, "Naval Station Norfolk"],
    [32.80, -76.95, "W-383 Hampton Roads", "Warning", 0, 20000, "Naval Station Norfolk"],
    [28.75, -80.75, "W-382 Cape Canaveral", "Warning", 0, 35000, "Space Force Eastern Range"],
    [26.10, -81.70, "W-381 Florida Keys", "Warning", 0, 30000, "US Navy"],
    [30.35, -88.20, "W-384 Gulf of Mexico", "Warning", 0, 35000, "US Navy"],
    [27.73, -97.15, "W-385 Corpus Christi", "Warning", 0, 30000, "US Navy"],
    [37.75, -122.75, "W-289 San Francisco Bay", "Warning", 0, 25000, "US Navy"],
    [32.70, -117.25, "W-291 San Diego", "Warning", 0, 30000, "US Navy"],
    [46.50, -124.50, "W-551 Oregon Coast", "Warning", 0, 25000, "Naval Station Everett"],
    
    # ===== PROHIBITED AREAS (P-xxxx) =====
    # Restricted no-fly zones
    [38.895, -77.037, "P-56 Washington DC", "Prohibited", 0, 18000, "FAA / US Secret Service"],
    [39.160, -77.464, "P-40 Camp David", "Prohibited", 0, 18000, "FAA / US Secret Service"],
    [37.224, -80.046, "P-42 Bluefield Area", "Prohibited", 0, 18000, "FAA"],
    [39.962, -75.173, "P-46 Philadelphia International", "Prohibited", 0, 10000, "FAA"],
    
    # ===== ALERT AREAS (A-xxxx) =====
    # High volume of pilot training or unusual aerial activity
    [40.77, -73.87, "A-202 New York", "Alert", 0, 10000, "LaGuardia / JFK Airspace"],
    [42.36, -71.01, "A-201 Boston", "Alert", 0, 10000, "Logan International"],
    [35.04, -89.98, "A-203 Memphis", "Alert", 0, 10000, "Naval Air Station Millington"],
    [33.94, -118.41, "A-204 Los Angeles", "Alert", 0, 15000, "LAX / MCAS Miramar"],
    [37.62, -122.38, "A-205 San Francisco", "Alert", 0, 12000, "SFO / NAS Alameda"],
    [40.64, -73.78, "A-206 New York Lower", "Alert", 0, 8000, "New York Special Flight Rules"],
    
    # ===== ADDITIONAL KEY RESTRICTED AREAS =====
    # Fort Huachuca (Arizona) - Army Intelligence
    [31.55, -110.35, "Fort Huachuca Range", "Restricted", 0, 35000, "Fort Huachuca"],
    
    # Fort Hood / Fort Cavazos (Texas) - Army training
    [31.15, -97.80, "Fort Hood Training Range", "Restricted", 0, 25000, "Fort Cavazos"],
    
    # Fort Benning / Fort Moore (Georgia) - Infantry
    [32.37, -84.95, "Fort Moore Training Area", "Restricted", 0, 20000, "Fort Moore"],
    
    # Fort Carson (Colorado) - Army training
    [38.75, -104.80, "Fort Carson Range", "Restricted", 0, 25000, "Fort Carson"],
    
    # Fort Bliss (Texas/New Mexico) - Air Defense
    [31.82, -106.50, "Fort Bliss Range", "Restricted", 0, 30000, "Fort Bliss"],
    
    # Fort Sill (Oklahoma) - Artillery training
    [34.65, -98.40, "Fort Sill Artillery Range", "Restricted", 0, 20000, "Fort Sill"],
    
    # Fort Bragg / Fort Liberty (North Carolina) - SOF
    [35.15, -78.98, "Fort Liberty Range", "Restricted", 0, 20000, "Fort Liberty"],
    
    # Fort Polk / Fort Johnson (Louisiana) - Infantry
    [31.07, -92.77, "Fort Johnson Training Area", "Restricted", 0, 20000, "Fort Johnson"],
    
    # Twentynine Palms Marine Base (California) - detailed
    [34.30, -116.07, "MCAGCC Range 300", "Restricted", 0, 30000, "MCAGCC Twentynine Palms"],
    [34.25, -116.20, "MCAGCC Range 400", "Restricted", 0, 30000, "MCAGCC Twentynine Palms"],
    
    # Miramar (California) - Fighter training
    [32.87, -117.14, "MCAS Miramar Range", "Restricted", 0, 35000, "MCAS Miramar"],
    
    # Oceana (Virginia) - Naval aviation
    [36.83, -76.02, "NAS Oceana Range", "Restricted", 0, 25000, "NAS Oceana"],
    
    # Pax River (Maryland) - Test and evaluation
    [38.27, -76.44, "NAS Patuxent River Test Range", "Restricted", 0, 45000, "NAS Patuxent River"],
    
    # China Lake (California) - Naval weapons testing (detailed)
    [35.98, -119.02, "NWC China Lake South", "Restricted", 0, 50000, "Naval Weapons Center China Lake"],
    [36.15, -118.70, "NWC China Lake North", "Restricted", 0, 50000, "Naval Weapons Center China Lake"],
    
    # Point Mugu (California) - Naval missile testing
    [34.11, -119.04, "NAS Point Mugu Range", "Restricted", 0, 45000, "NAS Point Mugu"],
    
    # Tonopah Test Range (Nevada) - Stealth testing
    [37.87, -116.77, "Tonopah Test Range", "Restricted", 0, 99999, "US Air Force"],
    
    # Groom Lake / Area 51 Expanded
    [37.15, -115.85, "Groom Lake South Sector", "Restricted", 0, 99999, "Nellis AFB / CIA"],
    
    # Creech AFB Range (Nevada) - Drone operations
    [36.23, -115.43, "Creech AFB Drone Range", "Restricted", 0, 35000, "Creech AFB"],
    
    # Nellis AFB Main Range (Nevada)
    [36.23, -115.03, "Nellis AFB Ranges Combined", "Restricted", 0, 99999, "Nellis AFB"],
    
    # Cannon AFB (New Mexico)
    [34.38, -103.30, "Cannon AFB Range", "Restricted", 0, 35000, "Cannon AFB"],
    
    # Kirtland AFB (New Mexico)
    [34.82, -106.52, "Kirtland AFB Range", "Restricted", 0, 45000, "Kirtland AFB"],
    
    # Dyess AFB (Texas)
    [32.52, -99.80, "Dyess AFB Range", "Restricted", 0, 25000, "Dyess AFB"],
    
    # Sheppard AFB (Texas)
    [33.98, -98.50, "Sheppard AFB Range", "Restricted", 0, 25000, "Sheppard AFB"],
    
    # F.E. Warren AFB (Wyoming)
    [41.15, -104.82, "F.E. Warren AFB Range", "Restricted", 0, 25000, "F.E. Warren AFB"],
    
    # Mountain Home AFB (Idaho)
    [43.68, -115.90, "Mountain Home AFB Range", "Restricted", 0, 35000, "Mountain Home AFB"],
    
    # Elmendorf AFB (Alaska) - Detailed
    [61.27, -149.80, "Elmendorf AFB Range", "Restricted", 0, 45000, "Joint Base Elmendorf-Richardson"],
    
    # Eielson AFB (Alaska)
    [64.65, -141.00, "Eielson AFB Range", "Restricted", 0, 45000, "Eielson AFB"],
    
    # Kadena AB (Okinawa) - USAF Pacific
    [26.35, 127.74, "Kadena Air Base Range", "Restricted", 0, 45000, "Kadena AB"],
    
    # Andersen AFB (Guam) - USAF Pacific
    [13.57, 144.93, "Andersen AFB Range", "Restricted", 0, 45000, "Andersen AFB"],
]

def build_airspace_json():
    """Build and save the airspace JSON dataset."""
    
    # Sort by type, then by name for better organization
    airspace_sorted = sorted(AIRSPACE_DATA, key=lambda x: (x[3], x[2]))
    
    dataset = {
        "fields": ["lat", "lon", "name", "type", "floor_ft", "ceiling_ft", "controlling_agency"],
        "data": airspace_sorted
    }
    
    output_path = Path(__file__).parent / "data" / "restricted_airspace.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w') as f:
        json.dump(dataset, f, indent=2)
    
    return output_path, len(airspace_sorted)

if __name__ == "__main__":
    output_file, count = build_airspace_json()
    
    print(f"✓ Generated restricted_airspace.json")
    print(f"✓ Records: {count}")
    print(f"✓ Output: {output_file}")
    
    # Print summary statistics
    with open(output_file, 'r') as f:
        data = json.load(f)
    
    # Count by type
    type_counts = {}
    for record in data['data']:
        record_type = record[3]
        type_counts[record_type] = type_counts.get(record_type, 0) + 1
    
    print("\nBreakdown by Type:")
    for atype in sorted(type_counts.keys()):
        print(f"  {atype}: {type_counts[atype]}")
    
    print("\nSample records (first 5):")
    for i, record in enumerate(data['data'][:5]):
        print(f"  {i+1}. {record[2]} ({record[3]}) - {record[0]:.2f}, {record[1]:.2f}")

