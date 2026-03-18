# Signal Intelligence Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an AI-powered conversational assistant ("SIGNAL") with tool use, draggable/resizable windows, visual map highlights, and correlation performance improvements via Web Workers.

**Architecture:** Three sub-projects built in dependency order: (1) a lightweight window manager for draggable/resizable panels, (2) a Web Worker for hex binning to fix correlation performance, (3) a Claude-powered AI assistant with 10 tools that control the map. All are vanilla JS files loaded via `<script>` tags — no build tools.

**Tech Stack:** Vanilla JS (IIFE pattern), Leaflet 1.9.4, Turf.js 7, D3.js 7, Anthropic Messages API (direct browser access with streaming)

---

## File Structure

```
NEW FILES:
  window-manager.js       Drag/resize/minimize/z-stack window system
  window-manager.css      Window chrome styles + animations
  hex-worker.js           Web Worker for Turf.js hex binning
  ai-assistant.js         Chat UI, Anthropic API, tool definitions + execution
  ai-assistant.css        Chat panel, message bubbles, highlight animations
  highlight-layer.js      L.HighlightLayer — radar ping + labeled spotlights

MODIFIED FILES:
  index.html              Add <script>/<link> refs, restructure temporal overlay, add AI toggle
  strange-signals.js      Expose window.StrangeSignals API, use worker for hex, use WindowManager
  strange-signals.css     Remove old temporal-overlay positioning (moved to window-manager)
  .env.example            Add ANTHROPIC_API_KEY documentation
```

---

## Task 1: Window Manager — Core System

**Files:**
- Create: `window-manager.js`
- Create: `window-manager.css`

- [ ] **Step 1: Create window-manager.css**

```css
/* ========== WINDOW MANAGER ========== */
.ss-window{position:absolute;z-index:1200;background:var(--surface-solid);border:1px solid var(--border);
  border-radius:6px;box-shadow:0 8px 32px rgba(0,0,0,0.5);display:flex;flex-direction:column;
  min-width:300px;min-height:200px;overflow:hidden}
.ss-window.focused{border-color:var(--border-bright);box-shadow:0 8px 32px rgba(0,255,136,0.15)}
.ss-window.minimized{display:none}

.ss-window-titlebar{display:flex;justify-content:space-between;align-items:center;
  padding:8px 12px;border-bottom:1px solid var(--border);cursor:move;user-select:none;
  background:rgba(0,255,136,0.03);flex-shrink:0}
.ss-window-title{font-family:var(--font-display);font-size:10px;letter-spacing:1.5px;
  color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ss-window-controls{display:flex;gap:4px;flex-shrink:0}
.ss-win-btn{width:24px;height:24px;border:1px solid var(--border);border-radius:3px;
  background:rgba(255,255,255,0.03);color:var(--text-dim);cursor:pointer;
  font-size:14px;display:flex;align-items:center;justify-content:center;
  transition:all .15s;line-height:1;padding:0}
.ss-win-btn:hover{color:var(--text);border-color:var(--border-bright)}
.ss-win-btn.close:hover{background:rgba(255,51,102,0.15);border-color:rgba(255,51,102,0.3);color:#ff3366}

.ss-window-body{flex:1;overflow:auto;min-height:0}

.ss-window-resize{position:absolute;bottom:0;right:0;width:16px;height:16px;cursor:nwse-resize}
.ss-window-resize::after{content:'';position:absolute;bottom:3px;right:3px;
  width:8px;height:8px;border-right:2px solid var(--border-bright);
  border-bottom:2px solid var(--border-bright)}

/* Minimized dock */
.ss-dock{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);
  display:flex;gap:6px;z-index:1199}
.ss-dock-btn{padding:4px 12px;background:var(--surface-solid);border:1px solid var(--border);
  border-radius:3px;color:var(--text-dim);font-family:var(--font-display);font-size:8px;
  letter-spacing:1px;cursor:pointer;transition:all .15s}
.ss-dock-btn:hover{color:var(--text);border-color:var(--border-bright)}

/* Transition for show/hide */
.ss-window.hiding{opacity:0;transform:scale(0.95);transition:opacity .15s,transform .15s}
.ss-window.showing{opacity:1;transform:scale(1);transition:opacity .15s,transform .15s}
```

- [ ] **Step 2: Create window-manager.js**

```js
/* ========== WINDOW MANAGER ========== */
(function(){
'use strict';

let zCounter=1200;
const windows={};
let dockEl=null;

function ensureDock(){
  if(dockEl)return dockEl;
  dockEl=document.createElement('div');
  dockEl.className='ss-dock';
  document.getElementById('map-container').appendChild(dockEl);
  return dockEl;
}

function clamp(val,min,max){return Math.max(min,Math.min(max,val))}

class SSWindow{
  constructor(opts){
    this.id=opts.id;
    this.onClose=opts.onClose||null;
    this.onResize=opts.onResize||null;
    this._minimized=false;
    this._hidden=true;

    // Create DOM
    this.el=document.createElement('div');
    this.el.className='ss-window';
    this.el.id='win-'+this.id;
    this.el.style.display='none';

    // Titlebar
    const titlebar=document.createElement('div');
    titlebar.className='ss-window-titlebar';
    this._titleEl=document.createElement('span');
    this._titleEl.className='ss-window-title';
    this._titleEl.innerHTML=opts.title||'';
    titlebar.appendChild(this._titleEl);

    const controls=document.createElement('div');
    controls.className='ss-window-controls';

    const minBtn=document.createElement('button');
    minBtn.className='ss-win-btn minimize';
    minBtn.title='Minimize';
    minBtn.innerHTML='&#9472;';
    minBtn.addEventListener('click',()=>this.minimize());
    controls.appendChild(minBtn);

    const closeBtn=document.createElement('button');
    closeBtn.className='ss-win-btn close';
    closeBtn.title='Close';
    closeBtn.innerHTML='&times;';
    closeBtn.addEventListener('click',()=>this.hide());
    controls.appendChild(closeBtn);

    titlebar.appendChild(controls);
    this.el.appendChild(titlebar);

    // Body
    this.bodyEl=document.createElement('div');
    this.bodyEl.className='ss-window-body';
    if(opts.content){
      if(typeof opts.content==='string'){
        this.bodyEl.innerHTML=opts.content;
      } else {
        this.bodyEl.appendChild(opts.content);
      }
    }
    this.el.appendChild(this.bodyEl);

    // Resize handle
    const resizeHandle=document.createElement('div');
    resizeHandle.className='ss-window-resize';
    this.el.appendChild(resizeHandle);

    // Set size
    const dw=opts.defaultSize||{width:500,height:400};
    this.el.style.width=dw.width+'px';
    this.el.style.height=dw.height+'px';

    // Set position
    const dp=opts.defaultPos||{right:20,bottom:60};
    if(dp.right!==undefined)this.el.style.right=dp.right+'px';
    if(dp.left!==undefined)this.el.style.left=dp.left+'px';
    if(dp.top!==undefined)this.el.style.top=dp.top+'px';
    if(dp.bottom!==undefined)this.el.style.bottom=dp.bottom+'px';

    // Restore saved position
    this._restorePosition();

    // Append to map container
    document.getElementById('map-container').appendChild(this.el);

    // Focus on click
    this.el.addEventListener('mousedown',()=>this.focus());

    // Drag
    this._initDrag(titlebar);
    // Resize
    this._initResize(resizeHandle,opts.minSize||{width:300,height:200});

    windows[this.id]=this;
  }

  _initDrag(handle){
    let startX,startY,startLeft,startTop;
    const onMove=(e)=>{
      const dx=(e.clientX||e.touches[0].clientX)-startX;
      const dy=(e.clientY||e.touches[0].clientY)-startY;
      // Switch to left/top positioning for drag
      this.el.style.right='auto';
      this.el.style.bottom='auto';
      const container=this.el.parentElement;
      this.el.style.left=clamp(startLeft+dx,0,container.clientWidth-50)+'px';
      this.el.style.top=clamp(startTop+dy,0,container.clientHeight-50)+'px';
    };
    const onUp=()=>{
      document.removeEventListener('mousemove',onMove);
      document.removeEventListener('mouseup',onUp);
      document.removeEventListener('touchmove',onMove);
      document.removeEventListener('touchend',onUp);
      this._savePosition();
    };
    handle.addEventListener('mousedown',(e)=>{
      if(e.target.closest('.ss-win-btn'))return;
      e.preventDefault();
      this.focus();
      startX=e.clientX;startY=e.clientY;
      const rect=this.el.getBoundingClientRect();
      const parentRect=this.el.parentElement.getBoundingClientRect();
      startLeft=rect.left-parentRect.left;
      startTop=rect.top-parentRect.top;
      // Convert to left/top
      this.el.style.left=startLeft+'px';
      this.el.style.top=startTop+'px';
      this.el.style.right='auto';
      this.el.style.bottom='auto';
      document.addEventListener('mousemove',onMove);
      document.addEventListener('mouseup',onUp);
    });
    handle.addEventListener('touchstart',(e)=>{
      if(e.target.closest('.ss-win-btn'))return;
      this.focus();
      startX=e.touches[0].clientX;startY=e.touches[0].clientY;
      const rect=this.el.getBoundingClientRect();
      const parentRect=this.el.parentElement.getBoundingClientRect();
      startLeft=rect.left-parentRect.left;
      startTop=rect.top-parentRect.top;
      this.el.style.left=startLeft+'px';
      this.el.style.top=startTop+'px';
      this.el.style.right='auto';
      this.el.style.bottom='auto';
      document.addEventListener('touchmove',onMove,{passive:false});
      document.addEventListener('touchend',onUp);
    },{passive:false});
  }

  _initResize(handle,minSize){
    let startX,startY,startW,startH;
    const onMove=(e)=>{
      const dx=(e.clientX||e.touches[0].clientX)-startX;
      const dy=(e.clientY||e.touches[0].clientY)-startY;
      this.el.style.width=Math.max(minSize.width,startW+dx)+'px';
      this.el.style.height=Math.max(minSize.height,startH+dy)+'px';
      if(this.onResize)this.onResize();
    };
    const onUp=()=>{
      document.removeEventListener('mousemove',onMove);
      document.removeEventListener('mouseup',onUp);
      this._savePosition();
    };
    handle.addEventListener('mousedown',(e)=>{
      e.preventDefault();e.stopPropagation();
      startX=e.clientX;startY=e.clientY;
      startW=this.el.offsetWidth;startH=this.el.offsetHeight;
      document.addEventListener('mousemove',onMove);
      document.addEventListener('mouseup',onUp);
    });
  }

  _savePosition(){
    try{
      localStorage.setItem('ss-win-'+this.id,JSON.stringify({
        left:this.el.style.left,top:this.el.style.top,
        width:this.el.style.width,height:this.el.style.height
      }));
    }catch(e){}
  }

  _restorePosition(){
    try{
      const saved=JSON.parse(localStorage.getItem('ss-win-'+this.id));
      if(saved){
        if(saved.left){this.el.style.left=saved.left;this.el.style.right='auto'}
        if(saved.top){this.el.style.top=saved.top;this.el.style.bottom='auto'}
        if(saved.width)this.el.style.width=saved.width;
        if(saved.height)this.el.style.height=saved.height;
      }
    }catch(e){}
  }

  focus(){
    Object.values(windows).forEach(w=>w.el.classList.remove('focused'));
    this.el.classList.add('focused');
    this.el.style.zIndex=++zCounter;
  }

  show(){
    this._hidden=false;
    this._minimized=false;
    this.el.style.display='flex';
    this.el.classList.remove('minimized');
    this.focus();
    this._updateDock();
  }

  hide(){
    this._hidden=true;
    this.el.style.display='none';
    if(this.onClose)this.onClose();
    this._updateDock();
  }

  minimize(){
    this._minimized=true;
    this.el.style.display='none';
    this._updateDock();
  }

  toggle(){
    if(this._hidden||this._minimized)this.show();
    else this.hide();
  }

  setTitle(html){this._titleEl.innerHTML=html}

  _updateDock(){
    const dock=ensureDock();
    // Remove existing dock button for this window
    const existing=dock.querySelector(`[data-win="${this.id}"]`);
    if(existing)existing.remove();
    // Add dock button if minimized
    if(this._minimized){
      const btn=document.createElement('button');
      btn.className='ss-dock-btn';
      btn.dataset.win=this.id;
      btn.textContent=this._titleEl.textContent;
      btn.addEventListener('click',()=>this.show());
      dock.appendChild(btn);
    }
    // Hide dock if empty
    dock.style.display=dock.children.length?'flex':'none';
  }
}

window.WindowManager={
  create(opts){return new SSWindow(opts)},
  get(id){return windows[id]||null},
  getAll(){return{...windows}}
};

})();
```

