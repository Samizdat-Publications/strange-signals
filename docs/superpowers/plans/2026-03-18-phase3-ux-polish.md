# Phase 3 UX Polish Implementation Plan (Items #9-13)

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add mobile responsiveness, keyboard shortcuts with help overlay, SIGNAL conversation persistence, exportable dashboard snapshots, and map annotations to complete the Phase 3 UX polish.

**Architecture:** Each feature is self-contained. #11 modifies only `ai-assistant.js`. #10 modifies `strange-signals.js` + adds a help overlay to `index.html`. #9 modifies `strange-signals.css`. #12 and #13 each add a new JS module plus HTML/CSS. All follow the existing IIFE pattern, CDN-only, no build tools.

**Tech Stack:** Vanilla JS (IIFE), Leaflet 1.9.4, D3 v7, CSS custom properties, localStorage API, html2canvas (CDN) for snapshots.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `ai-assistant.js` | Modify | #11: Add localStorage persistence for conversation history |
| `strange-signals.js` | Modify | #10: Expand keyboard handler, #12: snapshot export fn |
| `strange-signals.css` | Modify | #9: Mobile styles, #10: help overlay, #12: snapshot btn, #13: annotation styles |
| `index.html` | Modify | #10: help overlay HTML, #12: snapshot button, #13: annotation toolbar |
| `annotations.js` | Create | #13: Annotation layer (pins, notes, persistence, export) |
| `annotations.css` | Create | #13: Annotation toolbar + popup styles |

---

### Task 1: SIGNAL Conversation Memory (#11)

**Files:**
- Modify: `ai-assistant.js` (lines 6-7 state, lines 225-228 clear history, lines 593-606 send message, lines 655 assistant response, lines 675 tool results, line 239 greeting)

- [ ] **Step 1: Add conversation save/restore functions**

In `ai-assistant.js`, after `let settingsVisible=false;` (line 9), add:

```js
var STORAGE_KEY='signal-conversation';
var MAX_STORED_MESSAGES=40;

function saveConversation(){
  try{
    // Only save text messages, not tool_result arrays
    var saveable=messages.filter(function(m){
      return typeof m.content==='string'||
        (Array.isArray(m.content)&&m.content.some(function(b){return b.type==='text'}));
    });
    if(saveable.length>MAX_STORED_MESSAGES)saveable=saveable.slice(-MAX_STORED_MESSAGES);
    localStorage.setItem(STORAGE_KEY,JSON.stringify(saveable));
  }catch(e){console.warn('Failed to save conversation',e)}
}

function loadConversation(){
  try{
    var stored=localStorage.getItem(STORAGE_KEY);
    if(!stored)return[];
    return JSON.parse(stored);
  }catch(e){return[]}
}

function clearConversation(){
  messages=[];
  localStorage.removeItem(STORAGE_KEY);
}
```

- [ ] **Step 2: Persist messages after each exchange**

In `sendMessage()`, after `messages.push({role:'user',content:text});` (line 594), add:
```js
saveConversation();
```

In `runConversationLoop()`, after `messages.push({role:'assistant',content:result.content});` (line 655), add:
```js
saveConversation();
```

After `messages.push({role:'user',content:toolResults});` (line 675), add:
```js
saveConversation();
```

- [ ] **Step 3: Update clear history to wipe localStorage**

Replace the clear history click handler (line 225-228):
```js
document.getElementById('signal-clear-history').addEventListener('click',()=>{
  clearConversation();
  document.getElementById('signal-messages').innerHTML='';
  addGreeting();
});
```

- [ ] **Step 4: Restore conversation on window creation**

In `createChatWindow()`, replace `addGreeting();` (line 239) with:
```js
var restored=loadConversation();
if(restored.length>0){
  messages=restored;
  // Replay visible messages
  restored.forEach(function(m){
    if(m.role==='user'&&typeof m.content==='string'){
      appendMessage('user',m.content);
    } else if(m.role==='assistant'){
      if(typeof m.content==='string'){
        appendMessage('assistant',m.content);
      } else if(Array.isArray(m.content)){
        m.content.forEach(function(b){
          if(b.type==='text')appendMessage('assistant',b.text);
        });
      }
    }
  });
} else {
  addGreeting();
}
```

