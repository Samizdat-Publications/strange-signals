# Module 2 Brief: Meet the Cast

## Teaching Arc
- **Metaphor:** A TV show writer's room. Each writer has a specific job — one writes the witty lines, one plots the mystery, one handles the special effects — but an episode only works when they collaborate. Strange Signals' files are the same. (NOT a restaurant. NOT a factory. Module 3 uses the factory/assembly-line metaphor, so don't use that here either.)
- **Opening hook:** "You open the project folder. There are 9 JavaScript files, 11 Python files, 3 CSS files, and a bunch of JSON. Nobody tells you which one *runs first*. So who's the main character?"
- **Key insight:** In a zero-build web app, every script is loaded by one HTML file and lives in the same global playground. They talk to each other by putting their public functions on `window`. There's no import/export system — just conventions.
- **"Why should I care?":** When you tell AI "add a new feature to the AI assistant," you need to know which file to point it at. When something breaks in the middle of a zoom, you need to know whether to look at the map file, the worker, or the CSS. This module gives you the actor names.

## Output file
Write to `strange-signals-course/modules/02-meet-the-cast.html`.

## Content to cover (5 screens)

**Screen 1 — The problem of finding the main character.** Hook paragraph. Then a visual file tree of the project root, with the big players annotated:
```
strange-signals/
├── index.html              ← the director. Loads everyone else.
├── strange-signals.js      ← the lead actor. 3,061 lines. The map lives here.
├── strange-signals.css     ← wardrobe.
├── parse-worker.js         ← the stage hand. Runs off-screen so the show doesn't freeze.
├── hex-worker.js           ← the mathematician. Also off-screen.
├── ai-assistant.js         ← SIGNAL. Talks to Claude. Drives the map on command.
├── signal-reports.js       ← the writer who turns findings into HTML reports.
├── signal-charts.js        ← the inline chart artist.
├── annotations.js          ← the user's pin-notes.
├── window-manager.js       ← the floating panels.
├── data/sightings_map_data.json  ← the script. What everyone's reading from.
└── build_*.py              ← the prep crew. Python. They never run in the browser.
```
(Visual file tree format, use `references/interactive-elements.md` → Visual File Tree section.)

**Screen 2 — The cast of characters, six main actors.** Use icon-label rows or pattern cards. Each actor gets:
- A name (match the file tree above)
- A one-line "role"
- A color badge

The six:
1. **index.html** — *The director.* Loads every other script in order. Has the nav bar, sidebar, loading screen.
2. **strange-signals.js** — *The lead.* Holds all the state (`allData`, `filteredCat`, `currentView`), runs the map, handles clicks. Everything flows through here.
3. **parse-worker.js** — *The data receiver.* A separate thread. Gets the raw JSON, validates it, groups records by category, ships batches back.
4. **hex-worker.js** — *The math thread.* Another separate thread. Counts points inside hexagons for the hex density view.
5. **ai-assistant.js** — *The agent.* Talks to Claude's API directly from the browser. Reads user messages, picks tools, executes them against the map.
6. **build_*.py** — *The offline prep crew.* Python scripts that run on a developer's laptop before anything is shipped. They build the JSON files.

**Screen 3 — How they talk: the `window.StrangeSignals` trick.** Explain the IIFE pattern and the public API. This is the most important architectural idea in the codebase.

Use a two-step visual:
- **Inside** `strange-signals.js`: everything is wrapped in `(function(){ ... })()` — a bubble. Variables like `allData` are trapped inside.
- **To let other files see some things**, they get stuck onto `window.StrangeSignals` at the end. Other files then call `SS.setView('heatmap')` instead of touching anything directly.

Show the code below in a code↔English translation block.

Callout: **"Aha! This is how files communicate without imports."** In modern web apps, files use `import`/`export` syntax. Zero-build apps like this one use a shared `window` object instead — it's older and simpler, but every script shares one giant namespace.

**Screen 4 — Drag-and-drop: "which file does this job?"** A matching game. Five chips, five zones. Force the learner to match behavior to actor.

**Screen 5 — Quiz.** 3 questions, architecture/scenario style.

## Code Snippets (pre-extracted — do not re-read the codebase)

**Snippet A — The IIFE wrapping the main app (from strange-signals.js lines 1-14).** Use in the Screen 3 code↔English translation block.

```javascript
(function(){
'use strict';

/* ========== CONSTANTS ========== */
const CAT_COLORS = ['#00ff88','#ff6622','#aa44ff'];
const CAT_NAMES = ['UFO/UAP','Bigfoot/Sasquatch','Haunted Place'];
const CAT_RGB = ['0,255,136','255,102,34','170,68,255'];
const F={LAT:0,LON:1,CAT:2,DATE:3,LOC:4,SUB:5,DESC:6};

/* ========== STATE ========== */
let allData=[], catArrays=[[],[],[]];
let filteredCat=[[],[],[]];
let currentView='markers';
```

Line-by-line translation ideas:
- `(function(){` — "Start a private bubble. Everything inside this bubble is invisible to the rest of the page."
- `'use strict';` — "Turn on the stricter version of JavaScript — catches typos that would otherwise silently misbehave."
- `const CAT_COLORS = [...]` — "These three colors are the whole visual identity: green for UFO, orange for Bigfoot, purple for Haunted."
- `const F = {LAT:0, LON:1, ...}` — "A cheat sheet. Records are stored as plain arrays (not objects), so `F.LAT` is just the number `0` — the first position in the array."
- `let allData=[]` — "An empty list waiting to be filled with every sighting. 258,000 of them."
- `let currentView='markers'` — "Right now the user is looking at the markers view. This gets flipped when they click a nav button."

**Snippet B — Public API exposure (from strange-signals.js lines 2820-2840).** Use in the Screen 3 translation block, paired with Snippet A.

```javascript
/* ========== PUBLIC API (for AI assistant) ========== */
window.StrangeSignals={
  // Map
  getMap:()=>map,
  setView:setView,

  // Filters
  applyFilters:applyFilters,
  setFilterValues:(opts)=>{
    if(opts.yearFrom!=null)document.getElementById('year-from').value=opts.yearFrom;
    if(opts.yearTo!=null)document.getElementById('year-to').value=opts.yearTo;
    if(opts.state!=null)document.getElementById('state-filter').value=opts.state;
    ...
```

Translation ideas:
- `window.StrangeSignals = { ... }` — "Open the bubble to the outside world — but only these specific things."
- `getMap: ()=>map` — "Give anyone who asks a reference to the Leaflet map object."
- `setView: setView` — "Expose the function that switches between markers/heatmap/hex/correlation."
- This is the handshake. The AI assistant calls `SS.setView('hexbin')` and the map changes. No imports needed.

## Interactive Elements (all required)

- [x] **Code↔English translation** — Snippets A and B. Two translation blocks, one after the other, with a short paragraph in between explaining that "B is the only way anyone outside the bubble can touch anything inside the bubble."
- [x] **Visual file tree** — from Screen 1. See `references/interactive-elements.md` → Visual File Tree. Annotate at least the 8 files listed above.
- [x] **Drag-and-drop matching** — id prefix: `dnd-module2`. Five chips, five zones:
  - Chips: `index.html`, `strange-signals.js`, `parse-worker.js`, `hex-worker.js`, `ai-assistant.js`
  - Zones (descriptions):
    - "Holds the list of 258,000 sightings in memory" → strange-signals.js
    - "Runs in a background thread so parsing doesn't freeze the page" → parse-worker.js
    - "Counts points inside hexagons without blocking the UI" → hex-worker.js
    - "Sends messages to Claude and executes the tools Claude picks" → ai-assistant.js
    - "The very first file the browser loads — wires all the others together" → index.html
- [x] **Multiple-choice quiz** — id: `quiz-module2`. 3 questions:
  1. *"You ask AI to 'make the 'bigfoot' layer pulsate when it's selected.' Which file is the right place to send AI to?"*
     - A: `index.html` (wrong — structure, not behavior)
     - B: `strange-signals.css` (wrong — this is behavior over time, not just styling)
     - C: `strange-signals.js` (correct — layer logic and state live in the lead file)
     - D: `parse-worker.js` (wrong — the worker doesn't know anything about visuals)
  2. *"You open the browser console and type `StrangeSignals.setView('heatmap')`. The view changes. What does that prove about the app?"*
     - A: That the view logic is actually open to the outside world via `window.StrangeSignals`. **(correct)**
     - B: That console commands are privileged and bypass the bubble. (wrong — it's the public API doing the work)
     - C: That there's a hidden backend endpoint. (wrong — no backend)
  3. *"A bug: when the AI tries to apply a year filter, nothing happens. Where would you look first?"*
     - A: The `setFilterValues` function exposed on `window.StrangeSignals` — is it actually being called? **(correct — that's the handshake point)**
     - B: The Python pipeline. (wrong — pipeline already ran)
     - C: The CSS file. (wrong)
- [x] **Callout box** — "Aha! This is how files communicate without imports." (from Screen 3 above)

## Glossary Tooltips (first use)

- **IIFE** — "Immediately-Invoked Function Expression. A function that runs the instant it's defined. Used here to create a private bubble so variables don't leak into the global page."
- **global namespace** — "The shared pool of names that every script on a page can see. In this app, all scripts write their public stuff to `window.*` — one shared whiteboard."
- **thread** — "A single lane of execution. Your browser's main thread draws the page and handles clicks. A *worker* thread runs in parallel — good for heavy math that would otherwise freeze the UI."
- **state** — "The app's current memory: what's loaded, what's selected, what filters are on. When state changes, the map re-renders."
- **Leaflet** — "A JavaScript library for interactive maps. It handles the map tiles, zoom, pan, and pin drawing. Strange Signals builds on top of it."
- **namespace** — "A container for names so they don't collide. `window.StrangeSignals` is a namespace — all the map's public functions live inside it instead of on the bare `window`."
- **import/export** — "The modern way JavaScript files share code — one file says `export foo`, another says `import { foo } from './file.js'`. This app doesn't use them; it uses the shared `window` object instead."

## Reference Files to Read

- `references/content-philosophy.md` — especially "Metaphors First", "Show Don't Tell", "Glossary Tooltips"
- `references/interactive-elements.md` → "Code ↔ English Translation Blocks", "Visual File Tree", "Drag-and-Drop Matching", "Icon-Label Rows" or "Pattern/Feature Cards", "Multiple-Choice Quizzes", "Callout Boxes", "Glossary Tooltips"
- `references/gotchas.md` — full file

## Connections

- **Previous module:** "The Scene" — established that the app is a pipeline with no backend and that the browser is the last step. This module zooms into the browser and names the files that make it work.
- **Next module:** "The Pipeline — From CSV to Your Browser" — traces the data's journey from raw CSVs through Python into the compact JSON into parse-worker into the arrays we just met. End with something like: "Now that you know who the cast is, let's watch them do the opening scene: loading 258,000 records without freezing the page."
- **Tone/style notes:**
  - Accent color is vermillion (`#D94F30`).
  - Actor naming is Capitalized ("Parse Worker", "Hex Worker", "AI Assistant") — not full file paths in prose.
  - Don't re-explain terms already defined in Module 1 (JSON, CSV, backend, static file, Web Worker, pipeline) — but you *may* briefly remind the reader.

## Section wrapper

Your output file must be exactly one `<section class="module" id="module-2">...</section>` block.