- [ ] **Step 3: Add script/css refs to index.html**

In `index.html`, add before the `strange-signals.css` link (line 13):
```html
<link rel="stylesheet" href="window-manager.css">
```

And add before the `strange-signals.js` script (line 296):
```html
<script src="window-manager.js"></script>
```

- [ ] **Step 4: Verify window manager loads without errors**

Open http://localhost:8001, check browser console for errors. `window.WindowManager` should be defined.

- [ ] **Step 5: Commit**

```
feat: add draggable/resizable window manager system
```

---

## Task 2: Migrate Temporal Overlay to Window Manager

**Files:**
- Modify: `index.html:261-278` — restructure temporal overlay
- Modify: `strange-signals.js:918,1347-1353` — use WindowManager for temporal
- Modify: `strange-signals.css:131-148` — remove old temporal positioning

- [ ] **Step 1: Update temporal overlay HTML**

In `index.html`, replace the temporal overlay div (lines 261-278) with just the inner content wrapped in a container that WindowManager will adopt:

```html
<!-- TEMPORAL OVERLAY (managed by WindowManager) -->
<div id="temporal-content-inner" style="display:none">
  <div class="temporal-content">
    <div class="temporal-chart-row">
      <div class="temporal-chart-label">ROLLING CORRELATION (5-YEAR WINDOW)</div>
      <svg id="temporal-rolling-svg" width="100%" height="130"></svg>
    </div>
    <div class="temporal-chart-row">
      <div class="temporal-chart-label">SEASONAL PATTERN (MONTH-OF-YEAR)</div>
      <svg id="temporal-seasonal-svg" width="100%" height="110"></svg>
    </div>
    <div class="temporal-stats" id="temporal-stats"></div>
  </div>
</div>
```

- [ ] **Step 2: Update strange-signals.js to create temporal window**

After the map init section (~line 52), add temporal window creation:

```js
/* ========== TEMPORAL WINDOW ========== */
let temporalWindow=null;
function getTemporalWindow(){
  if(temporalWindow)return temporalWindow;
  const content=document.getElementById('temporal-content-inner');
  content.style.display='block';
  temporalWindow=WindowManager.create({
    id:'temporal',
    title:'<span class="icon">&#9202;</span> TEMPORAL CORRELATION',
    content:content,
    defaultPos:{right:20,bottom:220},
    defaultSize:{width:720,height:400},
    minSize:{width:400,height:250},
    onClose:()=>{temporalOverlayVisible=false},
    onResize:()=>{/* D3 charts auto-scale via width:100% */}
  });
  return temporalWindow;
}
```

Replace line 918 (`document.getElementById('temporal-overlay').style.display='none';`) with:
```js
if(temporalWindow)temporalWindow.hide();
```

Replace the temporal run handler (lines 1347-1351) — find the `temporal-run` click handler and update to use the window:
```js
document.getElementById('temporal-run').addEventListener('click',()=>{
  const win=getTemporalWindow();
  renderTemporalCharts();
  win.show();
  temporalOverlayVisible=true;
});
```

Remove the temporal-close handler (it's now handled by WindowManager's close button).

- [ ] **Step 3: Remove old temporal-overlay CSS**

In `strange-signals.css`, remove lines 131-133 (the `.temporal-overlay` positioning rule) and lines 134-138 (`.temporal-header` and `.temporal-close`). Keep lines 140-148 (`.temporal-content`, `.temporal-chart-row`, etc.) as they style the inner content.

- [ ] **Step 4: Verify temporal overlay works as draggable window**

Open app → switch to CORR view → click TEMPORAL → OPEN DASHBOARD. Verify the temporal charts appear in a draggable/resizable window. Drag it around, resize it, minimize it, restore from dock.

- [ ] **Step 5: Commit**

```
feat: migrate temporal overlay to draggable window system
```

---

## Task 3: Hex Binning Web Worker

**Files:**
- Create: `hex-worker.js`
- Modify: `strange-signals.js:219-253` — replace inline hex computation with worker

- [ ] **Step 1: Create hex-worker.js**

