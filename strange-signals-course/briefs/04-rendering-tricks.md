# Module 4 Brief: Rendering 258K Pins Fast

## Teaching Arc
- **Metaphor:** A stage magician's repertoire. Every illusion is a different trick — cards up a sleeve, hidden mirrors, a distracting assistant — and the audience never sees the work. Strange Signals uses six separate tricks to make 258,000 pins feel instant. (NOT a restaurant. NOT a factory/assembly-line. NOT a writer's room.)
- **Opening hook:** "Your browser has one painter. One. Every pixel on the page — the pins, the popup, the sidebar charts, the animated loading text — is drawn by the same single worker. Ask it to place 258,000 pins at once and it stops answering the door for ten seconds. The page freezes. The cursor stops responding. Modern web apps don't get around this by being clever with the paint — they get around it by never asking for more than the painter can handle at once."
- **Key insight:** You don't render 258K pins. You render 5,000. Then you *yield* — hand control back to the browser so it can draw a frame, answer a click, breathe — and then you render another 5,000. The app doesn't feel fast because it *is* fast; it feels fast because it never makes the user wait with a frozen screen.
- **"Why should I care?":** When AI builds you an app and it feels janky — scrolling stutters, clicks ignore you, loading bar freezes at 80% — it's almost always because the AI wrote code that does too much work in one unbroken stretch. Knowing these six performance tricks lets you diagnose jank instantly and ask AI for the right fix: "batch this," "debounce that," "move it to a worker," "cache the result."

## Output file
Write to `strange-signals-course/modules/04-rendering-tricks.html`.

## Content to cover (5 screens)

**Screen 1 — The problem of the frozen page.** Hook paragraph. Then a short visual: imagine a timeline bar. Left end: "user clicks MARKERS." Right end: "all 258K pins visible." If everything happens in one unbroken chunk, the middle is a frozen gray zone for 10 seconds. If broken into 52 batches of 5,000, the middle is 52 tiny work-slices with breathing room in between — the page stays responsive the whole time.

**Screen 2 — Trick #1: Batched rendering.** Explain that `renderMarkers` loops through 258K records but only creates 5,000 markers at a time, then calls `setTimeout(addBatch, 0)` to queue the next batch. That `setTimeout 0` is the trick — it says "do this next, but not right now." In between, the browser gets a turn to paint frames and handle clicks.

Show Snippet A in a code↔English translation block.

**Screen 3 — The other five tricks, pattern-cards style.** Six compact cards (one for each trick), each with name, 1-line "what it does", and 1-line "when AI should use it":

1. **Batched rendering** (recap from screen 2) — Do heavy work in small chunks and `setTimeout` between them. *Use when:* looping over 10K+ items on the main thread.
2. **Spatial index caching** — Build an expensive data structure once, reuse it on every hex recount. *Use when:* the same input is going to be asked the same question repeatedly (e.g. hover-hover-hover over a map).
3. **Canvas renderer** — Tell Leaflet `preferCanvas: true` so pins are drawn as pixels on one `<canvas>`, not as 258K separate DOM elements. *Use when:* you're drawing thousands of small graphical things.
4. **MarkerCluster library** — A third-party Leaflet plugin that lumps nearby pins into one circle-with-a-count, rendering only what's visible at the current zoom. *Use when:* the "real" data density is way higher than the screen pixel density.
5. **Debounced zoom** — When the user scroll-zooms, `zoomend` fires many times in quick succession; the app ignores all but the last (waits 300ms of quiet before re-rendering heatmap/hexbin). *Use when:* a user action can fire repeatedly and each run is expensive.
6. **Web Worker for math** — The hex-density view delegates the hex-count math to `hex-worker.js` so the main thread stays free. *Use when:* the math takes more than ~50ms.

Use the Pattern/Feature Cards layout from `references/interactive-elements.md`.

**Screen 4 — The stale-render problem and the generation counter.** This is the subtle bit. Show Snippet B (`markerRenderGen`) and explain in a code↔English block:

Scenario: The user clicks "apply filter." Renders start. They're halfway through the 52 batches when the user clicks "apply filter" *again* with different inputs. Now there are *two* batch sequences running, both writing to the same cluster groups. Chaos.

The fix is a single integer, `markerRenderGen`. Every time a new render starts, it bumps the counter and captures the current value as `myGen`. At the top of every batch, it checks: *"Am I still the newest render? If not, stop immediately."* A stale render aborts mid-way, no cleanup needed.

Callout: **"Aha! Long async work needs a stale-check."** Any time you kick off work that spans multiple ticks of the event loop, you need a way to detect that it's been superseded. A generation counter is the cheapest version of that idea.

**Screen 5 — Quiz.** 3 scenario questions about picking the right trick.

## Code Snippets (pre-extracted — do not re-read the codebase)

