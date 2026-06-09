# STRANGE SIGNALS v2 — From Map of Reports to Instrument of Anomalies

**Author:** Claude (Fable 5), driving. **Date:** 2026-06-09. **Baseline:** tag `v1-opus-baseline`.

## The Problem With v1 (honest diagnosis)

v1 plots **where people report things**. Population is the overwhelming driver of every
signal in the app:

- The hex density view is a viridis-colored population map.
- `pearsonR()` correlates raw hex counts, so "UFOs correlate with Haunted Places at
  r=0.62" mostly means "both happen where people live."
- Population adjustment exists (`us_population_density.json`) but is **only used to
  re-weight the heatmap visuals** — never in any statistic.
- Cluster detection = "≥ N sightings per hex" — a threshold, not a test.
- 4,600 hexes are each implicitly tested with no multiple-comparison control: at α=0.05
  you'd expect ~230 false "hotspots" by chance alone.
- Spatial autocorrelation is ignored, inflating every significance claim.

**v2's thesis:** the product is not the map — it's the *residual*. Where is there MORE
than there should be, after everything mundane we can model is subtracted? Find that,
measure confidence honestly, and explain it like an instrument would.

## The Four Pillars

### Pillar 1 — SIGNAL ENGINE (`signal-engine.js`)

A pure-math module (no DOM) computing, per hex cell over CONUS:

1. **Expected counts model.** `E_i = T × popmass_i / Σ popmass` where popmass samples
   the census density grid over the hex (centroid + ring samples), and `T` = total
   filtered observations in modeled hexes. This is the null hypothesis: *sightings are
   just people looking up.*
2. **Relative risk + significance.** `RR_i = O_i / E_i`; Poisson tail probability
   `P(X ≥ O_i | λ = E_i)` (exact log-space for small E, normal approx for large E).
3. **FDR control.** Benjamini–Hochberg across all hexes → q-values. Only cells with
   q < 0.05 count as "anomalous." Kills the ~230-false-hotspots problem.
4. **Getis-Ord Gi\*** z-scores computed on *Pearson residuals* `(O−E)/√E`, using the
   existing hex adjacency graph. Finds spatially *coherent* excesses, not lone spikes.
5. **Residual correlation.** Category↔category and category↔overlay correlations run on
   residuals, not raw counts. Always reported as a pair: *raw r* vs *population-controlled
   r* — the gap between them is itself a finding ("87% of this correlation is people").
6. **Flap detection.** Per coarse region, monthly series vs a baseline of
   (national monthly trend × region share). Poisson-surprise months merge into "flap"
   events — automatically rediscovering the 1947 wave, 1973 flap, Hudson Valley
   1982–86, Phoenix 1997 from raw data, and surfacing ones nobody has named.
7. **Anomaly Index (0–100).** Explainable blend per hex:
   `AI = w₁·sig(−log10 q) + w₂·sig(Gi* z) + w₃·burstiness + w₄·cross-category co-excess`
   Each component is exposed separately in the hex detail panel — never a black box.
8. **Confounder ledger.** Distance to nearest military installation / restricted
   airspace discounts nothing silently — instead it *annotates*: "Within 40 km of
   Nellis AFB — military aviation is a plausible mundane source."

### Pillar 2 — NEW FLAGSHIP VIEW: "ANOMALY"

Replaces raw hex density as the headline visualization.

- Diverging scale: dim blue (below expected) → near-black (as expected) → green→amber
  (significantly above expected). **Only FDR-significant cells get bright color** —
  green stays precious, the map stays dark and honest.
- Legend becomes an instrument: distribution histogram of the index with the
  significance threshold marked.
- Hex detail panel gains an "ANOMALY BREAKDOWN" block: O vs E, RR, q-value, Gi* z,
  component bars of the index, confounder ledger lines.

### Pillar 3 — DOSSIER (deep dive on any place)

Search any town / click anywhere → **DEEP DIVE** generates a full instrumented regional
report in a draggable window (and exportable self-contained HTML):

- Anomaly verdict: index, percentile vs all CONUS, RR with CI, q-value.
- Observed vs expected over time; flap timeline with named historical peaks.
- Category mix, top subcategories/shapes, seasonal + hour-of-day patterns.
- Overlay context: nearest base, airspace, caves, quakes, fireballs, Missing 411.
- Exemplar cases: the most detailed report descriptions in radius.
- Mundane-explanations ledger with estimated attributable fractions.
- Map snapshot captures embedded as evidence figures.

### Pillar 4 — SIGNAL ANALYST v2 (the agent in the cockpit)

- New tools: `run_deep_dive`, `get_anomaly_scores`, `detect_flaps`,
  `capture_evidence` (html2canvas map snapshot → stored as session evidence, embeddable
  in `generate_report`), `get_anomaly_breakdown(lat, lon)`.
- **Investigation log**: a live instrument strip showing each tool call as a console
  line (`▸ RUN_DEEP_DIVE — Sedona AZ r=50km — 2.3s`). The user *watches the agent fly
  the instrument*.
- System prompt rewritten around the engine: always compare raw vs adjusted, always
  check the confounder ledger, always cite q-values not raw p, attach evidence captures
  to reports.

## Visual Direction (per .impeccable.md)

Keep tokens (Orbitron/Space Mono, `--green #00ff88`, `#05060f`). Changes:

- Marker cluster bubbles restyled from cartoon circles → thin-ring instrument blips.
- Header gains live status readouts (RECORDS / WINDOW / ENGINE) in tabular numerals.
- Radar-sweep shader moment while the engine computes (computation IS the show).
- Bottom status bar: cursor coordinates, engine state, last analysis summary.

## Non-Goals

- No build tooling, no frameworks. Same IIFE + CDN + SRI discipline.
- No new heavyweight deps. The engine is ~600 lines of plain math.
- Anomaly model is CONUS-only (population grid coverage); elsewhere the view falls back
  to density with an honest "no baseline model" notice.

## Ship Plan

| PR | Contents |
|----|----------|
| A | Signal engine + Anomaly view + hex-detail breakdown + legend instrument |
| B | Dossier deep-dive mode (UI entry points + report window + export) |
| C | Signal Analyst v2 (tools, investigation log, evidence capture) |
| D | Cockpit polish pass (clusters, status bar, boot, micro-interactions) |

Each PR squash-merged to `master` per standing preference.