- [ ] **Step 5: Commit**

```bash
git add ai-assistant.js
git commit -m "feat: add SIGNAL conversation persistence via localStorage"
```

---

### Task 2: Keyboard Shortcuts + Help Overlay (#10)

**Files:**
- Modify: `index.html` (add help overlay HTML)
- Modify: `strange-signals.js` (expand keyboard handler at line 1574)
- Modify: `strange-signals.css` (add help overlay styles)

- [ ] **Step 1: Add help overlay HTML to index.html**

Before `<!-- CDN Libraries -->` (line 305), insert:
```html
<!-- KEYBOARD SHORTCUTS HELP OVERLAY -->
<div id="shortcuts-overlay" class="shortcuts-overlay" style="display:none">
  <div class="shortcuts-panel">
    <div class="shortcuts-header">
      <h2>KEYBOARD SHORTCUTS</h2>
      <button id="shortcuts-close" class="shortcuts-close">&times;</button>
    </div>
    <div class="shortcuts-grid">
      <div class="shortcut-group">
        <h3>LAYERS</h3>
        <div class="shortcut-row"><kbd>1</kbd> Toggle UFO/UAP</div>
        <div class="shortcut-row"><kbd>2</kbd> Toggle Bigfoot</div>
        <div class="shortcut-row"><kbd>3</kbd> Toggle Haunted</div>
      </div>
      <div class="shortcut-group">
        <h3>VIEWS</h3>
        <div class="shortcut-row"><kbd>M</kbd> Markers view</div>
        <div class="shortcut-row"><kbd>H</kbd> Heatmap view</div>
        <div class="shortcut-row"><kbd>X</kbd> Hex density</div>
        <div class="shortcut-row"><kbd>C</kbd> Correlation</div>
      </div>
      <div class="shortcut-group">
        <h3>PANELS</h3>
        <div class="shortcut-row"><kbd>S</kbd> Toggle sidebar</div>
        <div class="shortcut-row"><kbd>I</kbd> Toggle SIGNAL AI</div>
        <div class="shortcut-row"><kbd>T</kbd> Toggle timeline</div>
        <div class="shortcut-row"><kbd>/</kbd> Focus search</div>
      </div>
      <div class="shortcut-group">
        <h3>GENERAL</h3>
        <div class="shortcut-row"><kbd>?</kbd> This help</div>
        <div class="shortcut-row"><kbd>Esc</kbd> Close panel / Reset</div>
        <div class="shortcut-row"><kbd>F</kbd> Fullscreen map</div>
        <div class="shortcut-row"><kbd>R</kbd> Reset view</div>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Add help overlay styles to strange-signals.css**

Append after the overlay markers section:
```css
/* ========== SHORTCUTS HELP OVERLAY ========== */
.shortcuts-overlay{position:fixed;top:0;left:0;right:0;bottom:0;z-index:9000;
  background:rgba(5,6,15,0.85);display:flex;align-items:center;justify-content:center;
  -webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.shortcuts-panel{background:var(--surface-solid);border:1px solid var(--border-bright);
  border-radius:8px;padding:24px;max-width:560px;width:90%;max-height:80vh;overflow-y:auto}
.shortcuts-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.shortcuts-header h2{font-family:var(--font-display);font-size:14px;letter-spacing:3px;color:var(--green)}
.shortcuts-close{background:none;border:1px solid var(--border);border-radius:3px;color:var(--text-dim);
  width:28px;height:28px;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;transition:all .15s}
.shortcuts-close:hover{color:var(--text);border-color:var(--border-bright)}
.shortcuts-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.shortcut-group h3{font-family:var(--font-display);font-size:9px;letter-spacing:2px;color:var(--cyan);margin-bottom:8px}
.shortcut-row{display:flex;align-items:center;gap:10px;padding:4px 0;font-size:11px;color:var(--text)}
.shortcut-row kbd{display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:22px;
  padding:0 6px;background:rgba(255,255,255,0.06);border:1px solid var(--border);border-radius:3px;
  font-family:var(--font-mono);font-size:10px;color:var(--green);flex-shrink:0}
@media(max-width:768px){.shortcuts-grid{grid-template-columns:1fr}}
```

- [ ] **Step 3: Expand keyboard handler in strange-signals.js**

Replace the keyboard handler (lines 1574-1592) with:
```js
document.addEventListener('keydown',e=>{
  // Close help overlay first if open
  const helpOverlay=document.getElementById('shortcuts-overlay');
  if(helpOverlay&&helpOverlay.style.display!=='none'){
    if(e.key==='Escape'||e.key==='?'){helpOverlay.style.display='none';e.preventDefault()}
    return;
  }

  if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT'||e.target.tagName==='TEXTAREA')return;
  const key=e.key.toLowerCase();

  // Help overlay
  if(e.key==='?'){e.preventDefault();document.getElementById('shortcuts-overlay').style.display='flex';return}

  // Layer toggles
  if(key==='1'||key==='2'||key==='3'){
    const i=parseInt(key)-1;
    const cb=document.querySelector(`[data-cat="${i}"]`);
    cb.checked=!cb.checked;applyFilters();
  }
  // View modes
  else if(key==='m')setView('markers');
  else if(key==='h')setView('heatmap');
  else if(key==='x')setView('hexbin');
  else if(key==='c')setView('correlation');
  // Search
  else if(key==='/'){e.preventDefault();document.getElementById('search-box').focus()}
  // Panels
  else if(key==='s'){
    const sb=document.getElementById('sidebar');
    sb.classList.toggle('collapsed');
    sb.classList.toggle('open');
  }
  else if(key==='t'){document.getElementById('timeline-panel').classList.toggle('collapsed')}
  // Reset view
  else if(key==='r'){map.flyTo([39.5,-98.35],4,{duration:1})}
  // Fullscreen map (hide sidebar + timeline)
  else if(key==='f'){
    document.getElementById('sidebar').classList.add('collapsed');
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('timeline-panel').classList.add('collapsed');
  }
  // Escape - close panels/overlays, then reset
  else if(key==='escape'){
    // Close any open SS windows first
    const wins=WindowManager.getAll();
    let closedSomething=false;
    Object.values(wins).forEach(w=>{if(!w._hidden&&!w._minimized){w.hide();closedSomething=true}});
    if(!closedSomething){
      document.getElementById('search-box').blur();
      brushRange=null;applyFilters();
    }
  }
});

// Close button for help overlay
document.getElementById('shortcuts-close').addEventListener('click',()=>{
  document.getElementById('shortcuts-overlay').style.display='none';
});
```

- [ ] **Step 4: Update sidebar shortcuts reference**

In `index.html`, update the SHORTCUTS section (lines 253-269) to add new shortcuts:
```html
    <!-- KEYBOARD SHORTCUTS -->
    <div class="sb-section">
      <div class="sb-title"><span class="icon">&#9000;</span> SHORTCUTS</div>
      <div style="font-size:10px;color:var(--text-dim);line-height:2">
        <b style="color:var(--text)">1</b> UFO &nbsp;
        <b style="color:var(--text)">2</b> Bigfoot &nbsp;
        <b style="color:var(--text)">3</b> Haunted<br>
        <b style="color:var(--text)">M</b> Markers &nbsp;
        <b style="color:var(--text)">H</b> Heat &nbsp;
        <b style="color:var(--text)">X</b> Hex &nbsp;
        <b style="color:var(--text)">C</b> Corr<br>
        <b style="color:var(--text)">/</b> Search &nbsp;
        <b style="color:var(--text)">Esc</b> Close &nbsp;
        <b style="color:var(--text)">S</b> Sidebar<br>
        <b style="color:var(--purple)">I</b> Signal AI &nbsp;
        <b style="color:var(--text)">T</b> Timeline &nbsp;
        <b style="color:var(--text)">?</b> All shortcuts
      </div>
    </div>
```

- [ ] **Step 5: Commit**

```bash
git add index.html strange-signals.js strange-signals.css
git commit -m "feat: add keyboard shortcuts help overlay (? key) with T/R/F shortcuts"
```

---

### Task 3: Mobile Responsiveness (#9)

**Files:**
- Modify: `strange-signals.css` (expand @media query at line 250)
- Modify: `index.html` (add mobile hamburger icon visibility)

- [ ] **Step 1: Enhance mobile styles in strange-signals.css**

Replace the existing `@media(max-width:768px)` block (lines 250-258) with:
```css
/* ========== MOBILE ========== */
@media(max-width:768px){
  :root{--sidebar-w:100vw;--header-h:44px;--timeline-h:120px}

  /* Header */
  .header-nav{display:none}
  .logo h1{font-size:12px;letter-spacing:2px}
  .logo h1 span{display:none}
  #search-box{width:100px;font-size:11px;padding:4px 8px}
  .kbd-hint{display:none}
  #ai-toggle{padding:3px 8px;font-size:9px}

  /* Sidebar: slide-over from left */
  #sidebar{position:fixed;top:var(--header-h);left:0;right:0;bottom:0;z-index:1050;
    transform:translateX(-100%);transition:transform .3s;width:100vw}
  #sidebar.open{transform:translateX(0)}
  #sidebar.collapsed{margin-left:0;transform:translateX(-100%)}

  /* Sidebar toggle - larger touch target */
  #sidebar-toggle{width:40px;height:40px;font-size:18px}

  /* Touch-friendly controls */
  .layer-row{padding:10px 0;min-height:44px}
  .view-btn{padding:8px 12px;font-size:11px;min-height:36px}
  .corr-sub-btn{padding:6px 10px;font-size:9px;min-height:32px}
  .corr-btn{padding:12px;font-size:11px;min-height:44px}
  .btn-sm{padding:8px 12px;font-size:11px;min-height:36px}
  .filter-row input{padding:8px 10px;font-size:12px;min-height:36px}

  /* Stats grid - full width */
  .stat-grid{grid-template-columns:1fr 1fr}
  .stat-val{font-size:12px}

  /* Timeline - shorter on mobile */
  #timeline-panel{height:var(--timeline-h);padding:6px 10px 2px}

  /* Popups - wider on mobile */
  .leaflet-popup-content-wrapper{max-width:280px!important}

  /* Correlation panel adjustments */
  .corr-submodes{flex-wrap:wrap;gap:4px}
  #corr-matrix-svg{width:100%;max-width:260px}

  /* Windows - full-width on mobile */
  .ss-window{left:4px!important;right:4px!important;width:auto!important;
    max-height:70vh;bottom:60px!important;top:auto!important}
  .ss-window-resize{display:none}
  .ss-dock{bottom:4px;left:4px;right:4px;transform:none;justify-content:center}

  /* Signal chat - full width */
  .signal-input{font-size:14px}
  .signal-send{padding:10px 16px;font-size:11px}

  /* Help overlay - single column */
  .shortcuts-grid{grid-template-columns:1fr}
  .shortcuts-panel{padding:16px;margin:8px}
}

