# Phase 2: Data Expansion, Visual Reports & Polish — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the dataset with new sources (~14K net new records), give SIGNAL inline chart rendering and report generation, and fix the NN crash bug.

**Architecture:** Python pipeline gets 2 new data loaders that feed into the existing dedup-and-export flow. Two new JS modules (`signal-charts.js`, `signal-reports.js`) provide chart rendering and report generation as IIFE-wrapped APIs. The AI assistant gains 4 new tools, a typing indicator, and proper error handling.

**Tech Stack:** Python 3 (pandas), D3.js 7 (already loaded), Leaflet, vanilla JS (IIFE pattern, no build tools)

**Spec:** `docs/superpowers/specs/2026-03-17-phase2-expansion-design.md`

---

## File Map

```
MODIFIED FILES
  setup_sightings.sh              + download steps 7-8
  build_sightings_workbook.py     + load_ufo_corgis(), load_haunted_kaggle()
  strange-signals.js              NN bug fix (lines 803-862)
  ai-assistant.js                 + 4 tools, typing indicator, error handling, system prompt
  ai-assistant.css                + .signal-chart, .signal-typing, .signal-error
  index.html                      + 2 <script> refs

NEW FILES
  signal-charts.js                D3 chart rendering (bar/line/pie/scatter)
  signal-reports.js               Report window + Download HTML
```

---

### Task 1: Fix NN Crash Bug

**Files:**
- Modify: `strange-signals.js:803-862`

This is the highest-priority fix — it crashes on every NN analysis when a category is toggled off.

- [ ] **Step 1: Add source category empty check**

In `strange-signals.js`, find the `computeNNAnalysis` function (line ~803). Inside the outer `for(let a=0;a<3;a++)` loop, right after `results[a]={};` and before `const sampledA=...`, add:

```js
    if(!filteredCat[a].length){
      for(let b=0;b<3;b++) if(a!==b){results[a][b]=null;step++}
      continue;
    }
```

- [ ] **Step 2: Guard d3.mean/deviation results**

In the same function, find the results assignment (line ~830):
```js
      results[a][b]={
        meanDist:d3.mean(distances),medianDist:d3.median(distances),
        stdDev:d3.deviation(distances)||0,sampleN:sampledA.length
      };
```

Replace with:
```js
      results[a][b]={
        meanDist:d3.mean(distances)??null,medianDist:d3.median(distances)??null,
        stdDev:d3.deviation(distances)??0,sampleN:sampledA.length
      };
```

- [ ] **Step 3: Guard renderNNResults**

In `renderNNResults` (line ~848), find:
```js
      const r=results[a]?.[b];
      if(!r){html+='<td>N/A</td>';continue}
```

Replace with:
```js
      const r=results[a]?.[b];
      if(!r||r.meanDist===null){html+='<td>N/A</td>';continue}
```

- [ ] **Step 4: Verify fix**

Open the app in browser. Toggle off Bigfoot (uncheck). Go to CORR → NEAREST → COMPUTE DISTANCES. Verify no crash — disabled categories should show "N/A" in the table.

- [ ] **Step 5: Commit**

```bash
git add strange-signals.js
git commit -m "fix: guard NN analysis against empty/undefined distances"
```

---

### Task 2: Expand Data Pipeline — Download Steps

**Files:**
- Modify: `setup_sightings.sh`

- [ ] **Step 1: Verify download URLs work**

Run these two curl commands and verify they return CSV data (not 404):

```bash
curl -sI "https://corgis-edu.github.io/corgis/datasets/csv/ufo_sightings/ufo_sightings.csv" | head -5
curl -sI "https://raw.githubusercontent.com/sujaykapadnis/haunted-places/main/haunted_places.csv" | head -5
```

Expected: both return HTTP 200. If either returns 404, skip that source and note it.

- [ ] **Step 2: Add download steps to setup_sightings.sh**

In `setup_sightings.sh`, after the existing `[6/6]` download step (line ~54) and before the `echo "--- Building Excel workbook ---"` line, add:

```bash
echo "[7/8] UFO Sightings - CORGIS (80K with nested columns)..."
curl -L -o data/raw/ufo_corgis.csv \
    "https://corgis-edu.github.io/corgis/datasets/csv/ufo_sightings/ufo_sightings.csv" || echo "  (optional source unavailable, continuing)"

echo "[8/8] Haunted Places - Kaggle mirror (expanded ~10K)..."
curl -L -o data/raw/haunted_kaggle.csv \
    "https://raw.githubusercontent.com/sujaykapadnis/haunted-places/main/haunted_places.csv" || echo "  (optional source unavailable, continuing)"
```

Also update the existing step numbers from `[1/6]` through `[6/6]` to `[1/8]` through `[6/8]`.

- [ ] **Step 3: Update setup complete message**

Update the `echo` block at the end of `setup_sightings.sh` that lists tabs. Add entries for the new datasets:

