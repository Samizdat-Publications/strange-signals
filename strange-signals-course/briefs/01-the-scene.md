# Module 1 Brief: The Scene

## Teaching Arc
- **Metaphor:** A detective's evidence board — pushpins all over a map, colored strings connecting them, the detective standing back and finally seeing the pattern. (NOT a restaurant. Do not reuse this metaphor in later modules.)
- **Opening hook:** Open with the moment of using the app: "You open Strange Signals. A radar spins. The loading bar fills. Then 258,000 pushpins drop onto a dark map of the United States. You click a green cluster in Washington state — 3,536 UFO sightings live inside that one shape. How did 258,000 records from five different websites end up clickable on your laptop?"
- **Key insight:** Strange Signals is not one program — it's a **pipeline** of small programs that each do one job. The map you see is the *last* step. Everything before it is prep work that happened on someone else's computer, saved as a file, and shipped to your browser.
- **"Why should I care?":** Because when you ask AI to build a "data app," you need to know the difference between *pre-computed* data (fast, cheap, limited) and *live* data (slow, expensive, flexible). This app made a deliberate choice, and knowing why helps you make that same call.

## Output file
Write to `strange-signals-course/modules/01-the-scene.html`.

## Content to cover (5 screens)

**Screen 1 — The moment of use.** Open with the hook. A hero visual: a dark map fragment with clustered colored pins. One paragraph. That's it.

**Screen 2 — What this thing actually does.** Three things, as icon-label rows or pattern cards:
1. Shows 258K paranormal sighting reports on an interactive map of the USA
2. Lets you overlay "real-world" things nearby (military bases, earthquakes, caves)
3. Has an AI assistant named SIGNAL that can drive the map for you

**Screen 3 — The four ways to see the data.** The top nav has four buttons: MARKERS, HEATMAP, HEX DENSITY, CORRELATION. Show these as four small cards with a one-line description each. Use the actual HTML nav code below as a code↔English translation block.

**Screen 4 — The big idea: it's a pipeline.** Use a simple flow diagram showing: Raw CSVs from the internet → Python scripts → One big JSON file → Your browser loads it → Map. The point: the expensive work already happened, before you opened the tab. You're not hitting a server — you're loading a pre-built file. Use a callout: **"Aha! The app has no backend."** There is no server computing anything in real time. That's why it's fast and free to run, and why new datasets require a rebuild.

**Screen 5 — Quiz.** 3 questions, scenario style.

## Code Snippets (pre-extracted — do not re-read the codebase)

**Snippet A — The four views (from index.html lines 54-59).** Use in a code↔English translation block on Screen 3.

```html
<nav class="header-nav">
  <button class="nav-btn active" data-view="markers">MARKERS</button>
  <button class="nav-btn" data-view="heatmap">HEATMAP</button>
  <button class="nav-btn" data-view="hexbin">HEX DENSITY</button>
  <button class="nav-btn" data-view="correlation">CORRELATION</button>
</nav>
```

Translation ideas, line by line:
- `<nav class="header-nav">` → "This is the bar of buttons across the top of the app."
- `<button ... data-view="markers">MARKERS</button>` → "A button labeled MARKERS. The `data-view` tag is a little note stuck on the button so the JavaScript knows which view to switch to when it's clicked."
- `data-view="heatmap"` etc → "Same idea — each button carries the name of its view as a label."
- `class="nav-btn active"` → "The `active` word means this is the one currently selected — it'll look highlighted."

**Snippet B — The three sighting categories (from strange-signals.js lines 5-8).** Use as a short inline code block to ground the "three categories" point.

```javascript
const CAT_COLORS = ['#00ff88','#ff6622','#aa44ff'];
const CAT_NAMES = ['UFO/UAP','Bigfoot/Sasquatch','Haunted Place'];
const CAT_RGB = ['0,255,136','255,102,34','170,68,255'];
const F = {LAT:0, LON:1, CAT:2, DATE:3, LOC:4, SUB:5, DESC:6};
```

This gets referenced again in Module 3 (the compact array format is `F`). For Module 1, just show it and point out: "Three categories, three colors. Green = UFO, orange = Bigfoot, purple = Haunted. The whole app is built around these three lists."

## Interactive Elements (all required)

- [x] **Code↔English translation** — Snippet A, the four-view nav.
- [x] **Group chat animation** — id: `chat-module1`. Four actors: **Markers**, **Heatmap**, **Hex**, **Correlation**, arguing about how to best show "the same 258K points." Suggested messages (6-8 total):
  - Markers: "Let me draw one pin per sighting. Every report gets its own click."
  - Heatmap: "You'll melt the user's laptop. I can blur it all into hot/cold zones instead."
  - Hex: "Neither of you answers the real question: *how many sightings per X square kilometers?* That's my job — I count them into honeycomb tiles."
  - Correlation: "All three of you are just drawing. I do the *math* — whether UFO hotspots line up with military bases."
  - Markers: "Fine, we each get a button in the top nav. User picks."
  - Correlation: "Deal. But when the user asks a real question, they'll come to me."
