/* ========== AI ASSISTANT ("SIGNAL") ========== */
(function(){
'use strict';

/* ===== STATE ===== */
let chatWindow=null;
let messages=[];
let isStreaming=false;
let settingsVisible=false;

var STORAGE_KEY='signal-conversation';
var MAX_STORED_MESSAGES=40;

function saveConversation(){
  try{
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

/* ===== US STATE CENTROIDS ===== */
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

/* ===== NAMED PARANORMAL HOTSPOT REGIONS ===== */
const NAMED_REGIONS={
  'pacific northwest':{lat:46.5,lon:-122.5,radius_km:300,label:'Pacific Northwest'},
  'appalachia':{lat:37.5,lon:-80.5,radius_km:250,label:'Appalachia'},
  'skinwalker ranch':{lat:40.2,lon:-109.9,radius_km:100,label:'Skinwalker Ranch Area'},
  'area 51':{lat:37.2,lon:-115.8,radius_km:150,label:'Area 51 / Nevada Test Range'},
  'pine barrens':{lat:39.8,lon:-74.5,radius_km:80,label:'Pine Barrens (NJ)'},
  'hudson valley':{lat:41.5,lon:-74.0,radius_km:100,label:'Hudson Valley (NY)'},
  'gulf breeze':{lat:30.4,lon:-87.0,radius_km:80,label:'Gulf Breeze (FL)'},
  'bridgewater triangle':{lat:41.9,lon:-71.0,radius_km:50,label:'Bridgewater Triangle (MA)'},
  'san luis valley':{lat:37.5,lon:-106.0,radius_km:100,label:'San Luis Valley (CO)'},
  'marfa':{lat:30.3,lon:-104.0,radius_km:80,label:'Marfa Lights Area (TX)'},
  'great lakes':{lat:43.5,lon:-82.5,radius_km:300,label:'Great Lakes Corridor'},
  'ozarks':{lat:37.0,lon:-92.0,radius_km:150,label:'Missouri Ozarks'},
  'point pleasant':{lat:38.8,lon:-82.1,radius_km:80,label:'Point Pleasant / Mothman (WV)'},
  'sedona':{lat:34.9,lon:-111.8,radius_km:80,label:'Sedona Vortex (AZ)'},
  'roswell':{lat:33.4,lon:-104.5,radius_km:100,label:'Roswell (NM)'}
};

/* ===== TOOL DEFINITIONS ===== */
const TOOLS=[
  {name:'zoom_to_region',description:'Pan and zoom the map to a US state, city, or coordinates.',
    input_schema:{type:'object',properties:{
      state:{type:'string',description:'US state code (e.g. OH, CA)'},
      city:{type:'string',description:'City name for geocoding'},
      lat:{type:'number'},lon:{type:'number'},
      zoom:{type:'integer',minimum:3,maximum:18}
    }}},
  {name:'set_filters',description:'Apply data filters: year range, state, subcategory, category visibility. Categories: 0=UFO/UAP, 1=Bigfoot/Sasquatch, 2=Haunted Places.',
    input_schema:{type:'object',properties:{
      year_from:{type:'integer'},year_to:{type:'integer'},
      state:{type:'string'},subcategory:{type:'string'},
      categories:{type:'array',items:{type:'integer',enum:[0,1,2]},description:'Which categories to show'}
    }}},
  {name:'set_view_mode',description:'Switch map visualization mode.',
    input_schema:{type:'object',properties:{
      mode:{type:'string',enum:['markers','heatmap','hexbin','correlation']}
    },required:['mode']}},
  {name:'run_spatial_correlation',description:'Compute Pearson spatial correlation between two datasets using hex binning. Returns r, p-value, interpretation. Accepts sighting categories (0=UFO, 1=Bigfoot, 2=Haunted) OR overlay names (airspace, earthquakes, caves, fireballs, cryptids, missing411, military). Pass integers for sightings, strings for overlays.',
    input_schema:{type:'object',properties:{
      category_a:{description:'Sighting category (0/1/2) or overlay name (airspace, earthquakes, caves, fireballs, cryptids, missing411, military)'},
      category_b:{description:'Sighting category (0/1/2) or overlay name'},
      hex_size_km:{type:'number'}
    },required:['category_a','category_b']}},
  {name:'run_matrix_correlation',description:'Compute all-pairs 3x3 correlation matrix with p-values.',
    input_schema:{type:'object',properties:{hex_size_km:{type:'number'}}}},
  {name:'detect_clusters',description:'Find dense multi-category hotspot regions via BFS clustering. Returns cluster locations and compositions.',
    input_schema:{type:'object',properties:{
      min_sightings:{type:'integer',default:30},
      hex_size_km:{type:'number'}
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
    },required:['lat','lon']}},
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
  {name:'compare_regions',description:'Compare sighting statistics between two regions. Use named hotspot (e.g. "Pacific Northwest", "Area 51"), US state code, or lat/lon+radius.',
    input_schema:{type:'object',properties:{
      region_a:{type:'object',properties:{
        name:{type:'string',description:'Named region (e.g. "Pacific Northwest", "Area 51", "Skinwalker Ranch", "Roswell")'},
        state:{type:'string',description:'US state code (e.g. OH)'},
        lat:{type:'number'},lon:{type:'number'},radius_km:{type:'number',default:100}
      }},
      region_b:{type:'object',properties:{
        name:{type:'string'},state:{type:'string'},lat:{type:'number'},lon:{type:'number'},radius_km:{type:'number',default:100}
      }}
    },required:['region_a','region_b']}},
  {name:'export_findings',description:'Export analysis results as a downloadable CSV. Types: sightings, clusters, correlation_matrix.',
    input_schema:{type:'object',properties:{
      export_type:{type:'string',enum:['sightings','clusters','correlation_matrix']}
    },required:['export_type']}},
  {name:'query_temporal',description:'Query sighting counts aggregated by time period. Returns counts per time bucket for trend analysis. Use render_chart to visualize the results.',
    input_schema:{type:'object',properties:{
      category:{type:'integer',enum:[0,1,2],description:'Category to query (omit for all categories)'},
      state:{type:'string',description:'US state code filter (e.g. OH, CA)'},
      year_from:{type:'integer',description:'Start year'},
      year_to:{type:'integer',description:'End year'},
      granularity:{type:'string',enum:['year','month','decade'],default:'year',description:'Time bucket size'}
    }}},
  {name:'find_anomalies',description:'Find statistical anomalies in sighting data. density: hexes with unusually high counts. temporal_spike: years with abnormal increases. population_adjusted: high sightings relative to population density.',
    input_schema:{type:'object',properties:{
      anomaly_type:{type:'string',enum:['density','temporal_spike','population_adjusted'],description:'Type of anomaly to detect'},
      category:{type:'integer',enum:[0,1,2],description:'Category filter (optional)'},
      top_n:{type:'integer',default:10,description:'Number of top anomalies to return'},
      threshold_sigma:{type:'number',default:2.0,description:'Standard deviation threshold'}
    },required:['anomaly_type']}},
  {name:'add_annotation',description:'Place an annotation pin on the map with a note. Use this to mark locations of interest for the user — hotspots, anomalies, points of discussion, etc.',
    input_schema:{type:'object',properties:{
      lat:{type:'number',description:'Latitude'},
      lon:{type:'number',description:'Longitude'},
      note:{type:'string',description:'Text note for the annotation'},
      icon:{type:'string',enum:['pin','eye','alert','star','skull','ufo'],default:'pin',description:'Icon type: pin (general), eye (observation), alert (anomaly), star (notable), skull (haunted), ufo (UFO-related)'}
    },required:['lat','lon','note']}},
  {name:'remove_annotation',description:'Remove an annotation by its ID.',
    input_schema:{type:'object',properties:{
      id:{type:'integer',description:'Annotation ID to remove'}
    },required:['id']}},
  {name:'list_annotations',description:'List all current annotations on the map.',
    input_schema:{type:'object',properties:{}}},
  {name:'clear_annotations',description:'Remove all annotations from the map.',
    input_schema:{type:'object',properties:{}}},
  {name:'get_hex_analysis',description:'Get detailed analysis data for the currently selected hex cell (from HEX DENSITY view). Returns location, category breakdown, top subcategories, and up to 100 sighting records with descriptions. User must click a hex first. Use this to analyze themes, patterns, and descriptions within a specific geographic cell.',
    input_schema:{type:'object',properties:{
      include_descriptions:{type:'boolean',default:true,description:'Include sighting descriptions (up to 300 chars each)'}
    }}},
  {name:'get_nearby_overlays',description:'Find overlay features near a point: military bases, restricted airspace, caves, fireballs, cryptid sightings, Missing 411 cases. Returns distance-sorted results. Data must be loaded first (user toggles overlay on, or use toggle_overlay).',
    input_schema:{type:'object',properties:{
      lat:{type:'number',description:'Latitude'},
      lon:{type:'number',description:'Longitude'},
      radius_km:{type:'number',default:50,description:'Search radius in km'}
    },required:['lat','lon']}},
  {name:'toggle_overlay',description:'Toggle an overlay dataset on or off. Loads data on first activation. Available overlays: military, airspace, earthquakes, caves, fireballs, cryptids, missing411, geomagnetic, parks, historic.',
    input_schema:{type:'object',properties:{
      overlay:{type:'string',enum:['military','airspace','earthquakes','caves','fireballs','cryptids','missing411','geomagnetic','parks','historic'],description:'Overlay to toggle'},
      enabled:{type:'boolean',default:true,description:'true=show, false=hide'}
    },required:['overlay']}},
  {name:'get_active_overlays',description:'List which overlay datasets are currently toggled on and loaded.',
    input_schema:{type:'object',properties:{}}}
];

const SYSTEM_PROMPT=`You are SIGNAL, an AI analyst embedded in Strange Signals — a paranormal sightings correlation map with 258K+ geocoded records across three categories: UFO/UAP (~244K, including ~3.6K Canadian), Bigfoot/Sasquatch (~4.2K), and Haunted Places (~9.7K).

You help users investigate spatial and temporal patterns in paranormal sighting data. You can control the map, run statistical analyses, highlight areas of interest, and explain findings in plain language.

When the user asks about patterns, correlations, or specific regions:
1. Use your tools to filter, analyze, and visualize the data
2. Explain what you found and what it means statistically
3. Highlight relevant areas on the map so the user can see them

Always note statistical significance. A correlation of r=0.3 with p>0.05 is not meaningful — say so. Be honest about the limitations of the data.

Available data spans from ~1900 to 2023. Geographic coverage is primarily US with ~3.6K Canadian sightings.
Categories: 0=UFO/UAP, 1=Bigfoot/Sasquatch, 2=Haunted Places.

Keep responses concise but informative. Use the highlight_areas tool to visually call out important findings on the map.

You can render inline charts (bar, line, pie, scatter) in the chat using the render_chart tool. Use charts to visualize data patterns when they would be clearer than text.

You can generate full investigation reports with the generate_report tool. Reports open in a new window and can be downloaded as standalone HTML files.

You can compare two regions side-by-side with compare_regions, and export analysis results as CSV with export_findings.

You can query temporal trends with query_temporal and then render the results as a chart. For time-based questions, call query_temporal first to get the data, then use render_chart (line chart for trends, bar chart for comparisons) to visualize it.

You can detect anomalies with find_anomalies. Use 'density' to find unusual spatial clusters, 'temporal_spike' to find abnormal yearly increases, and 'population_adjusted' to find areas with high sightings relative to population. After finding anomalies, use highlight_areas to mark them on the map and render_chart to visualize them.

When the user has a hex selected in HEX DENSITY view, you can use get_hex_analysis to retrieve detailed data for that specific geographic cell — including category breakdown, subcategories, and up to 100 sighting records with descriptions. Use this to analyze common themes, compile reports on patterns within a region, or find connections between sightings in the same area.

For region comparisons, you can use these named hotspot regions: Pacific Northwest, Appalachia, Skinwalker Ranch, Area 51, Pine Barrens, Hudson Valley, Gulf Breeze, Bridgewater Triangle, San Luis Valley, Marfa, Great Lakes, Ozarks, Point Pleasant, Sedona, Roswell. You can also use US state codes or lat/lon coordinates.

OVERLAY DATASETS: The map has toggleable overlay layers that enrich analysis:
- Military/DOE Sites (98 installations) — always loaded at startup
- Restricted Airspace (105 FAA zones: Restricted, MOA, Warning, Prohibited, Alert)
- USGS Earthquakes (20K M2.5+ events, 2019-2025) — earthquake-lights hypothesis
- US Cave Systems (104 major caves/karst) — Bigfoot/Missing 411 correlation
- NASA Fireballs (29 CNEOS detections over US) — UFO misidentification analysis
- Cryptid Sightings (105 non-Bigfoot: Mothman, Jersey Devil, Champ, Skunk Ape, Dogman, etc)
- Missing 411 (71 National Park disappearance cases)
- Geomagnetic Storms (92 G3+ storms, 1950-2026) — temporal overlay on timeline

Use toggle_overlay to activate datasets, get_nearby_overlays to find features near a point, and get_active_overlays to check what is loaded. When analyzing a region, proactively check for nearby restricted airspace, caves, military bases, and Missing 411 cases to provide richer context. For temporal correlations, enable geomagnetic storms to see if sighting spikes coincide with solar activity.

You can place persistent annotation pins on the map using add_annotation. Use annotations to mark specific locations for the user — hotspots you've identified, anomaly sites, areas of interest, etc. Choose appropriate icons: 'ufo' for UFO-related, 'skull' for haunted, 'eye' for observation points, 'alert' for anomalies, 'star' for notable finds, 'pin' for general. Annotations persist across page reloads and can be exported/imported by the user. Use list_annotations to see existing pins, remove_annotation to delete specific ones, and clear_annotations to wipe the slate. When the user asks you to "pin" or "mark" a location, use add_annotation. When presenting analysis results with specific locations (like anomalies or clusters), proactively place annotation pins so the user has a persistent record.`;

/* ===== CHART MODAL ===== */
let chartModal=null;
function ensureChartModal(){
  if(chartModal)return chartModal;
  chartModal=document.createElement('div');
  chartModal.className='signal-chart-modal';
  var inner=document.createElement('div');
  inner.className='signal-chart-modal-inner';
  var closeBtn=document.createElement('button');
  closeBtn.className='signal-chart-modal-close';
  closeBtn.textContent='\u00D7';
  closeBtn.addEventListener('click',closeChartModal);
  var body=document.createElement('div');
  body.className='signal-chart-modal-body';
  inner.appendChild(closeBtn);
  inner.appendChild(body);
  chartModal.appendChild(inner);
  document.body.appendChild(chartModal);
  chartModal.addEventListener('click',function(e){
    if(e.target===chartModal)closeChartModal();
  });
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'&&chartModal.classList.contains('open'))closeChartModal();
  });
  return chartModal;
}
function openChartModal(chartOpts){
  var modal=ensureChartModal();
  var body=modal.querySelector('.signal-chart-modal-body');
  body.textContent='';
  if(window.SignalCharts){
    try{SignalCharts.render(body,chartOpts)}
    catch(e){
      var errEl=document.createElement('div');
      errEl.style.color='#ff3366';
      errEl.textContent='Chart error: '+e.message;
      body.appendChild(errEl);
    }
  }
  modal.classList.add('open');
}
function closeChartModal(){
  if(chartModal)chartModal.classList.remove('open');
}

/* ===== CHAT WINDOW ===== */
function createChatWindow(){
  if(chatWindow)return chatWindow;

  const container=document.createElement('div');
  container.style.cssText='display:flex;flex-direction:column;height:100%;position:relative';
  container.innerHTML=
    '<button class="signal-gear" id="signal-gear" title="Settings">&#9881;</button>'+
    '<div class="signal-settings" id="signal-settings" style="display:none">'+
      '<label>API KEY</label>'+
      '<input type="password" id="signal-api-key" placeholder="sk-ant-..." value="'+(localStorage.getItem('signal-api-key')||'')+'">'+
      '<div style="font-size:9px;color:var(--text-dim);margin:-4px 0 8px;line-height:1.5">'+
        'Your key stays in your browser (localStorage). Never sent anywhere except Anthropic. '+
        '<a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener" style="color:var(--cyan)">Get a key &rarr;</a>'+
      '</div>'+
      '<label>MODEL</label>'+
      '<select id="signal-model">'+
        '<option value="claude-sonnet-4-6"'+(getModel()==='claude-sonnet-4-6'?' selected':'')+'>Claude Sonnet 4.6 (fast)</option>'+
        '<option value="claude-haiku-4-5-20251001"'+(getModel()==='claude-haiku-4-5-20251001'?' selected':'')+'>Claude Haiku 4.5 (fastest, cheapest)</option>'+
        '<option value="claude-opus-4-6"'+(getModel()==='claude-opus-4-6'?' selected':'')+'>Claude Opus 4.6 (best)</option>'+
      '</select>'+
      '<div style="font-size:9px;color:var(--text-dim);margin:-4px 0 8px;line-height:1.5">'+
        'Haiku: ~$0.001/query &middot; Sonnet: ~$0.01 &middot; Opus: ~$0.05'+
      '</div>'+
      '<div class="signal-settings-actions">'+
        '<button class="btn-sm" id="signal-clear-history">CLEAR HISTORY</button>'+
        '<button class="btn-sm primary" id="signal-save-settings">SAVE & CLOSE</button>'+
      '</div>'+
    '</div>'+
    '<div class="signal-messages" id="signal-messages"></div>'+
    '<div class="signal-input-bar">'+
      '<textarea class="signal-input" id="signal-input" placeholder="Ask about patterns, correlations, or regions..." rows="1"></textarea>'+
      '<button class="signal-send" id="signal-send">SEND</button>'+
    '</div>';

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
    clearConversation();
    document.getElementById('signal-messages').innerHTML='';
    addGreeting();
  });
  document.getElementById('signal-send').addEventListener('click',sendMessage);
  document.getElementById('signal-input').addEventListener('keydown',(e)=>{
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage()}
  });
  document.getElementById('signal-input').addEventListener('input',function(){
    this.style.height='auto';
    this.style.height=Math.min(this.scrollHeight,120)+'px';
  });

  var restored=loadConversation();
  if(restored.length>0){
    messages=restored;
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
  return chatWindow;
}

