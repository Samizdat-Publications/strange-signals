#!/usr/bin/env python3
"""
Export consolidated sighting data as compact JSON for the interactive map.

Reads the Combined_All sheet from the Excel workbook and outputs a minimal
JSON file optimized for Leaflet marker clustering.

Format: { categories: [...], fields: [...], data: [[lat,lon,cat,date,loc,sub,desc], ...] }
"""

import pandas as pd
import gzip
import math
import json
import os
import sys

WORKBOOK = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        "data", "paranormal_sightings_consolidated.xlsx")
OUTPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                      "data", "sightings_map_data.json")

# Static hosts cap individual assets at 25 MiB (Cloudflare, GitHub Pages).
# Split below that for headroom, and aim each shard well under the cap so
# future growth does not immediately breach it again.
SHARD_LIMIT_MB = 20.0
SHARD_TARGET_MB = 12.0


def main():
    print("Exporting map data from Excel workbook...")

    if not os.path.exists(WORKBOOK):
        print(f"ERROR: Workbook not found at {WORKBOOK}")
        print("Run build_sightings_workbook.py first.")
        sys.exit(1)

    df = pd.read_excel(WORKBOOK, sheet_name="Combined_All")
    print(f"  Read {len(df):,} records from Combined_All")

    cat_map = {"UFO/UAP": 0, "Bigfoot/Sasquatch": 1, "Haunted Place": 2}

    # Filter to valid categories
    df = df[df["category"].isin(cat_map.keys())].copy()

    # Vectorized field preparation
    df["cat"] = df["category"].map(cat_map)
    df["latitude"] = pd.to_numeric(df["latitude"], errors="coerce").round(4)
    df["longitude"] = pd.to_numeric(df["longitude"], errors="coerce").round(4)

    # Drop invalid coords
    df = df.dropna(subset=["latitude", "longitude"])

    # Fill NaN with empty strings for text fields
    for col in ["city", "state", "date", "subcategory", "description"]:
        if col in df.columns:
            df[col] = df[col].fillna("")

    # Build location string
    df["loc"] = df.apply(
        lambda r: ", ".join(p for p in [str(r.get("city", "")), str(r.get("state", ""))] if p),
        axis=1,
    )

    # Truncate fields
    df["date_str"] = df["date"].astype(str).str[:10].replace("nan", "")
    df["sub"] = df["subcategory"].astype(str).replace("nan", "")
    df["desc"] = df["description"].astype(str).str[:500].replace("nan", "")

    # Build records as list of lists (vectorized via itertuples — 10x faster than iterrows)
    records = []
    for r in df.itertuples(index=False):
        records.append([
            float(r.latitude),
            float(r.longitude),
            int(r.cat),
            r.date_str if r.date_str != "nan" else "",
            r.loc,
            r.sub if r.sub != "nan" else "",
            r.desc if r.desc != "nan" else "",
        ])

    # Split records by category. We write one .json.gz per category so the
    # browser can fetch them in parallel, cache them independently, and
    # eventually render the small ones (Bigfoot, Haunted) before the big
    # one (UFO) finishes. The combined sightings_map_data.json.gz is no
    # longer produced.
    categories_full = ["UFO/UAP", "Bigfoot/Sasquatch", "Haunted Place"]
    fields = ["lat", "lon", "cat", "date", "location", "subcategory", "description"]
    cat_slug = ["ufo", "bigfoot", "haunted"]
    cat_records = [[], [], []]
    for r in records:
        if 0 <= r[2] <= 2:
            cat_records[r[2]].append(r)

    base_dir = os.path.dirname(OUTPUT)
    print(f"  Exported {len(records):,} records, splitting by category:")
    total_raw = 0
    total_gz = 0
    manifest = []

    def write_shard(slug, idx, rows, part=None):
        """Write one .json.gz and return its gzipped size in MB."""
        out = {
            "category": categories_full[idx],
            "fields": fields,
            "data": rows,
        }
        payload = json.dumps(out, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        name = f"sightings_{slug}.json.gz" if part is None else f"sightings_{slug}_{part}.json.gz"
        gz_path = os.path.join(base_dir, name)
        with gzip.open(gz_path, "wb", compresslevel=9) as f:
            f.write(payload)
        raw_mb = len(payload) / (1024 * 1024)
        gz_mb = os.path.getsize(gz_path) / (1024 * 1024)
        print(f"    {name:<34s} {len(rows):>8,} rec  raw {raw_mb:5.1f} MB  gz {gz_mb:5.1f} MB")
        manifest.append(name)
        return raw_mb, gz_mb

    for idx, slug in enumerate(cat_slug):
        rows = cat_records[idx]
        # Probe the single-file size first. Cloudflare (and most static hosts)
        # cap individual assets at 25 MiB; restoring full descriptions pushed
        # the UFO payload past that, so any category that would breach the cap
        # is split into equal shards rather than silently failing to deploy.
        probe = json.dumps(
            {"category": categories_full[idx], "fields": fields, "data": rows},
            separators=(",", ":"), ensure_ascii=False,
        ).encode("utf-8")
        est_gz = len(gzip.compress(probe, 9)) / (1024 * 1024)

        if est_gz <= SHARD_LIMIT_MB or not rows:
            raw_mb, gz_mb = write_shard(slug, idx, rows)
            total_raw += raw_mb
            total_gz += gz_mb
        else:
            n = math.ceil(est_gz / SHARD_TARGET_MB)
            print(f"    {slug}: {est_gz:.1f} MB exceeds the {SHARD_LIMIT_MB} MB cap -> {n} shards")
            # Partition by serialized byte weight, not record count. Description
            # lengths vary hugely by source (HF NUFORC records are far longer and
            # sort to the end), so equal record counts produce wildly unequal
            # files — one shard came out 3x the size of another.
            weights = [len(json.dumps(r, separators=(",", ":"), ensure_ascii=False)) for r in rows]
            budget = sum(weights) / n
            groups, cur, cur_w = [], [], 0
            for r, w in zip(rows, weights):
                cur.append(r)
                cur_w += w
                if cur_w >= budget and len(groups) < n - 1:
                    groups.append(cur)
                    cur, cur_w = [], 0
            groups.append(cur)
            for p, g in enumerate(groups):
                raw_mb, gz_mb = write_shard(slug, idx, g, part=p + 1)
                total_raw += raw_mb
                total_gz += gz_mb
            # Drop a stale single-file version so the browser can't load both.
            legacy_single = os.path.join(base_dir, f"sightings_{slug}.json.gz")
            if os.path.exists(legacy_single):
                os.remove(legacy_single)

    # The browser reads this to discover how many shards exist, so adding or
    # removing one never requires a matching edit in strange-signals.js.
    manifest_path = os.path.join(base_dir, "sightings_manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump({"files": manifest}, f, indent=2)
    print(f"    sightings_manifest.json            {len(manifest)} file(s)")

    # Remove any legacy combined files (uncompressed or gzipped).
    for legacy in (OUTPUT, OUTPUT + ".gz"):
        if os.path.exists(legacy):
            os.remove(legacy)

    print(f"  Totals: raw {total_raw:.1f} MB  ->  gzipped {total_gz:.1f} MB ({total_gz/total_raw*100:.0f}% of original)")


if __name__ == "__main__":
    main()