```bash
echo "  UFO_CORGIS_80K      - CORGIS UFO sightings with nested columns (~80K)"
echo "  Haunted_Kaggle      - Kaggle Haunted Places expanded (~10K)"
```

- [ ] **Step 4: Commit**

```bash
git add setup_sightings.sh
git commit -m "feat: add CORGIS UFO and Kaggle Haunted download steps to pipeline"
```

---

### Task 3: Expand Data Pipeline — Loader Functions

**Files:**
- Modify: `build_sightings_workbook.py`

- [ ] **Step 1: Add load_ufo_corgis function**

First, update the existing loader print labels from `[1/5]`..`[5/5]` to `[1/7]`..`[5/7]` in the five existing load functions (lines 41, 61, 75, 85, 95).

Then, after the existing `load_haunted_places()` function (around line 100), add:

```python
def load_ufo_corgis():
    """CORGIS UFO sightings (~80K with nested column names)."""
    path = os.path.join(RAW, "ufo_corgis.csv")
    if not os.path.exists(path):
        print("  [6/7] UFO CORGIS - file not found, skipping")
        return pd.DataFrame()
    print("  [6/7] UFO CORGIS (80K nested columns)...")
    df = pd.read_csv(path, low_memory=False)
    df = df.rename(columns={
        "Location.Coordinates.Latitude": "latitude",
        "Location.Coordinates.Longitude": "longitude",
        "Location.City": "city",
        "Location.State": "state",
        "Location.Country": "country",
        "Data.Shape": "shape",
        "Data.Description excerpt": "description",
    })
    # Reconstruct date from year/month/day columns
    df["date"] = pd.to_datetime({
        "year": df["Dates.Sighted.Year"],
        "month": df["Dates.Sighted.Month"].clip(1, 12),
        "day": df["Dates.Sighted.Day"].clip(1, 31)
    }, errors="coerce").dt.strftime("%Y-%m-%d")
    before = len(df)
    df = clean_coords(df)
    print(f"         {len(df):,} / {before:,} with valid coordinates")
    return df
```

- [ ] **Step 2: Add load_haunted_kaggle function**

After `load_ufo_corgis()`, add:

```python
def load_haunted_kaggle():
    """Kaggle Haunted Places expanded (~10K)."""
    path = os.path.join(RAW, "haunted_kaggle.csv")
    if not os.path.exists(path):
        print("  [7/7] Haunted Kaggle - file not found, skipping")
        return pd.DataFrame()
    print("  [7/7] Haunted Places Kaggle (expanded)...")
    df = pd.read_csv(path, low_memory=False)
    before = len(df)
    df = clean_coords(df)
    print(f"         {len(df):,} / {before:,} geocoded")
    return df
```

- [ ] **Step 3: Wire new loaders into build_combined**

In `build_combined()`, add two new frame blocks. After the Haunted Places block (around line 193), add:

For CORGIS UFO (add as a new parameter `ufo_corgis` to `build_combined`):
```python
    # UFO CORGIS
    if ufo_corgis is not None and len(ufo_corgis) > 0:
        df = ufo_corgis.copy()
        frames.append(pd.DataFrame({
            "category": "UFO/UAP",
            "subcategory": df.get("shape", ""),
            "date": df.get("date", ""),
            "time": "",
            "latitude": df["latitude"],
            "longitude": df["longitude"],
            "city": df.get("city", ""),
            "state": df.get("state", ""),
            "country": df.get("country", ""),
            "description": df.get("description", "").apply(lambda x: truncate(x)),
            "source": "CORGIS UFO Sightings",
        }))
```

For Kaggle Haunted:
```python
    # Haunted Kaggle
    if haunted_kaggle is not None and len(haunted_kaggle) > 0:
        df = haunted_kaggle.copy()
        frames.append(pd.DataFrame({
            "category": "Haunted Place",
            "subcategory": "Ghost/Haunting",
            "date": "",
            "time": "",
            "latitude": df["latitude"],
            "longitude": df["longitude"],
            "city": df.get("city", ""),
            "state": df.get("state_abbrev", df.get("state", "")),
            "country": df.get("country", "United States"),
            "description": df.get("description", "").apply(lambda x: truncate(x)),
            "source": "Kaggle Haunted Places",
        }))
```

- [ ] **Step 4: Update main() to call new loaders**

In `main()`, after the existing loader calls (around line 253), add:

```python
    ufo_corgis = load_ufo_corgis()
    haunted_kaggle = load_haunted_kaggle()
```

Update the `build_combined` call to pass the new dataframes:

```python
    combined = build_combined(ufo_nuforc, ufo_planetsig, bigfoot_det, bigfoot_loc, haunted,
                              ufo_corgis, haunted_kaggle)
```

Update `build_combined`'s function signature to accept the new parameters:
```python
def build_combined(ufo_nuforc, ufo_planetsig, bigfoot_det, bigfoot_loc, haunted,
                   ufo_corgis=None, haunted_kaggle=None):
```

(Use `ufo_corgis=None` with `if ufo_corgis is not None and len(ufo_corgis) > 0:` guards.)

