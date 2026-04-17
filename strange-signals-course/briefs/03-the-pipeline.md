# Module 3 Brief: The Pipeline — From CSV to Your Browser

## Teaching Arc
- **Metaphor:** A shipping warehouse before a holiday sale. 258,000 loose items arrive from five different suppliers in five different formats. They get cleaned, labeled, boxed efficiently, put on one truck, and delivered. The truck can't roll up to the customer's door and hand things out one at a time — so a helper on the receiving end unloads it all in the background. (NOT a restaurant, NOT a factory assembly line, NOT a writer's room.)
- **Opening hook:** "The dataset for this app is 258,000 records. A naive JSON file of those records is ~70 MB. If you downloaded that as plain JSON objects with full field names on every record, you'd wait half a minute staring at a frozen page. Strange Signals loads it in a handful of seconds — and the page *never* freezes, even during parsing. How?"
- **Key insight:** Two big ideas working together: (1) the data is packed into *compact arrays* instead of verbose objects, cutting the file size roughly in half, and (2) parsing happens in a **Web Worker** — a separate thread that does heavy work *without blocking* the UI. The main thread stays free to keep animations smooth while 258,000 records are being sorted into buckets.
- **"Why should I care?":** Any time you ask AI to load a large dataset in the browser, these two tricks are the difference between a snappy app and a frozen tab. Knowing the names "compact array format" and "Web Worker with batched postMessage" lets you *ask* for them instead of accepting whatever AI writes first.

## Output file
Write to `strange-signals-course/modules/03-the-pipeline.html`.

## Content to cover (5 screens)

**Screen 1 — The journey in one picture.** A flow diagram of the six-stop journey: Five raw CSVs → `build_sightings_workbook.py` (Python, merges them) → Excel file with 7 tabs → `export_map_data.py` (Python, writes JSON) → One big `sightings_map_data.json` → Browser `fetch()` → Web Worker → Categorized arrays in memory → Map renders. End with the punchline: "Five of those six stops happen on a developer's laptop before the app is ever shipped. Only the last two happen on yours."

**Screen 2 — The packing trick: compact arrays.** Explain the huge file-size win. Two code blocks side by side:

Verbose (what most AI would write):
```json
{ "latitude": 39.12, "longitude": -84.56, "category": "UFO/UAP", "date": "2020-01-15", "location": "Cincinnati, OH" }
```

Compact (what this app does):
```json
[39.12, -84.56, 0, "2020-01-15", "Cincinnati, OH", "triangle", "Bright light..."]
```

Callout: **"Aha! Array positions are the column names."** With 258K records, repeating `"latitude"` 258,000 times adds up to megabytes. So every record is stored as a plain list, and the code knows `position 0 = lat, position 1 = lon, position 2 = category`. The `F = {LAT:0, LON:1, ...}` cheat sheet from Module 2 is what reads them.

Show `export_map_data.py` snippet (Snippet A below) in a code↔English translation block.

**Screen 3 — The unfreeze trick: the Parse Worker.** Metaphor: the dock worker. Your main thread is the shopkeeper — they have to keep smiling at customers. You don't want the shopkeeper personally unloading a 70 MB truck. You hire a dock worker (the Web Worker), who unloads on the side, and passes finished boxes up to the counter in small batches.

Show `parse-worker.js` snippet (Snippet B below) as a code↔English translation block.

Two things the worker does:
1. **Validates and categorizes in one pass** — throws out any record with a bad lat/lon or a category outside 0-2, and groups the rest into three lists.
2. **Ships results back in 5,000-record batches** — using small `postMessage` chunks. Each chunk is small enough that copying it across the thread boundary (a process called "structured clone") doesn't hiccup the UI.

**Screen 4 — The main thread's job: just receive and render.** Short screen. Once the worker starts sending batches, the main thread's job is tiny: append each batch to the right bucket (`catArrays[0]`, `catArrays[1]`, `catArrays[2]`) and update the progress bar. The heavy lifting already happened. Visual: a three-lane swimming pool filling up with pins as batches arrive.

**Screen 5 — Quiz.** 3 questions, scenario-style.

## Code Snippets (pre-extracted — do not re-read the codebase)

**Snippet A — Compact record building in Python (from export_map_data.py lines 62-79).** Use on Screen 2.

```python
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

output = {
    "categories": ["UFO/UAP", "Bigfoot/Sasquatch", "Haunted Place"],
    "fields": ["lat", "lon", "cat", "date", "location", "subcategory", "description"],
    "data": records,
}
```

Translation ideas:
- `records = []` — "Start with an empty list. We'll build up every sighting into it."
- `for r in df.itertuples(index=False):` — "Walk every row of the cleaned spreadsheet, one at a time."
- `records.append([ float(r.latitude), float(r.longitude), int(r.cat), ... ])` — "For each row, throw away the column names and just keep the values in a fixed order: latitude first, longitude second, category code third, date fourth..."
- `output = { "categories": [...], "fields": [...], "data": records }` — "Wrap the big list in a tiny header that tells the browser *what each position means*. This is the 'key' — `fields[0] is 'lat'`, so `data[i][0]` is the latitude of record i."

**Snippet B — The Parse Worker (all of parse-worker.js).** Use on Screen 3.

```javascript
// Web Worker: decode, parse, validate, categorize — all off main thread.
// Sends results back in small batches so the main thread never blocks on structured clone.
self.onmessage=function(e){
  try{
    const text=new TextDecoder().decode(e.data);
    const json=JSON.parse(text);
    const raw=json.data;
    if(!Array.isArray(raw)||!raw.length){
      self.postMessage({type:'error',error:'Invalid or empty data'});
      return;
    }
    // Filter + categorize in one pass
    const cats=[[],[],[]];
    for(let i=0;i<raw.length;i++){
      const r=raw[i];
      if(!Array.isArray(r)||r.length<7)continue;
      if(typeof r[0]!=='number'||isNaN(r[0]))continue;
      if(typeof r[1]!=='number'||isNaN(r[1]))continue;
      if(r[2]<0||r[2]>2)continue;
      cats[r[2]].push(r);
    }
    const total=cats[0].length+cats[1].length+cats[2].length;
    // Send back in small batches to avoid structured clone blocking main thread
    const BATCH=5000;
    for(let cat=0;cat<3;cat++){
      for(let i=0;i<cats[cat].length;i+=BATCH){
        self.postMessage({type:'batch',cat:cat,records:cats[cat].slice(i,i+BATCH)});
      }
    }
    self.postMessage({type:'done',total:total});
  }catch(err){
    self.postMessage({type:'error',error:err.message});
  }
};
```

Translation ideas — don't translate every single line, just the key moments:
- `self.onmessage=function(e){` — "This worker waits for the main thread to hand it a file. When that happens, this function runs."
- `const text = new TextDecoder().decode(e.data); const json = JSON.parse(text);` — "Turn the raw bytes into text, then turn the text into a JavaScript object."
- `const cats=[[],[],[]];` — "Three empty buckets, one per category."
- `for(let i=0; i<raw.length; i++){ ... cats[r[2]].push(r); }` — "Walk every record. Skip broken ones. Drop the rest into the bucket named by its category code."
- `const BATCH=5000;` — "Ship results back in chunks of 5,000."
- `self.postMessage({type:'batch', cat:cat, records:...})` — "Send this chunk to the main thread. The main thread will handle it in a split-second, then be free again."
- `self.postMessage({type:'done', total:total})` — "All done. Here's the final tally."

## Interactive Elements (all required)

- [x] **Code↔English translation** — Two blocks. Snippet A on Screen 2 (the Python packing), Snippet B on Screen 3 (the worker).
- [x] **Flow / data flow animation** — id: `flow-module3-journey`. Six actors:
  - **Five Raw CSVs** (GitHub / external sites)
  - **Python Scripts** (developer's laptop)
  - **One Big JSON File** (`sightings_map_data.json`)
  - **Browser Fetch** (you, loading the page)
  - **Parse Worker** (background thread)
  - **Main Thread** (your map)
  Steps (8 total):
  1. Highlight Five Raw CSVs. Label: "NUFORC, BFRO, Shadowlands, and two others — each in a different CSV format."
  2. Packet Five Raw CSVs → Python Scripts. Label: "The developer runs `bash setup_sightings.sh`. Python downloads them all."
  3. Highlight Python Scripts. Label: "Python merges, cleans, and dedupes — 258,000 survivors."
  4. Packet Python Scripts → One Big JSON File. Label: "Written as compact arrays — `[lat, lon, cat, date, ...]` — no field names per record."
  5. Packet One Big JSON File → Browser Fetch. Label: "You open the page. Browser downloads the single JSON file."
  6. Packet Browser Fetch → Parse Worker. Label: "Main thread hands raw bytes to the worker. Hands are free again."
  7. Highlight Parse Worker. Label: "Worker decodes, validates, categorizes into three buckets."
  8. Packet Parse Worker → Main Thread. Label: "Ships results in 5,000-record batches. Main thread stays responsive the whole time."
- [x] **Multiple-choice quiz** — id: `quiz-module3`. 3 questions:
  1. *"You ask AI to load a 50 MB JSON file of product listings into your e-commerce site. It writes `const data = await fetch(url).then(r => r.json());` on the main thread. What's the risk?"*
     - A: The browser will run out of memory. (wrong — 50 MB is fine for memory)
     - B: Parsing a file that big on the main thread will freeze the UI for a second or two. **(correct — this is the worker lesson)**
     - C: The file will be corrupted. (wrong)
  2. *"Why does the JSON file store records as `[39.12, -84.56, 0, ...]` instead of `{lat: 39.12, lon: -84.56, cat: 0, ...}`?"*
     - A: It's faster to parse. (partially true, but not the main reason)
     - B: It's smaller on disk and over the wire — field names aren't repeated 258,000 times. **(correct)**
     - C: Objects with keys don't work in JSON. (wrong — they do)
  3. *"The parse worker validates `if (r[2] < 0 || r[2] > 2) continue;` — what does this actually guard against?"*
     - A: Records with a category code that's not 0 (UFO), 1 (Bigfoot), or 2 (Haunted) get silently dropped. **(correct — defensive programming)**
     - B: Records from outside the US. (wrong)
     - C: Duplicate records. (wrong — dedupe happens earlier, in Python)
- [x] **Callout box** — "Aha! Array positions are the column names." (on Screen 2)
- [x] Optional: **Pattern cards** on Screen 4 or 5 — "Two tricks every big-data browser app should use" with two cards: "Compact array format" and "Web Worker + batched postMessage."

## Glossary Tooltips (first use)

- **thread** (*remind only — defined in Module 2*) — no tooltip needed
- **Web Worker** (*remind only — defined in Module 1*) — light tooltip acceptable: "A background thread in your browser. Module 2 introduced them; here's one in action."
- **postMessage** — "The only way a Web Worker and the main thread can talk. They can't share variables — they shove data back and forth with postMessage."
- **structured clone** — "The browser's process for deep-copying data from one thread to another. It's fast, but very large copies can still pause things — which is why this app sends 5,000-record chunks instead of one giant blob."
- **main thread** — "The single thread that draws your page, handles clicks, and runs most JavaScript. If it gets busy, the whole UI freezes."
- **fetch** — "The browser's built-in way to download a file from a URL. `fetch(url)` returns a promise that resolves when the file arrives."
- **promise** — "A 'I'll get back to you later' placeholder in JavaScript. Used for anything that doesn't happen instantly — downloads, timeouts, API calls."
- **pandas** / **DataFrame** — "Pandas is a Python library for working with tables of data. A DataFrame is its table type — rows, columns, a bit like a spreadsheet in memory."
- **vectorized** — "Doing an operation on a whole column at once instead of one row at a time. Much faster in pandas."
- **bytes** — "Raw file content before it's been interpreted as text. A fetched file arrives as bytes; `TextDecoder` turns them into a string."
- **dedupe** — "Deduplicate — remove duplicate records. Five overlapping datasets combined without deduping would double-count thousands of sightings."

## Reference Files to Read

- `references/content-philosophy.md` — especially "Code↔English Translations", "Metaphors First", "Glossary Tooltips"
- `references/interactive-elements.md` → "Code ↔ English Translation Blocks", "Message Flow / Data Flow Animation", "Multiple-Choice Quizzes", "Callout Boxes", "Pattern/Feature Cards", "Glossary Tooltips"
- `references/gotchas.md` — full file; especially the **single-quote-in-flow-labels** warning. Replace every apostrophe in flow step labels with `&apos;` or rephrase.

## Connections

- **Previous module:** "Meet the Cast" — introduced the files and the `window.StrangeSignals` handshake.
- **Next module:** "Rendering 258K Pins Fast" — we just delivered 258,000 records into browser memory. Now we have to *draw* them without the user waiting. Module 4 is the rendering tricks. End with: "The pins are in memory. Drawing all of them at once on a map would crash a mid-range laptop. Here's how the app gets away with it."
- **Tone/style notes:**
  - Vermillion accent (`#D94F30`).
  - "Parse Worker" and "Main Thread" and "Hex Worker" are capitalized roles.
  - This is the module where the warehouse/shipping metaphor is introduced — don't reuse it in later modules.

## Section wrapper

Your output file must be exactly one `<section class="module" id="module-3">...</section>` block.