/* Touch device: enlarge Leaflet zoom controls */
@media(pointer:coarse){
  .leaflet-control-zoom a{width:36px!important;height:36px!important;line-height:36px!important;font-size:18px!important}
  .leaflet-bar a{width:36px!important;height:36px!important}
}
```

- [ ] **Step 2: Add sidebar open/close toggle for mobile**

In `strange-signals.js`, update the sidebar toggle behavior. In the keyboard handler's `s` case and in the sidebar-toggle click handler, ensure both `collapsed` and `open` classes are toggled properly. The click handler (around line 1402) should be:
```js
document.getElementById('sidebar-toggle').addEventListener('click',()=>{
  const sb=document.getElementById('sidebar');
  const isOpen=sb.classList.contains('open');
  sb.classList.toggle('collapsed',isOpen);
  sb.classList.toggle('open',!isOpen);
});
```

- [ ] **Step 3: Commit**

```bash
git add strange-signals.css strange-signals.js index.html
git commit -m "feat: enhance mobile responsiveness with touch targets and slide-over sidebar"
```

---

### Task 4: Exportable Dashboard Snapshots (#12)

**Files:**
- Modify: `index.html` (add html2canvas CDN, snapshot button)
- Modify: `strange-signals.js` (add snapshot export function)
- Modify: `strange-signals.css` (snapshot button + modal styles)

- [ ] **Step 1: Add html2canvas CDN to index.html**

After the D3 script tag (line 310), add:
```html
<script src="https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
```

- [ ] **Step 2: Add snapshot button to header**

In `index.html`, in the `header-right` div (after the SIGNAL button, line 50), add:
```html
<button id="snapshot-btn" title="Export snapshot (screenshot + data summary)">&#128247; SNAP</button>
```

- [ ] **Step 3: Add snapshot button styles**

In `strange-signals.css`, after the `#ai-toggle` styles:
```css
#snapshot-btn{padding:4px 10px;border:1px solid var(--cyan);border-radius:3px;
  background:rgba(0,212,255,0.1);color:var(--cyan);cursor:pointer;
  font-family:var(--font-display);font-size:10px;letter-spacing:1px;transition:all .15s}
#snapshot-btn:hover{background:rgba(0,212,255,0.2)}
@media(max-width:768px){#snapshot-btn{padding:3px 6px;font-size:9px}}
```