Add new entries to the `datasets` dict and `build_summary`:
```python
    if ufo_corgis is not None and len(ufo_corgis) > 0:
        datasets["UFO_CORGIS_80K"] = ufo_corgis
    if haunted_kaggle is not None and len(haunted_kaggle) > 0:
        datasets["Haunted_Kaggle"] = haunted_kaggle
```

- [ ] **Step 5: Commit**

```bash
git add build_sightings_workbook.py
git commit -m "feat: add CORGIS UFO and Kaggle Haunted loader functions to pipeline"
```

---

### Task 4: Create signal-charts.js — Chart Rendering Module

**Files:**
- Create: `signal-charts.js`

- [ ] **Step 1: Create signal-charts.js**

Create `signal-charts.js` with the full IIFE module. This renders D3 SVG charts for bar, line, pie, and scatter types.

```js
/* ========== SIGNAL CHARTS ========== */
(function(){
'use strict';

const DEFAULTS={
  bar:{aspect:16/9,margin:{top:28,right:12,bottom:32,left:44}},
  line:{aspect:16/9,margin:{top:28,right:12,bottom:32,left:44}},
  pie:{aspect:1,margin:{top:28,right:12,bottom:12,left:12}},
  scatter:{aspect:4/3,margin:{top:28,right:12,bottom:36,left:44}}
};
const FALLBACK_COLORS=['#00ff88','#ff6622','#aa44ff','#00ccff','#ff3366','#ffcc00'];

function render(container,opts){
  const type=opts.chart_type||'bar';
  const data=opts.data||[];
  if(!data.length)return;

  const cfg=DEFAULTS[type]||DEFAULTS.bar;
  const w=container.clientWidth||360;
  const h=Math.round(w/cfg.aspect);
  const m=cfg.margin;
  const iw=w-m.left-m.right;
  const ih=h-m.top-m.bottom;

  const svg=d3.select(container).append('svg')
    .attr('viewBox',`0 0 ${w} ${h}`)
    .attr('width','100%')
    .style('overflow','visible');

  // Title
  if(opts.title){
    svg.append('text').attr('x',w/2).attr('y',16)
      .attr('text-anchor','middle').attr('fill','#e0e0e0')
      .style('font-family','Orbitron,monospace').style('font-size','10px')
      .style('letter-spacing','1px').text(opts.title.toUpperCase());
  }

  const g=svg.append('g').attr('transform',`translate(${m.left},${m.top})`);

  if(type==='bar')renderBar(g,data,iw,ih,opts);
  else if(type==='line')renderLine(g,data,iw,ih,opts);
  else if(type==='pie')renderPie(svg,data,w,h,m,opts);
  else if(type==='scatter')renderScatter(g,data,iw,ih,opts);
}

function renderBar(g,data,w,h,opts){
  const x=d3.scaleBand().domain(data.map(d=>d.label||'')).range([0,w]).padding(0.3);
  const y=d3.scaleLinear().domain([0,d3.max(data,d=>d.value)||1]).nice().range([h,0]);

  // Axes
  g.append('g').attr('transform',`translate(0,${h})`).call(d3.axisBottom(x))
    .selectAll('text').attr('fill','#888').style('font-size','8px');
  g.append('g').call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.2s')))
    .selectAll('text').attr('fill','#888').style('font-size','8px');
  g.selectAll('.domain,.tick line').attr('stroke','#333');

  // Bars
  g.selectAll('.bar').data(data).enter().append('rect')
    .attr('x',d=>x(d.label||''))
    .attr('y',d=>y(d.value||0))
    .attr('width',x.bandwidth())
    .attr('height',d=>h-y(d.value||0))
    .attr('fill',(d,i)=>d.color||FALLBACK_COLORS[i%FALLBACK_COLORS.length])
    .attr('rx',2).attr('opacity',0.85);

  // Labels
  if(opts.x_label)g.append('text').attr('x',w/2).attr('y',h+28)
    .attr('text-anchor','middle').attr('fill','#666').style('font-size','8px').text(opts.x_label);
  if(opts.y_label)g.append('text').attr('transform','rotate(-90)')
    .attr('x',-h/2).attr('y',-32).attr('text-anchor','middle')
    .attr('fill','#666').style('font-size','8px').text(opts.y_label);
}

function renderLine(g,data,w,h,opts){
  const x=d3.scalePoint().domain(data.map(d=>d.label||'')).range([0,w]).padding(0.5);
  const y=d3.scaleLinear().domain([0,d3.max(data,d=>d.value)||1]).nice().range([h,0]);

  g.append('g').attr('transform',`translate(0,${h})`).call(d3.axisBottom(x))
    .selectAll('text').attr('fill','#888').style('font-size','8px')
    .attr('transform','rotate(-30)').style('text-anchor','end');
  g.append('g').call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.2s')))
    .selectAll('text').attr('fill','#888').style('font-size','8px');
  g.selectAll('.domain,.tick line').attr('stroke','#333');

  const line=d3.line().x(d=>x(d.label||'')).y(d=>y(d.value||0)).curve(d3.curveMonotoneX);
  const color=data[0]?.color||FALLBACK_COLORS[0];

  // Area fill
  const area=d3.area().x(d=>x(d.label||'')).y0(h).y1(d=>y(d.value||0)).curve(d3.curveMonotoneX);
  g.append('path').datum(data).attr('d',area).attr('fill',color).attr('opacity',0.1);

  // Line
  g.append('path').datum(data).attr('d',line)
    .attr('fill','none').attr('stroke',color).attr('stroke-width',2);

  // Dots
  g.selectAll('.dot').data(data).enter().append('circle')
    .attr('cx',d=>x(d.label||'')).attr('cy',d=>y(d.value||0))
    .attr('r',3).attr('fill',color);
}

function renderPie(svg,data,w,h,m,opts){
  const radius=Math.min(w-m.left-m.right,h-m.top-m.bottom)/2;
  const g=svg.append('g').attr('transform',`translate(${w/2},${m.top+radius})`);

  const pie=d3.pie().value(d=>d.value||0).sort(null);
  const arc=d3.arc().innerRadius(radius*0.45).outerRadius(radius);

  g.selectAll('.arc').data(pie(data)).enter().append('path')
    .attr('d',arc)
    .attr('fill',(d,i)=>d.data.color||FALLBACK_COLORS[i%FALLBACK_COLORS.length])
    .attr('stroke','rgba(5,6,15,0.8)').attr('stroke-width',2);

  // Labels
  const labelArc=d3.arc().innerRadius(radius*0.75).outerRadius(radius*0.75);
  g.selectAll('.label').data(pie(data)).enter().append('text')
    .attr('transform',d=>`translate(${labelArc.centroid(d)})`)
    .attr('text-anchor','middle').attr('fill','#e0e0e0')
    .style('font-size','8px').text(d=>d.data.label||'');
}

function renderScatter(g,data,w,h,opts){
  const xExtent=d3.extent(data,d=>d.x??0);
  const yExtent=d3.extent(data,d=>d.y??0);
  const x=d3.scaleLinear().domain(xExtent).nice().range([0,w]);
  const y=d3.scaleLinear().domain(yExtent).nice().range([h,0]);

  g.append('g').attr('transform',`translate(0,${h})`).call(d3.axisBottom(x).ticks(5))
    .selectAll('text').attr('fill','#888').style('font-size','8px');
  g.append('g').call(d3.axisLeft(y).ticks(5))
    .selectAll('text').attr('fill','#888').style('font-size','8px');
  g.selectAll('.domain,.tick line').attr('stroke','#333');

  g.selectAll('.dot').data(data).enter().append('circle')
    .attr('cx',d=>x(d.x??0)).attr('cy',d=>y(d.y??0))
    .attr('r',4)
    .attr('fill',(d,i)=>d.color||FALLBACK_COLORS[i%FALLBACK_COLORS.length])
    .attr('opacity',0.7).attr('stroke','rgba(255,255,255,0.2)').attr('stroke-width',0.5);

  if(opts.x_label)g.append('text').attr('x',w/2).attr('y',h+32)
    .attr('text-anchor','middle').attr('fill','#666').style('font-size','8px').text(opts.x_label);
  if(opts.y_label)g.append('text').attr('transform','rotate(-90)')
    .attr('x',-h/2).attr('y',-32).attr('text-anchor','middle')
    .attr('fill','#666').style('font-size','8px').text(opts.y_label);
}

window.SignalCharts={render};

})();
```

