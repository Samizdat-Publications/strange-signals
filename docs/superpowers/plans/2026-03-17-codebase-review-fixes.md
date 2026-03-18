# Strange Signals Codebase Review Fixes

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all Critical and High priority issues found in the codebase review, then address Medium priority items.

**Architecture:** Static HTML/CSS/JS app — all changes are in `strange-signals.js`, `strange-signals.css`, and `index.html`. No build tools, no npm. IIFE pattern.

**Tech Stack:** Vanilla JS, Leaflet, D3.js, Turf.js (all CDN)

---

## Task 1: Fix stale analysis cache on filter change (HIGH)

**Files:**
- Modify: `strange-signals.js:155-158`

`invalidateAnalysisCache()` only clears hex grid and monthly bins, but leaves `corrMatrix`, `detectedClusters`, `nnResults` stale. Users see old cluster locations after filtering.

- [ ] **Step 1: Expand invalidateAnalysisCache()**

Replace lines 155-158:
```js
function invalidateAnalysisCache(){
  cachedHexGrid=null;cachedHexCounts=null;cachedHexSize=null;cachedBoundsKey=null;cachedSpatialIndex=null;
  monthlyBins=null;
  corrMatrix=null;
  detectedClusters=[];
  nnResults=null;
}
```

- [ ] **Step 2: Verify no regressions**

Open app, run cluster detection, change filter, verify clusters are cleared.

- [ ] **Step 3: Commit**

---

## Task 2: Hide temporal overlay on view change (HIGH)

**Files:**
- Modify: `strange-signals.js:866-872` (renderCurrentView)

When switching views, the temporal overlay stays visible blocking the map.

- [ ] **Step 1: Add temporal overlay cleanup to renderCurrentView()**

After `clearAllLayers();` on line 867, add:
```js
document.getElementById('temporal-overlay').style.display='none';
temporalOverlayVisible=false;
```

- [ ] **Step 2: Commit**

---

## Task 3: Fix O(n*m) point-in-polygon in runCorrelation (HIGH)

**Files:**
- Modify: `strange-signals.js:991-1091` (runCorrelation function)

Currently iterates all points × all hexes. Should use `getOrBuildHexData()` which has spatial indexing.

- [ ] **Step 1: Refactor runCorrelation to use getOrBuildHexData()**

Replace the hex grid creation + manual counting (lines 994-1027) with:
```js
function runCorrelation(catA,catB){
  if(corrLayer){map.removeLayer(corrLayer);corrLayer=null}

  const cellSide=parseFloat(document.getElementById('corr-hex-size').value);
  const{grid,counts}=getOrBuildHexData(cellSide);
  const hexFeatures=grid.features;

  // Extract per-category counts from the shared hex data
  const countsA=counts.map(c=>c[catA]);
  const countsB=counts.map(c=>c[catB]);

  // ... rest of function uses countsA/countsB arrays instead of Float64Arrays
```

Also remove dead code: line 1008 `const collA=turf.collect(...)` which is assigned but never used.

- [ ] **Step 2: Verify correlation results are consistent**
- [ ] **Step 3: Commit**

---

## Task 4: Fix cluster adjacency threshold (HIGH)

**Files:**
- Modify: `strange-signals.js:364`

Uses `cellSide * 2.05` but flat-top hex center-to-center is `cellSide * sqrt(3)` = `cellSide * 1.732`. Current value overestimates adjacency by 18%.

- [ ] **Step 1: Fix threshold**

Change line 364 from:
```js
const threshold=cellSide*2.05;
```
to:
```js
const threshold=cellSide*Math.sqrt(3)*1.05; // hex center-to-center + 5% tolerance
```

- [ ] **Step 2: Commit**

---

## Task 5: Add data validation on load (HIGH)

**Files:**
- Modify: `strange-signals.js:1447-1459`

No validation that `json.data` exists, is an array, or that records have valid coordinates.

- [ ] **Step 1: Add validation after JSON load**

After line 1447 `allData=json.data;`, add:
```js
if(!Array.isArray(allData)){
  setProgress(0,'Invalid data format');
  return;
}
// Filter invalid records
allData=allData.filter(r=>
  Array.isArray(r)&&r.length>=7&&
  typeof r[F.LAT]==='number'&&!isNaN(r[F.LAT])&&
  typeof r[F.LON]==='number'&&!isNaN(r[F.LON])&&
  r[F.CAT]>=0&&r[F.CAT]<3
);
if(!allData.length){
  setProgress(0,'No valid records found');
  return;
}
```

- [ ] **Step 2: Commit**

---

## Task 6: Add permutation test for p-values (CRITICAL — statistical rigor)

**Files:**
- Modify: `strange-signals.js` — after `pearsonR()` function (line 171)
- Modify: `strange-signals.js` — `runCorrelation()` and `runMatrixCorrelation()` to display p-values

- [ ] **Step 1: Add permutationPValue function**

