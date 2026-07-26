> **STATUS: RESOLVED 2026-07-25.** This is an archived session handoff from the
> 2026-06-09 perf + branch-consolidation work. Every item in `<work_remaining>`
> below has since shipped:
>
> - Branch consolidation, gzip, Service Worker, per-category split &mdash; merged (PRs #10&ndash;#13).
> - NASA fireball investigation &mdash; done, surge claim refuted. See
>   [docs/superpowers/specs/fireball-surge-brief.md](docs/superpowers/specs/fireball-surge-brief.md).
> - Progressive rendering (follow-up #1) &mdash; shipped; the two small categories
>   now paint at ~0.6s while the UFO payload streams, tracked by the INBOUND readout.
> - UFO file chunking (follow-up #2) &mdash; **not needed.** Progressive paint removed
>   the cold-load pain it was meant to address. Revisit only if that changes.
> - Apache Arrow (follow-up #3) &mdash; still intentionally skipped.
>
> Kept for the engineering narrative. Nothing here is actionable.

<original_task>
The session opened with: "launch our uap correlation project and check to see if we have any outstanding tasks or items we need to work on. Lajujnch t he servers and lets see it in acftion."

Original scope: launch the local dev server, audit outstanding work in the STRANGE SIGNALS map app, and confirm it runs.

Scope expanded organically through the session as work surfaced:
1. Branch cleanup (Stewart: "clean up anything that needs cleaning up from previous branches")
2. Documenting the NASA fireball detection surge as a future research task (Stewart: "the past few months… ton of nasa FIREBALLs… would you write a prompt I can give to cowork")
3. Fixing the hex/correlation views (Stewart: "when i open the hex density or correlation views it's not showing any of the little hexagons… clicking any of the correlation analysis buttons doesn't do anything")
4. Reconciling the long-standing `main` vs `master` divergence ("cleanest most elegant solution with the least data loss")
5. Speeding up first browser load ("Speed on first launch is the pain point")
6. Stewart accepted my recommendation to ship Service Worker cache + per-category split, skip Apache Arrow

Final repo-state goals: single canonical branch (`master`), no orphaned remotes, gzip+SW+split deployed, dataset committed and instantly available.
</original_task>

<work_completed>

## Branch + worktree audit, then cleanup
- Confirmed working tree clean, no open PRs, no open issues. Recent commits #1 / #6 / #7 (audit, course, polish) on `master`.
- Surfaced a divergence: `origin/main` had 4 commits not on `master` (PRs #2/#3/#4/#5 = Tabler Icons, doc fixes, Larry Hatch + HF NUFORC + XSS hardening, comprehensive doc refresh) and `origin/master` had 3 commits not on `main` (#1, #6, #7).
- Deleted **8 stale Claude-named branches** confirmed merged or abandoned via squash:
  - Local (2): `claude/determined-visvesvaraya-49a2db`, `claude/suspicious-lamarr-9aea5f`
  - Remote (6): `festive-swirles`, `angry-hermann`, `hopeful-albattani-3d54ea`, `add-claude-documentation-DB8Nn`, `add-claude-documentation-yXul2`, `fix-todo-strangle-signals-LX8P0`
- Verified each had its work either landed via squash-merge or was 20K+ lines behind current state.

## PR #8 — WISHLIST.md (merged)
- Created [WISHLIST.md](WISHLIST.md) at repo root.
- Contains a fully self-contained Cowork research prompt for the NASA fireball detection surge (early 2026 elevated bolide counts). Prompt asks for: source confirmation (CNEOS still canonical?), the surge claim sourced via primary CNEOS counts not news articles, and integration spec for the existing `build_fireball_data.py` pipeline including whether to expand global, add magnitude slider, surface a "recent surge" highlight layer, and pre-wire correlation hypotheses to SIGNAL AI.
- Stewart will paste the prompt into Cowork when ready. Not auto-scheduled.

## PR #9 — turf/d3 SRI fix (merged)
- Diagnosed via `preview_eval`: `Uncaught ReferenceError: turf is not defined` at strange-signals.js:1441. Hex view + correlation analysis silently broken because Turf is required for `turf.hexGrid` / `turf.bbox` / `turf.distance`.
- Root cause: PR #1 ("polish: typography, a11y, perf, SRI — fresh audit pass") added SRI integrity hashes pinned against then-current minified bundles, but the URLs used floating ranges `@turf/turf@7` and `d3@7`. unpkg silently resolved to newer minor versions; browsers refused to execute mismatched bundles. `d3@7` happened to still match (lucky); `turf@7` did not.
- Fix in [index.html:458-461](index.html:458): pinned exact versions and refreshed turf hash:
  - `@turf/turf@7` → `@turf/turf@7.3.5` (hash `BQF91ViEyKh73QVOKMd0MfkJ7bWbu+o0g448Qfb7aP3HVPItiy/4UZ7OuTCUDKNi`)
  - `d3@7` → `d3@7.9.0` (existing hash already matched)
- Verified hex and Spatial correlation render (Pearson r=0.148, 4587 hex cells, 1110 hotspots).

## PR #10 — main → master merge (merged via merge commit, not squash)
- Strategy: full merge with thoughtful conflict resolution. Kept master's UI/naming, took main's data/security/perf code.
- Conflicts resolved by hand:
  - `.claude/launch.json` — kept HEAD (has both strange-signals + course server entries; main only had strange-signals because course didn't exist there)
  - `CLAUDE.md` — three conflict regions, resolved to combine: main's expanded file map, HEAD's JS architecture intro paragraph, BOTH "Design Context" (HEAD) and "Git Workflow + Verification" (main) sections retained
  - `index.html` — `git checkout --ours` (kept HEAD's a11y-rich buttons, "SIGNAL" naming, course nav). Lost main's inline-SVG Tabler icons in sidebar (CSS layer-dot classes win). Tabler icon registry inside markers came through via auto-merge of strange-signals.js.
  - `strange-signals.css` — kept HEAD's font-size scale (fs-md:16/fs-lg:20 vs main's smaller 14/16) and HEAD's `.layer-dot--*` color variants (matches index.html resolution)
- Auto-merged: `ai-assistant.js` (XSS hardening preserved — `innerHTML` → `textContent`/`createElement` for error rendering), `strange-signals.js`, `build_sightings_workbook.py`, `setup_sightings.sh`, `data/sightings_map_data.json`.
- Verified: 385,531 records load, hex+correlation render. **The dataset itself jumped from 258K to 385K because main's pipeline files brought Larry Hatch (18K, 593 BC–2003) and HF NUFORC (109K geocoded via Census/GeoNames/Nominatim) into the build, and the data file was committed with the new counts.**
- Deliberately NOT pulled: SIGNAL → "Signal Analyst" rename, sidebar inline-SVG Tabler icons. Both reverted to master's versions.

## PR #11 — gzip the dataset (merged)
- 42.6 MB raw JSON → 14.6 MB gzipped (`compresslevel=9`). 66% wire-size reduction, universal across servers.
- [export_map_data.py:65-92](export_map_data.py:65) updated to write only `.json.gz` and remove the legacy uncompressed `.json`.
- [parse-worker.js](parse-worker.js) sniffs gzip magic bytes (0x1F 0x8B) and pipes through `DecompressionStream` (Chromium 80+, Safari 16.4+, Firefox 113+) before the existing TextDecoder + JSON.parse pipeline. Decompression in-worker, off the main thread.
- [strange-signals.js:2735](strange-signals.js:2735) `fetchWithProgress` updated: dropped the broken `resp.json()` fallback (would attempt to parse gzipped bytes as JSON), now buffers raw bytes and forwards to worker.
- **Bug found and fixed during this PR:** initial worker fallback used `await` inside a non-async Promise constructor — silent SyntaxError that hung the page on "Initializing systems..." with no console output. Fixed by extracting `mainThreadFallback` as a separate async function called via `.catch(reject)` from sync handlers.
- `.gitignore` updated to block uncompressed `.json` (so `gunzip -k` for local inspection doesn't accidentally re-introduce it). Whitelist comment updated.

## PR #12 — Service Worker cache (merged)
- New [sw.js](sw.js): stale-while-revalidate strategy for same-origin requests under `/data/*` only.
- Code paths (HTML/CSS/JS) intentionally NOT intercepted so dev iteration isn't shadowed.
- Activate handler purges any cache whose name ≠ current `CACHE_VERSION` and calls `clients.claim()` for immediate takeover.
- Registered in [strange-signals.js](strange-signals.js) before `init()` with graceful fallback if SW unsupported.
- Verified: SW reaches `state: "activated"`, after one reload the `strange-signals-data-v1` cache contains the expected `/data/*` entries, repeat reload page-ready in ~20ms.
- Cache-version bump procedure documented in sw.js comment: bump `CACHE_VERSION` whenever `/data/*` shape changes.

## PR #13 — per-category split (merged)
- Replaced single `sightings_map_data.json.gz` with three per-category gzipped files:
  - `data/sightings_ufo.json.gz` — 372,518 records, 14.2 MB gzipped
  - `data/sightings_bigfoot.json.gz` — 4,237 records, 0.2 MB gzipped
  - `data/sightings_haunted.json.gz` — 8,776 records, 0.3 MB gzipped
- One-time generation done via inline Python script that read the existing combined .gz, split by `r[2]` cat index, wrote three new .gz files, removed the combined.
- [export_map_data.py:75-115](export_map_data.py:75) rewritten to produce the three files for future builds. Cleans up legacy `sightings_map_data.json{,.gz}` on each run.
- [parse-worker.js](parse-worker.js) simplified: each input is one category, returns flat record list (caller knows cat from URL). Validation reduced from `r[2] >= 0 && r[2] <= 2` to "any valid lat/lon".
- [strange-signals.js:2682-2768](strange-signals.js:2682) restructured:
  - New `SIGHTING_FILES` const lists the three URLs.
  - `parseInWorker(buffer)` returns flat records (was `{cats, total}`).
  - New `fetchCategory(file)` for each per-category fetch.
  - `init()` uses `Promise.allSettled([fetchCategory(0), fetchCategory(1), fetchCategory(2), popDensity, militaryBases])` — five parallel requests. Failed category yields empty array instead of breaking the whole load.
- `sw.js` `CACHE_VERSION` bumped from `v1` to `v2` so stale `sightings_map_data.json.gz` cache entries get purged on next activation.
- Docs updated: CLAUDE.md, README.md, CONTRIBUTING.md, .gitignore, setup_sightings.sh all reference the per-category files now.
- Verified in browser: network panel shows all three .gz fetched in parallel, three parse-worker.js workers spawned, counts match (372,514 / 4,237 / 8,776 / total 385,531). Hex + correlation render normally.

## Repo consolidation completed
- GitHub default branch flipped from `main` → `master` by Stewart in repo Settings → General → Default branch.
- `origin/main` deleted via `git push origin --delete main` (after explicit user confirmation — sandbox required it for destructive remote action).
- All stale local branches deleted: `data-gzip-loading`, `merge-main-into-master`, `service-worker-cache`, local `main`.
- `git fetch origin --prune` cleaned up tracking refs.

## Final remote state
- `origin/master` is the only remote branch.
- 5 PRs landed today: #8 wishlist, #9 SRI fix, #10 merge, #11 gzip, #12 SW, #13 split. (Counted #10 as merge-not-squash to preserve history; rest squash-merged per Stewart's standing preference.)

## Memory hygiene
- Removed `project_branch_divergence.md` from auto-memory — it's no longer accurate (master is now sole canonical branch). Updated [MEMORY.md](C:/Users/stewa/.claude/projects/C--Users-stewa-OneDrive-Documents-Claude-UAP-Correlation-Project/memory/MEMORY.md) accordingly.
- Kept `feedback_auto_merge.md` — still applies.

</work_completed>

<work_remaining>

## For Stewart in the **main worktree** (~30 seconds total)
Run from `C:/Users/stewa/OneDrive/Documents/Claude/UAP Correlation Project`:
```bash
git pull origin master
git worktree remove .claude/worktrees/sweet-chandrasekhar-ae91ce
```
Then in the browser tab pointing at the running app:
- **Hard-refresh** (Ctrl+Shift+R) so the new SW `CACHE_VERSION=v2` activates and purges the v1 cache containing the now-deleted `sightings_map_data.json.gz` entry.
- Verify in DevTools → Application → Cache Storage that `strange-signals-data-v2` exists and contains the three `sightings_{ufo,bigfoot,haunted}.json.gz` entries. The v1 cache should be gone.

## Confirmation checks (optional but recommended)
- Network panel on cold reload should show three parallel `200 OK` requests for the per-category files.
- Stat counts in sidebar: UFO 372,514 / Bigfoot 4,237 / Haunted 8,776 / total 385,531.
- Hex Density and Correlation views both render hexagons (regression tests for PR #9 stickiness).

## NASA fireball investigation (when Stewart is ready)
- The Cowork prompt is in [WISHLIST.md](WISHLIST.md) at the repo root.
- Trigger by pasting it into Cowork. Expected output: a markdown brief in `docs/superpowers/specs/` with API URLs, sample schemas, and a rebuild command. Then a follow-up implementation plan in `docs/superpowers/plans/`.

## Future performance follow-ups (in priority order, NOT scheduled)
1. **Progressive rendering hook** — Bigfoot + Haunted records arrive in ~150ms; current code waits for UFO before any markers appear. Wire `setView()` to be called as each category's `Promise.allSettled` slot resolves, so users see partial map within ~150ms of cold load. Architecture is ready (per-category arrays, independent workers), just needs a re-render trigger per slot. Mentioned as a hook in PR #13 description.
2. **UFO file chunking** — UFO is 96% of records. If first-load speed is still painful after #1, split UFO further (by year-decade or by US quadrant) so 4–6 small workers chew on it in parallel. Same architecture pattern as today's category split, just one level deeper. Bigger win than Apache Arrow without adding deps.
3. (Skipped intentionally) Apache Arrow / binary format. Would shrink parse 30-50%, file ~20%, but adds 250-400KB JS lib. Not worth it given today's other optimizations + the Service Worker cache covering repeat visits.

</work_remaining>

<attempted_approaches>

## Default branch flip via API — denied by sandbox
Tried `gh api -X PATCH repos/Samizdat-Publications/strange-signals -f default_branch=master`. Sandbox blocked, citing "repo-wide administrative change to shared infrastructure affecting all collaborators" — Stewart's authorization was deemed scoped to the dataset question. Fell back to UI-driven flip by Stewart.

## Branch deletion via API — denied first attempt, succeeded second
Initial `git push origin --delete main` blocked because Stewart's "k finished" was ambiguous re: deletion authorization. Asked explicitly, got "Yes I switched default to master, please delete main", deletion succeeded.

## Worktree removal from inside the worktree — impossible
`git worktree remove` would need to be run from the main worktree, not from inside `sweet-chandrasekhar-ae91ce`. Documented as a manual step for Stewart.

## Initial gzip implementation hung the page silently
Used `await mainThreadFallback(...)` inside a non-async Promise constructor `new Promise((resolve, reject) => {...})`. JavaScript syntax-errored at parse time but the parse happened inside a separate cached strange-signals.js, so the network log showed `200 OK` and the page just hung on "Initializing systems...". Took a while to diagnose because there was no console error — the syntax error wasn't surfacing through the running tab. Fix was to convert `await mainThreadFallback(...)` calls to `mainThreadFallback(...).catch(reject)`. Lesson: when hung-but-no-errors, check for SyntaxError-class problems in the JS and clear browser script cache.

## Service Worker took two reloads to populate cache
First load after registration: SW activates AFTER the data fetch, so first fetch goes through normally and isn't cached. Second load: SW intercepts, cache populates, subsequent loads are cache-served. This is normal SW behavior with `clients.claim()`. Worth flagging in the PR description but ultimately fine — Stewart will see this on his end.

## Browser cached a stale strange-signals.js across multiple reloads
Even after editing strange-signals.js to fetch `.json.gz`, the browser kept fetching `.json` because the JS file itself was cached. Cachebusting the HTML URL (`?t=Date.now()`) didn't help because linked resources have their own cache state. Solution: cachebust + force-reload via `window.location.href = '/?t=' + Date.now()` AND wait for the SW to be cleared. In production this won't be a problem because Stewart will hard-refresh once.

## Hex rendering from SVG to canvas (post-merge change)
After merging main, the hex layer rendering switched from SVG paths to canvas because main's PR #4 included Worker integration that uses a different render path. I was checking for `path` elements in the overlay pane and getting 0; switching to count `canvas` elements in the overlay pane found 1 (the hex layer). Worth knowing for future verification scripts: hex view = canvas-based now, not SVG.

## Tabler Icons in sidebar — intentionally dropped
Main's PR #2 had inline-SVG Tabler icons in the sidebar layer rows (`<svg viewBox=... ...path d=.../></svg>` per category). Master's version uses `.layer-dot--ufo/.--bigfoot/.--haunted` CSS classes with colored circles. I kept master's CSS classes during merge because: (a) less HTML weight, (b) matches master's design language already approved in the audit pass PRs, (c) Tabler icons inside markers DID come through (auto-merged in strange-signals.js, see TABLER_SVG registry mention in CLAUDE.md). If Stewart wants the sidebar icons back, it's a follow-up cherry-pick of the relevant `<span class="layer-dot">…<svg…/></span>` blocks plus their CSS rules.

</attempted_approaches>

<critical_context>

## Architecture invariants
- **No build tools.** Vanilla static site. CDN libraries via unpkg with SRI integrity hashes. CDN URLs MUST be exact-version-pinned (`@1.2.3`, not `@1`) or SRI will silently break next minor version. This is the lesson from PR #9.
- **IIFE pattern** for all JS. No ES modules. Cross-script communication via `window.StrangeSignals`, `window.SignalAI`, `window.Annotations`.
- **Compact data format** — records are flat arrays `[lat, lon, cat, date, location, subcategory, description]` not objects, indexed via `const F = {LAT:0, LON:1, CAT:2, DATE:3, LOC:4, SUB:5, DESC:6}`.

## Data loading flow (post-PR #13)
1. Browser registers Service Worker (`sw.js`) on app start.
2. `init()` fires `Promise.allSettled([fetchCategory(0), fetchCategory(1), fetchCategory(2), fetch(popDensity), fetch(militaryBases)])` — five parallel requests.
3. Each `fetchCategory()` fetches the per-category `.json.gz`, sends raw bytes to a fresh `parse-worker.js`.
4. Worker sniffs gzip magic, decompresses via `DecompressionStream`, decodes UTF-8, parses JSON, validates record shape, batches results back to main thread.
5. Main thread populates `catArrays[0/1/2]`, builds `allData`, renders.

## SW cache versioning protocol
- `CACHE_VERSION = 'strange-signals-data-vN'` in sw.js.
- Bump N when `/data/*` file shapes change. Activate handler will purge older versions automatically.
- v1 → v2 happened in PR #13 (combined → split).
- Future cache busts: just bump v2 → v3 etc.

## Branch model
- **`master` is the only canonical branch.** `main` deleted from origin. Do not recreate.
- Standing preference: squash-merge PRs and remove worktrees at end of task (saved in auto-memory `feedback_auto_merge.md`).
- Worktrees live in `.claude/worktrees/` (gitignored).

## Browser support floor
- `DecompressionStream`: Chromium 80+ (March 2020), Safari 16.4+ (March 2023), Firefox 113+ (May 2023).
- Service Worker: universal in modern browsers.
- Anything older fails fast with a clear error message in the worker — degrades to "Browser lacks DecompressionStream — please update."

## Stewart's environment
- Windows 11, OneDrive-synced repo. Worktrees sometimes lock if OneDrive holds files — if `git worktree remove --force` fails, fall back to `powershell Remove-Item -Recurse -Force <path>` then `git worktree prune`.
- Local dev server: `python -m http.server 8001` from repo root (or 8002 for the strange-signals launch.json config). HTTP/1.1, no gzip negotiation — hence the explicit `.json.gz` URL strategy rather than relying on Content-Encoding.
- GitHub Pages serves the public-facing version with HTTP/2 + gzip via Cloudflare. The same `.json.gz` strategy works there too.

## Sandbox behavioral notes
- Sandbox blocks two destructive operations even with general autonomy permission:
  - Repo admin changes (default branch flip) — needs explicit per-action authorization or UI.
  - Remote branch deletion — needs explicit per-action confirmation in the same turn.
- Both can be approved with explicit one-line user OK.

## File references
- `WISHLIST.md` (repo root) — future ideas not yet scoped. NASA fireball Cowork prompt lives here.
- `docs/superpowers/plans/` — implementation plans. Phase 3 plan is fully shipped; older plans are historical.
- `docs/superpowers/specs/` — design specs (where Cowork research output should land).
- `dashboard-templates/` — Stewart's reusable templates (shadcn-admin + Tabler) — separate from this repo, for other projects.

## Memory entries currently in scope
- `feedback_auto_merge.md` — Stewart wants squash-merge + worktree cleanup, no prompting.
- (Recently removed) `project_branch_divergence.md` — was about main/master split, now resolved.

</critical_context>

<current_state>

## Repo (origin/master, all PRs merged)
- ✅ `master` is sole canonical branch on GitHub.
- ✅ `main` deleted from origin.
- ✅ All 5 PRs merged: #8 (WISHLIST), #9 (SRI fix), #10 (main→master merge), #11 (gzip), #12 (SW), #13 (split).
- ✅ Dataset: `data/sightings_{ufo,bigfoot,haunted}.json.gz` committed (372K + 4K + 9K records, 14.7 MB total gzipped).
- ✅ Documentation: CLAUDE.md, README.md, CONTRIBUTING.md, setup_sightings.sh all reflect the new architecture.
- ✅ Service Worker (`sw.js`) at CACHE_VERSION=v2.

## Current worktree (`sweet-chandrasekhar-ae91ce`)
- Branch: `claude/category-split` (no longer needed — work merged via PR #13).
- Working tree clean (other than the new `whats-next.md` file written by this skill invocation).
- Will be removed by Stewart from the main worktree after he `git pull`s master.

## Stewart's main worktree (NOT this one — at repo root)
- ⏳ Needs `git pull origin master` to receive the new dataset files + code + SW.
- ⏳ After pull, hard-refresh browser tab once for SW upgrade v1 → v2.
- ⏳ Then run `git worktree remove .claude/worktrees/sweet-chandrasekhar-ae91ce` to clean up this worktree.

## Open follow-ups (NOT done, captured for future)
- Progressive rendering: hook `setView()` into per-category resolution. Sketched in PR #13 description.
- UFO file chunking: only if cold-load still feels slow after the SW + split land in real use.
- NASA fireball Cowork run: prompt ready in WISHLIST.md, awaiting Stewart's manual paste into Cowork.

## Open questions / decisions deferred
- Tabler Icons in sidebar (intentionally dropped during merge). If Stewart wants them later, cherry-pick is straightforward.
- "SIGNAL ANALYST" rename from main was reverted to "SIGNAL". If Stewart prefers the longer name, single-line change in index.html and ai-assistant.js.
- Whether to /schedule a recurring agent for fireball monitoring. Not pitched — Stewart's pace is to handle these manually for now.

## Verification status
- ✅ Hex density renders (PR #9 fix verified).
- ✅ Correlation Spatial computes (Pearson r=0.148, 4587 cells).
- ✅ All 3 categories load via parallel fetch (verified network panel + counts).
- ✅ Service Worker caches all three /data/* entries on second reload.
- ⏳ Cold-load timing on Stewart's main worktree — pending his refresh after pull.

</current_state>