- [ ] **Step 2: Add script ref to index.html**

In `index.html`, before the `<script src="ai-assistant.js"></script>` line, add:
```html
<script src="signal-charts.js"></script>
```

- [ ] **Step 3: Add chart CSS to ai-assistant.css**

Append to `ai-assistant.css`:
```css
/* Chart containers */
.signal-msg.chart{padding:8px;background:rgba(0,255,136,0.02);border:1px solid var(--border);border-radius:4px;margin:6px 0}
.signal-msg.chart svg{display:block}
```

- [ ] **Step 4: Verify chart module loads**

Reload the app. Open browser console and run:
```js
typeof SignalCharts // should be 'object'
typeof SignalCharts.render // should be 'function'
```

- [ ] **Step 5: Commit**

```bash
git add signal-charts.js index.html ai-assistant.css
git commit -m "feat: add signal-charts.js D3 chart rendering module"
```

---

### Task 5: Create signal-reports.js — Report Generation Module

**Files:**
- Create: `signal-reports.js`

- [ ] **Step 1: Create signal-reports.js**

Create `signal-reports.js` with the full IIFE module:

```js
/* ========== SIGNAL REPORTS ========== */
(function(){
'use strict';

let reportCounter=0;

function create(opts){
  reportCounter++;
  const id='report-'+reportCounter;
  const title=opts.title||'Investigation Report';
  const sections=opts.sections||[];

  // Build report body
  const body=document.createElement('div');
  body.className='signal-report';
  body.style.cssText='padding:16px;color:#e0e0e0;font-family:"Space Mono",monospace;font-size:12px;line-height:1.6;overflow:auto;height:100%';

  // Header
  const header=document.createElement('div');
  header.style.cssText='border-bottom:1px solid rgba(0,255,136,0.2);padding-bottom:12px;margin-bottom:16px';
  header.innerHTML=`<h2 style="font-family:Orbitron,monospace;font-size:14px;color:#00ff88;letter-spacing:2px;margin:0 0 4px">${escHtml(title)}</h2>`+
    `<div style="font-size:9px;color:#666;letter-spacing:1px">GENERATED BY SIGNAL &mdash; ${new Date().toLocaleString()}</div>`;
  body.appendChild(header);

  // Sections
  sections.forEach(function(sec){
    const div=document.createElement('div');
    div.style.cssText='margin-bottom:20px';
    div.innerHTML=`<h3 style="font-family:Orbitron,monospace;font-size:11px;color:#00ccff;letter-spacing:1.5px;margin:0 0 8px;border-left:3px solid #00ccff;padding-left:8px">${escHtml(sec.heading)}</h3>`+
      `<div style="color:#ccc;font-size:11px;line-height:1.7">${escHtml(sec.text).replace(/\n/g,'<br>')}</div>`;

    // Optional chart
    if(sec.chart&&sec.chart.data&&window.SignalCharts){
      const chartDiv=document.createElement('div');
      chartDiv.style.cssText='margin:12px 0;padding:8px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.05);border-radius:4px';
      div.appendChild(chartDiv);
      try{
        SignalCharts.render(chartDiv,sec.chart);
      }catch(e){
        chartDiv.innerHTML='<div style="color:#666;font-size:10px">[Chart could not be rendered]</div>';
      }
    }
    body.appendChild(div);
  });

  // Download button
  const dlBtn=document.createElement('button');
  dlBtn.style.cssText='display:block;margin:20px auto;padding:8px 20px;background:rgba(0,255,136,0.1);border:1px solid #00ff88;color:#00ff88;font-family:Orbitron,monospace;font-size:10px;letter-spacing:1.5px;cursor:pointer;border-radius:3px';
  dlBtn.textContent='DOWNLOAD HTML';
  dlBtn.addEventListener('click',function(){downloadReport(title,body)});
  body.appendChild(dlBtn);

  // Create window
  var win=WindowManager.create({
    id:id,
    title:'<span class="icon">&#9993;</span> '+title.toUpperCase(),
    content:body,
    defaultPos:{right:40,top:60},
    defaultSize:{width:600,height:500},
    minSize:{width:400,height:300}
  });
  win.show();
  return{windowId:id};
}

function downloadReport(title,bodyEl){
  // Clone SVGs as static snapshots
  const clone=bodyEl.cloneNode(true);
  // Remove download button from the exported version
  var btns=clone.querySelectorAll('button');
  btns.forEach(function(b){b.remove()});

  var html='<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">'
    +'<meta name="viewport" content="width=device-width,initial-scale=1">'
    +'<title>'+escHtml(title)+' — Strange Signals Report</title>'
    +'<style>'
    +'body{background:#05060f;color:#e0e0e0;font-family:"Courier New",monospace;font-size:12px;line-height:1.6;max-width:800px;margin:0 auto;padding:24px}'
    +'h2{font-size:16px;color:#00ff88;letter-spacing:2px;margin:0 0 4px}'
    +'h3{font-size:12px;color:#00ccff;letter-spacing:1.5px;margin:16px 0 8px;border-left:3px solid #00ccff;padding-left:8px}'
    +'svg text{font-family:"Courier New",monospace}'
    +'</style></head><body>'
    +clone.innerHTML
    +'</body></html>';

  var blob=new Blob([html],{type:'text/html'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url;
  a.download=title.replace(/[^a-zA-Z0-9 ]/g,'').replace(/ +/g,'-').toLowerCase()+'.html';
  a.click();
  URL.revokeObjectURL(url);
}

function escHtml(s){
  if(!s)return'';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.SignalReports={create};

})();
```