```js
/* ========== HEX BINNING WEB WORKER ========== */
importScripts('https://unpkg.com/@turf/turf@7/turf.min.js');

self.onmessage=function(e){
  const{bbox,cellSide,points,nCats}=e.data;
  // points is a flat Float64Array: [lat,lon,cat, lat,lon,cat, ...]

  self.postMessage({type:'progress',pct:10,stage:'Building hex grid...'});
  const grid=turf.hexGrid(bbox,cellSide,{units:'kilometers'});
  const hexes=grid.features;
  const counts=new Array(hexes.length);
  for(let i=0;i<hexes.length;i++)counts[i]=new Array(nCats).fill(0);

  self.postMessage({type:'progress',pct:20,stage:'Building spatial index...'});

  // Build spatial index
  const cellDeg=cellSide/111;
  const idx={};
  const nPts=points.length/3;
  for(let i=0;i<nPts;i++){
    const lat=points[i*3],lon=points[i*3+1],cat=points[i*3+2];
    const key=Math.floor(lat/cellDeg)+','+Math.floor(lon/cellDeg);
    if(!idx[key])idx[key]=[];
    idx[key].push({lat,lon,cat});
  }

  self.postMessage({type:'progress',pct:30,stage:`Assigning ${nPts.toLocaleString()} points to hexes...`});

  // Assign points to hexes
  const totalHexes=hexes.length;
  for(let hi=0;hi<totalHexes;hi++){
    const hex=hexes[hi];
    const bb=turf.bbox(hex);
    const minR=Math.floor(bb[1]/cellDeg),maxR=Math.floor(bb[3]/cellDeg);
    const minC=Math.floor(bb[0]/cellDeg),maxC=Math.floor(bb[2]/cellDeg);
    for(let r=minR;r<=maxR;r++){
      for(let c=minC;c<=maxC;c++){
        const pts=idx[r+','+c];
        if(!pts)continue;
        for(let p=0;p<pts.length;p++){
          const pt=pts[p];
          if(turf.booleanPointInPolygon(turf.point([pt.lon,pt.lat]),hex)){
            counts[hi][pt.cat]++;
          }
        }
      }
    }
    // Progress every 10%
    if(hi%Math.max(1,Math.floor(totalHexes/10))===0){
      self.postMessage({type:'progress',pct:30+Math.round(hi/totalHexes*60),
        stage:`Processing hex ${hi.toLocaleString()} of ${totalHexes.toLocaleString()}...`});
    }
  }

  self.postMessage({type:'progress',pct:95,stage:'Finalizing...'});

  // Send back the grid as GeoJSON string + counts array
  self.postMessage({type:'result',gridJSON:JSON.stringify(grid),counts:counts});
};
```

- [ ] **Step 2: Add worker integration to strange-signals.js**

Replace the `getOrBuildHexData` function (lines 219-253) with an async version that uses the worker:

```js
let hexWorker=null;
function getHexWorker(){
  if(!hexWorker){
    hexWorker=new Worker('hex-worker.js');
  }
  return hexWorker;
}

function getOrBuildHexData(cellSide){
  // Synchronous version — still used for cached results
  const bounds=map.getBounds();
  const bKey=bounds.toBBoxString();
  if(cachedHexGrid&&cachedHexSize===cellSide&&cachedBoundsKey===bKey){
    return{grid:cachedHexGrid,counts:cachedHexCounts};
  }
  return null; // Cache miss — caller must use async version
}

function getOrBuildHexDataAsync(cellSide,onProgress){
  return new Promise((resolve,reject)=>{
    // Check cache first
    const cached=getOrBuildHexData(cellSide);
    if(cached){resolve(cached);return}

    const bounds=map.getBounds();
    const bbox=[bounds.getWest(),bounds.getSouth(),bounds.getEast(),bounds.getNorth()];

    // Flatten all filtered points into Float64Array for transfer
    let total=0;
    for(let i=0;i<3;i++)total+=filteredCat[i].length;
    const points=new Float64Array(total*3);
    let offset=0;
    for(let cat=0;cat<3;cat++){
      filteredCat[cat].forEach(r=>{
        points[offset++]=r[F.LAT];
        points[offset++]=r[F.LON];
        points[offset++]=cat;
      });
    }

    const worker=getHexWorker();
    worker.onmessage=(e)=>{
      if(e.data.type==='progress'){
        if(onProgress)onProgress(e.data.pct,e.data.stage);
      } else if(e.data.type==='result'){
        const grid=JSON.parse(e.data.gridJSON);
        const counts=e.data.counts;
        // Cache
        cachedHexGrid=grid;cachedHexCounts=counts;
        cachedHexSize=cellSide;cachedBoundsKey=bounds.toBBoxString();
        resolve({grid,counts});
      }
    };
    worker.onerror=(err)=>{
      console.error('Hex worker error:',err);
      reject(err);
    };
    worker.postMessage({bbox,cellSide,points,nCats:3},[points.buffer]);
  });
}
```

- [ ] **Step 3: Update runCorrelation to be async with progress**

Replace `runCorrelation` (lines 1043-1121) to use async worker and show progress:

```js
async function runCorrelation(catA,catB){
  if(corrLayer){map.removeLayer(corrLayer);corrLayer=null}

  const cellSide=parseFloat(document.getElementById('corr-hex-size').value);
  const runBtn=document.getElementById('corr-run');
  runBtn.disabled=true;
  runBtn.textContent='Computing...';

  // Show progress in result area
  const resultEl=document.getElementById('corr-result');
  resultEl.classList.add('visible');
  document.getElementById('corr-r-value').textContent='...';
  document.getElementById('corr-detail').innerHTML='<div class="analysis-progress"><div class="progress-track"><div class="progress-fill" id="corr-progress-fill" style="width:0%"></div></div><div style="font-size:10px;color:var(--text-dim);margin-top:4px" id="corr-progress-status">Starting...</div></div>';

  try{
    const{grid,counts}=await getOrBuildHexDataAsync(cellSide,(pct,stage)=>{
      const fill=document.getElementById('corr-progress-fill');
      const status=document.getElementById('corr-progress-status');
      if(fill)fill.style.width=pct+'%';
      if(status)status.textContent=stage;
    });
    const hexFeatures=grid.features;

    const countsA=counts.map(c=>c[catA]);
    const countsB=counts.map(c=>c[catB]);

    const pairs=[];
    let hotspotCount=0;
    const medA=d3.median(countsA.filter(v=>v>0))||1;
    const medB=d3.median(countsB.filter(v=>v>0))||1;

    for(let i=0;i<hexFeatures.length;i++){
      if(countsA[i]>0||countsB[i]>0){
        pairs.push([countsA[i],countsB[i]]);
        hexFeatures[i].properties.cA=countsA[i];
        hexFeatures[i].properties.cB=countsB[i];
        hexFeatures[i].properties.hotspot=countsA[i]>=medA&&countsB[i]>=medB;
        if(hexFeatures[i].properties.hotspot)hotspotCount++;
      } else {
        hexFeatures[i].properties.cA=0;
        hexFeatures[i].properties.cB=0;
        hexFeatures[i].properties.hotspot=false;
      }
    }

    const xArr=pairs.map(p=>p[0]),yArr=pairs.map(p=>p[1]);
    const r=pearsonR(xArr,yArr);
    const pVal=isNaN(r)?1:permutationPValue(xArr,yArr,r,999);

    const rDisplay=isNaN(r)?'N/A':r.toFixed(3);
    const rEl=document.getElementById('corr-r-value');
    rEl.textContent=rDisplay;
    rEl.style.color=isNaN(r)?'var(--text-dim)':r>0.3?'var(--green)':r<-0.1?'var(--pink)':'var(--cyan)';

    document.getElementById('corr-detail').innerHTML=
      `<div>${interpretR(r)}</div>`+
      `<div style="margin-top:3px;font-size:10px;color:${pVal<0.05?'var(--green)':'var(--text-dim)'}">${formatPValue(pVal)}</div>`+
      `<div style="margin-top:4px">${pairs.length} hex cells analyzed &middot; ${hotspotCount} hotspots</div>`;
    document.getElementById('stat-hotspots').textContent=hotspotCount;

    const maxVal=d3.max(pairs,p=>p[0]+p[1])||1;
    const coOccScale=d3.scaleSequential(d3.interpolateRdYlGn).domain([0,maxVal]);

    corrLayer=L.geoJSON(turf.featureCollection(hexFeatures),{
      style(feature){
        const a=feature.properties.cA,b=feature.properties.cB;
        if(a===0&&b===0)return{fillOpacity:0,weight:0};
        const score=a+b;
        const isHotspot=feature.properties.hotspot;
        return{
          fillColor:coOccScale(score),fillOpacity:isHotspot?0.7:0.4,
          weight:isHotspot?2:0.5,color:isHotspot?'#fff':'rgba(255,255,255,0.1)'
        };
      },
      onEachFeature(feature,layer){
        const a=feature.properties.cA,b=feature.properties.cB;
        if(a>0||b>0){
          let tip=`<b>Co-occurrence cell</b><br>`;
          tip+=`<span style="color:${CAT_COLORS[catA]}">${CAT_NAMES[catA]}: ${a}</span><br>`;
          tip+=`<span style="color:${CAT_COLORS[catB]}">${CAT_NAMES[catB]}: ${b}</span>`;
          if(feature.properties.hotspot)tip+=`<br><b style="color:var(--green)">HOTSPOT</b>`;
          layer.bindTooltip(tip);
        }
      }
    }).addTo(map);

    return{r,pVal,nHexes:pairs.length,hotspots:hotspotCount,interpretation:interpretR(r)};
  }finally{
    runBtn.disabled=false;
    runBtn.innerHTML='&#9672; RUN ANALYSIS';
  }
}
```

