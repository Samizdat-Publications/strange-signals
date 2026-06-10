#!/usr/bin/env python3
"""
Build the US airports overlay for the Strange Signals paranormal map.

Airports are the single biggest mundane confounder for UAP reports:
landing lights, holding patterns, and approach corridors generate
"hovering light" reports constantly. This dataset powers the airports
overlay, proximity context in deep-dive dossiers, and the confounder
ledger.

Source: OurAirports (public domain) — data/raw/ourairports.csv
  Download: https://davidmegginson.github.io/ourairports-data/airports.csv

Output: data/us_airports.json
Format: {fields: [lat, lon, name, iata, type], data: [[...], ...]}
  type: "large" (large_airport) or "medium" (medium_airport)

Only US large + medium airports with scheduled service or an IATA code
are kept (~600 airports) — small airfields would blanket the map and
dilute the confounder signal.
"""

import csv
import json
from pathlib import Path

RAW = Path("data/raw/ourairports.csv")
OUT = Path("data/us_airports.json")


def main():
    if not RAW.exists():
        raise SystemExit(
            f"{RAW} not found. Download it first:\n"
            "  curl -L -o data/raw/ourairports.csv "
            "https://davidmegginson.github.io/ourairports-data/airports.csv"
        )

    rows = []
    with RAW.open(encoding="utf-8") as f:
        for rec in csv.DictReader(f):
            if rec["iso_country"] != "US":
                continue
            kind = rec["type"]
            if kind not in ("large_airport", "medium_airport"):
                continue
            iata = (rec.get("iata_code") or "").strip()
            scheduled = rec.get("scheduled_service") == "yes"
            # medium airports without scheduled service or IATA code are
            # mostly quiet regional strips — skip them
            if kind == "medium_airport" and not (scheduled or iata):
                continue
            try:
                lat = round(float(rec["latitude_deg"]), 4)
                lon = round(float(rec["longitude_deg"]), 4)
            except ValueError:
                continue
            rows.append([
                lat,
                lon,
                rec["name"].strip(),
                iata or None,
                "large" if kind == "large_airport" else "medium",
            ])

    rows.sort(key=lambda r: (r[4] != "large", r[2]))
    payload = {"fields": ["lat", "lon", "name", "iata", "type"], "data": rows}
    OUT.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    n_large = sum(1 for r in rows if r[4] == "large")
    print(f"Wrote {OUT}: {len(rows)} airports ({n_large} large, {len(rows)-n_large} medium)")


if __name__ == "__main__":
    main()
