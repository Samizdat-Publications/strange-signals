# NASA Fireball Surge Investigation — Findings Brief

**Investigated:** 2026-06-10, directly against primary sources (no secondary reporting used).
**Trigger:** WISHLIST.md entry — community perception of an "early-2026 surge" in
NASA CNEOS fireball detections.

## 1. Source confirmation

- **CNEOS remains canonical.** `https://ssd-api.jpl.nasa.gov/fireball.api` is live,
  version 1.2, no auth, no observed rate limits at our usage level.
- Schema is unchanged since the pipeline was written: fields
  `date, energy, impact-e, lat, lat-dir, lon, lon-dir, alt, vel`.
  `build_fireball_data.py` parses correctly with zero changes required.
- 877 events worldwide carry location data (`req-loc=true`); only a small fraction of
  all CNEOS-listed bolides are geolocated. This — combined with our continental-US
  filter — is why the old snapshot held just 29 records, not staleness.
- Complementary source noted but not integrated: AMS (American Meteor Society)
  eyewitness reports. Those scale with *people and phones*, not with rocks, and would
  reintroduce exactly the reporting bias the Signal Engine exists to remove. Skip.

## 2. The "surge" claim — REFUTED by primary counts

Monthly located-event counts straight from the API:

| Period | Events | Rate |
|--------|--------|------|
| 2024 full year | 31 | 2.6/mo |
| 2025 full year | 32 | 2.7/mo |
| **2026 Jan–May** | **14** | **2.8/mo** |
| 2024 Jan–May (same window) | 9 | 1.8/mo |
| 2025 Jan–May (same window) | 18 | 3.6/mo |

2026 year-to-date sits *between* the two preceding years' equivalent windows. The
monthly maximum in 2026 (4 events) was matched or exceeded eight times in 2024–25.
Under a Poisson model with λ≈2.7/month, nothing in 2026 approaches significance.

**Conclusion:** there is no detection surge in the satellite record. The perception is
driven by social amplification of eyewitness reporting — which is itself a useful
data point for the project's central thesis: report volume tracks attention, not
phenomena. The dashboard's role is to show users this gap.

## 3. Integration decisions (shipped with this brief)

- **Global coverage**: dropped the continental-US filter — 29 → 877 events. UFO/UAP
  data is worldwide; the overlay should be too.
- **New field**: `impact_kt` (total impact energy) appended to the record format
  (backwards-compatible — existing indices unchanged).
- **Recent-event styling**: detections from the last 180 days render brighter and
  larger, so any *future* genuine surge is visible at a glance without a separate
  layer.
- **Energy slider**: skipped — 877 points renders fine; revisit only if the dataset
  grows 10x.
- **Pre-wired correlation hypotheses** (already supported by the existing tool
  surface): fireballs × UFO reports within ±7 days (use `query_temporal` +
  `get_nearby_overlays`), fireballs × geomagnetic storms (timeline bands). The
  Signal Analyst's system prompt directs it to treat fireballs as a mundane-source
  check for transient UAP flaps.

**Rebuild command:** `python build_fireball_data.py` (writes `data/nasa_fireballs.json`).