Also update `runMatrixCorrelation` to use `getOrBuildHexDataAsync` — make it `async function runMatrixCorrelation()` and `await getOrBuildHexDataAsync(cellSide)` instead of the sync call. The rest of the function stays the same.

- [ ] **Step 4: Update renderCorrelation to handle async**

Change `renderCorrelation()` (line 1030) to be async:

```js
async function renderCorrelation(){
  if(clusterLayer){map.removeLayer(clusterLayer);clusterLayer=null}
  if(corrSubMode==='spatial'){
    const catA=parseInt(document.getElementById('corr-a').value);
    const catB=parseInt(document.getElementById('corr-b').value);
    await runCorrelation(catA,catB);
  }
}
```

And in `renderCurrentView()` (line 916), the call to `renderCorrelation()` becomes async — since it returns a promise, the view switch is fire-and-forget which is fine (the progress bar handles UX).

- [ ] **Step 5: Verify correlation view no longer freezes UI**

Switch to CORR view, run analysis. Verify progress bar appears and UI remains responsive during computation.

- [ ] **Step 6: Commit**

```
perf: move hex binning to Web Worker with progress UI
```

---

## Task 4: Highlight Layer

**Files:**
- Create: `highlight-layer.js`

- [ ] **Step 1: Create highlight-layer.js**

```js
/* ========== HIGHLIGHT LAYER ========== */
(function(){
'use strict';

let highlightGroup=null;
let highlightId=0;

function ensureGroup(map){
  if(!highlightGroup){
    highlightGroup=L.layerGroup().addTo(map);
  }
  return highlightGroup;
}

function clearHighlights(){
  if(highlightGroup){
    highlightGroup.clearLayers();
  }
}

function addHighlight(map,opts){
  const{lat,lon,radiusKm,label,color}=Object.assign({radiusKm:50,color:'#00ff88',label:''},opts);
  const group=ensureGroup(map);
  const id=++highlightId;
  const radiusM=radiusKm*1000;

  // Create pulsing rings (3 staggered)
  const rings=[];
  for(let i=0;i<3;i++){
    const ring=L.circle([lat,lon],{
      radius:radiusM,
      color:color,
      fillColor:color,
      fillOpacity:0,
      weight:2,
      opacity:0,
      className:'highlight-ring highlight-ring-'+i
    });
    group.addLayer(ring);
    rings.push(ring);
  }

  // Animate rings with CSS
  rings.forEach((ring,i)=>{
    const el=ring.getElement();
    if(el){
      el.style.animation=`highlight-ping 2s ease-out ${i*0.4}s`;
      el.style.animationFillMode='forwards';
    }
  });

  // After ping animation, show persistent spotlight
  setTimeout(()=>{
    // Remove ping rings
    rings.forEach(r=>group.removeLayer(r));

    // Add spotlight circle
    const spotlight=L.circle([lat,lon],{
      radius:radiusM,
      color:color,
      fillColor:color,
      fillOpacity:0.12,
      weight:2,
      opacity:0.6,
      className:'highlight-spotlight'
    });
    group.addLayer(spotlight);

    // Add label marker
    if(label){
      const labelMarker=L.marker([lat,lon],{
        icon:L.divIcon({
          className:'highlight-label',
          html:`<div class="highlight-label-inner" style="border-color:${color};color:${color}">${label}</div>`,
          iconSize:[32,32],
          iconAnchor:[16,16]
        }),
        interactive:true
      });
      labelMarker.on('click',()=>{
        group.removeLayer(spotlight);
        group.removeLayer(labelMarker);
      });
      group.addLayer(labelMarker);
    }
  },2400);

  return id;
}

window.HighlightLayer={
  add:(map,opts)=>addHighlight(map,opts),
  clear:clearHighlights,
  addMultiple:(map,areas)=>{
    clearHighlights();
    return areas.map(a=>addHighlight(map,a));
  }
};

})();
```

- [ ] **Step 2: Add highlight CSS to window-manager.css**

Append to `window-manager.css` (so Task 4 is independently testable without ai-assistant.css):

```css
/* Highlight animations */
@keyframes highlight-ping{
  0%{stroke-opacity:0.8;stroke-width:3;fill-opacity:0.15}
  100%{stroke-opacity:0;stroke-width:1;fill-opacity:0}
}
@keyframes spotlight-pulse{
  0%,100%{fill-opacity:0.12;stroke-opacity:0.6}
  50%{fill-opacity:0.06;stroke-opacity:0.3}
}
.highlight-spotlight{animation:spotlight-pulse 3s ease-in-out infinite}
.highlight-label{background:none!important;border:none!important}
.highlight-label-inner{
  width:32px;height:32px;border-radius:50%;
  border:2px solid;display:flex;align-items:center;justify-content:center;
  font-family:var(--font-display);font-size:12px;font-weight:700;
  background:rgba(5,6,15,0.8);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);
  text-shadow:0 0 8px currentColor}
```

- [ ] **Step 3: Add script ref to index.html**

Add before `strange-signals.js`:
```html
<script src="highlight-layer.js"></script>
```

- [ ] **Step 4: Commit**

```
feat: add radar-ping highlight layer for map callouts
```

---

## Task 5: Expose StrangeSignals API Surface

**Files:**
- Modify: `strange-signals.js:1553-1557` — add window.StrangeSignals before closing IIFE

- [ ] **Step 1: Add API surface to strange-signals.js**

Before the closing `})();` at line 1557, add:

```js
/* ========== PUBLIC API (for AI assistant) ========== */
window.StrangeSignals={
  // Map
  getMap:()=>map,
  setView:setView,

  // Filters
  applyFilters:applyFilters,
  resetFilters:()=>{
    document.getElementById('year-from').value='';
    document.getElementById('year-to').value='';
    document.getElementById('state-filter').value='';
    document.getElementById('sub-filter').value='';
    [0,1,2].forEach(i=>{document.querySelector(`[data-cat="${i}"]`).checked=true});
    brushRange=null;
    applyFilters();
  },
  setFilterValues:(opts)=>{
    if(opts.yearFrom!=null)document.getElementById('year-from').value=opts.yearFrom;
    if(opts.yearTo!=null)document.getElementById('year-to').value=opts.yearTo;
    if(opts.state!=null)document.getElementById('state-filter').value=opts.state;
    if(opts.sub!=null)document.getElementById('sub-filter').value=opts.sub;
    if(opts.categories){
      [0,1,2].forEach(i=>{
        document.querySelector(`[data-cat="${i}"]`).checked=opts.categories.includes(i);
      });
    }
  },

  // Analysis (runCorrelation is async after Task 3)
  runCorrelation:runCorrelation,
  runMatrixCorrelation:async()=>{
    corrSubMode='matrix';
    document.querySelectorAll('.corr-sub-btn').forEach(b=>b.classList.toggle('active',b.dataset.submode==='matrix'));
    document.querySelectorAll('.corr-subpanel').forEach(p=>p.style.display='none');
    document.getElementById('matrix-panel').style.display='block';
    await runMatrixCorrelation();
    // corrMatrix is set by runMatrixCorrelation — it's a 3x3 array of r values
    return corrMatrix?{matrix:corrMatrix}:{computed:true};
  },
  detectClusters:()=>{
    corrSubMode='clusters';
    document.querySelectorAll('.corr-sub-btn').forEach(b=>b.classList.toggle('active',b.dataset.submode==='clusters'));
    document.querySelectorAll('.corr-subpanel').forEach(p=>p.style.display='none');
    document.getElementById('cluster-panel').style.display='block';
    document.getElementById('cluster-run').click();
    // detectedClusters structure: [{indices, centroid:{lat,lon,label}, stats:[ufo,bf,haunt], total, catCount, color}]
    return{clusters:detectedClusters.map(c=>({
      centroid:{lat:c.centroid.lat,lon:c.centroid.lon,label:c.centroid.label},
      total:c.total,
      categories:{ufo:c.stats[0],bigfoot:c.stats[1],haunted:c.stats[2]},
      catCount:c.catCount
    }))};
  },
  runTemporalAnalysis:()=>{
    corrSubMode='temporal';
    document.querySelectorAll('.corr-sub-btn').forEach(b=>b.classList.toggle('active',b.dataset.submode==='temporal'));
    document.querySelectorAll('.corr-subpanel').forEach(p=>p.style.display='none');
    document.getElementById('temporal-panel').style.display='block';
    document.getElementById('temporal-run').click();
  },

  // Data access
  getStats:()=>{
    const vis=filteredCat.reduce((s,a)=>s+a.length,0);
    return{
      total:allData.length,visible:vis,
      categories:[catArrays[0].length,catArrays[1].length,catArrays[2].length],
      filtered:[filteredCat[0].length,filteredCat[1].length,filteredCat[2].length],
      zoom:map.getZoom(),
      bounds:{south:map.getBounds().getSouth(),north:map.getBounds().getNorth(),
              west:map.getBounds().getWest(),east:map.getBounds().getEast()},
      activeFilters:{
        yearFrom:document.getElementById('year-from').value||null,
        yearTo:document.getElementById('year-to').value||null,
        state:document.getElementById('state-filter').value||null,
        sub:document.getElementById('sub-filter').value||null
      }
    };
  },
  getSightingsInArea:(lat,lon,radiusKm,category,limit)=>{
    limit=limit||20;
    const radiusDeg=radiusKm/111;
    const results=[];
    const cats=category!=null?[category]:[0,1,2];
    for(const cat of cats){
      for(const r of filteredCat[cat]){
        const dlat=r[F.LAT]-lat,dlon=r[F.LON]-lon;
        if(Math.abs(dlat)>radiusDeg||Math.abs(dlon)>radiusDeg)continue;
        const dist=Math.sqrt(dlat*dlat+dlon*dlon)*111;
        if(dist<=radiusKm){
          results.push({cat:cat,catName:CAT_NAMES[cat],lat:r[F.LAT],lon:r[F.LON],
            date:r[F.DATE],location:r[F.LOC],sub:r[F.SUB],
            description:(r[F.DESC]||'').substring(0,200),distKm:Math.round(dist*10)/10});
        }
      }
    }
    results.sort((a,b)=>a.distKm-b.distKm);
    const limited=results.slice(0,limit);
    const countsByCategory={};
    for(const r of results){countsByCategory[r.catName]=(countsByCategory[r.catName]||0)+1}
    return{total:results.length,showing:limited.length,countsByCategory,sightings:limited};
  },

  // Constants
  F,CAT_NAMES,CAT_COLORS
};
```