After `pearsonR()` (line 171), add:
```js
function permutationPValue(xArr,yArr,observedR,nPerms){
  nPerms=nPerms||999;
  if(xArr.length<5)return 1;
  let extremeCount=0;
  const yCopy=yArr.slice();
  for(let p=0;p<nPerms;p++){
    // Fisher-Yates shuffle
    for(let i=yCopy.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [yCopy[i],yCopy[j]]=[yCopy[j],yCopy[i]];
    }
    if(Math.abs(pearsonR(xArr,yCopy))>=Math.abs(observedR))extremeCount++;
  }
  return(extremeCount+1)/(nPerms+1);
}
```

- [ ] **Step 2: Update runCorrelation to show p-value**

In `runCorrelation()`, after computing `r` (line 1050), add p-value computation and update display (line 1059-1060):
```js
const pVal=permutationPValue(pairs.map(p=>p[0]),pairs.map(p=>p[1]),r,999);
const sigLabel=pVal<0.001?'***':pVal<0.01?'**':pVal<0.05?'*':'n.s.';
```

Update the detail innerHTML to include p-value.

- [ ] **Step 3: Update runMatrixCorrelation to show p-values**

In the matrix detail (line 318), compute and display p-values for each pair.

- [ ] **Step 4: Update interpretR to factor in significance**
- [ ] **Step 5: Commit**

---

## Task 7: Extract zoom-based hex size constants (MEDIUM)

**Files:**
- Modify: `strange-signals.js` — lines 891, 937-938, 997-998

Same zoom→size mapping repeated 3 times.

- [ ] **Step 1: Add constant and helper**

Near constants section (after line 8):
```js
function autoHexSize(zoom){return zoom<=4?80:zoom<=5?50:zoom<=6?30:zoom<=7?20:15}
function autoHeatRadius(zoom){return zoom<=4?14:zoom<=5?17:zoom<=6?21:zoom<=7?25:22}
```

- [ ] **Step 2: Replace all 3 inline zoom calculations**
- [ ] **Step 3: Commit**

---

## Task 8: Expand URL state persistence (MEDIUM)

**Files:**
- Modify: `strange-signals.js:1194-1228` (saveState/loadState)

Missing: subcategory filter, correlation sub-mode, per-capita mode, military bases toggle.

- [ ] **Step 1: Expand saveState()**

Add after line 1208:
```js
const sub=document.getElementById('sub-filter').value;
if(sub)params.set('sub',sub);
params.set('csm',corrSubMode);
if(perCapitaMode)params.set('pc','1');
if(showMilitaryBases)params.set('mil','1');
```

- [ ] **Step 2: Expand loadState()**

Add after line 1226:
```js
if(params.has('sub'))document.getElementById('sub-filter').value=params.get('sub');
if(params.has('csm'))corrSubMode=params.get('csm');
if(params.get('pc')==='1'){perCapitaMode=true;const el=document.getElementById('percapita-toggle');if(el)el.checked=true}
if(params.get('mil')==='1'){showMilitaryBases=true;const el=document.getElementById('military-toggle');if(el)el.checked=true}
```

- [ ] **Step 3: Commit**

---

## Task 9: Add async error handling for NN analysis (MEDIUM)

**Files:**
- Modify: `strange-signals.js:1319-1321`

`computeNNAnalysis()` is async but called without await or catch.

- [ ] **Step 1: Wrap in try/catch with await**

```js
document.getElementById('nearest-run').addEventListener('click',async ()=>{
  try{await computeNNAnalysis()}
  catch(e){
    console.error('NN analysis failed:',e);
    document.getElementById('nearest-results').innerHTML='<div style="color:var(--pink)">Analysis failed. Try adjusting filters.</div>';
  }
});
```

- [ ] **Step 2: Commit**

---

## Task 10: CSS and accessibility polish (MEDIUM)

**Files:**
- Modify: `index.html` — sidebar toggle aria, main landmark
- Modify: `strange-signals.css` — disabled states, hover media query, backdrop-filter prefix

- [ ] **Step 1: Fix HTML semantics**

Change `<div id="main">` to `<main id="main">` if present, add aria-label to sidebar toggle, add aria-expanded tracking.

- [ ] **Step 2: Add CSS improvements**

```css
button:disabled,input:disabled,select:disabled{opacity:0.5;cursor:not-allowed}
@media(hover:hover){.layer-row:hover{background:rgba(255,255,255,0.03)}}
```

Add `-webkit-backdrop-filter` vendor prefix.

- [ ] **Step 3: Commit**

---

## Task 11: Add pearsonR guard for constant arrays (MEDIUM)

**Files:**
- Modify: `strange-signals.js:160-171`

If all X or all Y values are identical, `den` is 0 and function returns 0. Should return NaN to distinguish "no correlation" from "can't compute."

- [ ] **Step 1: Update pearsonR**

Change minimum sample from 3 to 5, return NaN when denominator is 0:
```js
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

- [ ] **Step 2: Update all callers to handle NaN**

Check `runCorrelation`, `runMatrixCorrelation`, `rollingCorrelation` for NaN display.

- [ ] **Step 3: Commit**