- [ ] **Step 2: Add script ref to index.html**

In `index.html`, after the `<script src="signal-charts.js"></script>` line, add:
```html
<script src="signal-reports.js"></script>
```

- [ ] **Step 3: Verify report module loads**

Reload the app. In console:
```js
typeof SignalReports // 'object'
typeof SignalReports.create // 'function'
```

- [ ] **Step 4: Commit**

```bash
git add signal-reports.js index.html
git commit -m "feat: add signal-reports.js report generation module"
```

---

### Task 6: Wire New Tools into AI Assistant

**Files:**
- Modify: `ai-assistant.js`

- [ ] **Step 1: Add render_chart and generate_report tool definitions**

In `ai-assistant.js`, find the `TOOLS` array (line ~27). After the last tool definition (before the `];`), add:

```js
  {name:'render_chart',description:'Render an inline D3 chart in the chat. Bar/line/pie use label+value. Scatter uses x+y.',
    input_schema:{type:'object',properties:{
      chart_type:{type:'string',enum:['bar','line','pie','scatter']},
      title:{type:'string'},
      data:{type:'array',items:{type:'object',properties:{
        label:{type:'string'},value:{type:'number'},
        x:{type:'number'},y:{type:'number'},color:{type:'string'}
      }}},
      x_label:{type:'string'},y_label:{type:'string'}
    },required:['chart_type','data']}},
  {name:'generate_report',description:'Generate a formatted investigation report with narrative sections and optional charts. Opens in a new draggable window.',
    input_schema:{type:'object',properties:{
      title:{type:'string'},
      sections:{type:'array',items:{type:'object',properties:{
        heading:{type:'string'},text:{type:'string'},
        chart:{type:'object',properties:{
          chart_type:{type:'string',enum:['bar','line','pie','scatter']},
          data:{type:'array'},title:{type:'string'}
        }}
      },required:['heading','text']}}
    },required:['title','sections']}},
  {name:'compare_regions',description:'Compare sighting statistics between two US states or coordinate regions. Provide state code or lat/lon+radius for each region.',
    input_schema:{type:'object',properties:{
      region_a:{type:'object',properties:{
        state:{type:'string',description:'US state code (e.g. OH)'},
        lat:{type:'number'},lon:{type:'number'},radius_km:{type:'number',default:100}
      }},
      region_b:{type:'object',properties:{
        state:{type:'string'},lat:{type:'number'},lon:{type:'number'},radius_km:{type:'number',default:100}
      }}
    },required:['region_a','region_b']}},
  {name:'export_findings',description:'Export analysis results as a downloadable CSV. Types: sightings, clusters, correlation_matrix.',
    input_schema:{type:'object',properties:{
      export_type:{type:'string',enum:['sightings','clusters','correlation_matrix']}
    },required:['export_type']}}
```