- [ ] **Step 2: Verify API surface is accessible**

Open browser console, type `window.StrangeSignals.getStats()` — should return stats object with total, visible, categories, etc.

- [ ] **Step 3: Commit**

```
feat: expose StrangeSignals API surface for AI assistant tool use
```

---

## Task 6: AI Assistant — Chat UI & Styles

**Files:**
- Create: `ai-assistant.css`
- Create: `ai-assistant.js` (initial: UI only, no API calls yet)
- Modify: `index.html` — add refs and toggle button

- [ ] **Step 1: Create ai-assistant.css**

```css
/* ========== AI ASSISTANT ========== */

/* Chat messages */
.signal-messages{padding:12px;display:flex;flex-direction:column;gap:10px;
  overflow-y:auto;flex:1;min-height:0}
.signal-msg{max-width:90%;padding:10px 12px;border-radius:6px;font-size:11px;line-height:1.6}
.signal-msg.assistant{background:rgba(0,255,136,0.06);border:1px solid rgba(0,255,136,0.15);
  align-self:flex-start;color:var(--text)}
.signal-msg.user{background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.15);
  align-self:flex-end;color:var(--text)}
.signal-msg .msg-role{font-family:var(--font-display);font-size:8px;letter-spacing:1.5px;
  color:var(--text-dim);margin-bottom:4px}
.signal-msg.assistant .msg-role{color:var(--green)}
.signal-msg.user .msg-role{color:var(--cyan)}

/* Markdown in messages */
.signal-msg strong{color:var(--text-bright)}
.signal-msg code{background:rgba(255,255,255,0.06);padding:1px 4px;border-radius:2px;font-size:10px}
.signal-msg ul,.signal-msg ol{margin:4px 0;padding-left:16px}
.signal-msg li{margin:2px 0}

/* Tool call indicators */
.signal-tool{display:flex;align-items:center;gap:6px;padding:4px 8px;margin:4px 0;
  background:rgba(170,68,255,0.06);border:1px solid rgba(170,68,255,0.15);
  border-radius:4px;font-size:10px;color:var(--purple)}
.signal-tool.done{border-color:rgba(0,255,136,0.15);color:var(--green)}
.signal-tool-icon{font-size:12px;animation:tool-spin 1s linear infinite}
.signal-tool.done .signal-tool-icon{animation:none}
@keyframes tool-spin{to{transform:rotate(360deg)}}

/* Input bar */
.signal-input-bar{display:flex;gap:6px;padding:8px 12px;border-top:1px solid var(--border);flex-shrink:0}
.signal-input{flex:1;background:rgba(255,255,255,0.04);border:1px solid var(--border);
  border-radius:4px;color:var(--text);padding:8px 10px;outline:none;resize:none;
  font-family:var(--font-mono);font-size:11px;min-height:36px;max-height:120px}
.signal-input:focus{border-color:var(--green)}
.signal-input::placeholder{color:var(--text-dim)}
.signal-send{padding:8px 14px;background:rgba(0,255,136,0.1);border:1px solid var(--green);
  border-radius:4px;color:var(--green);cursor:pointer;font-family:var(--font-display);
  font-size:10px;letter-spacing:1px;transition:all .15s;flex-shrink:0}
.signal-send:hover{background:rgba(0,255,136,0.2)}
.signal-send:disabled{opacity:0.4;cursor:not-allowed}

/* Settings */
.signal-settings{padding:12px;display:flex;flex-direction:column;gap:8px}
.signal-settings label{font-family:var(--font-display);font-size:9px;letter-spacing:1px;color:var(--text-dim)}
.signal-settings input,.signal-settings select{width:100%;background:rgba(255,255,255,0.04);
  border:1px solid var(--border);border-radius:3px;color:var(--text);padding:6px 8px;outline:none}
.signal-settings input:focus,.signal-settings select:focus{border-color:var(--green)}
.signal-settings-actions{display:flex;gap:6px;margin-top:4px}

/* Settings gear button */
.signal-gear{position:absolute;top:8px;right:8px;width:24px;height:24px;
  background:none;border:1px solid var(--border);border-radius:3px;color:var(--text-dim);
  cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;
  transition:all .15s;z-index:1}
.signal-gear:hover{color:var(--text);border-color:var(--border-bright)}

/* AI toggle button in header */
#ai-toggle{padding:4px 12px;border:1px solid var(--purple);border-radius:3px;
  background:rgba(170,68,255,0.1);color:var(--purple);cursor:pointer;
  font-family:var(--font-display);font-size:10px;letter-spacing:1px;
  transition:all .15s;margin-left:auto}
#ai-toggle:hover{background:rgba(170,68,255,0.2)}
#ai-toggle.active{background:rgba(170,68,255,0.25);border-color:rgba(170,68,255,0.6)}

/* Streaming cursor */
.signal-cursor{display:inline-block;width:6px;height:14px;background:var(--green);
  animation:cursor-blink 0.8s step-end infinite;vertical-align:text-bottom;margin-left:2px}
@keyframes cursor-blink{50%{opacity:0}}

```

- [ ] **Step 2: Add HTML elements for AI toggle**

In `index.html`, add the AI toggle button to the header-right div (after the kbd-hint on line 47):

```html
<button id="ai-toggle" title="Toggle AI Assistant (I)">SIGNAL</button>
```

Add CSS and script refs:
```html
<link rel="stylesheet" href="ai-assistant.css">
```
(before strange-signals.css)

```html
<script src="ai-assistant.js"></script>
```
(after strange-signals.js — needs window.StrangeSignals to exist)

- [ ] **Step 3: Create ai-assistant.js — UI shell**