**Snippet A — Batched marker rendering (from strange-signals.js lines 1360-1382).** Use in the Screen 2 code↔English translation block.

```javascript
let markerRenderGen=0;
function renderMarkers(){
  const myGen=++markerRenderGen;
  const BATCH=5000;
  for(let i=0;i<3;i++){
    if(!filteredCat[i].length)continue;
    const group=createCluster(i);
    const data=filteredCat[i];
    let idx=0;
    function addBatch(){
      if(markerRenderGen!==myGen)return; // stale render — abort
      const end=Math.min(idx+BATCH,data.length);
      const batch=[];
      for(;idx<end;idx++)batch.push(createMarker(data[idx]));
      group.addLayers(batch);
      if(idx<data.length)setTimeout(addBatch,0);
    }
    addBatch();
    group.addTo(map);
    clusterGroups[i]=group;
  }
}
```

Line-by-line translation ideas:
- `let markerRenderGen=0;` — "A counter that ticks up every time a render starts. Module-level so it survives between renders."
- `const myGen=++markerRenderGen;` — "Capture *my* generation number before I start. If a new render comes in, it'll bump the counter past mine, and I'll know to bow out."
- `const BATCH=5000;` — "Do 5,000 markers per slice. Picked empirically — big enough that the loop overhead is negligible, small enough that one slice finishes in a few milliseconds."
- `if(markerRenderGen!==myGen)return;` — "Am I stale? If someone newer has started, abandon the rest of my work."
- `setTimeout(addBatch,0);` — "Queue the next batch — but not *right now*. Give the browser a turn to paint a frame and respond to any clicks before I come back."

**Snippet B — Debounced zoom re-render (from strange-signals.js lines 78-86).** Use as a short inline example when introducing Trick #5 on Screen 3, or in Screen 4's lead-in.

```javascript
let _zoomRenderTimer=null;
map.on('zoomend',()=>{
  document.getElementById('stat-zoom').textContent=map.getZoom();
  if(currentView==='heatmap'||currentView==='hexbin'){
    if(_zoomRenderTimer)clearTimeout(_zoomRenderTimer);
    _zoomRenderTimer=setTimeout(()=>{_zoomRenderTimer=null;renderCurrentView();},300);
  }
});
```

Translation ideas:
- `map.on('zoomend', ...)` — "Leaflet fires `zoomend` every time a zoom completes. Scroll-zooming fires it repeatedly — once per scroll tick."
- `if(_zoomRenderTimer) clearTimeout(_zoomRenderTimer)` — "Cancel the pending re-render. We're going to schedule a fresh one."
- `setTimeout(..., 300)` — "Wait 300ms. If no further zooms come in, fire the re-render. If another zoom *does* come in, we'll cancel this and restart the timer."

**Snippet C — Spatial index cache (from strange-signals.js lines 528-539).** Use as a short inline example on Screen 3's "Spatial index caching" card.

```javascript
function buildSpatialIndex(cellDeg){
  if(cachedSpatialIndex)return cachedSpatialIndex;
  const idx={};
  for(let cat=0;cat<3;cat++){
    filteredCat[cat].forEach(r=>{
      const key=Math.floor(r[F.LAT]/cellDeg)+','+Math.floor(r[F.LON]/cellDeg);
      (idx[key]=idx[key]||[]).push(r);
    });
  }
  cachedSpatialIndex=idx;
  return idx;
}
```

Translation ideas:
- `if(cachedSpatialIndex)return cachedSpatialIndex` — "Already built? Return the cached version. This is the whole point — don't rebuild."
- `const key = Math.floor(lat/cellDeg)+','+Math.floor(lon/cellDeg)` — "Every point lives in a grid cell. The key is `'row,column'` as a string — a cheap way to group points by location."
- `cachedSpatialIndex=idx` — "Stash the result. Next call gets it for free."

## Interactive Elements (all required)

- [x] **Code↔English translation** — Snippet A on Screen 2 (batched rendering, full translation). Snippet B briefly on Screen 3 (inline). Snippet optional on Screen 4 if space allows.
- [x] **Pattern/Feature Cards** — Screen 3, six cards (one per trick). See `references/interactive-elements.md` → Pattern/Feature Cards.
- [x] **Flow / data flow animation** — id: `flow-module4-zoom`. 5 actors across the screen: **User Scrolls**, **`zoomend` Events**, **Debounce Timer**, **Spatial Index Cache**, **Map Redraws**.
  Steps:
  1. Highlight User Scrolls. Label: "User spins the scroll wheel. Ten `zoomend` events fire in under a second."
  2. Packet User Scrolls → `zoomend` Events (repeat three times). Label: "Each tick of the wheel fires `zoomend`."
  3. Packet `zoomend` Events → Debounce Timer. Label: "Each one clears the pending timer and starts a fresh 300ms countdown."
  4. Highlight Debounce Timer. Label: "The timer survives the final event. 300ms of quiet passes."
  5. Packet Debounce Timer → Spatial Index Cache. Label: "Timer fires. Re-render asks: what points are in the visible bounds?"
  6. Highlight Spatial Index Cache. Label: "The index is already built — return it from cache. Saves ~200ms."
  7. Packet Spatial Index Cache → Map Redraws. Label: "One re-render, not ten. The user feels responsiveness, not jank."