- [ ] **Step 2: Add executeTool cases**

In `ai-assistant.js`, find the `executeTool` function's switch statement. Add cases for each new tool. Find the closing `default:` case and add before it:

```js
    case 'render_chart':{
      var chatMsgs=document.getElementById('signal-messages');
      var chartDiv=document.createElement('div');
      chartDiv.className='signal-msg chart';
      chatMsgs.appendChild(chartDiv);
      chatMsgs.scrollTop=chatMsgs.scrollHeight;
      if(window.SignalCharts){
        try{SignalCharts.render(chartDiv,input)}
        catch(e){chartDiv.innerHTML='<div style="color:#ff3366;font-size:10px">Chart error: '+e.message+'</div>'}
      }
      var desc=input.title||input.chart_type+' chart';
      return{rendered:true,description:desc+' with '+input.data.length+' data points'};
    }
    case 'generate_report':{
      if(window.SignalReports){
        var r=SignalReports.create(input);
        return{success:true,window_id:r.windowId,message:'Report opened in new window'};
      }
      return{error:'Report module not loaded'};
    }
    case 'compare_regions':{
      function resolveRegion(reg){
        var lat=reg.lat,lon=reg.lon,radius=reg.radius_km||100,label=reg.state||'';
        if(reg.state&&STATE_CENTROIDS[reg.state]&&!reg.lat){
          lat=STATE_CENTROIDS[reg.state][0];lon=STATE_CENTROIDS[reg.state][1];
          label=reg.state;
        }
        var result=SS.getSightingsInArea(lat,lon,radius);
        // getSightingsInArea returns {total, showing, countsByCategory: {"UFO/UAP":N,...}, sightings:[...]}
        var cbc=result.countsByCategory||{};
        return{label:label||lat.toFixed(1)+','+lon.toFixed(1),lat:lat,lon:lon,radius:radius,
          total:result.total,countsByCategory:cbc,
          ufo:cbc['UFO/UAP']||0,bigfoot:cbc['Bigfoot/Sasquatch']||0,haunted:cbc['Haunted Place']||0};
      }
      var a=resolveRegion(input.region_a);
      var b=resolveRegion(input.region_b);
      // Render comparison chart
      if(window.SignalCharts){
        var chatMsgs2=document.getElementById('signal-messages');
        var chartDiv2=document.createElement('div');
        chartDiv2.className='signal-msg chart';
        chatMsgs2.appendChild(chartDiv2);
        SignalCharts.render(chartDiv2,{chart_type:'bar',title:a.label+' vs '+b.label,
          data:[
            {label:a.label+' UFO',value:a.ufo,color:'#00ff88'},
            {label:b.label+' UFO',value:b.ufo,color:'#00ff88'},
            {label:a.label+' BF',value:a.bigfoot,color:'#ff6622'},
            {label:b.label+' BF',value:b.bigfoot,color:'#ff6622'},
            {label:a.label+' HP',value:a.haunted,color:'#aa44ff'},
            {label:b.label+' HP',value:b.haunted,color:'#aa44ff'}
          ]});
      }
      return{region_a:a,region_b:b};
    }
    case 'export_findings':{
      if(input.export_type==='sightings'){
        document.getElementById('export-csv').click();
        return{exported:'sightings',message:'CSV download triggered'};
      }
      if(input.export_type==='clusters'){
        var clusters=SS.detectClusters?SS.detectClusters():{clusters:[]};
        var csv='label,lat,lon,ufo,bigfoot,haunted,total\n';
        (clusters.clusters||[]).forEach(function(c){
          csv+='"'+c.centroid.label+'",'+c.centroid.lat+','+c.centroid.lon+','
            +c.categories.ufo+','+c.categories.bigfoot+','+c.categories.haunted+','+c.total+'\n';
        });
        downloadCSV('clusters.csv',csv);
        return{exported:'clusters',count:(clusters.clusters||[]).length};
      }
      if(input.export_type==='correlation_matrix'){
        var stats=SS.getStats();
        var mat=SS.runMatrixCorrelation?await SS.runMatrixCorrelation():{matrix:[[1,0,0],[0,1,0],[0,0,1]]};
        var csv2='category_a,category_b,pearson_r\n';
        var names=['UFO/UAP','Bigfoot/Sasquatch','Haunted Place'];
        if(mat&&mat.matrix){
          for(var i=0;i<3;i++)for(var j=0;j<3;j++){
            csv2+='"'+names[i]+'","'+names[j]+'",'+mat.matrix[i][j]+'\n';
          }
        }
        downloadCSV('correlation_matrix.csv',csv2);
        return{exported:'correlation_matrix'};
      }
      return{error:'Unknown export type'};
    }
```