```js
/* ========== AI ASSISTANT ("SIGNAL") ========== */
(function(){
'use strict';

/* ===== STATE ===== */
let chatWindow=null;
let messages=[];
let isStreaming=false;
let settingsVisible=false;

/* ===== US STATE CENTROIDS (for zoom_to_region) ===== */
const STATE_CENTROIDS={
  AL:[32.8,-86.8],AK:[64.2,-152.5],AZ:[34.3,-111.7],AR:[34.8,-92.2],CA:[36.8,-119.4],
  CO:[39.0,-105.5],CT:[41.6,-72.7],DE:[39.0,-75.5],FL:[28.6,-82.4],GA:[32.7,-83.5],
  HI:[20.5,-157.5],ID:[44.1,-114.7],IL:[40.0,-89.0],IN:[39.9,-86.3],IA:[42.0,-93.5],
  KS:[38.5,-98.3],KY:[37.5,-85.3],LA:[31.0,-92.0],ME:[45.3,-69.0],MD:[39.0,-76.8],
  MA:[42.2,-71.5],MI:[44.2,-84.5],MN:[46.0,-94.3],MS:[32.7,-89.7],MO:[38.3,-92.5],
  MT:[47.0,-109.6],NE:[41.5,-99.8],NV:[39.5,-116.9],NH:[43.7,-71.5],NJ:[40.1,-74.5],
  NM:[34.5,-106.0],NY:[43.0,-75.5],NC:[35.5,-79.4],ND:[47.4,-100.5],OH:[40.4,-82.8],
  OK:[35.5,-97.5],OR:[44.0,-120.5],PA:[41.0,-77.5],RI:[41.7,-71.5],SC:[34.0,-81.0],
  SD:[44.4,-100.2],TN:[35.9,-86.4],TX:[31.5,-99.3],UT:[39.3,-111.7],VT:[44.1,-72.6],
  VA:[37.5,-78.9],WA:[47.4,-120.7],WV:[38.6,-80.6],WI:[44.5,-89.8],WY:[43.0,-107.6],
  DC:[38.9,-77.0]
};

/* ===== TOOL DEFINITIONS ===== */
const TOOLS=[
  {name:'zoom_to_region',description:'Pan and zoom the map to a US state, city, or coordinates.',
    input_schema:{type:'object',properties:{
      state:{type:'string',description:'US state code (e.g. OH, CA)'},
      city:{type:'string',description:'City name for geocoding'},
      lat:{type:'number'},lon:{type:'number'},
      zoom:{type:'integer',minimum:3,maximum:18,default:7}
    }}},
  {name:'set_filters',description:'Apply data filters: year range, state, subcategory, category visibility.',
    input_schema:{type:'object',properties:{
      year_from:{type:'integer'},year_to:{type:'integer'},
      state:{type:'string'},subcategory:{type:'string'},
      categories:{type:'array',items:{type:'integer',enum:[0,1,2]},description:'Which categories to show (0=UFO,1=Bigfoot,2=Haunted)'}
    }}},
  {name:'set_view_mode',description:'Switch map visualization mode.',
    input_schema:{type:'object',properties:{
      mode:{type:'string',enum:['markers','heatmap','hexbin','correlation']}
    },required:['mode']}},
  {name:'run_spatial_correlation',description:'Compute Pearson spatial correlation between two categories using hex binning. Returns r, p-value, interpretation.',
    input_schema:{type:'object',properties:{
      category_a:{type:'integer',enum:[0,1,2]},
      category_b:{type:'integer',enum:[0,1,2]},
      hex_size_km:{type:'number',default:25}
    },required:['category_a','category_b']}},
  {name:'run_matrix_correlation',description:'Compute all-pairs 3x3 correlation matrix with p-values.',
    input_schema:{type:'object',properties:{hex_size_km:{type:'number',default:25}}}},
  {name:'detect_clusters',description:'Find dense multi-category hotspot regions via BFS clustering. Returns cluster locations and compositions.',
    input_schema:{type:'object',properties:{
      min_sightings:{type:'integer',default:30},
      hex_size_km:{type:'number',default:25}
    }}},
  {name:'run_temporal_analysis',description:'Open temporal correlation dashboard showing rolling correlation and seasonal patterns.',
    input_schema:{type:'object',properties:{}}},
  {name:'highlight_areas',description:'Highlight areas on the map with pulsing radar-ping animations that settle into labeled spotlights.',
    input_schema:{type:'object',properties:{
      areas:{type:'array',items:{type:'object',properties:{
        lat:{type:'number'},lon:{type:'number'},
        radius_km:{type:'number',default:50},
        label:{type:'string'},color:{type:'string',default:'#00ff88'}
      },required:['lat','lon','label']}}
    },required:['areas']}},
  {name:'get_statistics',description:'Get current dataset statistics: counts per category, active filters, zoom, bounds.',
    input_schema:{type:'object',properties:{}}},
  {name:'get_sightings_in_area',description:'Query sightings within a radius of a point. Returns counts and sample records.',
    input_schema:{type:'object',properties:{
      lat:{type:'number'},lon:{type:'number'},
      radius_km:{type:'number',default:50},
      category:{type:'integer',enum:[0,1,2]},
      limit:{type:'integer',default:20,maximum:100}
    },required:['lat','lon']}}
];

const SYSTEM_PROMPT=`You are SIGNAL, an AI analyst embedded in Strange Signals — a paranormal sightings correlation map with 183K+ geocoded records across three categories: UFO/UAP (~170K), Bigfoot/Sasquatch (~4.2K), and Haunted Places (~8.8K).

You help users investigate spatial and temporal patterns in paranormal sighting data. You can control the map, run statistical analyses, highlight areas of interest, and explain findings in plain language.

When the user asks about patterns, correlations, or specific regions:
1. Use your tools to filter, analyze, and visualize the data
2. Explain what you found and what it means statistically
3. Highlight relevant areas on the map so the user can see them

Always note statistical significance. A correlation of r=0.3 with p>0.05 is not meaningful — say so. Be honest about the limitations of the data.

Available data spans from ~1900 to 2023. Geographic coverage is US-centric.
Categories: 0=UFO/UAP, 1=Bigfoot/Sasquatch, 2=Haunted Places.

Keep responses concise but informative. Use the highlight_areas tool to visually call out important findings on the map.`;

/* ===== CHAT WINDOW ===== */
function createChatWindow(){
  if(chatWindow)return chatWindow;

  // Build chat DOM
  const container=document.createElement('div');
  container.innerHTML=`
    <button class="signal-gear" id="signal-gear" title="Settings">&#9881;</button>
    <div class="signal-settings" id="signal-settings" style="display:none">
      <label>API KEY</label>
      <input type="password" id="signal-api-key" placeholder="sk-ant-..." value="${localStorage.getItem('signal-api-key')||''}">
      <label>MODEL</label>
      <select id="signal-model">
        <option value="claude-sonnet-4-6"${getModel()==='claude-sonnet-4-6'?' selected':''}>Claude Sonnet 4.6 (fast)</option>
        <option value="claude-haiku-4-5-20251001"${getModel()==='claude-haiku-4-5-20251001'?' selected':''}>Claude Haiku 4.5 (fastest)</option>
        <option value="claude-opus-4-6"${getModel()==='claude-opus-4-6'?' selected':''}>Claude Opus 4.6 (best)</option>
      </select>
      <div class="signal-settings-actions">
        <button class="btn-sm" id="signal-clear-history">CLEAR HISTORY</button>
        <button class="btn-sm primary" id="signal-save-settings">SAVE & CLOSE</button>
      </div>
    </div>
    <div class="signal-messages" id="signal-messages"></div>
    <div class="signal-input-bar">
      <textarea class="signal-input" id="signal-input" placeholder="Ask about patterns, correlations, or regions..." rows="1"></textarea>
      <button class="signal-send" id="signal-send">SEND</button>
    </div>
  `;

  chatWindow=WindowManager.create({
    id:'signal',
    title:'<span class="icon" style="color:var(--purple)">&#9678;</span> SIGNAL // AI ANALYST',
    content:container,
    defaultPos:{right:20,bottom:220},
    defaultSize:{width:420,height:500},
    minSize:{width:320,height:300}
  });

  // Event listeners
  document.getElementById('signal-gear').addEventListener('click',()=>{
    settingsVisible=!settingsVisible;
    document.getElementById('signal-settings').style.display=settingsVisible?'flex':'none';
  });
  document.getElementById('signal-save-settings').addEventListener('click',()=>{
    localStorage.setItem('signal-api-key',document.getElementById('signal-api-key').value);
    localStorage.setItem('signal-model',document.getElementById('signal-model').value);
    settingsVisible=false;
    document.getElementById('signal-settings').style.display='none';
  });
  document.getElementById('signal-clear-history').addEventListener('click',()=>{
    messages=[];
    document.getElementById('signal-messages').innerHTML='';
    addGreeting();
  });
  document.getElementById('signal-send').addEventListener('click',sendMessage);
  document.getElementById('signal-input').addEventListener('keydown',(e)=>{
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage()}
  });
  // Auto-resize textarea
  document.getElementById('signal-input').addEventListener('input',function(){
    this.style.height='auto';
    this.style.height=Math.min(this.scrollHeight,120)+'px';
  });

  addGreeting();
  return chatWindow;
}

function getModel(){return localStorage.getItem('signal-model')||'claude-sonnet-4-6'}
function getApiKey(){return localStorage.getItem('signal-api-key')||''}

/* ===== MESSAGE RENDERING ===== */
function addGreeting(){
  const el=document.getElementById('signal-messages');
  appendMessage('assistant',`**SIGNAL online.** I'm your AI analyst for Strange Signals.\n\nI can search the dataset, run correlation analyses, detect clusters, and highlight findings on the map. Try:\n\n- "Show me UFO hotspots in the Pacific Northwest"\n- "Are Bigfoot sightings correlated with UFO activity?"\n- "Find areas where all three categories overlap"\n- "What are the seasonal patterns?"`);
}

