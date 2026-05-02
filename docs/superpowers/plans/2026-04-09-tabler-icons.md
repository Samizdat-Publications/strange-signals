# Tabler Icons Integration — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all map marker icons (3 main categories + 8 overlay layers) and sidebar legend dots with Tabler Icons inline SVGs for visual consistency.

**Architecture:** Add a `TABLER_SVG` registry object with ~15 cleaned SVG template functions to `strange-signals.js`. A `tablerIcon()` helper wraps each SVG in an `L.divIcon`. All existing `makeIcon()`, `CAT_ICON_SVG`, and Unicode glyph icon creation is replaced with calls to this helper. CSS adds `.tabler-marker` styling and removes obsolete Unicode-specific overlay marker styles.

**Tech Stack:** Vanilla JS (no build tools), Leaflet 1.9.4, inline SVG strings sourced from Tabler Icons v3 (MIT). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-04-09-tabler-icons-design.md`

**Note:** The spec's `TABLER_SVG` registry lists 20 icon keys. This plan includes only the 15 that are actively used by map layers, sidebar legend, or popups. The 5 omitted keys (`alien`, `skull`, `campfire`, `buildingFortress`, `triangle`) are secondary/extra icons listed in the spec for future subcategory use — they have no current consumers and are excluded per YAGNI.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `strange-signals.css` | Modify | Add `.tabler-marker` class, remove Unicode overlay marker sub-styles |
| `strange-signals.js` | Modify | Add `TABLER_SVG` registry + `tablerIcon()` helper, replace all icon creation across main categories, overlays, clusters, sidebar legend, and popup HTML |
| `index.html` | Modify | Replace `<span class="layer-dot">` elements with inline SVG icon spans in sidebar legend |

---

### Task 1: Add CSS for `.tabler-marker` and remove obsolete overlay styles

**Files:**
- Modify: `strange-signals.css:462-471`

- [ ] **Step 1: Add `.tabler-marker` styles**

After the `/* ========== OVERLAY MARKERS ========== */` comment (line 462), add the new Tabler marker styles. The `.overlay-marker` base class is retained since it provides shared layout (`text-align:center`, `background:transparent`, `border:none`).

Add immediately after line 463 (`.overlay-marker{...}`):
```css
.tabler-marker{background:none!important;border:none!important}
.tabler-marker svg{filter:drop-shadow(0 0 3px rgba(255,255,255,0.4))}
```

- [ ] **Step 2: Remove obsolete Unicode overlay marker sub-styles**

Delete lines 464-471 — the per-layer Unicode glyph styles that are no longer needed:
```css
/* DELETE THESE — they style Unicode glyphs, not SVGs */
.parks-marker{color:var(--parks);font-size:14px;text-shadow:0 0 6px var(--parks),0 0 2px #000}
.historic-marker{color:var(--historic);font-size:12px;text-shadow:0 0 6px var(--historic),0 0 2px #000}
.airspace-marker{color:var(--airspace);font-size:12px;text-shadow:0 0 6px var(--airspace),0 0 2px #000}
.earthquake-marker{color:var(--earthquake);font-size:9px;text-shadow:0 0 4px var(--earthquake),0 0 2px #000}
.cave-marker{color:var(--cave);font-size:13px;text-shadow:0 0 6px var(--cave),0 0 2px #000}
.fireball-marker{color:var(--fireball);font-size:14px;text-shadow:0 0 8px var(--fireball),0 0 3px #000}
.cryptid-marker{color:var(--cryptid);font-size:12px;text-shadow:0 0 6px var(--cryptid),0 0 2px #000}
.missing411-marker{color:var(--missing411);font-size:11px;text-shadow:0 0 6px var(--missing411),0 0 2px #000}
```

Keep `.overlay-group-label` (line 472) and `.airspace-circle` (line 474) — those are unrelated to icon styling.

- [ ] **Step 3: Commit**

```bash
git add strange-signals.css
git commit -m "style: add .tabler-marker CSS, remove obsolete Unicode overlay marker styles"
```

---

### Task 2: Add `TABLER_SVG` registry and `tablerIcon()` helper

**Files:**
- Modify: `strange-signals.js:144-175`

- [ ] **Step 1: Replace `CAT_ICON_SVG`, `makeIcon()`, and `icons[]`**

Replace lines 144-175 (from `const CAT_ICON_SVG=[` through `const icons=[makeIcon(0),makeIcon(1),makeIcon(2)];`) with the `TABLER_SVG` registry, `tablerIcon()` helper, and new `icons[]` array.

Each SVG template:
- Removes the Tabler `class="icon icon-tabler..."` attribute
- Removes the `<path stroke="none" d="M0 0h24v24H0z" fill="none" />` filler path
- Replaces `stroke="currentColor"` with `stroke="${c}"`
- Replaces `width="24" height="24"` with `width="${s}" height="${s}"`
- Bumps `stroke-width` from `"2"` to `"2.5"`

```javascript
/* ========== TABLER ICON SVG REGISTRY ========== */
const TABLER_SVG={
  ufo:(c,s=16)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16.95 9.01c3.02 .739 5.05 2.123 5.05 3.714c0 2.367 -4.48 4.276 -10 4.276s-10 -1.909 -10 -4.276c0 -1.59 2.04 -2.985 5.07 -3.724"/><path d="M7 9c0 1.105 2.239 2 5 2s5 -.895 5 -2v-.035c0 -2.742 -2.239 -4.965 -5 -4.965s-5 2.223 -5 4.965v.035"/><path d="M15 17l2 3"/><path d="M8.5 17l-1.5 3"/><path d="M12 14h.01"/><path d="M7 13h.01"/><path d="M17 13h.01"/></svg>`,
  paw:(c,s=16)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 13.5c-1.1 -2 -1.441 -2.5 -2.7 -2.5c-1.259 0 -1.736 .755 -2.836 2.747c-.942 1.703 -2.846 1.845 -3.321 3.291c-.097 .265 -.145 .677 -.143 .962c0 1.176 .787 2 1.8 2c1.259 0 3 -1 4.5 -1s3.241 1 4.5 1c1.013 0 1.8 -.823 1.8 -2c0 -.285 -.049 -.697 -.146 -.962c-.475 -1.451 -2.512 -1.835 -3.454 -3.538"/><path d="M20.188 8.082a1.039 1.039 0 0 0 -.406 -.082h-.015c-.735 .012 -1.56 .75 -1.993 1.866c-.519 1.335 -.28 2.7 .538 3.052c.129 .055 .267 .082 .406 .082c.739 0 1.575 -.742 2.011 -1.866c.516 -1.335 .273 -2.7 -.54 -3.052l-.001 0"/><path d="M9.474 9c.055 0 .109 0 .163 -.011c.944 -.128 1.533 -1.346 1.32 -2.722c-.203 -1.297 -1.047 -2.267 -1.932 -2.267c-.055 0 -.109 0 -.163 .011c-.944 .128 -1.533 1.346 -1.32 2.722c.204 1.293 1.048 2.267 1.933 2.267"/><path d="M16.456 6.733c.214 -1.376 -.375 -2.594 -1.32 -2.722a1.164 1.164 0 0 0 -.162 -.011c-.885 0 -1.728 .97 -1.93 2.267c-.214 1.376 .375 2.594 1.32 2.722c.054 .007 .108 .011 .162 .011c.885 0 1.73 -.974 1.93 -2.267"/><path d="M5.69 12.918c.816 -.352 1.054 -1.719 .536 -3.052c-.436 -1.124 -1.271 -1.866 -2.009 -1.866c-.14 0 -.277 .027 -.407 .082c-.816 .352 -1.054 1.719 -.536 3.052c.436 1.124 1.271 1.866 2.009 1.866c.14 0 .277 -.027 .407 -.082"/></svg>`,
  ghost:(c,s=16)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 11a7 7 0 0 1 14 0v7a1.78 1.78 0 0 1 -3.1 1.4a1.65 1.65 0 0 0 -2.6 0a1.65 1.65 0 0 1 -2.6 0a1.65 1.65 0 0 0 -2.6 0a1.78 1.78 0 0 1 -3.1 -1.4v-7"/><path d="M10 10l.01 0"/><path d="M14 10l.01 0"/><path d="M10 14a3.5 3.5 0 0 0 4 0"/></svg>`,
  shield:(c,s=14)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3"/></svg>`,
  radar:(c,s=14)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12h-8a1 1 0 1 0 -1 1v8a9 9 0 0 0 9 -9"/><path d="M16 9a5 5 0 1 0 -7 7"/><path d="M20.486 9a9 9 0 1 0 -11.482 11.495"/></svg>`,
  trees:(c,s=14)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 5l3 3l-2 1l4 4l-3 1l4 4h-9"/><path d="M15 21l0 -3"/><path d="M8 13l-2 -2"/><path d="M8 12l2 -2"/><path d="M8 21v-13"/><path d="M5.824 16a3 3 0 0 1 -2.743 -3.69a3 3 0 0 1 .304 -4.833a3 3 0 0 1 4.615 -3.707a3 3 0 0 1 4.614 3.707a3 3 0 0 1 .305 4.833a3 3 0 0 1 -2.919 3.695h-4l-.176 -.005"/></svg>`,
  activity:(c,s=14)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l3 8l4 -16l3 8h4"/></svg>`,
  mountain:(c,s=14)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18l-6.921 -14.612a2.3 2.3 0 0 0 -4.158 0l-6.921 14.612"/><path d="M7.5 11l2 2.5l2.5 -2.5l2 3l2.5 -2"/></svg>`,
  meteor:(c,s=14)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3l-5 9h5l-6.891 7.086a6.5 6.5 0 1 1 -8.855 -9.506l7.746 -6.58l-1 5l9 -5"/><path d="M7 14.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0"/></svg>`,
  eye:(c,s=14)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6"/></svg>`,
  alertTriangle:(c,s=14)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0"/><path d="M12 16h.01"/></svg>`,
  buildingCastle:(c,s=14)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 19v-2a3 3 0 0 0 -6 0v2a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-14h4v3h3v-3h4v3h3v-3h4v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1"/><path d="M3 11l18 0"/></svg>`,
  sunElectricity:(c,s=14)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12a4 4 0 0 0 4 4m0 -8a4 4 0 0 0 -4 4"/><path d="M3 12h1"/><path d="M12 3v1"/><path d="M12 20v1"/><path d="M5.6 5.6l.7 .7"/><path d="M6.3 17.7l-.7 .7"/><path d="M20 7l-3 5h4l-3 5"/></svg>`,
  world:(c,s=14)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M3.6 9h16.8"/><path d="M3.6 15h16.8"/><path d="M11.5 3a17 17 0 0 0 0 18"/><path d="M12.5 3a17 17 0 0 1 0 18"/></svg>`,
  mapPin:(c,s=14)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/><path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0"/></svg>`
};

/* ========== TABLER ICON HELPER ========== */
function tablerIcon(name,color,size){
  return L.divIcon({className:'tabler-marker',iconSize:[size,size],
    iconAnchor:[size/2,size/2],popupAnchor:[0,-(size/2)],
    html:TABLER_SVG[name](color,size)});
}

/* ========== CREATE MARKER ========== */
const icons=[tablerIcon('ufo',CAT_COLORS[0],16),tablerIcon('paw',CAT_COLORS[1],16),tablerIcon('ghost',CAT_COLORS[2],16)];
```

This replaces the entire block from `const CAT_ICON_SVG=[` (line 144) through `const icons=[makeIcon(0),makeIcon(1),makeIcon(2)];` (line 175).

- [ ] **Step 2: Verify the map still loads**

Run: `python -m http.server 8001` from the project root and open `http://localhost:8001` in a browser. The 3 main category markers should now render as Tabler stroke icons (UFO saucer, paw print, ghost) instead of the old filled silhouettes.

- [ ] **Step 3: Commit**

```bash
git add strange-signals.js
git commit -m "feat: add TABLER_SVG registry and tablerIcon() helper, replace main category icons"
```

---

### Task 3: Update overlay render functions — Military Bases

**Files:**
- Modify: `strange-signals.js:252-271` (the `renderMilitaryBases()` function)

- [ ] **Step 1: Replace the military icon creation**

Inside `renderMilitaryBases()`, find the icon creation at line 265-266:
```javascript
    const icon=L.divIcon({className:'',iconSize:[10,10],iconAnchor:[5,5],
      html:`<div style="width:10px;height:10px;background:${color};border:1.5px solid rgba(255,255,255,0.6);transform:rotate(45deg);opacity:0.85"></div>`});
```

Replace with:
```javascript
    const icon=tablerIcon('shield',color,14);
```

The `color` variable comes from the existing `branchColors` map on the line above — this preserves all 12 branch-specific colors.

- [ ] **Step 2: Commit**

```bash
git add strange-signals.js
git commit -m "feat: replace military base rotated-square icons with Tabler shield icons"
```

---

### Task 4: Update overlay render functions — Airspace center marker

**Files:**
- Modify: `strange-signals.js:297` (inside `renderAirspace()`)

- [ ] **Step 1: Replace airspace center marker icon**

Find line 297:
```javascript
    const icon=L.divIcon({className:'overlay-marker airspace-marker',html:'&#9651;',iconSize:[12,12]});
```

Replace with:
```javascript
    const icon=tablerIcon('radar',color,14);
```

The `color` variable is already defined from `AIRSPACE_COLORS[a[AF.TYPE]]` on the line above.

- [ ] **Step 2: Commit**

```bash
git add strange-signals.js
git commit -m "feat: replace airspace triangle glyphs with Tabler radar icons"
```

---

### Task 5: Update overlay render functions — Caves

**Files:**
- Modify: `strange-signals.js:317-331` (the `renderCaves()` function)

- [ ] **Step 1: Replace cave icon and popup glyph**

Find line 323:
```javascript
    const icon=L.divIcon({className:'overlay-marker cave-marker',html:'&#9673;',iconSize:[12,12]});
```
Replace with:
```javascript
    const icon=tablerIcon('mountain','#aa8866',14);
```

Find line 326 — the popup HTML uses `&#9673;` as a prefix:
```javascript
    marker.bindPopup('<b style="color:var(--cave)">&#9673; '+esc(c[CF.NAME])+'</b><br>'+
```
Replace `&#9673; ` with a mini inline SVG:
```javascript
    marker.bindPopup('<b style="color:var(--cave)">'+TABLER_SVG.mountain('var(--cave)',12)+' '+esc(c[CF.NAME])+'</b><br>'+
```

- [ ] **Step 2: Commit**

```bash
git add strange-signals.js
git commit -m "feat: replace cave circle glyphs with Tabler mountain icons"
```

---

### Task 6: Update overlay render functions — Fireballs

**Files:**
- Modify: `strange-signals.js:334-353` (the `renderFireballs()` function)

- [ ] **Step 1: Replace fireball icon (dynamic sizing)**

Find lines 342-343:
```javascript
    const icon=L.divIcon({className:'overlay-marker fireball-marker',
      html:'<span style="font-size:'+sz+'px">&#9788;</span>',iconSize:[sz,sz]});
```
Replace with:
```javascript
    const icon=tablerIcon('meteor','#ffcc00',sz);
```

The `sz` variable is already computed dynamically from energy on line 341: `const sz=Math.max(10,Math.min(24,8+Math.sqrt(energy)*3));`

Find line 347 — the popup HTML:
```javascript
    marker.bindPopup('<b style="color:var(--fireball)">&#9788; NASA Fireball</b><br>'+
```
Replace `&#9788; ` with:
```javascript
    marker.bindPopup('<b style="color:var(--fireball)">'+TABLER_SVG.meteor('var(--fireball)',12)+' NASA Fireball</b><br>'+
```

- [ ] **Step 2: Commit**

```bash
git add strange-signals.js
git commit -m "feat: replace fireball sun glyphs with Tabler meteor icons"
```

---

### Task 7: Update overlay render functions — Cryptids

**Files:**
- Modify: `strange-signals.js:355-371` (the `renderCryptids()` function)

- [ ] **Step 1: Replace cryptid icon and popup glyph**

Find line 361:
```javascript
    const icon=L.divIcon({className:'overlay-marker cryptid-marker',html:'&#10070;',iconSize:[12,12]});
```
Replace with:
```javascript
    const icon=tablerIcon('eye','#cc44ff',14);
```

Find line 364 — the popup:
```javascript
    marker.bindPopup('<b style="color:var(--cryptid)">&#10070; '+esc(c[XF.TYPE])+'</b><br>'+
```
Replace with:
```javascript
    marker.bindPopup('<b style="color:var(--cryptid)">'+TABLER_SVG.eye('var(--cryptid)',12)+' '+esc(c[XF.TYPE])+'</b><br>'+
```

- [ ] **Step 2: Commit**

```bash
git add strange-signals.js
git commit -m "feat: replace cryptid diamond glyphs with Tabler eye icons"
```

---

### Task 8: Update overlay render functions — Missing 411

**Files:**
- Modify: `strange-signals.js:373-390` (the `renderMissing411()` function)

- [ ] **Step 1: Replace missing411 icon and popup glyph**

Find line 379:
```javascript
    const icon=L.divIcon({className:'overlay-marker missing411-marker',html:'&#9888;',iconSize:[12,12]});
```
Replace with:
```javascript
    const icon=tablerIcon('alertTriangle','#ff2222',14);
```

Find line 382 — the popup:
```javascript
    marker.bindPopup('<b style="color:var(--missing411)">&#9888; Missing 411</b><br>'+
```
Replace with:
```javascript
    marker.bindPopup('<b style="color:var(--missing411)">'+TABLER_SVG.alertTriangle('var(--missing411)',12)+' Missing 411</b><br>'+
```

- [ ] **Step 2: Commit**

```bash
git add strange-signals.js
git commit -m "feat: replace missing411 warning glyphs with Tabler alert-triangle icons"
```

---

### Task 9: Update overlay render functions — Parks

**Files:**
- Modify: `strange-signals.js:2419-2422` (inside parks checkbox handler)

- [ ] **Step 1: Replace parks icon and popup glyph**

Find line 2420:
```javascript
          const icon=L.divIcon({className:'overlay-marker parks-marker',html:'&#9830;',iconSize:[12,12]});
```
Replace with:
```javascript
          const icon=tablerIcon('trees','#22cc66',14);
```

Find line 2422 — the popup:
```javascript
          marker.bindPopup('<b style="color:#22cc66">&#9830; '+esc(p[2])+'</b><br>'+esc(p[3])+'<br>'+p[4]+' km&sup2;');
```
Replace with:
```javascript
          marker.bindPopup('<b style="color:#22cc66">'+TABLER_SVG.trees('#22cc66',12)+' '+esc(p[2])+'</b><br>'+esc(p[3])+'<br>'+p[4]+' km&sup2;');
```

- [ ] **Step 2: Commit**

```bash
git add strange-signals.js
git commit -m "feat: replace parks diamond glyphs with Tabler trees icons"
```

---

### Task 10: Update overlay render functions — Historic Sites

**Files:**
- Modify: `strange-signals.js:2448-2451` (inside historic checkbox handler)

- [ ] **Step 1: Replace historic icon and popup glyph**

Find line 2449:
```javascript
          const icon=L.divIcon({className:'overlay-marker historic-marker',html:'&#9632;',iconSize:[10,10]});
```
Replace with:
```javascript
          const icon=tablerIcon('buildingCastle','#ffaa22',14);
```

Find line 2451 — the popup:
```javascript
          marker.bindPopup('<b style="color:#ffaa22">&#9632; '+esc(s[2])+'</b><br>'+esc(s[3])+'<br>Listed: '+esc(String(s[4])));
```
Replace with:
```javascript
          marker.bindPopup('<b style="color:#ffaa22">'+TABLER_SVG.buildingCastle('#ffaa22',12)+' '+esc(s[2])+'</b><br>'+esc(s[3])+'<br>Listed: '+esc(String(s[4])));
```

- [ ] **Step 2: Commit**

```bash
git add strange-signals.js
git commit -m "feat: replace historic square glyphs with Tabler building-castle icons"
```

---

### Task 11: Update cluster `iconCreateFunction`

**Files:**
- Modify: `strange-signals.js:1207-1224` (the `createCluster()` function)

- [ ] **Step 1: Add a mini Tabler icon to cluster center**

The cluster icon currently shows only a count number in a colored circle. Add a small (12px) category icon above the count.

Find lines 1213-1221 (the `iconCreateFunction`):
```javascript
    iconCreateFunction(cluster){
      const n=cluster.getChildCount();
      const sz=n<100?28:n<1000?36:44;
      const label=n+' '+CAT_NAMES[catIdx]+' sightings';
      return L.divIcon({className:'',iconSize:[sz,sz],
        html:`<div aria-label="${label}" style="background:rgba(${c},0.65);color:#fff;font-weight:700;font-size:${sz>36?12:10}px;
          width:${sz}px;height:${sz}px;border-radius:50%;display:flex;align-items:center;justify-content:center;
          border:2px solid rgba(${c},0.4);box-shadow:0 0 8px rgba(${c},0.3);font-family:var(--font-mono)">
          ${n>=1000?Math.round(n/1000)+'k':n}</div>`});
    }
```

Replace with (adds the category icon as a small overlay at the top of the cluster badge):
```javascript
    iconCreateFunction(cluster){
      const n=cluster.getChildCount();
      const sz=n<100?28:n<1000?36:44;
      const label=n+' '+CAT_NAMES[catIdx]+' sightings';
      const catIcons=['ufo','paw','ghost'];
      const catIcon=TABLER_SVG[catIcons[catIdx]](CAT_COLORS[catIdx],12);
      return L.divIcon({className:'tabler-marker',iconSize:[sz,sz],
        html:`<div aria-label="${label}" style="background:rgba(${c},0.65);color:#fff;font-weight:700;font-size:${sz>36?12:10}px;
          width:${sz}px;height:${sz}px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;
          border:2px solid rgba(${c},0.4);box-shadow:0 0 8px rgba(${c},0.3);font-family:var(--font-mono)">
          <span style="line-height:1;margin-bottom:-1px">${catIcon}</span>
          <span style="line-height:1">${n>=1000?Math.round(n/1000)+'k':n}</span></div>`});
    }
```

**Note:** The icon only shows visually when the cluster badge is large enough (36px+). At 28px, both icon and count will be small — this is acceptable since the icon still provides category identification.

- [ ] **Step 2: Verify clusters render correctly**

Open the map, zoom out to level 4-5, and confirm that cluster badges show the category icon above the count number. Verify all 3 categories (UFO, Bigfoot, Haunted) display their respective icons.

- [ ] **Step 3: Commit**

```bash
git add strange-signals.js
git commit -m "feat: add Tabler category icons to cluster badge centers"
```

---

### Task 12: Update sidebar legend — Main category `layer-dot` icons

**Files:**
- Modify: `index.html:72-89` (main category layer rows)

**Important:** We cannot use the `TABLER_SVG` JS registry in static HTML. Instead, paste the literal SVG at 12px with the correct color. Use `stroke-width="2.5"` to match. All SVG paths are identical to those in the `TABLER_SVG` registry from Task 2.

- [ ] **Step 1: Replace UFO layer-dot (line 74)**

Find: `<span class="layer-dot" style="background:var(--green)"></span>`
Replace with:
```html
<span class="layer-dot" style="background:none;border:none;display:inline-flex;align-items:center"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00ff88" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16.95 9.01c3.02 .739 5.05 2.123 5.05 3.714c0 2.367 -4.48 4.276 -10 4.276s-10 -1.909 -10 -4.276c0 -1.59 2.04 -2.985 5.07 -3.724"/><path d="M7 9c0 1.105 2.239 2 5 2s5 -.895 5 -2v-.035c0 -2.742 -2.239 -4.965 -5 -4.965s-5 2.223 -5 4.965v.035"/><path d="M15 17l2 3"/><path d="M8.5 17l-1.5 3"/><path d="M12 14h.01"/><path d="M7 13h.01"/><path d="M17 13h.01"/></svg></span>
```

- [ ] **Step 2: Replace Bigfoot layer-dot (line 80)**

Find: `<span class="layer-dot" style="background:var(--orange)"></span>`
Replace with:
```html
<span class="layer-dot" style="background:none;border:none;display:inline-flex;align-items:center"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ff6622" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 13.5c-1.1 -2 -1.441 -2.5 -2.7 -2.5c-1.259 0 -1.736 .755 -2.836 2.747c-.942 1.703 -2.846 1.845 -3.321 3.291c-.097 .265 -.145 .677 -.143 .962c0 1.176 .787 2 1.8 2c1.259 0 3 -1 4.5 -1s3.241 1 4.5 1c1.013 0 1.8 -.823 1.8 -2c0 -.285 -.049 -.697 -.146 -.962c-.475 -1.451 -2.512 -1.835 -3.454 -3.538"/><path d="M20.188 8.082a1.039 1.039 0 0 0 -.406 -.082h-.015c-.735 .012 -1.56 .75 -1.993 1.866c-.519 1.335 -.28 2.7 .538 3.052c.129 .055 .267 .082 .406 .082c.739 0 1.575 -.742 2.011 -1.866c.516 -1.335 .273 -2.7 -.54 -3.052l-.001 0"/><path d="M9.474 9c.055 0 .109 0 .163 -.011c.944 -.128 1.533 -1.346 1.32 -2.722c-.203 -1.297 -1.047 -2.267 -1.932 -2.267c-.055 0 -.109 0 -.163 .011c-.944 .128 -1.533 1.346 -1.32 2.722c.204 1.293 1.048 2.267 1.933 2.267"/><path d="M16.456 6.733c.214 -1.376 -.375 -2.594 -1.32 -2.722a1.164 1.164 0 0 0 -.162 -.011c-.885 0 -1.728 .97 -1.93 2.267c-.214 1.376 .375 2.594 1.32 2.722c.054 .007 .108 .011 .162 .011c.885 0 1.73 -.974 1.93 -2.267"/><path d="M5.69 12.918c.816 -.352 1.054 -1.719 .536 -3.052c-.436 -1.124 -1.271 -1.866 -2.009 -1.866c-.14 0 -.277 .027 -.407 .082c-.816 .352 -1.054 1.719 -.536 3.052c.436 1.124 1.271 1.866 2.009 1.866c.14 0 .277 -.027 .407 -.082"/></svg></span>
```

- [ ] **Step 3: Replace Haunted layer-dot (line 86)**

Find: `<span class="layer-dot" style="background:var(--purple)"></span>`
Replace with:
```html
<span class="layer-dot" style="background:none;border:none;display:inline-flex;align-items:center"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#aa44ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 11a7 7 0 0 1 14 0v7a1.78 1.78 0 0 1 -3.1 1.4a1.65 1.65 0 0 0 -2.6 0a1.65 1.65 0 0 1 -2.6 0a1.65 1.65 0 0 0 -2.6 0a1.78 1.78 0 0 1 -3.1 -1.4v-7"/><path d="M10 10l.01 0"/><path d="M14 10l.01 0"/><path d="M10 14a3.5 3.5 0 0 0 4 0"/></svg></span>
```

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: replace main category sidebar dots with Tabler SVG icons"
```

---

### Task 13: Update sidebar legend — Overlay `layer-dot` icons

**Files:**
- Modify: `index.html:96-167` (overlay layer rows)

Each overlay `<span class="layer-dot" style="background:var(--xxx)"></span>` is replaced with the same wrapper pattern: `<span class="layer-dot" style="background:none;border:none;display:inline-flex;align-items:center"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="{COLOR}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">{PATHS}</svg></span>`

- [ ] **Step 1: Replace Military layer-dot (line 99)**

Find: `<span class="layer-dot" style="background:var(--military)"></span>`
Replace with:
```html
<span class="layer-dot" style="background:none;border:none;display:inline-flex;align-items:center"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4488ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3"/></svg></span>
```

- [ ] **Step 2: Replace Airspace layer-dot (line 105)**

Find: `<span class="layer-dot" style="background:var(--airspace)"></span>`
Replace with:
```html
<span class="layer-dot" style="background:none;border:none;display:inline-flex;align-items:center"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ff4466" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12h-8a1 1 0 1 0 -1 1v8a9 9 0 0 0 9 -9"/><path d="M16 9a5 5 0 1 0 -7 7"/><path d="M20.486 9a9 9 0 1 0 -11.482 11.495"/></svg></span>
```

- [ ] **Step 3: Replace Parks layer-dot (line 111)**

Find: `<span class="layer-dot" style="background:var(--parks)"></span>`
Replace with:
```html
<span class="layer-dot" style="background:none;border:none;display:inline-flex;align-items:center"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22cc66" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 5l3 3l-2 1l4 4l-3 1l4 4h-9"/><path d="M15 21l0 -3"/><path d="M8 13l-2 -2"/><path d="M8 12l2 -2"/><path d="M8 21v-13"/><path d="M5.824 16a3 3 0 0 1 -2.743 -3.69a3 3 0 0 1 .304 -4.833a3 3 0 0 1 4.615 -3.707a3 3 0 0 1 4.614 3.707a3 3 0 0 1 .305 4.833a3 3 0 0 1 -2.919 3.695h-4l-.176 -.005"/></svg></span>
```

- [ ] **Step 4: Replace Earthquakes layer-dot (line 119)**

Find: `<span class="layer-dot" style="background:var(--earthquake)"></span>`
Replace with:
```html
<span class="layer-dot" style="background:none;border:none;display:inline-flex;align-items:center"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ff8844" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l3 8l4 -16l3 8h4"/></svg></span>
```

- [ ] **Step 5: Replace Caves layer-dot (line 125)**

Find: `<span class="layer-dot" style="background:var(--cave)"></span>`
Replace with:
```html
<span class="layer-dot" style="background:none;border:none;display:inline-flex;align-items:center"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#aa8866" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18l-6.921 -14.612a2.3 2.3 0 0 0 -4.158 0l-6.921 14.612"/><path d="M7.5 11l2 2.5l2.5 -2.5l2 3l2.5 -2"/></svg></span>
```

- [ ] **Step 6: Replace Fireballs layer-dot (line 131)**

Find: `<span class="layer-dot" style="background:var(--fireball)"></span>`
Replace with:
```html
<span class="layer-dot" style="background:none;border:none;display:inline-flex;align-items:center"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffcc00" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3l-5 9h5l-6.891 7.086a6.5 6.5 0 1 1 -8.855 -9.506l7.746 -6.58l-1 5l9 -5"/><path d="M7 14.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0"/></svg></span>
```

- [ ] **Step 7: Replace Cryptids layer-dot (line 139)**

Find: `<span class="layer-dot" style="background:var(--cryptid)"></span>`
Replace with:
```html
<span class="layer-dot" style="background:none;border:none;display:inline-flex;align-items:center"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#cc44ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6"/></svg></span>
```

- [ ] **Step 8: Replace Missing 411 layer-dot (line 145)**

Find: `<span class="layer-dot" style="background:var(--missing411)"></span>`
Replace with:
```html
<span class="layer-dot" style="background:none;border:none;display:inline-flex;align-items:center"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ff2222" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0"/><path d="M12 16h.01"/></svg></span>
```

- [ ] **Step 9: Replace Historic layer-dot (line 151)**

Find: `<span class="layer-dot" style="background:var(--historic)"></span>`
Replace with:
```html
<span class="layer-dot" style="background:none;border:none;display:inline-flex;align-items:center"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffaa22" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 19v-2a3 3 0 0 0 -6 0v2a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-14h4v3h3v-3h4v3h3v-3h4v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1"/><path d="M3 11l18 0"/></svg></span>
```

- [ ] **Step 10: Replace Geomagnetic layer-dot (line 159)**

Find: `<span class="layer-dot" style="background:var(--geomagnetic)"></span>`
Replace with:
```html
<span class="layer-dot" style="background:none;border:none;display:inline-flex;align-items:center"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#44ffcc" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12a4 4 0 0 0 4 4m0 -8a4 4 0 0 0 -4 4"/><path d="M3 12h1"/><path d="M12 3v1"/><path d="M12 20v1"/><path d="M5.6 5.6l.7 .7"/><path d="M6.3 17.7l-.7 .7"/><path d="M20 7l-3 5h4l-3 5"/></svg></span>
```

- [ ] **Step 11: Replace Per-Capita layer-dot (line 167)**

Find: `<span class="layer-dot" style="background:#ffffff"></span>`
Replace with:
```html
<span class="layer-dot" style="background:none;border:none;display:inline-flex;align-items:center"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M3.6 9h16.8"/><path d="M3.6 15h16.8"/><path d="M11.5 3a17 17 0 0 0 0 18"/><path d="M12.5 3a17 17 0 0 1 0 18"/></svg></span>
```

- [ ] **Step 12: Commit**

```bash
git add index.html
git commit -m "feat: replace overlay sidebar dots with Tabler SVG icons"
```

---

### Task 14: Verify sidebar renders correctly

- [ ] **Step 1: Check sidebar in browser**

Open the map and confirm the sidebar shows mini SVG icons next to each layer name instead of colored circles. Verify all 14 rows (3 main + 11 overlay) display their respective Tabler icons at 12px with correct colors.

- [ ] **Step 2: Verify checked/unchecked toggle**

The `layer-dot` class still exists for CSS targeting. Verify that the `input:checked+.layer-dot` animation selector still applies the dot-pulse animation when a layer is toggled on.

---

### Task 15: Visual verification and smoke test

- [ ] **Step 1: Start the dev server**

```bash
cd "C:\Users\stewa\OneDrive\Documents\Claude\UAP Correlation Project\.claude\worktrees\angry-hermann"
python -m http.server 8001
```

- [ ] **Step 2: Verify all layers**

Open `http://localhost:8001` and check each layer:

1. **Main categories** — Toggle UFO, Bigfoot, Haunted on/off. Verify Tabler stroke icons (saucer, paw, ghost) render at 16px with correct colors (#00ff88, #ff6622, #aa44ff).
2. **Clusters** — Zoom out to level 4. Verify cluster badges show category icon + count.
3. **Military** — Toggle on. Verify shield icons with branch-specific colors.
4. **Airspace** — Toggle on. Verify radar icons at airspace zone centers.
5. **Caves** — Toggle on. Verify mountain icons with #aa8866 color.
6. **Fireballs** — Toggle on. Verify meteor icons with varying sizes.
7. **Cryptids** — Toggle on. Verify eye icons with #cc44ff color.
8. **Missing 411** — Toggle on. Verify alert-triangle icons with #ff2222 color.
9. **Parks** — Toggle on. Verify trees icons with #22cc66 color.
10. **Historic** — Toggle on. Verify building-castle icons with #ffaa22 color.
11. **Popups** — Click markers from caves, fireballs, cryptids, missing411, parks, historic. Verify popup headers show mini SVG icons instead of Unicode glyphs.
12. **Sidebar** — Verify all layer rows show SVG icons instead of colored dots.
13. **Glow effect** — Verify subtle white drop-shadow glow on all map markers.

- [ ] **Step 3: Check console for errors**

Open browser DevTools console. Verify no JavaScript errors related to icon rendering, missing `TABLER_SVG` keys, or Leaflet marker issues.

- [ ] **Step 4: Final commit**

If any fixes were needed during verification, commit them:
```bash
git add -A
git commit -m "fix: address visual issues found during Tabler icons smoke test"
```