Also add a `downloadCSV` helper inside the IIFE (before the `executeTool` function):

```js
function downloadCSV(filename,csvContent){
  var blob=new Blob([csvContent],{type:'text/csv'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url;a.download=filename;a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 3: Update system prompt**

In `ai-assistant.js`, find the `SYSTEM_PROMPT` string (line ~79). First, update the record count from "183K+" to "197K+" and the category counts (UFO ~170K→~183K, Haunted ~8.8K→~11K+). Then, before the closing backtick, append:

```
\n\nYou can render inline charts (bar, line, pie, scatter) in the chat using the render_chart tool. Use charts to visualize data patterns when they would be clearer than text.\n\nYou can generate full investigation reports with the generate_report tool. Reports open in a new window and can be downloaded as standalone HTML files.\n\nYou can compare two regions side-by-side with compare_regions, and export analysis results as CSV with export_findings.
```

- [ ] **Step 4: Commit**

```bash
git add ai-assistant.js
git commit -m "feat: add render_chart, generate_report, compare_regions, export_findings tools to SIGNAL"
```

---

### Task 7: Add Typing Indicator and Error Handling

**Files:**
- Modify: `ai-assistant.js`
- Modify: `ai-assistant.css`

- [ ] **Step 1: Add typing indicator CSS**

Append to `ai-assistant.css`:

```css
/* Typing indicator */
.signal-typing{display:flex;align-items:center;gap:6px;padding:8px 12px;color:var(--text-dim);font-size:10px;letter-spacing:0.5px}
.signal-typing-dots{display:flex;gap:3px}
.signal-typing-dots span{width:5px;height:5px;border-radius:50%;background:var(--green);animation:signal-bounce 1.4s ease-in-out infinite}
.signal-typing-dots span:nth-child(2){animation-delay:0.2s}
.signal-typing-dots span:nth-child(3){animation-delay:0.4s}
@keyframes signal-bounce{0%,80%,100%{opacity:0.2;transform:scale(0.8)}40%{opacity:1;transform:scale(1.1)}}