function getModel(){return localStorage.getItem('signal-model')||'claude-sonnet-4-6'}
function getApiKey(){return localStorage.getItem('signal-api-key')||''}

/* ===== MESSAGE RENDERING ===== */
function addGreeting(){
  var hasKey=!!getApiKey();
  var greeting='**SIGNAL online.** I\'m your AI analyst for Strange Signals.\n\n';
  if(!hasKey){
    greeting+='To get started, click the **gear icon** above and add your Anthropic API key. Your key stays in your browser and is only sent to Anthropic.\n\n';
    greeting+='**All map features work without a key** — markers, heatmap, hex density, correlation, timeline, and overlays. The AI analyst just needs a key to answer questions.\n\n';
  }
  greeting+='I can search the dataset, run correlation analyses, detect clusters, render charts, and highlight findings on the map. Try:\n\n- "Show me UFO hotspots in the Pacific Northwest"\n- "Are Bigfoot sightings correlated with UFO activity?"\n- "Compare Ohio vs California sightings"\n- "What are the seasonal patterns?"';
  if(hasKey) greeting+='\n- "Analyze the sightings in my selected hex" *(click a hex first)*';
  appendMessage('assistant',greeting);
}

function appendMessage(role,text){
  const el=document.getElementById('signal-messages');
  const msgDiv=document.createElement('div');
  msgDiv.className='signal-msg '+role;
  const roleLabel=role==='assistant'?'SIGNAL':'YOU';
  msgDiv.innerHTML='<div class="msg-role">'+roleLabel+'</div><div class="msg-text">'+renderMarkdown(text)+'</div>';
  el.appendChild(msgDiv);
  el.scrollTop=el.scrollHeight;
  return msgDiv;
}