- [x] **Flow / data flow animation** — id: `flow-module1-pipeline`. 5 actors across the screen: **Raw CSVs**, **Python Scripts**, **One Big JSON File**, **Your Browser**, **Map View**. Steps:
  1. Highlight Raw CSVs. Label: "5 public datasets live on GitHub — NUFORC, BFRO, Shadowlands, etc."
  2. Packet Raw CSVs → Python Scripts. Label: "Python downloads them all, strips out junk rows, merges them."
  3. Highlight Python Scripts. Label: "Then squishes 258,000 records into one compact JSON file."
  4. Packet Python Scripts → One Big JSON File. Label: "The file gets saved to disk. This is the expensive part — and it only runs once."
  5. Packet One Big JSON File → Your Browser. Label: "Your browser downloads that single file."
  6. Highlight Your Browser. Label: "A Web Worker parses it off the main thread so the page stays responsive."
  7. Packet Your Browser → Map View. Label: "And the map renders 258K pins."
- [x] **Multiple-choice quiz** — id: `quiz-module1`. 3 questions:
  1. *"You open Strange Signals on a new laptop at 2am. Your wifi is off. The map still loads and you can click pins. What does that tell you about how the app works?"*
     - A: The app is cached from your last visit. **(wrong — explain: caching is possible but that's not the architecture lesson)**
     - B: The map data was downloaded as a single file when the page first loaded — no further network calls are needed to browse. **(correct — explain: static app, no backend)**
     - C: Your browser talks to a database on the server. **(wrong — explain: there is no server)**
  2. *"You want to add a 20,000-record dataset of Loch Ness sightings. What kind of work is that?"*
     - A: Add a new button in the UI. **(wrong — that's only the very last step)**
     - B: Run the Python pipeline with a new data source, rebuild the JSON, then update the UI. **(correct — pre-computed data means changes require a rebuild)**
     - C: Deploy a new API endpoint. **(wrong — there's no API)**
  3. *"A user says the correlation view 'isn't working.' You know nothing else. Which tab would you check first in your browser's dev tools?"*
     - A: Network tab — maybe the big JSON file failed to download. **(correct — every feature depends on that one file)**
     - B: The database logs. **(wrong — there's no database)**
     - C: The server error page. **(wrong — no server)**
- [x] **Callout box** — "Aha! The app has no backend." Explain: the JSON file is pre-computed on someone's laptop, committed to disk, and served as a static file. Every feature — filters, correlations, the AI — runs on *your* computer. No server costs. No API downtime. But also: no live data, and every dataset update requires rebuilding and re-publishing the JSON.

## Glossary Tooltips (first use)

Tooltip ALL of these on first appearance:
- **JSON** — "A text format for storing structured data. Think of it as a way to write down a list of records so any computer can read them. The whole dataset is one .json file."
- **backend** — "A server that runs code and talks to a database. Strange Signals doesn't have one — everything happens in your browser."
- **static file** — "A file that just sits on disk waiting to be downloaded, unchanged. Like a PDF or an image. Opposite of a dynamic page where the server builds it fresh every time."
- **Web Worker** — "A separate thread inside your browser that can do heavy work without freezing the UI. Module 3 covers this in depth — just tooltip it here."
- **cluster** — "On this map, a clump of pins that have been visually grouped into one circle with a count, because they're too close to show separately."
- **dataset** — "A collection of records — rows of data. Five different datasets get merged into one here."
- **CSV** — "Comma-Separated Values. A plain-text spreadsheet: one row per line, columns separated by commas. The raw datasets ship as CSVs."
- **pipeline** — "A sequence of steps where the output of one step becomes the input of the next. Strange Signals' data goes through six or seven pipeline stages before it reaches your screen."

## Reference Files to Read

- `references/content-philosophy.md` — read all sections, especially "Show Don't Tell", "Code↔English", "Glossary Tooltips", "Quizzes That Test Application"
- `references/interactive-elements.md` — "Code ↔ English Translation Blocks", "Group Chat Animation", "Message Flow / Data Flow Animation", "Multiple-Choice Quizzes", "Callout Boxes", "Pattern/Feature Cards", "Icon-Label Rows", "Glossary Tooltips"
- `references/gotchas.md` — full file
- `references/design-system.md` — skim for accent color usage

## Connections

- **Previous module:** None (this is the opener). The very first thing after the `<section>` opening should orient the reader: what this course is, who it's for, and what they'll walk away with.
- **Next module:** "Meet the Cast" — we just said the app is a pipeline of small programs. Module 2 introduces the actual files and what each one does. End with something like: "Now let's meet the individual characters who make this show run."
- **Tone/style notes:**
  - Accent color is vermillion (`#D94F30`).
  - When naming actors in chats/flows, use Capitalized Role Names ("Markers", "Heatmap", "Python Scripts") — keep that convention across modules.
  - Never assume the reader has seen the app. Describe what they'd see.
  - Speak to a "vibe coder" — someone who builds with AI but doesn't read code.

## Section wrapper

Your output file must be exactly one `<section class="module" id="module-1">...</section>` block. No `<html>`, `<head>`, `<body>`, `<style>`, or `<script>` tags.
