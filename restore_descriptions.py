#!/usr/bin/env python3
"""Restore full sighting descriptions that were truncated to 60 characters.

WHAT HAPPENED
-------------
Up to commit 5264039 (2026-03-27) the exported dataset carried descriptions up
to 500 characters (median 87). The rebuild in PR #4 — the merge that brought
Larry Hatch and the HuggingFace NUFORC set over from `main` — produced a dataset
whose descriptions are capped at exactly 60 characters, mid-word:

    "i went to feed the dogs at about 1100 pm an something was co"

Neither `build_sightings_workbook.py` (truncate=500/2000) nor
`export_map_data.py` (str[:500]) does this, so the 60-char text came in from a
source column that was already an excerpt — CORGIS ships one literally named
"Data.Description excerpt" — and won the dedup for those rows.

The user-visible damage was larger than it looks: `makePopup()` only renders its
"Show more" control when a description exceeds 200 characters, so a 60-char cap
silently disabled the expand feature on every single sighting.

WHAT THIS DOES
--------------
Recovers the descriptions from the last good commit and merges them back into
the current per-category files, matching on two keys in order:

  1. (lat, lon, date)                  — exact coordinates, most reliable
  2. (location, date, subcategory)     — for rows whose coordinates were
                                         re-geocoded between builds

A description is only ever replaced when the recovered one is *longer*, so this
can never lose text and is safe to re-run.

USAGE
-----
    python restore_descriptions.py --check    # report only, writes nothing
    python restore_descriptions.py --run

Re-running the full pipeline would be the cleaner fix, but it re-downloads nine
sources and re-runs the slow HF geocoding step, and risks changing the record
count. This is surgical and verifiable.
"""

import argparse
import gzip
import json
import subprocess
import sys

GOOD_COMMIT = "5264039"
GOOD_PATH = "data/sightings_map_data.json"
CATEGORY_FILES = [
    "data/sightings_ufo.json.gz",
    "data/sightings_bigfoot.json.gz",
    "data/sightings_haunted.json.gz",
]
LAT, LON, CAT, DATE, LOC, SUB, DESC = range(7)


def load_reference():
    """Pull the pre-regression dataset straight out of git history."""
    print(f"Reading {GOOD_PATH} from {GOOD_COMMIT} ...")
    blob = subprocess.run(
        ["git", "show", f"{GOOD_COMMIT}:{GOOD_PATH}"],
        capture_output=True, check=True,
    ).stdout
    data = json.loads(blob.decode("utf-8"))["data"]

    by_coord, by_place = {}, {}
    for r in data:
        desc = r[DESC] if len(r) > DESC else ""
        if not desc:
            continue
        by_coord.setdefault((round(r[LAT], 4), round(r[LON], 4), r[DATE]), desc)
        by_place.setdefault(
            (str(r[LOC]).lower(), r[DATE], str(r[SUB]).lower()), desc
        )
    print(f"  {len(by_coord):,} coordinate keys, {len(by_place):,} place keys")
    return by_coord, by_place


def restore(write):
    by_coord, by_place = load_reference()
    grand = {"total": 0, "coord": 0, "place": 0, "still_60": 0}

    for path in CATEGORY_FILES:
        with gzip.open(path, "rt", encoding="utf-8") as fh:
            payload = json.load(fh)
        rows = payload["data"]
        hits = {"coord": 0, "place": 0, "still_60": 0}

        for r in rows:
            current = r[DESC] if len(r) > DESC else ""
            recovered = by_coord.get((round(r[LAT], 4), round(r[LON], 4), r[DATE]))
            key = "coord"
            if not recovered or len(recovered) <= len(current):
                recovered = by_place.get(
                    (str(r[LOC]).lower(), r[DATE], str(r[SUB]).lower())
                )
                key = "place"
            # Never shorten: only accept a strictly longer description.
            if recovered and len(recovered) > len(current):
                r[DESC] = recovered
                hits[key] += 1
            elif len(current) == 60:
                hits["still_60"] += 1

        grand["total"] += len(rows)
        for k in ("coord", "place", "still_60"):
            grand[k] += hits[k]
        print(
            f"{path}: {len(rows):,} rows | restored {hits['coord']:,} by coord, "
            f"{hits['place']:,} by place | {hits['still_60']:,} still truncated"
        )

        if write:
            # compresslevel=9 to match export_map_data.py's output.
            with gzip.open(path, "wt", encoding="utf-8", compresslevel=9) as fh:
                json.dump(payload, fh, separators=(",", ":"), ensure_ascii=False)

    restored = grand["coord"] + grand["place"]
    print(
        f"\nTOTAL {grand['total']:,} rows | restored {restored:,} "
        f"({100 * restored / grand['total']:.1f}%) | "
        f"{grand['still_60']:,} still capped at 60"
    )
    if not write:
        print("\n--check: nothing written. Re-run with --run to apply.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--run", action="store_true", help="write the files")
    ap.add_argument("--check", action="store_true", help="report only")
    args = ap.parse_args()
    if not (args.run or args.check):
        ap.print_help()
        sys.exit(1)
    restore(write=args.run)
