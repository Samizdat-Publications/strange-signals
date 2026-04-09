# Tabler Icons Integration — Design Spec

**Date:** 2026-04-09
**Status:** Approved
**Scope:** Replace all map marker icons and sidebar legend dots with Tabler Icons (MIT licensed, stroke-based SVGs)

## Problem

The map currently uses three different icon approaches:
1. **Main categories** (UFO, Bigfoot, Haunted) — hand-drawn inline SVGs in `CAT_ICON_SVG` (10-14px filled silhouettes)
2. **Overlay markers** (military, caves, cryptids, etc.) — Unicode HTML entities (`&#9651;`, `&#9673;`, `&#10070;`, etc.) in `L.divIcon`
3. **Military bases** — rotated colored `<div>` squares

This creates visual inconsistency across layers. Overlay markers using Unicode glyphs render differently across browsers and lack the thematic clarity of purpose-built icons.

## Solution

Replace all marker icons with Tabler Icons — 24x24 SVG stroke icons inlined as template literal functions. This unifies the visual language across all 13 map layers while keeping the zero-dependency, no-build-tools architecture.

## Icon Registry

A `TABLER_SVG` object holds ~20 cleaned SVG strings as functions `(color, size) => svgString`. Each SVG is sourced from `@tabler/icons` outline set, with the `class` attribute and `<path stroke="none" .../>` filler removed, `stroke="currentColor"` replaced with the parameterized `${c}` color, `width`/`height` made dynamic via `${s}`, and `stroke-width` bumped from `"2"` to `"2.5"` for visibility at small map scale.

```javascript
const TABLER_SVG = {
  ufo:     (c, s=16) => `<svg ...>...</svg>`,
  paw:     (c, s=16) => `<svg ...>...</svg>`,
  ghost:   (c, s=16) => `<svg ...>...</svg>`,
  shield:  (c, s=14) => `<svg ...>...</svg>`,
  radar:   (c, s=14) => `<svg ...>...</svg>`,
  trees:   (c, s=14) => `<svg ...>...</svg>`,
  activity:(c, s=14) => `<svg ...>...</svg>`,
  mountain:(c, s=14) => `<svg ...>...</svg>`,
  meteor:  (c, s=14) => `<svg ...>...</svg>`,
  eye:     (c, s=14) => `<svg ...>...</svg>`,
  alertTriangle: (c, s=14) => `<svg ...>...</svg>`,
  buildingCastle:(c, s=14) => `<svg ...>...</svg>`,
  sunElectricity:(c, s=14) => `<svg ...>...</svg>`,
  world:   (c, s=14) => `<svg ...>...</svg>`,
  mapPin:  (c, s=14) => `<svg ...>...</svg>`,
  alien:   (c, s=14) => `<svg ...>...</svg>`,
  skull:   (c, s=14) => `<svg ...>...</svg>`,
  campfire:(c, s=14) => `<svg ...>...</svg>`,
  buildingFortress:(c, s=14) => `<svg ...>...</svg>`,
  triangle:(c, s=14) => `<svg ...>...</svg>`,
};
```

## Layer-to-Icon Mapping

| Layer | Icon Key | Color | Size | Notes |
|-------|----------|-------|------|-------|
| UFO/UAP | `ufo` | `#00ff88` | 16px | Main category — saucer icon |
| Bigfoot/Sasquatch | `paw` | `#ff6b35` | 16px | Main category — paw print |
| Haunted Places | `ghost` | `#9b59b6` | 16px | Main category — ghost silhouette |
| Military/DOE Sites | `shield` | Per-branch color (12 variants, see below) | 14px | Overlay — defense shield, color per branch |
| Restricted Airspace | `radar` | `var(--airspace)` `#ff4466` | 14px | Overlay — radar sweep |
| National Parks | `trees` | `var(--parks)` `#22cc66` | 14px | Overlay — tree cluster |
| USGS Earthquakes | `activity` | `var(--earthquake)` `#ff8844` | 14px | Legend-only (layer renders as heatmap) |
| US Cave Systems | `mountain` | `var(--cave)` `#aa8866` | 14px | Overlay — geological feature |
| NASA Fireballs | `meteor` | `var(--fireball)` `#ffcc00` | 10-24px | Overlay — meteor icon, size varies dynamically by energy (see note below) |
| Cryptid Sightings | `eye` | `var(--cryptid)` `#cc44ff` | 14px | Overlay — observation/sighting |
| Missing 411 Cases | `alertTriangle` | `var(--missing411)` `#ff2222` | 14px | Overlay — warning triangle |
| Historic Sites (NRHP) | `buildingCastle` | `var(--historic)` `#ffaa22` | 14px | Overlay — castle/historic building |
| Geomagnetic Storms | `sunElectricity` | `var(--geomagnetic)` `#44ffcc` | 14px | Legend-only (layer renders as timeline bands) |
| Per-Capita Density | `world` | `#ffffff` | 14px | Legend-only (layer renders as choropleth) |

## Helper Function

```javascript
function tablerIcon(name, color, size) {
  return L.divIcon({
    className: 'tabler-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2)],
    html: TABLER_SVG[name](color, size)
  });
}
```

Replaces the existing `makeIcon()` function. The `icons[]` array becomes:
```javascript
const icons = [
  tablerIcon('ufo', CAT_COLORS[0], 16),
  tablerIcon('paw', CAT_COLORS[1], 16),
  tablerIcon('ghost', CAT_COLORS[2], 16)
];
```

## CSS Changes

```css
/* Remove default Leaflet divIcon white box */
.tabler-marker {
  background: none;
  border: none;
}

/* Glow effect — use a fixed semi-transparent white since currentColor
   would fall back to black on divIcons with no CSS color set */
.tabler-marker svg {
  filter: drop-shadow(0 0 3px rgba(255,255,255,0.4));
}
```

