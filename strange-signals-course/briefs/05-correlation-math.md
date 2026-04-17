# Module 5 Brief: The Correlation Math

## Teaching Arc
- **Metaphor:** A courtroom. The prosecution shows the jury a dramatic chart — "UFO sightings go up, military spending goes up, they must be connected!" The defense stands up and asks one question: "*Could this pattern happen by pure random chance?*" If the answer is "yeah, pretty often," the case falls apart. That question is what a p-value answers. (NOT a restaurant. NOT a factory. NOT a writer's room. NOT a stage magician.)
- **Opening hook:** "You zoom into the correlation view and see it: a Pearson r of 0.71 between UFO hotspots and military bases. The number feels huge. *It must mean something.* Before you post the screenshot to Reddit, Strange Signals shuffles the data 999 times, recomputes the correlation on each scramble, and asks: 'How often does a r≥0.71 happen by pure dumb luck?' If the answer is 'less than 1 in 1000,' you've got something. If it's '1 in 5,' you've got a coincidence. This module is the math that separates the two."
- **Key insight:** A correlation number *by itself* is a news headline — dramatic, easy, often wrong. A correlation *with a p-value from permutation testing* is evidence — you've stress-tested it against chance. Every correlation in Strange Signals has both numbers attached, on purpose.
- **"Why should I care?":** When AI builds you a dashboard and it says "X and Y are correlated r=0.6!" — that's the news headline version. If you can ask AI "run a permutation test on that — give me a p-value," you instantly move from storytelling to science. This is one of the cheapest superpowers in data work.

## Output file
Write to `strange-signals-course/modules/05-correlation-math.html`.

## Content to cover (5 screens)

**Screen 1 — The question the app is really answering.** Hook paragraph. Then a short framing: we have three categories of sightings (UFO, Bigfoot, Haunted) and a dozen overlay datasets (military bases, earthquakes, caves, etc). The question is never "are there UFO hotspots?" — you can see that on the markers map. The question is always comparative: **"Is there a suspicious overlap between UFO hotspots and *some other thing*?"** That comparison is what correlation measures.

**Screen 2 — Step 1: Turn a map into two lists of numbers.** You can't correlate pins directly — correlation works on pairs of numbers. Strange Signals converts the map into a hex grid (Turf.js builds honeycomb tiles), then counts how many sightings of each category land in each hex. Two categories → two parallel lists of counts → one list per hex.

Use a small ASCII / visual diagram:
```
Hex #1:  [ 12 UFO, 0 Bigfoot ]
Hex #2:  [ 3 UFO,  8 Bigfoot ]
Hex #3:  [ 0 UFO,  0 Bigfoot ]
...
Hex #N:  [ 5 UFO,  2 Bigfoot ]
```
From this, build two parallel arrays: `xArr = [12, 3, 0, ..., 5]` and `yArr = [0, 8, 0, ..., 2]`. That's the raw material for correlation.

Callout: **"Aha! Spatial correlation is just two parallel lists."** The map is for humans; the math only needs numbers in rows. Every correlation feature in the app ultimately boils down to "build two arrays the same length, then compute one number."

**Screen 3 — Step 2: Pearson r, the correlation number.** Show Snippet A (`pearsonR`) in a code↔English translation block. Keep the explanation geometric: r asks "when X is above its average, is Y also above its average?" If yes across the board, r approaches +1. If it's the opposite pattern (X up, Y down), r approaches −1. If there's no pattern, r hovers near 0.

Don't dwell on the formula — dwell on the *interpretation*. Quick scale:
- r ≈ 0.0 to 0.2 — "essentially unrelated"
- r ≈ 0.2 to 0.5 — "weak-to-moderate link — don't bet the farm"
- r ≈ 0.5 to 0.8 — "meaningful co-movement"
- r ≈ 0.8+ — "suspiciously tight — go look for a cause"

**Screen 4 — Step 3: The permutation p-value.** This is the module's centerpiece.

Show Snippet B (`permutationPValue`) in a code↔English translation block.

The intuition: imagine writing every Y value on an index card. Shuffle them. Now the Xs and Ys have no relationship at all — Y is in a random order. Compute r again on this scrambled pair. Save it. Shuffle again, recompute, save. Do this 999 times. You've built a histogram of "correlations that happen by pure chance."

Now compare your *observed* r to that histogram. If it sits way out in the tail (only 5 of the 999 shuffles beat it), your observed r is extreme — p ≈ 0.006. If half the shuffles beat it, your observed r is perfectly ordinary — p ≈ 0.5, meaning "this could easily be luck."

Show the significance-stars scale:
- `p < 0.001` — `***` — "would happen by chance less than 1 in 1000 times"
- `p < 0.01` — `**` — "less than 1 in 100"
- `p < 0.05` — `*` — "less than 1 in 20; the conventional bar for 'publishable'"
- `p ≥ 0.05` — `n.s.` ("not significant") — "could be coincidence; proceed with caution"

Callout: **"Aha! Scrambling is the null hypothesis made concrete."** Instead of deriving a p-value from a formula, you *simulate* what chance looks like. If you can shuffle one array 999 times, you never need to open a statistics textbook again.

**Screen 5 — Quiz.** 3 scenarios.

## Code Snippets (pre-extracted — do not re-read the codebase)

**Snippet A — Pearson correlation coefficient (from strange-signals.js lines 487-498).** Use in Screen 3's code↔English translation block.

```javascript
function pearsonR(xArr,yArr){
  const n=xArr.length;
  if(n<5)return NaN;
  const mx=d3.mean(xArr),my=d3.mean(yArr);
  let num=0,dx2=0,dy2=0;
  for(let i=0;i<n;i++){
    const dx=xArr[i]-mx,dy=yArr[i]-my;
    num+=dx*dy;dx2+=dx*dx;dy2+=dy*dy;
  }
  const den=Math.sqrt(dx2*dy2);
  return den>0?num/den:NaN;
}
```

Line-by-line translation ideas:
- `if(n<5)return NaN;` — "Refuse to answer if we have fewer than 5 data points. Any correlation on 4 points is noise."
- `const mx=d3.mean(xArr), my=d3.mean(yArr);` — "Compute the average of each list. Correlation is about deviations *from* the average, not raw values."
- `const dx=xArr[i]-mx, dy=yArr[i]-my;` — "How far above or below its average is this X? Same for Y."
- `num+=dx*dy` — "Multiply the two deviations. If both are positive (both above average) or both negative (both below), this adds a positive number to `num`. If they disagree in sign, it subtracts. This is the heart of the formula."
- `den=Math.sqrt(dx2*dy2)` — "Normalize by how spread out each list is, so the answer lives between −1 and +1 no matter the scale."
- `return den>0?num/den:NaN` — "If one of the lists has zero variation (all the same value), correlation is undefined — return NaN."

**Snippet B — Permutation p-value (from strange-signals.js lines 500-514).** Use in Screen 4's code↔English translation block.

```javascript
function permutationPValue(xArr,yArr,observedR,nPerms){
  nPerms=nPerms||999;
  if(xArr.length<5||isNaN(observedR))return 1;
  let extremeCount=0;
  const yCopy=yArr.slice();
  for(let p=0;p<nPerms;p++){
    for(let i=yCopy.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [yCopy[i],yCopy[j]]=[yCopy[j],yCopy[i]];
    }
    const permR=pearsonR(xArr,yCopy);
    if(!isNaN(permR)&&Math.abs(permR)>=Math.abs(observedR))extremeCount++;
  }
  return(extremeCount+1)/(nPerms+1);
}
```

Translation ideas:
- `nPerms=nPerms||999` — "Do 999 scrambles by default. The +1 convention — 999 becomes 1000 when you count the observed data as a permutation — avoids a p-value of exactly 0."
- `const yCopy=yArr.slice()` — "Don't destroy the real Y array. Make a working copy we can shuffle."
- The inner `for` loop doing `[yCopy[i],yCopy[j]]=[yCopy[j],yCopy[i]]` — "The Fisher-Yates shuffle. Walk from the end to the start and swap each item with a random earlier one. This produces a uniform random permutation in O(n)."
- `const permR=pearsonR(xArr,yCopy)` — "Correlate X with scrambled Y. Any pattern here is pure coincidence, because the pairing is random."
- `if(Math.abs(permR)>=Math.abs(observedR))extremeCount++` — "Count the scrambles that produced a correlation as strong or stronger than what we actually observed. `Math.abs` is because we care about 'strong' in either direction."
- `return(extremeCount+1)/(nPerms+1)` — "Fraction of scrambles that beat or matched the real data. That fraction *is* the p-value. The `+1`s are a standard correction for the observed value itself."

## Interactive Elements (all required)

- [x] **Code↔English translation** — Snippets A and B, each in its own translation block on Screens 3 and 4.
- [x] **Message flow / data flow animation** — id: `flow-module5-correlation`. 6 actors: **Map Bounds**, **Turf Hex Grid**, **Per-Hex Counts**, **`pearsonR`**, **`permutationPValue`**, **"r = 0.71, p < 0.001 ***"**. Steps:
  1. Highlight Map Bounds. Label: "User is zoomed into the Pacific Northwest. We only correlate what's on screen."
  2. Packet Map Bounds → Turf Hex Grid. Label: "Turf.js generates a hex grid covering the visible area — say, 200 tiles, each 50km across."
  3. Packet Turf Hex Grid → Per-Hex Counts. Label: "For each hex, count how many UFOs and how many Bigfeet landed inside."
  4. Packet Per-Hex Counts → `pearsonR`. Label: "Feed the two parallel lists in. Out comes r = 0.71."
  5. Packet Per-Hex Counts → `permutationPValue`. Label: "Same lists, 999 shuffles. Count how many shuffled runs beat r = 0.71."
  6. Highlight `permutationPValue`. Label: "Only 0 of 999 shuffles beat it. p ≈ 0.001."
  7. Packet both → "r = 0.71, p < 0.001 ***". Label: "Report both. The r is the headline; the p is the stress test."
- [x] **Group chat animation** — id: `chat-module5-detective`. Four actors: **Detective**, **Pearson R**, **Permutation Test**, **Hex Grid**, interrogating a crime scene:
  - Detective: "I've got a suspect. Are these two datasets related?"
  - Hex Grid: "I'll carve the map into honeycomb tiles and count sightings in each."
  - Pearson R: "Give me the two parallel lists. I'll tell you whether they move together — scale from −1 to +1."
  - Detective: "r = 0.71. That's our suspect. Case closed?"
  - Permutation Test: "Not so fast. Let me shuffle one of the arrays 999 times and see how often pure chance beats 0.71."
  - Permutation Test: "…zero times. Alright, detective, you've got real evidence. p < 0.001."
  - Detective: "If *50* of the shuffles had beat it?"
  - Permutation Test: "Then we'd have p ≈ 0.05 — borderline. And if 500 beat it, your 'suspect' is just a coincidence."
- [x] **Multiple-choice quiz** — id: `quiz-module5`. 3 questions:
  1. *"A headline reads: 'SHOCKING: Ice cream sales correlate with drowning deaths, r=0.8!' What's the right response?"*
     - A: "Wow, eating ice cream is dangerous." (wrong — this confuses correlation with causation)
     - B: "Both go up in summer. The real cause is heat; ice cream and drownings are independently caused by the same third thing." **(correct)**
     - C: "The r is wrong." (wrong — the math is fine; the *interpretation* is the problem)
     - D: "Need a p-value." (partial — you'd get p < 0.001 and still be wrong about causation; this is a *confounding variable* problem, not a significance problem)
  2. *"Your Strange Signals screen shows r = 0.4, p = 0.22 between UFO sightings and earthquake epicenters. Should you be excited?"*
     - A: "Yes — r = 0.4 is moderate." (wrong — p = 0.22 means there's a ~22% chance this pattern is pure coincidence. Well above the 5% bar.)
     - B: "No — the p-value says this correlation happens ~22% of the time by chance alone. Not evidence." **(correct)**
     - C: "Yes — any nonzero r is meaningful." (wrong — r values need significance context)
  3. *"Why does the app run 999 permutations instead of just, say, 50?"*
     - A: "The more shuffles, the more precise the p-value estimate — especially for small p-values. With 50 shuffles you can't tell the difference between p=0.02 and p=0.001." **(correct)**
     - B: "999 is a lucky number." (wrong)
     - C: "The code has a bug." (wrong)
- [x] **Callout boxes** — two of them, from Screens 2 and 4:
  - "Aha! Spatial correlation is just two parallel lists." (Screen 2)
  - "Aha! Scrambling is the null hypothesis made concrete." (Screen 4)

## Glossary Tooltips (first use)

- **correlation** — "A number between −1 and +1 that says how much two lists of numbers move together. +1 = perfectly in sync. 0 = no relationship. −1 = perfectly opposite."
- **Pearson r** — "The most common correlation measure. What people mean when they say 'correlation' without qualifying it."
- **p-value** — "The probability that you'd see a pattern this extreme (or more) by pure chance. Low p = unlikely to be luck. High p = probably just noise."
- **null hypothesis** — "The boring default: 'there is no real relationship; any pattern is coincidence.' Statistics is the art of trying to disprove this."
- **permutation test** — "A way to get a p-value by *simulation* instead of formulas. Shuffle the data many times to see what patterns random chance produces, then compare."
- **hex grid** — "A honeycomb tiling of the map. Used here to bin geographic points into equal-area cells so you can count them."
- **Turf.js** — "A JavaScript library for geographic math. Computes hex grids, distances, point-in-polygon tests."
- **confounding variable** — "A hidden third factor that causes two things to move together even though neither causes the other. Ice cream and drowning are both caused by summer heat."
- **significance stars** — "Shorthand from academic papers: `*` = p < 0.05, `**` = p < 0.01, `***` = p < 0.001. The more stars, the less likely it's coincidence."
- **Fisher-Yates shuffle** — "A fast algorithm for producing a truly random permutation of an array. Walk from end to start, swap each item with a random earlier one."

## Reference Files to Read

- `references/content-philosophy.md` — especially "Show Don't Tell", "Metaphors First", "Code↔English", "Callout Boxes", "Quizzes That Test Application"
- `references/interactive-elements.md` → "Code ↔ English Translation Blocks", "Group Chat Animation", "Message Flow / Data Flow Animation", "Multiple-Choice Quizzes", "Callout Boxes", "Glossary Tooltips"
- `references/gotchas.md` — full file

## Connections

- **Previous module:** "Rendering 258K Pins Fast" — explained how the map feels instant. This module explains the feature that justifies the app's existence: not *drawing* the data but *interrogating* it.
- **Next module:** "SIGNAL AI" — now that you know what the app can compute, the last module shows how Claude plugs in as a conversational co-pilot. The AI is just a wrapper around all the primitives you've now seen — `setView`, `applyFilters`, `computeCorrelation`. End with something like: "Next, we meet SIGNAL — the AI that knows how to pull these levers in English."
- **Tone/style notes:**
  - Accent color is vermillion (`#D94F30`).
  - The learner is a vibe coder, not a statistician. Lean on intuition, not notation. `sum((xi - x̄)(yi - ȳ)) / ...` is a cognitive trap — plain English is the whole point.
  - Don't redefine terms from earlier modules (JSON, pipeline, cache, spatial index). Do tooltip the new ones.

## Section wrapper

Your output file must be exactly one `<section class="module" id="module-5">...</section>` block.