function appendToolIndicator(name){
  const el=document.getElementById('signal-messages');
  const toolDiv=document.createElement('div');
  toolDiv.className='signal-tool';
  const label=name.replace(/_/g,' ').replace(/\b\w/g,function(c){return c.toUpperCase()});
  toolDiv.innerHTML='<span class="signal-tool-icon">&#9678;</span> '+label;
  el.appendChild(toolDiv);
  el.scrollTop=el.scrollHeight;
  return toolDiv;
}

function updateToolIndicator(div){
  div.className='signal-tool done';
  div.querySelector('.signal-tool-icon').innerHTML='&#10003;';
}

function escHtml(s){
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderMarkdown(text){
  return escHtml(text)
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`(.+?)`/g,'<code>$1</code>')
    .replace(/^- (.+)$/gm,'<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)/g,'<ul>$1</ul>')
    .replace(/\n/g,'<br>');
}

/* ===== TOOL EXECUTION ===== */
function downloadCSV(filename,csvContent){
  var blob=new Blob([csvContent],{type:'text/csv'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url;a.download=filename;a.click();
  URL.revokeObjectURL(url);
}

async function executeTool(name,input){
  var SS=window.StrangeSignals;
  if(!SS)return{error:'App not ready'};

  switch(name){
    case 'zoom_to_region':{
      var lat,lon,zoom=input.zoom||7;
      if(input.state){
        var code=input.state.toUpperCase();
        var coords=STATE_CENTROIDS[code];
        if(coords){lat=coords[0];lon=coords[1]}
        else return{error:'Unknown state: '+input.state};
      } else if(input.city){
        try{
          var resp=await fetch('https://nominatim.openstreetmap.org/search?format=json&q='+encodeURIComponent(input.city)+'&limit=1');
          var data=await resp.json();
          if(data.length){lat=parseFloat(data[0].lat);lon=parseFloat(data[0].lon)}
          else return{error:'Could not find: '+input.city};
        }catch(e){return{error:'Geocoding failed'}}
      } else if(input.lat!=null&&input.lon!=null){
        lat=input.lat;lon=input.lon;
      } else {
        return{error:'Provide state, city, or lat/lon'};
      }
      SS.getMap().flyTo([lat,lon],zoom,{duration:1.5});
      return{success:true,lat:lat,lon:lon,zoom:zoom};
    }
    case 'set_filters':{
      SS.setFilterValues({
        yearFrom:input.year_from,yearTo:input.year_to,
        state:input.state,sub:input.subcategory,
        categories:input.categories
      });
      SS.applyFilters();
      return SS.getStats();
    }
    case 'set_view_mode':{
      SS.setView(input.mode);
      return{mode:input.mode};
    }
    case 'run_spatial_correlation':{
      if(input.hex_size_km)document.getElementById('corr-hex-size').value=input.hex_size_km;
      // Convert to the format runCorrelation expects: integer for sightings, "overlay:key" for overlays
      var valA=typeof input.category_a==='number'?String(input.category_a):'overlay:'+input.category_a;
      var valB=typeof input.category_b==='number'?String(input.category_b):'overlay:'+input.category_b;
      // Update dropdown to match
      var selA=document.getElementById('corr-a');if(selA)selA.value=valA;
      var selB=document.getElementById('corr-b');if(selB)selB.value=valB;
      SS.setView('correlation');
      var result=await SS.runCorrelation(valA,valB);
      return result||{error:'Correlation computation failed'};
    }
    case 'run_matrix_correlation':{
      if(input.hex_size_km)document.getElementById('corr-hex-size').value=input.hex_size_km;
      SS.setView('correlation');
      var matResult=await SS.runMatrixCorrelation();
      return matResult||{computed:true};
    }
    case 'detect_clusters':{
      if(input.hex_size_km)document.getElementById('corr-hex-size').value=input.hex_size_km;
      if(input.min_sightings)document.getElementById('cluster-threshold').value=input.min_sightings;
      SS.setView('correlation');
      return SS.detectClusters();
    }
    case 'run_temporal_analysis':{
      SS.setView('correlation');
      SS.runTemporalAnalysis();
      return{opened:true};
    }
    case 'highlight_areas':{
      var map=SS.getMap();
      HighlightLayer.addMultiple(map,input.areas.map(function(a){
        return{lat:a.lat,lon:a.lon,radiusKm:a.radius_km||50,label:a.label,color:a.color||'#00ff88'};
      }));
      return{highlighted:input.areas.length};
    }
    case 'get_statistics':{
      return SS.getStats();
    }
    case 'get_sightings_in_area':{
      return SS.getSightingsInArea(input.lat,input.lon,input.radius_km||50,input.category,input.limit||20);
    }
    case 'render_chart':{
      var chatMsgs=document.getElementById('signal-messages');
      var chartDiv=document.createElement('div');
      chartDiv.className='signal-msg chart';
      chatMsgs.appendChild(chartDiv);
      chatMsgs.scrollTop=chatMsgs.scrollHeight;
      if(window.SignalCharts){
        try{SignalCharts.render(chartDiv,input)}
        catch(e){
          var errMsg=document.createElement('div');
          errMsg.style.cssText='color:#ff3366;font-size:10px';
          errMsg.textContent='Chart error: '+e.message;
          chartDiv.appendChild(errMsg);
        }
      }
      // Click to expand in modal
      var chartOpts=JSON.parse(JSON.stringify(input));
      chartDiv.addEventListener('click',function(){openChartModal(chartOpts)});
      var desc=input.title||input.chart_type+' chart';
      var pointCount=input.data&&input.data.length?input.data.length:0;
      return{rendered:true,description:desc+' with '+pointCount+' data points'};
    }
    case 'generate_report':{
      if(window.SignalReports){
        var rpt=SignalReports.create(input);
        // Inject inline download link in chat
        var chatMsgs=document.getElementById('signal-messages');
        if(chatMsgs){
          var dlDiv=document.createElement('div');
          dlDiv.className='signal-msg';
          dlDiv.style.cssText='padding:8px 12px;margin:4px 0';
          var dlBtn=document.createElement('button');
          dlBtn.style.cssText='display:flex;align-items:center;gap:8px;width:100%;padding:10px 16px;'+
            'background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.3);color:#00ff88;'+
            'font-family:Orbitron,monospace;font-size:10px;letter-spacing:1.5px;cursor:pointer;'+
            'border-radius:4px;transition:all 0.2s';
          dlBtn.onmouseover=function(){this.style.background='rgba(0,255,136,0.15);';this.style.borderColor='#00ff88'};
          dlBtn.onmouseout=function(){this.style.background='rgba(0,255,136,0.08)';this.style.borderColor='rgba(0,255,136,0.3)'};
          dlBtn.textContent='\u2B07 DOWNLOAD REPORT: '+escHtml(input.title||'Report').toUpperCase();
          dlBtn.addEventListener('click',function(){
            // Find the report window and trigger its download
            var win=document.getElementById(rpt.windowId);
            if(win){
              var btn=win.querySelector('button');
              if(btn)btn.click();
            } else {
              // Rebuild and download directly
              SignalReports.download(input);
            }
          });
          dlDiv.appendChild(dlBtn);
          chatMsgs.appendChild(dlDiv);
          chatMsgs.scrollTop=chatMsgs.scrollHeight;
        }
        return{success:true,window_id:rpt.windowId,message:'Report generated. Download link added to chat.'};
      }
      return{error:'Report module not loaded'};
    }
    case 'compare_regions':{
      function resolveRegion(reg){
        var lat=reg.lat,lon=reg.lon,radius=reg.radius_km||100,label=reg.name||reg.state||'';
        // Check named regions first
        if(reg.name){
          var key=reg.name.toLowerCase();
          var named=NAMED_REGIONS[key];
          if(!named){
            // Try partial match
            var keys=Object.keys(NAMED_REGIONS);
            for(var k=0;k<keys.length;k++){
              if(keys[k].indexOf(key)>=0||key.indexOf(keys[k])>=0){named=NAMED_REGIONS[keys[k]];break}
            }
          }
          if(named){lat=named.lat;lon=named.lon;radius=named.radius_km;label=named.label}
        }
        if((!lat||!lon)&&reg.state){
          var code=reg.state.toUpperCase();
          if(STATE_CENTROIDS[code]){lat=STATE_CENTROIDS[code][0];lon=STATE_CENTROIDS[code][1];label=label||code;}
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
        var compareOpts={chart_type:'bar',title:a.label+' vs '+b.label,
          data:[
            {label:a.label+' UFO',value:a.ufo,color:'#00ff88'},
            {label:b.label+' UFO',value:b.ufo,color:'#00ff88'},
            {label:a.label+' BF',value:a.bigfoot,color:'#ff6622'},
            {label:b.label+' BF',value:b.bigfoot,color:'#ff6622'},
            {label:a.label+' HP',value:a.haunted,color:'#aa44ff'},
            {label:b.label+' HP',value:b.haunted,color:'#aa44ff'}
          ]};
        SignalCharts.render(chartDiv2,compareOpts);
        chatMsgs2.scrollTop=chatMsgs2.scrollHeight;
        chartDiv2.addEventListener('click',function(){openChartModal(compareOpts)});
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
    case 'query_temporal':{
      var temporal=SS.getTemporalData(
        input.category!=null?input.category:null,
        input.state||null,
        input.year_from||null,
        input.year_to||null,
        input.granularity||'year'
      );
      return temporal;
    }
    case 'find_anomalies':{
      var topN=input.top_n||10;
      var sigma=input.threshold_sigma||2.0;

      if(input.anomaly_type==='density'){
        var hexData=SS.getHexCounts(25);
        var hexes=hexData.hexes;
        var values=hexes.map(function(h){return input.category!=null?h.counts[input.category]:h.total});
        var mean=values.reduce(function(s,v){return s+v},0)/values.length;
        var variance=values.reduce(function(s,v){return s+(v-mean)*(v-mean)},0)/values.length;
        var stddev=Math.sqrt(variance);
        var threshold=mean+sigma*stddev;
        var anomalies=[];
        hexes.forEach(function(h,i){
          if(values[i]>threshold){
            anomalies.push({lat:h.lat,lon:h.lon,count:values[i],z_score:((values[i]-mean)/stddev).toFixed(2),
              mean:mean.toFixed(1),threshold:threshold.toFixed(1)});
          }
        });
        anomalies.sort(function(a,b){return b.count-a.count});
        return{type:'density',anomalies:anomalies.slice(0,topN),total_hexes:hexes.length,
          stats:{mean:mean.toFixed(1),stddev:stddev.toFixed(1),threshold:threshold.toFixed(1)},sigma:sigma};
      }

      if(input.anomaly_type==='temporal_spike'){
        var temporal2=SS.getTemporalData(input.category!=null?input.category:null,null,null,null,'year');
        var buckets=temporal2.buckets;
        if(buckets.length<6)return{error:'Not enough years for spike detection (need 6+)'};
        var spikes=[];
        for(var yi=5;yi<buckets.length;yi++){
          var window5=buckets.slice(yi-5,yi).map(function(b){return b.count});
          var wMean=window5.reduce(function(s,v){return s+v},0)/5;
          var wVar=window5.reduce(function(s,v){return s+(v-wMean)*(v-wMean)},0)/5;
          var wStd=Math.sqrt(wVar);
          if(wStd===0)continue;
          var z=(buckets[yi].count-wMean)/wStd;
          if(z>sigma){
            spikes.push({year:buckets[yi].label,count:buckets[yi].count,rolling_avg:wMean.toFixed(1),z_score:z.toFixed(2)});
          }
        }
        spikes.sort(function(a,b){return parseFloat(b.z_score)-parseFloat(a.z_score)});
        return{type:'temporal_spike',anomalies:spikes.slice(0,topN),total_years:buckets.length,sigma:sigma};
      }

      if(input.anomaly_type==='population_adjusted'){
        var popGrid=SS.getPopDensityGrid();
        if(!popGrid)return{error:'Population density data not loaded. Run setup to generate us_population_density.json.'};
        var hexData2=SS.getHexCounts(50);
        var ratios=[];
        hexData2.hexes.forEach(function(h){
          var sightings=input.category!=null?h.counts[input.category]:h.total;
          if(sightings===0)return;
          var row=Math.floor((h.lat-popGrid.lat_min)/(popGrid.lat_max-popGrid.lat_min)*popGrid.rows);
          var col=Math.floor((h.lon-popGrid.lon_min)/(popGrid.lon_max-popGrid.lon_min)*popGrid.cols);
          row=Math.max(0,Math.min(popGrid.rows-1,row));
          col=Math.max(0,Math.min(popGrid.cols-1,col));
          var pop=popGrid.grid[row]?popGrid.grid[row][col]:0;
          if(pop<10)pop=10;
          var ratio=sightings/pop*10000;
          ratios.push({lat:h.lat,lon:h.lon,sightings:sightings,population_density:pop,ratio:ratio.toFixed(2)});
        });
        var ratioVals=ratios.map(function(r){return parseFloat(r.ratio)});
        var rMean=ratioVals.reduce(function(s,v){return s+v},0)/ratioVals.length;
        var rVar=ratioVals.reduce(function(s,v){return s+(v-rMean)*(v-rMean)},0)/ratioVals.length;
        var rStd=Math.sqrt(rVar);
        ratios.forEach(function(r){r.z_score=rStd>0?((parseFloat(r.ratio)-rMean)/rStd).toFixed(2):'0'});
        ratios.sort(function(a,b){return parseFloat(b.z_score)-parseFloat(a.z_score)});
        var filtered=ratios.filter(function(r){return parseFloat(r.z_score)>sigma});
        return{type:'population_adjusted',anomalies:filtered.slice(0,topN),total_cells:ratios.length,
          stats:{mean_ratio:rMean.toFixed(2),stddev:rStd.toFixed(2)},sigma:sigma};
      }

      return{error:'Unknown anomaly_type: '+input.anomaly_type};
    }
    case 'add_annotation':{
      if(!window.Annotations)return{error:'Annotations module not loaded'};
      var anno=window.Annotations.add(input.lat,input.lon,input.note,input.icon||'pin');
      return{success:true,annotation:anno,message:'Annotation placed at '+input.lat.toFixed(2)+', '+input.lon.toFixed(2)};
    }
    case 'remove_annotation':{
      if(!window.Annotations)return{error:'Annotations module not loaded'};
      window.Annotations.remove(input.id);
      return{success:true,removed:input.id};
    }
    case 'list_annotations':{
      if(!window.Annotations)return{error:'Annotations module not loaded'};
      var all=window.Annotations.getAll();
      return{count:all.length,annotations:all.map(function(a){
        return{id:a.id,lat:a.lat.toFixed(3),lon:a.lon.toFixed(3),note:a.note,icon:a.icon,created:a.created};
      })};
    }
    case 'clear_annotations':{
      if(!window.Annotations)return{error:'Annotations module not loaded'};
      window.Annotations.clearAll();
      return{success:true,message:'All annotations cleared'};
    }
    case 'get_hex_analysis':{
      var hexData=window._selectedHexData;
      if(!hexData)return{error:'No hex selected. Switch to HEX DENSITY view and click a hex cell first.'};
      var result={
        location:hexData.location,
        lat:hexData.lat,lon:hexData.lon,
        total_sightings:hexData.total,
        categories:hexData.categories,
        top_subcategories:hexData.topSubcategories
      };
      if(input.include_descriptions!==false){
        result.sightings=hexData.sightings;
      } else {
        result.sighting_count=hexData.sightings.length;
      }
      return result;
    }
    case 'get_nearby_overlays':{
      if(!SS.getNearbyOverlays)return{error:'Overlay API not available. Update required.'};
      var nearby=SS.getNearbyOverlays(input.lat,input.lon,input.radius_km||50);
      if(!Object.keys(nearby).length)return{message:'No overlay features found within '+
        (input.radius_km||50)+'km. Toggle on overlay datasets first (airspace, caves, cryptids, etc).'};
      return nearby;
    }
    case 'toggle_overlay':{
      var toggleMap={
        military:'military-toggle',airspace:'airspace-toggle',earthquakes:'earthquakes-toggle',
        caves:'caves-toggle',fireballs:'fireballs-toggle',cryptids:'cryptids-toggle',
        missing411:'missing411-toggle',geomagnetic:'geomagnetic-toggle',
        parks:'parks-toggle',historic:'historic-toggle'
      };
      var tid=toggleMap[input.overlay];
      if(!tid)return{error:'Unknown overlay: '+input.overlay};
      var tel=document.getElementById(tid);
      if(!tel)return{error:'Overlay toggle not found in DOM'};
      var want=input.enabled!==false;
      if(tel.checked!==want){
        tel.checked=want;
        tel.dispatchEvent(new Event('change'));
      }
      return{overlay:input.overlay,enabled:want,message:input.overlay+' overlay '+(want?'enabled':'disabled')};
    }
    case 'get_active_overlays':{
      if(!SS.getActiveOverlays)return{error:'Overlay API not available.'};
      return{active:SS.getActiveOverlays()};
    }
    default:
      return{error:'Unknown tool: '+name};
  }
}

/* ===== API CALL WITH STREAMING ===== */
var MAX_RETRIES=3;
var BASE_DELAY_MS=2000;

function formatApiError(err,response){
  if(!response){return{msg:'Unable to reach the API. Check your internet connection.',details:err.message}}
  if(response.status===401){return{msg:'API key not set or invalid. Click the gear icon to configure.',details:'HTTP 401'}}
  if(response.status===429){return{msg:'Rate limited by the API. Try again in a minute or switch to a faster model (Haiku).',details:'HTTP 429 \u2014 Too many requests. The Anthropic API limits request frequency per key.'}}
  if(response.status===529){return{msg:'Anthropic API is temporarily overloaded. Please try again shortly.',details:'HTTP 529'}}
  return{msg:'Something went wrong.',details:err.message||'HTTP '+response.status}
}

function showError(errInfo){
  var typing=document.getElementById('signal-typing');
  if(typing)typing.remove();
  var div=document.createElement('div');
  div.className='signal-error';
  div.innerHTML=escHtml(errInfo.msg)+' <span class="signal-error-toggle" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'block\'?\'none\':\'block\'">Show details</span>'
    +'<div class="signal-error-details">'+escHtml(errInfo.details||'')+'</div>';
  document.getElementById('signal-messages').appendChild(div);
  document.getElementById('signal-messages').scrollTop=document.getElementById('signal-messages').scrollHeight;
  isStreaming=false;
}

async function sendMessage(){
  var inputEl=document.getElementById('signal-input');
  var text=inputEl.value.trim();
  if(!text||isStreaming)return;

  var apiKey=getApiKey();
  if(!apiKey){
    appendMessage('assistant','**API key required.** Click the gear icon (top-right of this panel) to add your Anthropic API key.\n\nDon\'t have one? [Get a free key at console.anthropic.com](https://console.anthropic.com/settings/keys)\n\nYour key stays in your browser and is never stored on any server.');
    return;
  }

  // Clear highlights on new query
  if(window.HighlightLayer)HighlightLayer.clear();

  appendMessage('user',text);
  messages.push({role:'user',content:text});
  saveConversation();
  inputEl.value='';
  inputEl.style.height='auto';

  // Add typing indicator
  var typingDiv=document.createElement('div');
  typingDiv.className='signal-typing';
  typingDiv.id='signal-typing';
  typingDiv.innerHTML='<div class="signal-typing-dots"><span></span><span></span><span></span></div> SIGNAL is analyzing...';
  document.getElementById('signal-messages').appendChild(typingDiv);
  document.getElementById('signal-messages').scrollTop=document.getElementById('signal-messages').scrollHeight;

  if(messages.length>20)messages=messages.slice(-20);

  isStreaming=true;
  document.getElementById('signal-send').disabled=true;

  try{
    await runConversationLoop();
  }catch(e){
    console.error('SIGNAL error:',e);
    showError(formatApiError(e,e.response||null));
  }finally{
    isStreaming=false;
    document.getElementById('signal-send').disabled=false;
  }
}

async function runConversationLoop(){
  var apiKey=getApiKey();
  var model=getModel();

  for(var turn=0;turn<10;turn++){
    var body={
      model:model,
      max_tokens:4096,
      system:SYSTEM_PROMPT,
      tools:TOOLS,
      messages:messages,
      stream:true
    };

    var resp=null;
    for(var attempt=0;attempt<=MAX_RETRIES;attempt++){
      resp=await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'x-api-key':apiKey,
          'anthropic-version':'2023-06-01',
          'anthropic-dangerous-direct-browser-access':'true'
        },
        body:JSON.stringify(body)
      });
      if(resp.status!==429&&resp.status!==529)break;
      if(attempt<MAX_RETRIES){
        var retryAfter=resp.headers.get('retry-after');
        var delayMs=retryAfter?parseInt(retryAfter,10)*1000:BASE_DELAY_MS*Math.pow(2,attempt);
        var delaySec=Math.round(delayMs/1000);
        var typing=document.getElementById('signal-typing');
        if(typing){
          var dots=typing.querySelector('.signal-typing-dots');
          // Clear and rebuild: keep dots animation, update text
          typing.textContent='';
          if(dots)typing.appendChild(dots);
          typing.appendChild(document.createTextNode(' Rate limited \u2014 retrying in '+delaySec+'s (attempt '+(attempt+2)+'/'+(MAX_RETRIES+1)+')...'));
        }
        await new Promise(function(r){setTimeout(r,delayMs)});
      }
    }

    if(!resp.ok){
      var errText=await resp.text();
      throw Object.assign(new Error('API '+resp.status+': '+errText.substring(0,200)),{response:resp});
    }

    var result=await parseStream(resp);
    var hasToolUse=result.content.some(function(b){return b.type==='tool_use'});

    messages.push({role:'assistant',content:result.content});
    saveConversation();

    if(!hasToolUse)break;

    // Execute tool calls
    var toolResults=[];
    for(var i=0;i<result.content.length;i++){
      var block=result.content[i];
      if(block.type!=='tool_use')continue;
      var indicator=appendToolIndicator(block.name);
      try{
        var toolResult=await executeTool(block.name,block.input);
        updateToolIndicator(indicator);
        toolResults.push({type:'tool_result',tool_use_id:block.id,content:JSON.stringify(toolResult)});
      }catch(e){
        updateToolIndicator(indicator);
        toolResults.push({type:'tool_result',tool_use_id:block.id,content:JSON.stringify({error:e.message}),is_error:true});
      }
    }

    messages.push({role:'user',content:toolResults});
    saveConversation();
  }
}

async function parseStream(resp){
  var reader=resp.body.getReader();
  var decoder=new TextDecoder();
  var buffer='';
  var currentText='';
  var msgDiv=null;
  var content=[];
  var currentBlock=null;
  var toolInput='';

  while(true){
    var chunk=await reader.read();
    if(chunk.done)break;
    buffer+=decoder.decode(chunk.value,{stream:true});

    var lines=buffer.split('\n');
    buffer=lines.pop()||'';

    for(var li=0;li<lines.length;li++){
      var line=lines[li];
      if(!line.startsWith('data: '))continue;
      var data=line.slice(6);
      if(data==='[DONE]')continue;

      try{
        var event=JSON.parse(data);

        switch(event.type){
          case 'content_block_start':
            currentBlock=event.content_block;
            if(currentBlock.type==='text'){
              currentText='';
              var typing=document.getElementById('signal-typing');
              if(typing)typing.remove();
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
              var parsedInput={};
              try{parsedInput=JSON.parse(toolInput)}catch(e){}
              content.push({type:'tool_use',id:currentBlock.id,name:currentBlock.name,input:parsedInput});
            }
            currentBlock=null;
            break;
        }
      }catch(e){/* skip malformed events */}
    }
  }

  return{content:content};
}

/* ===== TOGGLE & KEYBOARD ===== */
function toggleAssistant(){
  var win=createChatWindow();
  win.toggle();
  var btn=document.getElementById('ai-toggle');
  if(btn)btn.classList.toggle('active',!win._hidden&&!win._minimized);
}

// Toggle button
var aiBtn=document.getElementById('ai-toggle');
if(aiBtn)aiBtn.addEventListener('click',toggleAssistant);

// Keyboard shortcut: I
document.addEventListener('keydown',function(e){
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT')return;
  if(e.key==='i'||e.key==='I'){
    e.preventDefault();
    toggleAssistant();
  }
});

})();
