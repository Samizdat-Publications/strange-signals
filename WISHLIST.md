# STRANGE SIGNALS — Wishlist

Future ideas not yet scoped into a plan. Promote to `docs/superpowers/plans/` when ready to build.

## ~~NASA Fireball Surge Investigation~~ — RESOLVED 2026-06-10

**Outcome:** investigated directly against the CNEOS API instead of via Cowork.
The surge claim is **refuted** by primary monthly counts; dataset expanded
29 → 877 events (global), `impact_kt` field added, recent events highlighted.
Full findings: [docs/superpowers/specs/fireball-surge-brief.md](docs/superpowers/specs/fireball-surge-brief.md).
Original prompt kept below for reference.

<details><summary>Original investigation prompt</summary>

## NASA Fireball Surge Investigation

**Trigger:** Starting in early 2026, NASA CNEOS has been logging an unusually high number of fireball / bolide detections. The community is alarmed — this is exactly the kind of "signal in the noise" the dashboard exists to surface.

**What we have today:** [build_fireball_data.py](build_fireball_data.py) → [data/nasa_fireballs.json](data/nasa_fireballs.json) — 29 detections over the continental US, 1994–2026. Probably stale; rebuild covers up to whatever date the script was last run.

**Goal:** Refresh the fireball dataset, surface the recent surge in the dashboard, and let users correlate it against UFO/UAP, geomagnetic storms, restricted airspace, etc.

**Cowork research prompt** (paste into Cowork to kick off background research):

```
Research the recent surge in NASA CNEOS fireball / bolide detections (early 2026 to today). I run an interactive paranormal-correlation dashboard called STRANGE SIGNALS that already plots NASA CNEOS fireballs as a toggleable map overlay (build_fireball_data.py → data/nasa_fireballs.json). The current snapshot only has 29 events for the entire continental US 1994–2026, which feels wildly under-counted given recent reporting.

I need three deliverables:

1. **Source confirmation.** Verify that NASA CNEOS (https://cneos.jpl.nasa.gov/fireballs/) is still the canonical public source, that the JSON/CSV API endpoint our pipeline hits is still live, and document any auth, rate-limit, or schema changes since 2024. If CNEOS itself has changed or there is a better complementary source (AMS — American Meteor Society event reports, ESA NEO Coordination Centre, NASA Meteor Watch), call that out with API access details.

2. **The "surge" claim, sourced.** Confirm or refute the framing that fireball detections are abnormally elevated in early 2026. I want primary-source counts (CNEOS event count by month for the last 24 months at minimum), not just news articles. If news/podcast/Reddit discussion is what's driving the perception, separate that from what the data actually shows. Cite everything.

3. **Integration spec.** Given my pipeline architecture (Python → JSON → vanilla-JS Leaflet overlay; see CLAUDE.md), recommend:
   - whether to expand from "continental US only" to global,
   - whether to add a magnitude / energy filter slider,
   - what fields beyond {lat, lon, date, energy, velocity} would be useful (e.g. impact angle, altitude),
   - whether a separate "recent surge" highlight layer makes sense (e.g. last 90 days popped in a different color),
   - any correlation hypotheses worth pre-wiring into the SIGNAL AI tool surface (fireballs vs geomagnetic storms? vs UFO sightings within a 7-day window? vs restricted airspace?).

Output: a single markdown brief I can drop into docs/superpowers/specs/ and turn into an implementation plan. Include exact API URLs, sample response schemas, and a rebuild command for build_fireball_data.py.
```

</details>

---

*Add new entries above this line. Keep each entry self-contained so it can be picked up cold.*