- [ ] **Step 4: Add snapshot export function in strange-signals.js**

Before the `exportCSV` function (line 1337), add:
```js
/* ========== SNAPSHOT EXPORT ========== */
async function exportSnapshot(){
  const btn=document.getElementById('snapshot-btn');
  const origText=btn.innerHTML;
  btn.innerHTML='&#9203; CAPTURING...';
  btn.disabled=true;

  try{
    // Capture map area as image
    const mapEl=document.getElementById('map');
    const canvas=await html2canvas(mapEl,{
      useCORS:true,
      allowTaint:true,
      backgroundColor:'#05060f',
      scale:2,
      logging:false
    });

    // Build summary data
    const stats=getStats();
    const center=map.getCenter();
    const zoom=map.getZoom();
    const timestamp=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);

    // Build standalone HTML report
    const html=`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Strange Signals Snapshot - ${timestamp}</title>
<style>
body{background:#05060f;color:#c8d4e0;font-family:'Courier New',monospace;margin:0;padding:20px}
h1{color:#00ff88;font-size:18px;letter-spacing:3px;margin-bottom:4px}
h2{color:#00d4ff;font-size:13px;letter-spacing:2px;margin-top:16px}
.meta{color:#5a6a7a;font-size:11px;margin-bottom:16px}
img{max-width:100%;border:1px solid rgba(0,255,136,0.2);border-radius:4px;margin:12px 0}
table{border-collapse:collapse;width:100%;margin:8px 0}
td,th{border:1px solid rgba(0,255,136,0.15);padding:6px 10px;text-align:left;font-size:11px}
th{color:#00d4ff;font-size:10px;letter-spacing:1px}
.cat-ufo{color:#00ff88}.cat-bf{color:#ff6622}.cat-hp{color:#aa44ff}
footer{margin-top:20px;padding-top:12px;border-top:1px solid rgba(0,255,136,0.15);color:#5a6a7a;font-size:10px}
</style></head><body>
<h1>STRANGE SIGNALS</h1>
<div class="meta">Snapshot captured ${new Date().toLocaleString()} | View: ${currentView} | Zoom: ${zoom} | Center: ${center.lat.toFixed(2)}, ${center.lng.toFixed(2)}</div>
<img src="${canvas.toDataURL('image/png')}" alt="Map snapshot">
<h2>STATISTICS</h2>
<table>
<tr><th>Metric</th><th>Value</th></tr>
<tr><td class="cat-ufo">UFO / UAP</td><td>${stats.categories['UFO/UAP']||0}</td></tr>
<tr><td class="cat-bf">Bigfoot / Sasquatch</td><td>${stats.categories['Bigfoot/Sasquatch']||0}</td></tr>
<tr><td class="cat-hp">Haunted Places</td><td>${stats.categories['Haunted Place']||0}</td></tr>
<tr><td>Total Visible</td><td>${stats.visible}</td></tr>
<tr><td>Total Records</td><td>${stats.total}</td></tr>
</table>
${stats.filters.yearFrom||stats.filters.yearTo?'<h2>ACTIVE FILTERS</h2><table><tr><th>Filter</th><th>Value</th></tr>'
  +(stats.filters.yearFrom?'<tr><td>Year From</td><td>'+stats.filters.yearFrom+'</td></tr>':'')
  +(stats.filters.yearTo?'<tr><td>Year To</td><td>'+stats.filters.yearTo+'</td></tr>':'')
  +(stats.filters.state?'<tr><td>State</td><td>'+stats.filters.state+'</td></tr>':'')
  +'</table>':''}
<footer>Generated by Strange Signals // Paranormal Sightings Correlation Map<br>
<a href="${location.href}" style="color:#00d4ff">Restore this view</a></footer>
</body></html>`;

    // Download as HTML
    const blob=new Blob([html],{type:'text/html'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download='strange-signals-snapshot-'+timestamp+'.html';a.click();
    URL.revokeObjectURL(url);

  }catch(e){
    console.error('Snapshot failed:',e);
    alert('Snapshot capture failed. Try zooming in or waiting for tiles to load.');
  }finally{
    btn.innerHTML=origText;
    btn.disabled=false;
  }
}
```

- [ ] **Step 5: Wire up the snapshot button**

In the event listeners section of `strange-signals.js`, add:
```js
document.getElementById('snapshot-btn').addEventListener('click',exportSnapshot);
```

Also add `P` as a keyboard shortcut for snapshot in the keyboard handler:
```js
else if(key==='p'){exportSnapshot()}
```

- [ ] **Step 6: Commit**

```bash
git add index.html strange-signals.js strange-signals.css
git commit -m "feat: add exportable dashboard snapshots (html2canvas + HTML report)"
```

---

### Task 5: Collaborative Annotations (#13)

**Files:**
- Create: `annotations.js` (annotation layer IIFE)
- Create: `annotations.css` (toolbar + popup styles)
- Modify: `index.html` (add CSS/JS refs + toolbar HTML)

- [ ] **Step 1: Create annotations.css**

```css
/* ========== ANNOTATIONS ========== */
.annotation-toolbar{position:absolute;top:8px;right:48px;z-index:1050;
  display:flex;gap:4px;background:var(--surface);border:1px solid var(--border);
  border-radius:4px;padding:4px}
.annotation-toolbar.hidden{display:none}
.anno-btn{width:32px;height:32px;background:rgba(255,255,255,0.04);border:1px solid var(--border);
  border-radius:3px;color:var(--text-dim);cursor:pointer;display:flex;align-items:center;
  justify-content:center;font-size:14px;transition:all .15s}
.anno-btn:hover{color:var(--text);border-color:var(--border-bright)}
.anno-btn.active{color:var(--pink);border-color:var(--pink);background:rgba(255,51,102,0.1)}
.anno-btn[title]:hover::after{content:attr(title);position:absolute;top:100%;left:50%;
  transform:translateX(-50%);white-space:nowrap;background:var(--surface-solid);
  border:1px solid var(--border);border-radius:3px;padding:2px 6px;font-size:9px;
  color:var(--text);margin-top:4px;pointer-events:none;z-index:10}

/* Annotation popup form */
.anno-popup{min-width:200px}
.anno-popup textarea{width:100%;background:rgba(255,255,255,0.04);border:1px solid var(--border);
  border-radius:3px;color:var(--text);padding:6px;font-family:inherit;font-size:11px;
  resize:vertical;min-height:60px;outline:none}
.anno-popup textarea:focus{border-color:var(--green)}
.anno-popup-actions{display:flex;gap:4px;margin-top:6px}
.anno-popup select{flex:1;background:rgba(255,255,255,0.04);border:1px solid var(--border);
  border-radius:3px;color:var(--text);padding:4px;font-size:10px}
.anno-delete{background:rgba(255,51,102,0.1);border:1px solid rgba(255,51,102,0.3);
  border-radius:3px;color:#ff3366;padding:4px 8px;cursor:pointer;font-size:10px}
.anno-delete:hover{background:rgba(255,51,102,0.2)}

/* Annotation markers */
.anno-marker{width:24px;height:24px;background:none!important;border:none!important;
  text-align:center;line-height:24px;font-size:18px;cursor:pointer;
  filter:drop-shadow(0 0 4px rgba(255,51,102,0.5))}

/* Annotation list in sidebar or export */
.anno-count{font-size:9px;color:var(--text-dim);margin-left:4px}

@media(max-width:768px){
  .annotation-toolbar{top:auto;bottom:60px;right:8px;flex-direction:column}
  .anno-btn{width:36px;height:36px;font-size:16px}
}
```

- [ ] **Step 2: Create annotations.js**

```js
/* ========== MAP ANNOTATIONS ========== */
(function(){
'use strict';

var STORAGE_KEY='ss-annotations';
var annotations=[];
var annoLayer=null;
var annoMode=false;
var nextId=1;

var ICONS={
  pin:'\ud83d\udccd',     // pushpin
  eye:'\ud83d\udc41',     // eye
  alert:'\u26a0\ufe0f',   // warning
  star:'\u2b50',          // star
  skull:'\ud83d\udc80',   // skull
  ufo:'\ud83d\udef8'      // flying saucer
};

function init(){
  var map=window.StrangeSignals&&window.StrangeSignals.getMap();
  if(!map){setTimeout(init,500);return}

  annoLayer=L.layerGroup().addTo(map);
  loadAnnotations();
  renderAll();

  // Map click handler for annotation mode
  map.on('click',function(e){
    if(!annoMode)return;
    var anno={id:nextId++,lat:e.latlng.lat,lon:e.latlng.lng,
      icon:'pin',note:'',color:'#ff3366',created:new Date().toISOString()};
    annotations.push(anno);
    addMarker(anno);
    saveAnnotations();
    openEditor(anno);
  });

  // Toolbar buttons
  var toggleBtn=document.getElementById('anno-toggle');
  if(toggleBtn)toggleBtn.addEventListener('click',function(){
    annoMode=!annoMode;
    this.classList.toggle('active',annoMode);
    document.getElementById('map').style.cursor=annoMode?'crosshair':'';
  });

  var clearBtn=document.getElementById('anno-clear');
  if(clearBtn)clearBtn.addEventListener('click',function(){
    if(!annotations.length||!confirm('Clear all annotations?'))return;
    annotations=[];
    annoLayer.clearLayers();
    saveAnnotations();
    updateCount();
  });

  var exportBtn=document.getElementById('anno-export');
  if(exportBtn)exportBtn.addEventListener('click',exportAnnotations);

  var importBtn=document.getElementById('anno-import');
  if(importBtn)importBtn.addEventListener('click',importAnnotations);
}

function addMarker(anno){
  var icon=L.divIcon({
    className:'anno-marker',
    html:ICONS[anno.icon]||ICONS.pin,
    iconSize:[24,24],iconAnchor:[12,12]
  });
  var marker=L.marker([anno.lat,anno.lon],{icon:icon,draggable:true});
  marker._annoId=anno.id;

  marker.on('click',function(e){
    L.DomEvent.stopPropagation(e);
    openEditor(anno);
  });

  marker.on('dragend',function(){
    var pos=marker.getLatLng();
    anno.lat=pos.lat;anno.lon=pos.lng;
    saveAnnotations();
  });

  marker.addTo(annoLayer);
  updateCount();
  return marker;
}

function openEditor(anno){
  var map=window.StrangeSignals.getMap();
  var iconOptions=Object.keys(ICONS).map(function(k){
    return '<option value="'+k+'"'+(anno.icon===k?' selected':'')+'>'+ICONS[k]+' '+k+'</option>';
  }).join('');

  var popup=L.popup({maxWidth:260,className:'dark-popup'})
    .setLatLng([anno.lat,anno.lon])
    .setContent(
      '<div class="anno-popup">'+
      '<textarea id="anno-note-'+anno.id+'" placeholder="Add a note...">'+
        (anno.note||'').replace(/</g,'&lt;')+'</textarea>'+
      '<div class="anno-popup-actions">'+
        '<select id="anno-icon-'+anno.id+'">'+iconOptions+'</select>'+
        '<button class="anno-delete" onclick="window.Annotations.remove('+anno.id+')">DELETE</button>'+
      '</div></div>')
    .openOn(map);

  // Save on popup close
  map.once('popupclose',function(){
    var noteEl=document.getElementById('anno-note-'+anno.id);
    var iconEl=document.getElementById('anno-icon-'+anno.id);
    if(noteEl)anno.note=noteEl.value;
    if(iconEl&&iconEl.value!==anno.icon){
      anno.icon=iconEl.value;
      // Update marker icon
      annoLayer.eachLayer(function(layer){
        if(layer._annoId===anno.id){
          layer.setIcon(L.divIcon({
            className:'anno-marker',
            html:ICONS[anno.icon]||ICONS.pin,
            iconSize:[24,24],iconAnchor:[12,12]
          }));
        }
      });
    }
    saveAnnotations();
  });
}

function renderAll(){
  annoLayer.clearLayers();
  annotations.forEach(addMarker);
  updateCount();
}

function updateCount(){
  var el=document.getElementById('anno-count');
  if(el)el.textContent=annotations.length;
}

function saveAnnotations(){
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(annotations))}catch(e){}
  updateCount();
}

function loadAnnotations(){
  try{
    var stored=localStorage.getItem(STORAGE_KEY);
    if(stored){
      annotations=JSON.parse(stored);
      nextId=annotations.reduce(function(m,a){return Math.max(m,a.id)},0)+1;
    }
  }catch(e){annotations=[]}
}

function exportAnnotations(){
  var json=JSON.stringify(annotations,null,2);
  var blob=new Blob([json],{type:'application/json'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url;a.download='strange-signals-annotations.json';a.click();
  URL.revokeObjectURL(url);
}

function importAnnotations(){
  var input=document.createElement('input');
  input.type='file';input.accept='.json';
  input.onchange=function(){
    var reader=new FileReader();
    reader.onload=function(e){
      try{
        var imported=JSON.parse(e.target.result);
        if(!Array.isArray(imported))throw new Error('Invalid format');
        imported.forEach(function(a){
          a.id=nextId++;
          annotations.push(a);
        });
        renderAll();
        saveAnnotations();
      }catch(err){alert('Invalid annotations file')}
    };
    reader.readAsText(input.files[0]);
  };
  input.click();
}

function removeAnnotation(id){
  annotations=annotations.filter(function(a){return a.id!==id});
  annoLayer.eachLayer(function(layer){
    if(layer._annoId===id)annoLayer.removeLayer(layer);
  });
  saveAnnotations();
  var map=window.StrangeSignals.getMap();
  map.closePopup();
}

// Public API
window.Annotations={
  remove:removeAnnotation,
  getAll:function(){return annotations.slice()},
  getCount:function(){return annotations.length}
};

// Initialize when DOM ready
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',init);
} else {
  init();
}

})();
```

- [ ] **Step 3: Add annotation toolbar HTML to index.html**

In `index.html`, inside `#map-container` after the `#percapita-indicator` div (line 280), add:
```html
<!-- ANNOTATION TOOLBAR -->
<div class="annotation-toolbar" id="annotation-toolbar">
  <button class="anno-btn" id="anno-toggle" title="Add annotation">&#128204;</button>
  <button class="anno-btn" id="anno-export" title="Export annotations">&#128190;</button>
  <button class="anno-btn" id="anno-import" title="Import annotations">&#128194;</button>
  <button class="anno-btn" id="anno-clear" title="Clear all">&#128465;</button>
  <span class="anno-count-badge" style="font-size:9px;color:var(--text-dim);text-align:center"><span id="anno-count">0</span></span>
</div>
```

- [ ] **Step 4: Add CSS and JS references to index.html**

Add CSS link after `ai-assistant.css`:
```html
<link rel="stylesheet" href="annotations.css">
```

Add script after `ai-assistant.js`:
```html
<script src="annotations.js"></script>
```

- [ ] **Step 5: Add `A` keyboard shortcut for annotation mode**

In the keyboard handler in `strange-signals.js`, add:
```js
else if(key==='a'){
  var annoBtn=document.getElementById('anno-toggle');
  if(annoBtn)annoBtn.click();
}
```

Also update the help overlay in `index.html` to include annotation shortcuts.

- [ ] **Step 6: Commit**

```bash
git add annotations.js annotations.css index.html strange-signals.js strange-signals.css
git commit -m "feat: add collaborative map annotations with import/export"
```

---

## Execution Order

Tasks can be parallelized in two groups since they touch different primary files:

**Group 1 (can run in parallel):**
- Task 1 (#11 — ai-assistant.js only)
- Task 5 (#13 — new files annotations.js/css)

**Group 2 (sequential, shared files):**
- Task 2 (#10 — keyboard shortcuts, touches index.html + strange-signals.js + .css)
- Task 3 (#9 — mobile, touches .css + .js)
- Task 4 (#12 — snapshots, touches index.html + .js + .css)

**Recommended order:** Task 1 → Task 2 → Task 3 → Task 4 → Task 5 (or Task 1 & 5 in parallel, then 2 → 3 → 4)