function appendMessage(role,text){
  const el=document.getElementById('signal-messages');
  const msgDiv=document.createElement('div');
  msgDiv.className='signal-msg '+role;
  const roleLabel=role==='assistant'?'SIGNAL':'YOU';
  msgDiv.innerHTML=`<div class="msg-role">${roleLabel}</div><div class="msg-text">${renderMarkdown(text)}</div>`;
  el.appendChild(msgDiv);
  el.scrollTop=el.scrollHeight;
  return msgDiv;
}

function appendToolIndicator(name,status){
  const el=document.getElementById('signal-messages');
  const toolDiv=document.createElement('div');
  toolDiv.className='signal-tool'+(status==='done'?' done':'');
  const icon=status==='done'?'&#10003;':'&#9678;';
  const label=formatToolName(name);
  toolDiv.innerHTML=`<span class="signal-tool-icon">${icon}</span> ${label}`;
  el.appendChild(toolDiv);
  el.scrollTop=el.scrollHeight;
  return toolDiv;
}

function updateToolIndicator(div,status){
  div.className='signal-tool'+(status==='done'?' done':'');
  const icon=status==='done'?'&#10003;':'&#9678;';
  div.querySelector('.signal-tool-icon').innerHTML=icon;
}

function formatToolName(name){
  return name.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
}

function renderMarkdown(text){
  // Basic markdown: bold, italic, code, lists
  return text
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`(.+?)`/g,'<code>$1</code>')
    .replace(/^- (.+)$/gm,'<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s,'<ul>$1</ul>')
    .replace(/\n/g,'<br>');
}