/* Error messages */
.signal-error{padding:8px 12px;color:#ff3366;font-size:11px;border-left:2px solid #ff3366;margin:6px 0;background:rgba(255,51,102,0.05)}
.signal-error-details{display:none;margin-top:6px;font-size:9px;color:#888;word-break:break-all}
.signal-error-toggle{color:#ff6688;cursor:pointer;text-decoration:underline;font-size:9px;margin-left:4px}
```

- [ ] **Step 2: Add typing indicator to sendMessage flow**

In `ai-assistant.js`, find the `sendMessage` function. After the user message is appended to the chat DOM and before the API call starts, add a typing indicator:

```js
// Add typing indicator
var typingDiv=document.createElement('div');
typingDiv.className='signal-typing';
typingDiv.id='signal-typing';
typingDiv.innerHTML='<div class="signal-typing-dots"><span></span><span></span><span></span></div> SIGNAL is analyzing...';
document.getElementById('signal-messages').appendChild(typingDiv);
document.getElementById('signal-messages').scrollTop=document.getElementById('signal-messages').scrollHeight;
```

Then in the streaming response handler, remove the typing indicator when the first content arrives. Find where the first `content_block_start` or `content_block_delta` is processed and add:

```js
var typing=document.getElementById('signal-typing');
if(typing)typing.remove();
```

- [ ] **Step 3: Add error handling to API calls**

In `ai-assistant.js`, find where fetch errors are caught. Replace raw error display with friendly messages:

```js
function formatApiError(err,response){
  if(!response){return{msg:'Unable to reach the API. Check your internet connection.',details:err.message}}
  if(response.status===401){return{msg:'API key not set or invalid. Click the gear icon to configure.',details:'HTTP 401'}}
  if(response.status===429){return{msg:'Rate limited. Please wait a moment and try again.',details:'HTTP 429'}}
  return{msg:'Something went wrong.',details:err.message||'HTTP '+response.status}
}

function showError(errInfo){
  var typing=document.getElementById('signal-typing');
  if(typing)typing.remove();
  var div=document.createElement('div');
  div.className='signal-error';
  div.innerHTML=errInfo.msg+' <span class="signal-error-toggle" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'block\'?\'none\':\'block\'">Show details</span>'
    +'<div class="signal-error-details">'+errInfo.details+'</div>';
  document.getElementById('signal-messages').appendChild(div);
  document.getElementById('signal-messages').scrollTop=document.getElementById('signal-messages').scrollHeight;
  isStreaming=false;
}
```

Wire these into `ai-assistant.js`:

1. In `sendMessage()`, find the `try{await runConversationLoop();}catch(e){` block (line ~313). Replace the catch body:
```js
  }catch(e){
    console.error('SIGNAL error:',e);
    showError(formatApiError(e,null));
  }finally{
```

2. In `runConversationLoop()`, find the `if(!resp.ok){` check (line ~349). Replace with:
```js
    if(!resp.ok){
      var errText=await resp.text();
      throw Object.assign(new Error('API '+resp.status+': '+errText.substring(0,200)),{response:resp});
    }
```

3. In `sendMessage()` catch, update to pass the response:
```js
  }catch(e){
    console.error('SIGNAL error:',e);
    showError(formatApiError(e,e.response||null));
  }finally{
```

- [ ] **Step 4: Verify typing indicator**

Reload the app. Open SIGNAL, type a message (without a valid API key). Verify:
1. Typing indicator appears after sending
2. Error message shows "API key not set or invalid..."
3. Typing indicator is removed when error appears

- [ ] **Step 5: Commit**

```bash
git add ai-assistant.js ai-assistant.css
git commit -m "feat: add typing indicator and friendly error messages to SIGNAL"
```

---

### Task 8: Run Data Pipeline (if URLs verified)

**Files:**
- Run: `setup_sightings.sh`, `build_sightings_workbook.py`, `export_map_data.py`

**Note:** This task requires running the Python pipeline, which downloads ~160MB of CSV data. Only run if the download URLs from Task 2 Step 1 returned HTTP 200.

- [ ] **Step 1: Run the pipeline**

```bash
cd "C:\Users\stewa\OneDrive\Documents\Claude\UAP Correlation Project\.claude\worktrees\crazy-lehmann"
bash setup_sightings.sh
```

Expected output: all 8 downloads complete, workbook built, JSON exported. The Combined_All count should be ~197K+ records.

- [ ] **Step 2: Verify JSON file size**

```bash
ls -lh data/sightings_map_data.json
```

Expected: ~24-28MB (within the 30MB threshold).

- [ ] **Step 3: Commit updated data files**

```bash
git add data/sightings_map_data.json data/us_population_density.json
git commit -m "data: rebuild with CORGIS UFO and Kaggle Haunted sources (~197K records)"
```

- [ ] **Step 4: Reload app and verify record count**

Open the app. Check the STATISTICS panel — the TOTAL count should show ~197K.

---

### Task 9: Integration Testing

- [ ] **Step 1: Verify all scripts load without errors**

Reload the app. Open browser console. Check for errors. Expected: no new errors (the old NN errors should be gone now too).

Verify all modules:
```js
console.log({
  WindowManager: typeof WindowManager,
  HighlightLayer: typeof HighlightLayer,
  SignalCharts: typeof SignalCharts,
  SignalReports: typeof SignalReports,
  StrangeSignals: typeof StrangeSignals !== 'undefined'
});
```

All should be `'object'` or `true`.

- [ ] **Step 2: Test SIGNAL chat with chart**

Open SIGNAL, enter API key via gear icon. Ask: "Show me a bar chart of sightings by category"

Expected: SIGNAL calls `render_chart` tool, SVG bar chart appears inline in chat.

- [ ] **Step 3: Test report generation**

Ask SIGNAL: "Generate a report summarizing the overall dataset"

Expected: A WindowManager window opens with formatted report. Download HTML button works.

- [ ] **Step 4: Test NN fix**

Toggle off Bigfoot (uncheck in sidebar). Go to CORR → NEAREST → COMPUTE DISTANCES.

Expected: No crash. Bigfoot rows show "N/A".

- [ ] **Step 5: Final commit**

If any fixes were needed during testing, commit them:

```bash
git add -u
git commit -m "fix: integration testing fixes for Phase 2"
```