- [x] **Multiple-choice quiz** — id: `quiz-module4`. 3 questions:
  1. *"You're building a feature where AI places 40,000 colored dots on a chart. The page freezes for 8 seconds the first time. What's the right fix to ask AI for?"*
     - A: A more powerful computer. (wrong — this is a code pattern, not a hardware problem)
     - B: Render the dots in batches of a few thousand with `setTimeout` between them so the browser can paint and respond mid-render. **(correct)**
     - C: Zoom in so only 500 dots are visible at once. (wrong — that's a workaround, not a fix; the page still freezes the first time)
     - D: Use a server. (wrong — the bottleneck is the browser's single paint thread, not any server)
  2. *"A user drags a range slider. On every tiny drag, the chart under it recomputes for 400ms, so the drag feels 'sticky.' What's the name for the fix?"*
     - A: Caching. (wrong — the input is genuinely changing; there's nothing to cache)
     - B: Debouncing — only recompute after the slider stops moving for N milliseconds. **(correct)**
     - C: Batching. (wrong — the work is already one thing; the problem is it runs too often)
     - D: Web Worker. (partial credit — would help if the 400ms is pure math, but debouncing is the cleaner first fix)
  3. *"A subtle bug: the user clicks 'filter by year: 1990-2000,' then immediately clicks 'filter by year: 2010-2020.' The map ends up showing a random mix of markers from both filters. What's the most likely cause?"*
     - A: The second filter overwrote the first but the first one's batched render was still running and kept adding old markers. **(correct — this is the stale-render problem; a generation counter would fix it)**
     - B: The filter function has a typo. (wrong)
     - C: The map is cached. (wrong — the opposite; the first render finished using stale data)
- [x] **Callout box** — "Aha! Long async work needs a stale-check." (from Screen 4 above)

## Glossary Tooltips (first use)

- **main thread** — "The one lane your browser uses to draw the page, handle clicks, run JavaScript, and animate things. If you hog it, everything freezes."
- **event loop** — "The browser's scheduler. It picks one task at a time off a queue — a click, a timer, a paint — runs it to completion, then picks the next."
- **`setTimeout`** — "A JavaScript function that means 'run this later.' `setTimeout(fn, 0)` is a trick: it means 'run this ASAP, but not right now — put it at the back of the queue so other waiting tasks get their turn.'"
- **debounce** — "A pattern: if an event fires many times in a burst, only act on the *last* one. Wait until the burst stops, then run."
- **Canvas** — "An HTML element that's essentially a blank pixel grid your JavaScript can draw on. Fast for thousands of small shapes. Compare to DOM, where each shape is a separate tagged element."
- **DOM** — "The browser's tree of HTML elements. Cheap up to a few thousand nodes; expensive past that because the browser has to track every one."
- **cache** — "A stored result of an expensive computation, keyed by its inputs. If the same inputs come in again, return the stored result instead of recomputing."
- **spatial index** — "A data structure that groups points by their location so 'find nearby points' is fast. In this app, a simple grid-cell lookup."

## Reference Files to Read

- `references/content-philosophy.md` — especially "Show Don't Tell", "Metaphors First", "Code↔English", "Quizzes That Test Application"
- `references/interactive-elements.md` → "Code ↔ English Translation Blocks", "Pattern/Feature Cards", "Message Flow / Data Flow Animation", "Multiple-Choice Quizzes", "Callout Boxes", "Glossary Tooltips"
- `references/gotchas.md` — full file

## Connections

- **Previous module:** "The Pipeline" — traced the data from raw CSVs all the way into the three arrays in memory. This module picks up from there: you've got 258K records sitting in RAM. How do they become pixels without freezing the page?
- **Next module:** "The Correlation Math" — up to now we've been about *drawing*. The next module is about *concluding*: do UFO hotspots correlate with military bases? Does it mean anything? End with something like: "Now that the map feels fast, let's do the math that makes Strange Signals more than a dot plotter."
- **Tone/style notes:**
  - Accent color is vermillion (`#D94F30`).
  - Use the Pattern/Feature Cards component (from `references/interactive-elements.md`) for Screen 3. Do NOT stretch the cards to try to hold code — cards are short-text summaries. Code lives in translation blocks.
  - This module is a little more technical than 1-3. The vibe-coder payoff is practical: these six tricks recur in almost every app AI builds, and naming them makes the learner a better steerer.

## Section wrapper

Your output file must be exactly one `<section class="module" id="module-4">...</section>` block.