/* ===== TOOL EXECUTION ===== */
async function executeTool(name,input){
  const SS=window.StrangeSignals;
  if(!SS)return{error:'App not ready'};

  switch(name){
    case 'zoom_to_region':{
      let lat,lon,zoom=input.zoom||7;
      if(input.state){
        const code=input.state.toUpperCase();
        const coords=STATE_CENTROIDS[code];
        if(coords){lat=coords[0];lon=coords[1]}
        else return{error:`Unknown state: ${input.state}`};
      } else if(input.city){
        try{
          const resp=await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(input.city)}&limit=1`);
          const data=await resp.json();
          if(data.length){lat=parseFloat(data[0].lat);lon=parseFloat(data[0].lon)}
          else return{error:`Could not find: ${input.city}`};
        }catch(e){return{error:'Geocoding failed'}}
      } else if(input.lat!=null&&input.lon!=null){
        lat=input.lat;lon=input.lon;
      } else {
        return{error:'Provide state, city, or lat/lon'};
      }
      SS.getMap().flyTo([lat,lon],zoom,{duration:1.5});
      return{success:true,lat,lon,zoom};
    }

    case 'set_filters':{
      SS.setFilterValues({
        yearFrom:input.year_from,yearTo:input.year_to,
        state:input.state,sub:input.subcategory,
        categories:input.categories
      });
      SS.applyFilters();
      const stats=SS.getStats();
      return{visible:stats.visible,perCategory:stats.categories};
    }

    case 'set_view_mode':{
      SS.setView(input.mode);
      return{mode:input.mode};
    }

    case 'run_spatial_correlation':{
      if(input.hex_size_km)document.getElementById('corr-hex-size').value=input.hex_size_km;
      SS.setView('correlation');
      const result=await SS.runCorrelation(input.category_a,input.category_b);
      return result||{error:'Correlation computation failed'};
    }

    case 'run_matrix_correlation':{
      if(input.hex_size_km)document.getElementById('corr-hex-size').value=input.hex_size_km;
      SS.setView('correlation');
      const result=await SS.runMatrixCorrelation();
      return result||{error:'Matrix computation failed'};
    }

    case 'detect_clusters':{
      if(input.hex_size_km)document.getElementById('corr-hex-size').value=input.hex_size_km;
      if(input.min_sightings)document.getElementById('cluster-threshold').value=input.min_sightings;
      SS.setView('correlation');
      const result=SS.detectClusters();
      return result||{clusters:[]};
    }

    case 'run_temporal_analysis':{
      SS.setView('correlation');
      SS.runTemporalAnalysis();
      return{opened:true};
    }

    case 'highlight_areas':{
      const map=SS.getMap();
      HighlightLayer.addMultiple(map,input.areas.map(a=>({
        lat:a.lat,lon:a.lon,radiusKm:a.radius_km||50,
        label:a.label,color:a.color||'#00ff88'
      })));
      return{highlighted:input.areas.length};
    }

    case 'get_statistics':{
      return SS.getStats();
    }

    case 'get_sightings_in_area':{
      const results=SS.getSightingsInArea(input.lat,input.lon,input.radius_km||50,input.category,input.limit||20);
      return results;
    }

    default:
      return{error:`Unknown tool: ${name}`};
  }
}

/* ===== API CALL WITH STREAMING ===== */
async function sendMessage(){
  const input=document.getElementById('signal-input');
  const text=input.value.trim();
  if(!text||isStreaming)return;

  const apiKey=getApiKey();
  if(!apiKey){
    appendMessage('assistant','Please set your Anthropic API key in settings (gear icon).');
    return;
  }

  // Clear highlights on new query
  if(window.HighlightLayer)HighlightLayer.clear();

  // Add user message
  appendMessage('user',text);
  messages.push({role:'user',content:text});
  input.value='';
  input.style.height='auto';

  // Trim to last 20 messages
  if(messages.length>20)messages=messages.slice(-20);

  isStreaming=true;
  document.getElementById('signal-send').disabled=true;

  try{
    await runConversationLoop();
  }catch(e){
    console.error('SIGNAL error:',e);
    appendMessage('assistant',`Error: ${e.message||'Unknown error'}. Check your API key and try again.`);
  }finally{
    isStreaming=false;
    document.getElementById('signal-send').disabled=false;
  }
}

async function runConversationLoop(){
  const apiKey=getApiKey();
  const model=getModel();

  // Loop to handle multi-turn tool use
  for(let turn=0;turn<10;turn++){
    const body={
      model:model,
      max_tokens:4096,
      system:SYSTEM_PROMPT,
      tools:TOOLS,
      messages:messages,
      stream:true
    };

    const resp=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'x-api-key':apiKey,
        'anthropic-version':'2023-06-01',
        'anthropic-dangerous-direct-browser-access':'true'
      },
      body:JSON.stringify(body)
    });

    if(!resp.ok){
      const err=await resp.text();
      throw new Error(`API ${resp.status}: ${err.substring(0,200)}`);
    }

    // Parse SSE stream
    const result=await parseStream(resp);

    // Process result
    const hasToolUse=result.content.some(b=>b.type==='tool_use');

    // Add assistant message to history
    messages.push({role:'assistant',content:result.content});

    if(!hasToolUse){
      // No tool calls — conversation turn is complete
      break;
    }

    // Execute tool calls
    const toolResults=[];
    for(const block of result.content){
      if(block.type!=='tool_use'){continue}
      const indicator=appendToolIndicator(block.name,'running');
      try{
        const toolResult=await executeTool(block.name,block.input);
        updateToolIndicator(indicator,'done');
        toolResults.push({type:'tool_result',tool_use_id:block.id,content:JSON.stringify(toolResult)});
      }catch(e){
        updateToolIndicator(indicator,'done');
        toolResults.push({type:'tool_result',tool_use_id:block.id,content:JSON.stringify({error:e.message}),is_error:true});
      }
    }

    // Add tool results to messages
    messages.push({role:'user',content:toolResults});
  }
}

async function parseStream(resp){
  const reader=resp.body.getReader();
  const decoder=new TextDecoder();
  let buffer='';
  let currentText='';
  let msgDiv=null;
  const content=[];
  let currentBlock=null;
  let toolInput='';

  while(true){
    const{done,value}=await reader.read();
    if(done)break;
    buffer+=decoder.decode(value,{stream:true});

    const lines=buffer.split('\n');
    buffer=lines.pop()||'';

    for(const line of lines){
      if(!line.startsWith('data: '))continue;
      const data=line.slice(6);
      if(data==='[DONE]')continue;

      try{
        const event=JSON.parse(data);

        switch(event.type){
          case 'content_block_start':
            currentBlock=event.content_block;
            if(currentBlock.type==='text'){
              currentText='';
              msgDiv=appendMessage('assistant','');
            } else if(currentBlock.type==='tool_use'){
              toolInput='';
            }
            break;

          case 'content_block_delta':
            if(event.delta.type==='text_delta'){
              currentText+=event.delta.text;
              if(msgDiv){
                msgDiv.querySelector('.msg-text').innerHTML=renderMarkdown(currentText)+'<span class="signal-cursor"></span>';
                document.getElementById('signal-messages').scrollTop=document.getElementById('signal-messages').scrollHeight;
              }
            } else if(event.delta.type==='input_json_delta'){
              toolInput+=event.delta.partial_json;
            }
            break;

          case 'content_block_stop':
            if(currentBlock&&currentBlock.type==='text'){
              if(msgDiv){
                msgDiv.querySelector('.msg-text').innerHTML=renderMarkdown(currentText);
              }
              content.push({type:'text',text:currentText});
            } else if(currentBlock&&currentBlock.type==='tool_use'){
              let parsedInput={};
              try{parsedInput=JSON.parse(toolInput)}catch(e){}
              content.push({type:'tool_use',id:currentBlock.id,name:currentBlock.name,input:parsedInput});
            }
            currentBlock=null;
            break;
        }
      }catch(e){/* skip malformed events */}
    }
  }

  return{content};
}

/* ===== TOGGLE & KEYBOARD ===== */
function toggleAssistant(){
  const win=createChatWindow();
  win.toggle();
  document.getElementById('ai-toggle').classList.toggle('active',!win._hidden&&!win._minimized);
}

// Toggle button
document.getElementById('ai-toggle').addEventListener('click',toggleAssistant);

// Keyboard shortcut: I
document.addEventListener('keydown',(e)=>{
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT')return;
  if(e.key==='i'||e.key==='I'){
    e.preventDefault();
    toggleAssistant();
  }
});

})();
```

- [ ] **Step 4: Commit**

```
feat: add SIGNAL AI assistant with chat UI and tool definitions
```

---

## Task 7: Update .env.example and Keyboard Shortcuts

**Files:**
- Modify: `.env.example`
- Modify: `index.html:246-247` — add I shortcut to shortcuts panel

- [ ] **Step 1: Rewrite .env.example** (remove stale GardenSync references)

```js
/* ========== PUBLIC API (for AI assistant) ========== */
window.StrangeSignals={
  // Map
  getMap:()=>map,
  setView:setView,

  // Filters
  applyFilters:applyFilters,
  resetFilters:()=>{
    document.getElementById('year-from').value='';
    document.getElementById('year-to').value='';
    document.getElementById('state-filter').value='';
    document.getElementById('sub-filter').value='';
    [0,1,2].forEach(i=>{document.querySelector(`[data-cat="${i}"]`).checked=true});
    brushRange=null;
    applyFilters();
  },
  setFilterValues:(opts)=>{
    if(opts.yearFrom!=null)document.getElementById('year-from').value=opts.yearFrom;
    if(opts.yearTo!=null)document.getElementById('year-to').value=opts.yearTo;
    if(opts.state!=null)document.getElementById('state-filter').value=opts.state;
    if(opts.sub!=null)document.getElementById('sub-filter').value=opts.sub;
    if(opts.categories){
      [0,1,2].forEach(i=>{
        document.querySelector(`[data-cat="${i}"]`).checked=opts.categories.includes(i);
      });
    }
  },

  // Analysis
  runCorrelation:runCorrelation,
  runMatrixCorrelation:async()=>{
    const cellSide=parseFloat(document.getElementById('corr-hex-size').value);
    // Switch to matrix sub-mode
    corrSubMode='matrix';
    document.querySelectorAll('.corr-sub-btn').forEach(b=>b.classList.toggle('active',b.dataset.submode==='matrix'));
    document.querySelectorAll('.corr-subpanel').forEach(p=>p.style.display='none');
    document.getElementById('matrix-panel').style.display='block';
    runMatrixCorrelation();
    return corrMatrix?{matrix:corrMatrix}:{computed:true};
  },
  detectClusters:()=>{
    corrSubMode='clusters';
    document.querySelectorAll('.corr-sub-btn').forEach(b=>b.classList.toggle('active',b.dataset.submode==='clusters'));
    document.querySelectorAll('.corr-subpanel').forEach(p=>p.style.display='none');
    document.getElementById('cluster-panel').style.display='block';
    document.getElementById('cluster-run').click();
    return{clusters:detectedClusters.map(c=>({
      centroid:c.centroid,total:c.stats.total,
      categories:{ufo:c.stats[0]||0,bigfoot:c.stats[1]||0,haunted:c.stats[2]||0},
      label:c.label
    }))};
  },
  runTemporalAnalysis:()=>{
    corrSubMode='temporal';
    document.querySelectorAll('.corr-sub-btn').forEach(b=>b.classList.toggle('active',b.dataset.submode==='temporal'));
    document.querySelectorAll('.corr-subpanel').forEach(p=>p.style.display='none');
    document.getElementById('temporal-panel').style.display='block';
    document.getElementById('temporal-run').click();
  },

  // Data access
  getStats:()=>{
    const vis=filteredCat.reduce((s,a)=>s+a.length,0);
    return{
      total:allData.length,visible:vis,
      categories:[catArrays[0].length,catArrays[1].length,catArrays[2].length],
      filtered:[filteredCat[0].length,filteredCat[1].length,filteredCat[2].length],
      zoom:map.getZoom(),
      bounds:{south:map.getBounds().getSouth(),north:map.getBounds().getNorth(),
              west:map.getBounds().getWest(),east:map.getBounds().getEast()},
      activeFilters:{
        yearFrom:document.getElementById('year-from').value||null,
        yearTo:document.getElementById('year-to').value||null,
        state:document.getElementById('state-filter').value||null,
        sub:document.getElementById('sub-filter').value||null
      }
    };
  },
  getSightingsInArea:(lat,lon,radiusKm,category,limit)=>{
    limit=limit||20;
    const radiusDeg=radiusKm/111;
    const results=[];
    const cats=category!=null?[category]:[0,1,2];
    for(const cat of cats){
      for(const r of filteredCat[cat]){
        const dlat=r[F.LAT]-lat,dlon=r[F.LON]-lon;
        if(Math.abs(dlat)>radiusDeg||Math.abs(dlon)>radiusDeg)continue;
        const dist=Math.sqrt(dlat*dlat+dlon*dlon)*111;
        if(dist<=radiusKm){
          results.push({cat:cat,catName:CAT_NAMES[cat],lat:r[F.LAT],lon:r[F.LON],
            date:r[F.DATE],location:r[F.LOC],sub:r[F.SUB],
            description:(r[F.DESC]||'').substring(0,200),distKm:Math.round(dist*10)/10});
        }
      }
    }
    results.sort((a,b)=>a.distKm-b.distKm);
    const limited=results.slice(0,limit);
    const countsByCategory={};
    for(const r of results){countsByCategory[r.catName]=(countsByCategory[r.catName]||0)+1}
    return{total:results.length,showing:limited.length,countsByCategory,sightings:limited};
  },

  // Constants
  F,CAT_NAMES,CAT_COLORS
};
```

Replace `.env.example` contents with:
```
# ================================================
# STRANGE SIGNALS — Environment Config
# ================================================
# Copy this file to .env and fill in your keys:
#   cp .env.example .env
#
# NEVER commit .env to git (it's in .gitignore)

# Anthropic Claude API key (SIGNAL AI assistant)
# Note: key is entered via the SIGNAL chat panel gear icon
# and stored in browser localStorage. This file is for reference only.
ANTHROPIC_API_KEY=
```

- [ ] **Step 2: Add keyboard shortcut hint to sidebar**

In `index.html`, update the shortcuts section (around line 246) to include:
```html
<b style="color:var(--text)">I</b> Signal AI
```

- [ ] **Step 3: Commit**

```
docs: update .env.example and keyboard shortcuts for SIGNAL
```

---

## Task 8: Integration Testing & Final Verification

- [ ] **Step 1: Verify all scripts load without errors**

Open http://localhost:8001 in browser. Check console for zero errors. Verify:
- `window.WindowManager` exists
- `window.HighlightLayer` exists
- `window.StrangeSignals` exists
- AI toggle button ("SIGNAL") visible in header

- [ ] **Step 2: Test window manager**

Click SIGNAL button → chat window appears, draggable, resizable, minimizable. Click temporal dashboard → temporal window appears. Both windows can be dragged independently and z-stacked.

- [ ] **Step 3: Test AI assistant (requires API key)**

Enter Anthropic API key in settings. Send "What's in the dataset?" → Claude responds with dataset statistics using `get_statistics` tool. Send "Show me UFO hotspots in Ohio" → Claude calls `set_filters`, `zoom_to_region`, `highlight_areas`.

- [ ] **Step 4: Test correlation performance**

Switch to CORR view, run spatial analysis. Verify progress bar appears, UI stays responsive during computation.

- [ ] **Step 5: Final commit with all files**

```
feat: SIGNAL Intelligence — AI assistant, window manager, hex worker, highlights

Complete feature set:
- Draggable/resizable window system for all floating panels
- Web Worker for hex binning (non-blocking correlation analysis)
- Claude-powered AI assistant with 10 tools for map control
- Radar-ping highlights that settle into labeled spotlights
- Streaming responses, multi-turn conversation with tool use
```