**Note on `currentColor`:** The original plan used `drop-shadow(0 0 3px currentColor)`, but `L.divIcon` elements have no inherited CSS `color` property, so `currentColor` would resolve to browser-default black — invisible on dark map tiles. Using a fixed `rgba(255,255,255,0.4)` provides a subtle glow that works for all icon colors against the dark CARTO basemap. Per-layer colored glow is not needed since the stroke color itself provides the category distinction.

The existing `.overlay-marker` base class is retained (it sets `text-align`, `background:transparent`, `border:none`). The per-layer sub-styles (`.cave-marker`, `.cryptid-marker`, `.airspace-marker`, etc.) that applied Unicode-specific `font-size` and `text-shadow` are removed since those properties don't apply to SVG icons.

## Files Modified

| File | Changes |
|------|---------|
| `strange-signals.js` | Add `TABLER_SVG` registry (~lines 144+), add `tablerIcon()` helper, replace `CAT_ICON_SVG` + `makeIcon()`, update 8 overlay render functions, update sidebar legend HTML, update cluster center icons |
| `strange-signals.css` | Add `.tabler-marker` styles, remove obsolete `.overlay-marker` sub-styles |

## Implementation Touchpoints in strange-signals.js

### 1. Replace `CAT_ICON_SVG` and `makeIcon()` (lines 144-175)
Remove the hand-drawn SVG functions and `makeIcon()`. Replace with `TABLER_SVG` registry and `tablerIcon()` helper.

### 2. Update overlay render functions
Each overlay function creates `L.divIcon` with Unicode glyphs. Replace with `tablerIcon()` calls:

| Function | Current Icon | New Icon |
|----------|-------------|----------|
| `renderMilitaryBases()` (~line 252) | Rotated colored `<div>` square | `tablerIcon('shield', branchColor, 14)` — called **per marker** using the existing `branchColors` map (12 branch-specific colors: Air Force, Space Force, Navy, Army, Marines, DoD, DOE, NASA, CIA, Guard, FAA, Commerce). Icons cannot be cached. |
| `renderAirspace()` (~line 297) | `&#9651;` triangle | `tablerIcon('radar', color, 14)` |
| `renderCaves()` (~line 323) | `&#9673;` circle | `tablerIcon('mountain', '#aa8866', 14)` |
| `renderFireballs()` (~line 334) | `&#9788;` sun | `tablerIcon('meteor', '#ffcc00', sz)` — called **per marker** with dynamic `sz` computed from energy (`Math.max(10,Math.min(24,8+Math.sqrt(energy)*3))`). Icons cannot be cached. |
| `renderCryptids()` (~line 361) | `&#10070;` diamond | `tablerIcon('eye', 'var(--cryptid)', 14)` |
| `renderMissing411()` (~line 379) | `&#9888;` warning | `tablerIcon('alertTriangle', 'var(--missing411)', 14)` |
| Parks inline handler (~line 2404) | `&#9830;` diamond | `tablerIcon('trees', 'var(--parks)', 14)` — this is an anonymous inline handler inside the parks checkbox toggle, not a named function |
| Historic inline handler (~line 2435) | `&#9632;` square | `tablerIcon('buildingCastle', 'var(--historic)', 14)` — anonymous inline handler inside the historic checkbox toggle, not a named function |

### 3. Update sidebar legend
Replace `<span class="layer-dot" style="background:...">` colored circles with mini (12px) inline Tabler SVGs for each layer row. The `layer-dot` class styling remains for the CSS dot-pulse animation on checked state.

### 4. Update cluster iconCreateFunction (~line 1213)
Embed a small (12px) Tabler icon at cluster center alongside the count number. The icon matches the category (ufo/paw/ghost).

### 5. Update popup icon references
Replace Unicode glyphs in popup HTML (`&#9673;`, `&#10070;`, `&#9888;`, `&#9788;`) with inline mini SVGs from `TABLER_SVG`.

## What Stays the Same

- Data loading, parsing, Web Worker pipeline
- Heatmap, hexbin, and correlation view rendering
- Earthquake heatmap (`L.heatLayer`) — no point markers
- Geomagnetic timeline bands (D3 SVG overlay) — no point markers
- Popup content structure and proximity analysis
- Filter logic, URL state management, keyboard shortcuts
- SIGNAL AI assistant
- All Python data pipeline scripts

## Visual Changes

**Popup anchor behavior:** The current `makeIcon()` uses non-square icon sizes (12x12, 10x14, 11x14) with hand-tuned anchors and no explicit `popupAnchor`. The new `tablerIcon()` normalizes all main category icons to 16x16 square with centered anchors and `popupAnchor: [0, -8]`. This is an intentional change — popups will appear slightly higher above the icon center, which is more consistent across categories.

## Performance Considerations

- Tabler SVGs are 200-400 bytes each vs current custom SVGs at 150-300 bytes — negligible difference
- Icons are pre-built and cached in the `icons[]` array for the 3 main categories (258K markers share 3 icon instances)
- Military bases (98 markers) and fireballs (29 markers) create icons per-marker due to variable colors/sizes — acceptable given small counts
- Other overlays (71-105 points each) use a single cached icon per layer
- `stroke-width="2.5"` is baked into each SVG string in the `TABLER_SVG` registry (not applied via CSS) for consistent rendering
- `drop-shadow` CSS glow uses fixed `rgba(255,255,255,0.4)` for visibility on dark map tiles

## Open Questions

None — all icons verified available in Tabler outline set. All reviewer issues from spec review addressed.
