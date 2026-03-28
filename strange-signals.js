(function(){
'use strict';

/* ========== CONSTANTS ========== */
const CAT_COLORS = ['#00ff88','#ff6622','#aa44ff'];
const CAT_NAMES = ['UFO/UAP','Bigfoot/Sasquatch','Haunted Place'];
const CAT_RGB = ['0,255,136','255,102,34','170,68,255'];
const F={LAT:0,LON:1,CAT:2,DATE:3,LOC:4,SUB:5,DESC:6};
function autoHexSize(zoom){return zoom<=4?80:zoom<=5?50:zoom<=6?30:zoom<=7?20:15}
function autoHeatRadius(zoom){return zoom<=4?14:zoom<=5?17:zoom<=6?21:zoom<=7?25:22}

/* ========== STATE ========== */
let allData=[], catArrays=[[],[],[]];
let filteredCat=[[],[],[]];
let currentView='markers';
let clusterGroups=[null,null,null];
let heatLayers=[null,null,null];
let hexLayer=null, corrLayer=null, proxCircle=null, proxMarkers=null;
let brushRange=null; // [yearStart, yearEnd] from timeline brush
let timelineBuilt=false;

/* ========== CORRELATION SUB-MODE STATE ========== */
let corrSubMode='spatial';
let cachedHexGrid=null, cachedHexCounts=null, cachedHexSize=null, cachedBoundsKey=null;
let cachedSpatialIndex=null;
let corrMatrix=null; // 3x3 r values
let detectedClusters=[]; // [{indices, centroid, label, stats, color}]
let clusterLayer=null;
let monthlyBins=null;
let temporalOverlayVisible=false;
let nnResults=null;
let attractionLayer=null;

/* ========== OVERLAY STATE ========== */
let popDensityGrid=null; // {resolution, lat_min, lat_max, lon_min, lon_max, rows, cols, grid}
let perCapitaMode=false;
let militaryData=null; // {fields, data}
let militaryLayer=null;
let showMilitaryBases=false;
let parksData=null;
let parksLayer=null;
let showParks=false;
let historicData=null;
let historicLayer=null;
let showHistoric=false;
// New overlays
let airspaceData=null,airspaceLayer=null,showAirspace=false;
let earthquakeData=null,earthquakeLayer=null,showEarthquakes=false;
let caveData=null,caveLayer=null,showCaves=false;
let fireballData=null,fireballLayer=null,showFireballs=false;
let cryptidData=null,cryptidLayer=null,showCryptids=false;
let missing411Data=null,missing411Layer=null,showMissing411=false;
let geomagData=null,showGeomagnetic=false,geomagBandsGroup=null;

/* ========== MAP INIT ========== */
const map=L.map('map',{center:[39.5,-98.35],zoom:4,preferCanvas:true,maxZoom:18,zoomControl:false});
L.control.zoom({position:'topright'}).addTo(map);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{
  attribution:'&copy; OpenStreetMap &copy; CARTO',maxZoom:19
}).addTo(map);

map.on('zoomend',()=>{
  document.getElementById('stat-zoom').textContent=map.getZoom();
  // Re-render heatmap/hexbin on zoom so dynamic radius/cell-size updates
  if(currentView==='heatmap'||currentView==='hexbin')renderCurrentView();
});

/* ========== PROGRESS ========== */
const LOADING_VERBS=[
  'Scanning frequencies','Triangulating signals','Cataloging anomalies',
  'Decoding witness reports','Mapping coordinates','Correlating patterns',
  'Probing the unknown','Tracing sightings','Parsing field data',
  'Spelunking databases','Tabulating encounters','Geolocating phenomena',
  'Indexing the unexplained','Surveying hotspots','Crunching coordinates',
  'Analyzing waveforms','Calibrating sensors','Aggregating intel'
];
const LOADING_FACTS=[
  'Earliest recorded sighting: 1910, Pacific Northwest',
  'California leads all states with 15,000+ UFO reports',
  'Washington state: highest Bigfoot sighting density in the US',
  'Over 10,000 haunted locations documented nationwide',
  'Peak UFO sighting hour: 9 PM local time',
  'The Pacific Northwest is a triple-category paranormal hotspot',
  '"Triangle" is the most commonly reported UFO shape',
  'Dataset spans 258,000+ geocoded paranormal records',
  'Bigfoot sightings spike in September and October',
  'Most haunted state per capita: Louisiana',
  '98 US military installations mapped for proximity analysis',
  'Average UFO sighting lasts under 5 minutes',
  'Ohio ranks #4 nationally for UFO sightings',
  'BFRO has cataloged 5,000+ Bigfoot field reports',
  'The "Skinwalker Ranch" region has all three sighting types',
  'Reports increase 300% during summer months'
];
let _flavorIdx=0,_flavorTimer=null,_verbIdx=0;
function setProgress(pct,msg){
  // Progress bar is CSS-animated (decoupled from loading state)
  // Only update status text
  document.getElementById('loading-status').textContent=msg;
}
function setBytes(loaded,total){
  const el=document.getElementById('loading-bytes');
  if(!el)return;
  const fmt=n=>n<1e6?(n/1e3).toFixed(0)+'KB':(n/1e6).toFixed(1)+'MB';
  el.textContent=total?`${fmt(loaded)} / ${fmt(total)}`:`${fmt(loaded)} downloaded`;
}
function nextVerb(){
  _verbIdx=(_verbIdx+1)%LOADING_VERBS.length;
  return LOADING_VERBS[_verbIdx];
}
function startFlavorRotation(){
  const el=document.getElementById('loading-flavor');
  if(!el)return;
  _flavorIdx=Math.floor(Math.random()*LOADING_FACTS.length);
  _verbIdx=Math.floor(Math.random()*LOADING_VERBS.length);
  el.textContent=LOADING_FACTS[_flavorIdx];
  el.classList.add('slide-in');
  _flavorTimer=setInterval(()=>{
    // Slide current fact up and out
    el.classList.remove('slide-in');
    el.classList.add('slide-up');
    setTimeout(()=>{
      _flavorIdx=(_flavorIdx+1)%LOADING_FACTS.length;
      el.textContent=LOADING_FACTS[_flavorIdx];
      // Slide new fact in from below
      el.classList.remove('slide-up');
      el.classList.add('slide-in');
    },500);
  },3000);
}
function stopFlavorRotation(){
  if(_flavorTimer){clearInterval(_flavorTimer);_flavorTimer=null}
}

/* ========== ESCAPE HTML ========== */
function decodeEntities(s){
  // Decode HTML numeric entities (&#44; → , etc.) that exist in source data
  return s.replace(/&#(\d+);?/g,(_,n)=>String.fromCharCode(parseInt(n)))
          .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'");
}
function esc(s){return s?decodeEntities(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'):''}

/* ========== CREATE MARKER ========== */
const CAT_ICON_SVG=[
  // UFO/UAP — classic saucer silhouette
  (c)=>`<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12">
    <ellipse cx="6" cy="6" rx="5.5" ry="2.5" fill="${c}" opacity="0.9"/>
    <ellipse cx="6" cy="5" rx="3" ry="2" fill="${c}" opacity="0.7"/>
    <ellipse cx="6" cy="6" rx="5.5" ry="2.5" stroke="rgba(255,255,255,0.4)" stroke-width="0.5" fill="none"/>
  </svg>`,
  // Bigfoot — footprint silhouette
  (c)=>`<svg xmlns="http://www.w3.org/2000/svg" width="10" height="14" viewBox="0 0 10 14">
    <ellipse cx="5" cy="9" rx="3.2" ry="4.5" fill="${c}" opacity="0.9"/>
    <circle cx="2.2" cy="3.2" r="1.3" fill="${c}" opacity="0.85"/>
    <circle cx="4" cy="2" r="1.2" fill="${c}" opacity="0.85"/>
    <circle cx="6" cy="2" r="1.2" fill="${c}" opacity="0.85"/>
    <circle cx="7.8" cy="3.2" r="1.3" fill="${c}" opacity="0.85"/>
    <rect x="0" y="0" width="10" height="14" rx="1" stroke="rgba(255,255,255,0.3)" stroke-width="0.4" fill="none"/>
  </svg>`,
  // Haunted — ghost silhouette
  (c)=>`<svg xmlns="http://www.w3.org/2000/svg" width="11" height="14" viewBox="0 0 11 14">
    <path d="M5.5,1 C8,1 10,3.5 10,6 L10,11 Q9,10 8,11 Q7,12 6,11 Q5.5,10.5 5,11 Q4,12 3,11 Q2,10 1,11 L1,6 C1,3.5 3,1 5.5,1Z" fill="${c}" opacity="0.9" stroke="rgba(255,255,255,0.3)" stroke-width="0.4"/>
    <circle cx="4" cy="5.5" r="1" fill="rgba(0,0,0,0.5)"/>
    <circle cx="7" cy="5.5" r="1" fill="rgba(0,0,0,0.5)"/>
  </svg>`
];
function makeIcon(catIdx){
  const c=CAT_COLORS[catIdx];
  const svg=CAT_ICON_SVG[catIdx](c);
  const sizes=[[12,12],[10,14],[11,14]];
  const anchors=[[6,6],[5,7],[5.5,7]];
  return L.divIcon({className:'',iconSize:sizes[catIdx],iconAnchor:anchors[catIdx],
    html:svg});
}
const icons=[makeIcon(0),makeIcon(1),makeIcon(2)];

function makePopup(rec){
  const cat=rec[F.CAT];
  let h=`<div class="popup-cat" style="color:${CAT_COLORS[cat]}">${CAT_NAMES[cat]}</div>`;
  h+=`<div class="popup-loc">${esc(rec[F.LOC])||'Unknown location'}</div>`;
  if(rec[F.DATE])h+=`<div class="popup-date">${rec[F.DATE]}</div>`;
  if(rec[F.SUB])h+=`<div class="popup-sub">${esc(rec[F.SUB])}</div>`;
  if(rec[F.DESC]){
    const desc=esc(rec[F.DESC]);
    const TRUNC=200;
    if(desc.length>TRUNC){
      const id='desc-'+Math.random().toString(36).slice(2,8);
      h+=`<div class="popup-desc"><span id="${id}-short">${desc.slice(0,TRUNC)}... <a href="#" class="popup-expand" onclick="document.getElementById('${id}-short').style.display='none';document.getElementById('${id}-full').style.display='inline';return false">Show more</a></span><span id="${id}-full" style="display:none">${desc} <a href="#" class="popup-expand" onclick="document.getElementById('${id}-full').style.display='none';document.getElementById('${id}-short').style.display='inline';return false">Show less</a></span></div>`;
    } else {
      h+=`<div class="popup-desc">${desc}</div>`;
    }
  }
  h+=`<div class="popup-coords">${rec[F.LAT].toFixed(4)}, ${rec[F.LON].toFixed(4)}</div>`;
  // proximity analysis (bounding-box pre-filter for performance)
  const radius=parseInt(document.getElementById('prox-radius').value);
  const pt=turf.point([rec[F.LON],rec[F.LAT]]);
  const latDeg=radius/111;
  const lonDeg=radius/(111*Math.cos(rec[F.LAT]*Math.PI/180));
  let proxHtml='';
  for(let i=0;i<3;i++){
    if(i===cat)continue;
    const cb=document.querySelector(`[data-cat="${i}"]`);
    if(!cb||!cb.checked)continue;
    let count=0;
    filteredCat[i].forEach(r=>{
      // Fast bounding-box reject before expensive turf.distance
      if(Math.abs(r[F.LAT]-rec[F.LAT])>latDeg||Math.abs(r[F.LON]-rec[F.LON])>lonDeg)return;
      const d=turf.distance(pt,turf.point([r[F.LON],r[F.LAT]]),{units:'kilometers'});
      if(d<=radius)count++;
    });
    proxHtml+=`<div><span style="color:${CAT_COLORS[i]}">${CAT_NAMES[i]}</span>: ${count} within ${radius}km</div>`;
  }
  if(proxHtml){
    h+=`<div class="popup-prox"><div class="popup-prox-title">PROXIMITY ANALYSIS</div>${proxHtml}</div>`;
  }
  return h;
}

function createMarker(rec){
  const label=CAT_NAMES[rec[F.CAT]]+' sighting'+(rec[F.LOC]?' near '+rec[F.LOC]:'');
  const m=L.marker([rec[F.LAT],rec[F.LON]],{icon:icons[rec[F.CAT]],alt:label});
  m._rec=rec;
  m.bindPopup(()=>makePopup(rec),{maxWidth:300});
  m.on('click',function(){showProxCircle(rec)});
  m.on('add',function(){if(m._icon)m._icon.setAttribute('aria-label',label)});
  return m;
}

/* ========== PROXIMITY CIRCLE ========== */
function showProxCircle(rec){
  clearProxCircle();
  const radius=parseInt(document.getElementById('prox-radius').value)*1000;
  proxCircle=L.circle([rec[F.LAT],rec[F.LON]],{radius,className:'prox-circle',
    fillColor:'rgba(0,212,255,0.06)',color:'#00d4ff',weight:1.5,dashArray:'6 4'}).addTo(map);
}
function clearProxCircle(){
  if(proxCircle){map.removeLayer(proxCircle);proxCircle=null}
}

/* ========== POPULATION DENSITY LOOKUP ========== */
function getPopDensity(lat,lon){
  if(!popDensityGrid)return 0;
  const g=popDensityGrid;
  if(lat<g.lat_min||lat>g.lat_max||lon<g.lon_min||lon>g.lon_max)return 0;
  const row=Math.floor((g.lat_max-lat)/g.resolution);
  const col=Math.floor((lon-g.lon_min)/g.resolution);
  if(row<0||row>=g.rows||col<0||col>=g.cols)return 0;
  return g.grid[row][col]||0;
}

/* ========== MILITARY BASES LAYER ========== */
function renderMilitaryBases(){
  if(militaryLayer){map.removeLayer(militaryLayer);militaryLayer=null}
  if(!showMilitaryBases||!militaryData)return;
  militaryLayer=L.layerGroup();
  const MF={LAT:0,LON:1,NAME:2,BRANCH:3,TYPE:4};
  const branchColors={
    'Air Force':'#4488ff','Space Force':'#44ccff','Navy':'#0066cc',
    'Army':'#44aa44','Marines':'#cc4444','DoD':'#888888',
    'DOE':'#ffaa00','NASA':'#ff6644','CIA':'#666666',
    'Guard':'#66aa66','FAA':'#8888aa','Commerce':'#aa88cc'
  };
  militaryData.data.forEach(b=>{
    const color=branchColors[b[MF.BRANCH]]||'#888888';
    const icon=L.divIcon({className:'',iconSize:[10,10],iconAnchor:[5,5],
      html:`<div style="width:10px;height:10px;background:${color};border:1.5px solid rgba(255,255,255,0.6);transform:rotate(45deg);opacity:0.85"></div>`});
    const marker=L.marker([b[MF.LAT],b[MF.LON]],{icon});
    marker.bindTooltip(`<b style="color:${color}">${esc(b[MF.NAME])}</b><br><span style="color:var(--text-dim)">${b[MF.BRANCH]} - ${b[MF.TYPE]}</span>`,{className:'mil-tooltip'});
    marker.addTo(militaryLayer);
  });
  militaryLayer.addTo(map);
}

function removeMilitaryBases(){
  if(militaryLayer){map.removeLayer(militaryLayer);militaryLayer=null}
}

/* ========== NEW OVERLAY RENDER FUNCTIONS ========== */
const AIRSPACE_COLORS={Restricted:'#ff4466',MOA:'#ff8844',Warning:'#ffcc44',Prohibited:'#cc0022',Alert:'#4488ff'};
function renderAirspace(){
  if(airspaceLayer){map.removeLayer(airspaceLayer);airspaceLayer=null}
  if(!showAirspace||!airspaceData)return;
  airspaceLayer=L.layerGroup();
  const AF={LAT:0,LON:1,NAME:2,TYPE:3,FLOOR:4,CEIL:5,AGENCY:6};
  airspaceData.data.forEach(a=>{
    const color=AIRSPACE_COLORS[a[AF.TYPE]]||'#ff4466';
    const radius=a[AF.TYPE]==='Prohibited'?15000:a[AF.TYPE]==='MOA'?40000:25000;
    const circle=L.circle([a[AF.LAT],a[AF.LON]],{radius,color,fillColor:color,
      fillOpacity:0.08,weight:1.5,dashArray:'6 3',className:'airspace-circle'});
    const floorStr=a[AF.FLOOR]!=null?a[AF.FLOOR]+'ft':'SFC';
    const ceilStr=a[AF.CEIL]!=null?a[AF.CEIL]+'ft':'UNL';
    circle.bindTooltip('<b style="color:'+color+'">'+esc(a[AF.NAME])+'</b><br>'+
      '<span style="color:var(--text-dim)">'+a[AF.TYPE]+' Airspace</span><br>'+
      'Floor: '+floorStr+' | Ceiling: '+ceilStr+'<br>'+
      '<span style="color:var(--text-dim)">'+esc(a[AF.AGENCY]||'')+'</span>',{className:'mil-tooltip'});
    circle.addTo(airspaceLayer);
    const icon=L.divIcon({className:'overlay-marker airspace-marker',html:'&#9651;',iconSize:[12,12]});
    L.marker([a[AF.LAT],a[AF.LON]],{icon}).addTo(airspaceLayer);
  });
  airspaceLayer.addTo(map);
}
function removeAirspace(){if(airspaceLayer){map.removeLayer(airspaceLayer);airspaceLayer=null}}

function renderEarthquakes(){
  if(earthquakeLayer){map.removeLayer(earthquakeLayer);earthquakeLayer=null}
  if(!showEarthquakes||!earthquakeData)return;
  const EF={LAT:0,LON:1,DATE:2,MAG:3,DEPTH:4,PLACE:5};
  const pts=earthquakeData.data.map(e=>[e[EF.LAT],e[EF.LON],Math.pow(e[EF.MAG]-2,1.5)/10]);
  earthquakeLayer=L.heatLayer(pts,{
    radius:12,blur:10,maxZoom:map.getZoom(),minOpacity:0.15,
    gradient:{0.0:'rgba(0,0,0,0)',0.2:'rgba(255,136,68,0.3)',0.5:'rgba(255,136,68,0.6)',
      0.8:'rgba(255,200,100,0.85)',1.0:'rgba(255,255,200,1)'}
  }).addTo(map);
}
function removeEarthquakes(){if(earthquakeLayer){map.removeLayer(earthquakeLayer);earthquakeLayer=null}}

function renderCaves(){
  if(caveLayer){map.removeLayer(caveLayer);caveLayer=null}
  if(!showCaves||!caveData)return;
  caveLayer=L.layerGroup();
  const CF={LAT:0,LON:1,NAME:2,STATE:3,TYPE:4,LENGTH:5};
  caveData.data.forEach(c=>{
    const icon=L.divIcon({className:'overlay-marker cave-marker',html:'&#9673;',iconSize:[12,12]});
    const marker=L.marker([c[CF.LAT],c[CF.LON]],{icon});
    const lenStr=c[CF.LENGTH]?'Length: '+c[CF.LENGTH]+' mi':'';
    marker.bindPopup('<b style="color:var(--cave)">&#9673; '+esc(c[CF.NAME])+'</b><br>'+
      esc(c[CF.STATE])+' &mdash; '+esc(c[CF.TYPE])+'<br>'+lenStr);
    caveLayer.addLayer(marker);
  });
  caveLayer.addTo(map);
}
function removeCaves(){if(caveLayer){map.removeLayer(caveLayer);caveLayer=null}}

function renderFireballs(){
  if(fireballLayer){map.removeLayer(fireballLayer);fireballLayer=null}
  if(!showFireballs||!fireballData)return;
  fireballLayer=L.layerGroup();
  const FF={LAT:0,LON:1,DATE:2,ENERGY:3,VELOCITY:4,ALT:5};
  fireballData.data.forEach(f=>{
    const energy=f[FF.ENERGY]||1;
    const sz=Math.max(10,Math.min(24,8+Math.sqrt(energy)*3));
    const icon=L.divIcon({className:'overlay-marker fireball-marker',
      html:'<span style="font-size:'+sz+'px">&#9788;</span>',iconSize:[sz,sz]});
    const marker=L.marker([f[FF.LAT],f[FF.LON]],{icon});
    const velStr=f[FF.VELOCITY]?'Velocity: '+f[FF.VELOCITY]+' km/s<br>':'';
    const altStr=f[FF.ALT]?'Altitude: '+f[FF.ALT]+' km':'';
    marker.bindPopup('<b style="color:var(--fireball)">&#9788; NASA Fireball</b><br>'+
      'Date: '+esc(f[FF.DATE])+'<br>Energy: '+energy+' kt TNT<br>'+velStr+altStr);
    fireballLayer.addLayer(marker);
  });
  fireballLayer.addTo(map);
}
function removeFireballs(){if(fireballLayer){map.removeLayer(fireballLayer);fireballLayer=null}}

function renderCryptids(){
  if(cryptidLayer){map.removeLayer(cryptidLayer);cryptidLayer=null}
  if(!showCryptids||!cryptidData)return;
  cryptidLayer=L.layerGroup();
  const XF={LAT:0,LON:1,NAME:2,TYPE:3,STATE:4,DESC:5,YEAR:6};
  cryptidData.data.forEach(c=>{
    const icon=L.divIcon({className:'overlay-marker cryptid-marker',html:'&#10070;',iconSize:[12,12]});
    const marker=L.marker([c[XF.LAT],c[XF.LON]],{icon});
    const yearStr=c[XF.YEAR]?'Year: '+c[XF.YEAR]+'<br>':'';
    marker.bindPopup('<b style="color:var(--cryptid)">&#10070; '+esc(c[XF.TYPE])+'</b><br>'+
      '<span style="color:var(--text-dim)">'+esc(c[XF.NAME])+', '+esc(c[XF.STATE])+'</span><br>'+
      yearStr+'<span style="font-size:10px">'+esc(c[XF.DESC]||'')+'</span>');
    cryptidLayer.addLayer(marker);
  });
  cryptidLayer.addTo(map);
}
function removeCryptids(){if(cryptidLayer){map.removeLayer(cryptidLayer);cryptidLayer=null}}

function renderMissing411(){
  if(missing411Layer){map.removeLayer(missing411Layer);missing411Layer=null}
  if(!showMissing411||!missing411Data)return;
  missing411Layer=L.layerGroup();
  const MF2={LAT:0,LON:1,NAME:2,PARK:3,STATE:4,YEAR:5,AGE:6,CIRC:7};
  missing411Data.data.forEach(m=>{
    const icon=L.divIcon({className:'overlay-marker missing411-marker',html:'&#9888;',iconSize:[12,12]});
    const marker=L.marker([m[MF2.LAT],m[MF2.LON]],{icon});
    const yearAge=(m[MF2.YEAR]?'Year: '+m[MF2.YEAR]:'')+(m[MF2.AGE]?' | Age: '+m[MF2.AGE]:'');
    marker.bindPopup('<b style="color:var(--missing411)">&#9888; Missing 411</b><br>'+
      '<b>'+esc(m[MF2.NAME])+'</b><br>'+
      esc(m[MF2.PARK])+', '+esc(m[MF2.STATE])+'<br>'+
      yearAge+'<br><span style="font-size:10px">'+esc(m[MF2.CIRC]||'')+'</span>');
    missing411Layer.addLayer(marker);
  });
  missing411Layer.addTo(map);
}
function removeMissing411(){if(missing411Layer){map.removeLayer(missing411Layer);missing411Layer=null}}

function renderGeomagBands(){
  if(!geomagData||!showGeomagnetic||!timelineBuilt)return;
  removeGeomagBands();
  const svg=d3.select('#timeline-svg');
  const g=svg.select('g');
  if(g.empty())return;
  const yearData2={};
  allData.forEach(r=>{
    if(!r[F.DATE])return;
    const y=parseInt(r[F.DATE].substring(0,4));
    if(isNaN(y)||y<1900||y>2030)return;
    if(!yearData2[y])yearData2[y]=1;
  });
  const years=Object.keys(yearData2).map(Number).sort((a,b)=>a-b);
  if(!years.length)return;
  const container=document.getElementById('timeline-panel');
  const w=container.clientWidth-32;
  const h=parseInt(getComputedStyle(document.documentElement).getPropertyValue('--timeline-h'))-36;
  const margin={top:4,right:16,bottom:22,left:40};
  const iw=w-margin.left-margin.right;
  const ih=h-margin.top-margin.bottom;
  const x=d3.scaleBand().domain(years).range([0,iw]).padding(0.15);
  const stormColors={G3:'#ffcc00',G4:'#ff8800',G5:'#ff2200'};
  const GF={DATE:0,KP:1,CLASS:2,NAME:3};
  const bandsG=g.append('g').attr('class','geomag-bands-group');
  geomagData.data.forEach(s=>{
    const year=parseInt(s[GF.DATE].substring(0,4));
    if(!x(year)&&x(year)!==0)return;
    const color=stormColors[s[GF.CLASS]]||'#ffcc00';
    const bw=Math.max(x.bandwidth(),3);
    bandsG.append('rect')
      .attr('class','geomag-band')
      .attr('x',x(year))
      .attr('y',0)
      .attr('width',bw)
      .attr('height',ih)
      .attr('fill',color)
      .attr('opacity',0.25);
    bandsG.append('rect')
      .attr('class','geomag-band-hover')
      .attr('x',x(year))
      .attr('y',0)
      .attr('width',bw)
      .attr('height',ih)
      .attr('fill','transparent')
      .style('pointer-events','all')
      .on('mouseover',function(event){
        d3.select(this.previousSibling).attr('opacity',0.5);
        const tt=document.getElementById('timeline-tooltip');
        tt.style.display='block';
        tt.style.left=(event.offsetX+10)+'px';
        tt.style.top=(event.offsetY-30)+'px';
        tt.textContent=s[GF.CLASS]+' Storm — '+s[GF.DATE]+' (Kp '+s[GF.KP]+') '+esc(s[GF.NAME]||'');
      })
      .on('mouseout',function(){
        d3.select(this.previousSibling).attr('opacity',0.25);
        document.getElementById('timeline-tooltip').style.display='none';
      });
  });
  geomagBandsGroup=bandsG;
}
function removeGeomagBands(){
  if(geomagBandsGroup){geomagBandsGroup.remove();geomagBandsGroup=null}
  d3.selectAll('.geomag-bands-group').remove();
}

/* ========== SHARED ANALYSIS INFRASTRUCTURE ========== */
function invalidateAnalysisCache(){
  cachedHexGrid=null;cachedHexCounts=null;cachedHexSize=null;cachedBoundsKey=null;cachedSpatialIndex=null;
  monthlyBins=null;
  corrMatrix=null;
  detectedClusters=[];
  nnResults=null;
}

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

function significanceStars(p){
  if(p<0.001)return'***';
  if(p<0.01)return'**';
  if(p<0.05)return'*';
  return'';
}

function formatPValue(p){
  const stars=significanceStars(p);
  return'p'+(p<0.001?'<0.001':'='+p.toFixed(3))+' '+(stars||'n.s.');
}

function buildSpatialIndex(cellDeg){
  if(cachedSpatialIndex)return cachedSpatialIndex;
  const idx={};
  for(let cat=0;cat<3;cat++){
    filteredCat[cat].forEach(r=>{
      const key=Math.floor(r[F.LAT]/cellDeg)+','+Math.floor(r[F.LON]/cellDeg);
      (idx[key]=idx[key]||[]).push(r);
    });
  }
  cachedSpatialIndex=idx;
  return idx;
}

function getOrBuildHexData(cellSide){
  const bounds=map.getBounds();
  const bKey=bounds.toBBoxString();
  if(cachedHexGrid&&cachedHexSize===cellSide&&cachedBoundsKey===bKey){
    return{grid:cachedHexGrid,counts:cachedHexCounts};
  }
  const bbox=[bounds.getWest(),bounds.getSouth(),bounds.getEast(),bounds.getNorth()];
  const grid=turf.hexGrid(bbox,cellSide,{units:'kilometers'});
  const hexes=grid.features;
  const counts=hexes.map(()=>[0,0,0]);

  // Use spatial index for fast point-in-hex assignment
  const cellDeg=cellSide/111; // approximate degrees per km
  const idx=buildSpatialIndex(cellDeg);

  hexes.forEach((hex,hi)=>{
    const bb=turf.bbox(hex);
    const minR=Math.floor(bb[1]/cellDeg),maxR=Math.floor(bb[3]/cellDeg);
    const minC=Math.floor(bb[0]/cellDeg),maxC=Math.floor(bb[2]/cellDeg);
    for(let r=minR;r<=maxR;r++){
      for(let c=minC;c<=maxC;c++){
        const pts=idx[r+','+c];
        if(!pts)continue;
        pts.forEach(pt=>{
          if(turf.booleanPointInPolygon(turf.point([pt[F.LON],pt[F.LAT]]),hex)){
            counts[hi][pt[F.CAT]]++;
          }
        });
      }
    }
  });

  cachedHexGrid=grid;cachedHexCounts=counts;cachedHexSize=cellSide;cachedBoundsKey=bKey;
  return{grid,counts};
}

/* ========== ASYNC HEX DATA (WEB WORKER) ========== */
let hexWorker=null;
function getOrBuildHexDataAsync(cellSide){
  return new Promise((resolve,reject)=>{
    const bounds=map.getBounds();
    const bKey=bounds.toBBoxString();
    // Fast path: return cache
    if(cachedHexGrid&&cachedHexSize===cellSide&&cachedBoundsKey===bKey){
      return resolve({grid:cachedHexGrid,counts:cachedHexCounts});
    }

    // Show progress UI
    const progressEl=document.getElementById('hex-progress');
    const fillEl=document.getElementById('hex-progress-fill');
    const statusEl=document.getElementById('hex-status');
    if(progressEl){progressEl.style.display='block';fillEl.style.width='0%';statusEl.textContent='Initializing worker...'}

    // Build flat array of points: [lat, lon, cat, lat, lon, cat, ...]
    const totalPts=filteredCat[0].length+filteredCat[1].length+filteredCat[2].length;
    const points=new Float64Array(totalPts*3);
    let idx=0;
    for(let cat=0;cat<3;cat++){
      for(const r of filteredCat[cat]){
        points[idx++]=r[F.LAT];
        points[idx++]=r[F.LON];
        points[idx++]=cat;
      }
    }

    // Create/reuse worker
    if(hexWorker){hexWorker.terminate()}
    hexWorker=new Worker('hex-worker.js');
    const bbox=[bounds.getWest(),bounds.getSouth(),bounds.getEast(),bounds.getNorth()];

    hexWorker.onmessage=function(e){
      const msg=e.data;
      if(msg.type==='progress'){
        if(fillEl)fillEl.style.width=msg.pct+'%';
        if(statusEl)statusEl.textContent=msg.stage;
      } else if(msg.type==='result'){
        if(progressEl)progressEl.style.display='none';
        let grid;
        try{grid=JSON.parse(msg.gridJSON)}catch(e){
          console.error('Worker JSON parse failed',e);
          hexWorker.terminate();hexWorker=null;
          resolve(getOrBuildHexData(cellSide));
          return;
        }
        cachedHexGrid=grid;cachedHexCounts=msg.counts;cachedHexSize=cellSide;cachedBoundsKey=bKey;
        hexWorker.terminate();hexWorker=null;
        resolve({grid,counts:msg.counts});
      }
    };
    hexWorker.onerror=function(err){
      if(progressEl)progressEl.style.display='none';
      hexWorker.terminate();hexWorker=null;
      // Fallback to sync
      resolve(getOrBuildHexData(cellSide));
    };

    hexWorker.postMessage({bbox,cellSide,points,nCats:3},[points.buffer]);
  });
}

function interpretR(r){
  if(isNaN(r))return'Insufficient data for correlation';
  if(r>0.7)return'Strong positive — cluster together';
  if(r>0.4)return'Moderate positive — notable co-occurrence';
  if(r>0.2)return'Weak positive — some overlap';
  if(r<-0.3)return'Negative — tend to avoid each other';
  return'No significant correlation';
}

/* ========== SUB-MODE SWITCHING ========== */
function setCorrSubMode(mode){
  corrSubMode=mode;
  document.querySelectorAll('.corr-sub-btn').forEach(b=>{
    b.classList.toggle('active',b.dataset.submode===mode);
  });
  const panelMap={spatial:'spatial-panel',matrix:'matrix-panel',temporal:'temporal-panel',clusters:'cluster-panel',nearest:'nearest-panel'};
  Object.entries(panelMap).forEach(([key,panelId])=>{
    const el=document.getElementById(panelId);
    if(el)el.style.display=key===mode?'block':'none';
  });
  // Hide temporal overlay when switching away
  if(mode!=='temporal'){
    if(typeof temporalWindow!=='undefined'&&temporalWindow)temporalWindow.hide();
    temporalOverlayVisible=false;
  }
}

/* ========== PHASE 1: MATRIX CORRELATION ========== */
async function runMatrixCorrelation(){
  const cellSide=parseFloat(document.getElementById('corr-hex-size').value);
  const{grid,counts}=await getOrBuildHexDataAsync(cellSide);
  const hexes=grid.features;

  // Compute 3x3 Pearson r matrix with p-values
  const rMatrix=[[1,0,0],[0,1,0],[0,0,1]];
  const pMatrix=[[0,1,1],[1,0,1],[1,1,0]];
  const pairs=[[0,1],[0,2],[1,2]];
  pairs.forEach(([a,b])=>{
    const xArr=[],yArr=[];
    counts.forEach(c=>{
      if(c[a]>0||c[b]>0){xArr.push(c[a]);yArr.push(c[b])}
    });
    const r=pearsonR(xArr,yArr);
    const rVal=isNaN(r)?0:r;
    rMatrix[a][b]=rVal;rMatrix[b][a]=rVal;
    const p=isNaN(r)?1:permutationPValue(xArr,yArr,r,999);
    pMatrix[a][b]=p;pMatrix[b][a]=p;
  });
  corrMatrix=rMatrix;

  // Composite hotspots: all 3 above their medians
  const medians=[0,1,2].map(cat=>{
    const vals=counts.filter(c=>c[cat]>0).map(c=>c[cat]);
    return d3.median(vals)||1;
  });
  let hotspotCount=0;
  const maxScore=d3.max(counts,c=>c[0]+c[1]+c[2])||1;
  const compScale=d3.scaleSequential(d3.interpolateRdYlGn).domain([0,maxScore]);

  // Remove old layer
  if(corrLayer){map.removeLayer(corrLayer);corrLayer=null}

  hexes.forEach((hex,i)=>{
    const c=counts[i];
    hex.properties.counts=c;
    hex.properties.total=c[0]+c[1]+c[2];
    hex.properties.composite=c[0]>=medians[0]&&c[1]>=medians[1]&&c[2]>=medians[2];
    if(hex.properties.composite)hotspotCount++;
  });

  corrLayer=L.geoJSON(turf.featureCollection(hexes),{
    style(feature){
      const t=feature.properties.total;
      if(t===0)return{fillOpacity:0,weight:0};
      const isComp=feature.properties.composite;
      return{
        fillColor:compScale(t),fillOpacity:isComp?0.75:0.4,
        weight:isComp?2.5:0.5,color:isComp?'#fff':'rgba(255,255,255,0.1)'
      };
    },
    onEachFeature(feature,layer){
      const c=feature.properties.counts;
      if(feature.properties.total>0){
        let tip='<b>Multi-category cell</b><br>';
        for(let i=0;i<3;i++){
          if(c[i])tip+=`<span style="color:${CAT_COLORS[i]}">${CAT_NAMES[i]}: ${c[i]}</span><br>`;
        }
        if(feature.properties.composite)tip+='<b style="color:var(--green)">TRIPLE HOTSPOT</b>';
        layer.bindTooltip(tip);
      }
    }
  }).addTo(map);

  document.getElementById('stat-hotspots').textContent=hotspotCount;

  // Render matrix SVG
  renderMatrixSVG(rMatrix,pMatrix);

  // Update detail
  const strongest=pairs.reduce((best,p)=>Math.abs(rMatrix[p[0]][p[1]])>Math.abs(rMatrix[best[0]][best[1]])?p:best,pairs[0]);
  const sr=rMatrix[strongest[0]][strongest[1]];
  const sp=pMatrix[strongest[0]][strongest[1]];
  document.getElementById('matrix-detail').innerHTML=
    `<div>Strongest: <span style="color:${CAT_COLORS[strongest[0]]}">${CAT_NAMES[strongest[0]].split('/')[0]}</span> &harr; `+
    `<span style="color:${CAT_COLORS[strongest[1]]}">${CAT_NAMES[strongest[1]].split('/')[0]}</span> (r=${sr.toFixed(3)})</div>`+
    `<div style="margin-top:3px;font-size:10px;color:${sp<0.05?'var(--green)':'var(--text-dim)'}">${formatPValue(sp)}</div>`+
    `<div style="margin-top:3px">${hexes.length} hex cells &middot; ${hotspotCount} triple hotspots</div>`;
}

function renderMatrixSVG(rMatrix,pMatrix){
  const svg=d3.select('#corr-matrix-svg');
  svg.selectAll('*').remove();
  svg.style('display','block');

  const w=260,h=180;
  const m={top:30,left:70,right:10,bottom:10};
  const cellW=(w-m.left-m.right)/3;
  const cellH=(h-m.top-m.bottom)/3;
  const g=svg.append('g').attr('transform',`translate(${m.left},${m.top})`);
  const shortNames=['UFO','Bigfoot','Haunted'];
  const diverge=d3.scaleSequential(d3.interpolateRdYlGn).domain([-1,1]);

  // Column headers
  shortNames.forEach((n,i)=>{
    g.append('text').attr('x',i*cellW+cellW/2).attr('y',-8)
      .attr('text-anchor','middle').attr('font-size',9).attr('fill',CAT_COLORS[i]).text(n);
  });
  // Row headers
  shortNames.forEach((n,i)=>{
    g.append('text').attr('x',-8).attr('y',i*cellH+cellH/2+3)
      .attr('text-anchor','end').attr('font-size',9).attr('fill',CAT_COLORS[i]).text(n);
  });
  // Cells
  for(let r=0;r<3;r++){
    for(let c=0;c<3;c++){
      const v=rMatrix[r][c];
      g.append('rect').attr('x',c*cellW).attr('y',r*cellH).attr('width',cellW-2).attr('height',cellH-2)
        .attr('rx',3).attr('fill',r===c?'rgba(255,255,255,0.03)':diverge(v))
        .attr('stroke','var(--border)').attr('stroke-width',0.5);
      g.append('text').attr('x',c*cellW+cellW/2-1).attr('y',r*cellH+cellH/2-1)
        .attr('text-anchor','middle').attr('font-size',r===c?10:13).attr('font-weight',r===c?400:700)
        .attr('fill',r===c?'var(--text-dim)':'var(--text-bright)')
        .text(r===c?'1.0':v.toFixed(3));
      // Show significance stars below r value
      if(r!==c&&pMatrix){
        const sig=significanceStars(pMatrix[r][c]);
        if(sig){
          g.append('text').attr('x',c*cellW+cellW/2-1).attr('y',r*cellH+cellH/2+12)
            .attr('text-anchor','middle').attr('font-size',8)
            .attr('fill','var(--green)').text(sig);
        }
      }
    }
  }
}

/* ========== PHASE 2: CLUSTER DETECTION ========== */
function buildHexAdjacency(hexes,cellSide){
  const threshold=cellSide*Math.sqrt(3)*1.05; // hex center-to-center = cellSide*sqrt(3), +5% tolerance
  const centroids=hexes.map(f=>turf.centroid(f).geometry.coordinates);
  const step=threshold/111;
  const idx={};
  centroids.forEach((c,i)=>{
    const key=Math.floor(c[1]/step)+','+Math.floor(c[0]/step);
    (idx[key]=idx[key]||[]).push(i);
  });
  const adj=hexes.map(()=>[]);
  centroids.forEach((c,i)=>{
    const r0=Math.floor(c[1]/step),c0=Math.floor(c[0]/step);
    for(let dr=-1;dr<=1;dr++){
      for(let dc=-1;dc<=1;dc++){
        const nbs=idx[(r0+dr)+','+(c0+dc)];
        if(!nbs)continue;
        nbs.forEach(j=>{
          if(j<=i)return;
          const d=turf.distance(turf.point(c),turf.point(centroids[j]),{units:'kilometers'});
          if(d<=threshold){adj[i].push(j);adj[j].push(i)}
        });
      }
    }
  });
  return{adj,centroids};
}

function findConnectedClusters(hexes,counts,adj,threshold){
  const dense=hexes.map((_,i)=>counts[i][0]+counts[i][1]+counts[i][2]>=threshold);
  const visited=new Uint8Array(hexes.length);
  const clusters=[];
  for(let i=0;i<hexes.length;i++){
    if(!dense[i]||visited[i])continue;
    const cluster=[];
    const queue=[i];
    visited[i]=1;
    while(queue.length){
      const cur=queue.shift();
      cluster.push(cur);
      adj[cur].forEach(nb=>{
        if(!visited[nb]&&dense[nb]){visited[nb]=1;queue.push(nb)}
      });
    }
    if(cluster.length>=2)clusters.push(cluster);
  }
  return clusters;
}

function labelCluster(hexes,indices,centroids){
  const avgLon=d3.mean(indices,i=>centroids[i][0]);
  const avgLat=d3.mean(indices,i=>centroids[i][1]);
  let bestDist=Infinity,bestLoc='Unknown';
  for(let cat=0;cat<3;cat++){
    for(const r of filteredCat[cat]){
      if(!r[F.LOC])continue;
      const d=Math.abs(r[F.LAT]-avgLat)+Math.abs(r[F.LON]-avgLon);
      if(d<bestDist){bestDist=d;bestLoc=r[F.LOC]}
    }
  }
  return{lat:avgLat,lon:avgLon,label:bestLoc};
}

const CLUSTER_COLORS=['#00ffcc','#ff9944','#9966ff','#ff4488','#44bbff','#ffcc00','#66ff66','#ff66aa'];

async function runClusterDetection(){
  const cellSide=parseFloat(document.getElementById('corr-hex-size').value);
  const threshold=parseInt(document.getElementById('cluster-threshold').value);
  const{grid,counts}=await getOrBuildHexDataAsync(cellSide);
  const hexes=grid.features;
  const{adj,centroids}=buildHexAdjacency(hexes,cellSide);
  const rawClusters=findConnectedClusters(hexes,counts,adj,threshold);

  // Build cluster objects
  detectedClusters=rawClusters.map((indices,ci)=>{
    const geo=labelCluster(hexes,indices,centroids);
    const stats=[0,0,0];
    indices.forEach(i=>{stats[0]+=counts[i][0];stats[1]+=counts[i][1];stats[2]+=counts[i][2]});
    const total=stats[0]+stats[1]+stats[2];
    const catCount=stats.filter(v=>v>0).length;
    return{indices,centroid:geo,stats,total,catCount,color:CLUSTER_COLORS[ci%CLUSTER_COLORS.length]};
  });

  // Sort by total density desc
  detectedClusters.sort((a,b)=>b.total-a.total);

  // Render on map
  if(corrLayer){map.removeLayer(corrLayer);corrLayer=null}
  if(clusterLayer){map.removeLayer(clusterLayer);clusterLayer=null}

  // Build cluster membership map and tag hexes with index
  const membership=new Int16Array(hexes.length).fill(-1);
  detectedClusters.forEach((cl,ci)=>{cl.indices.forEach(i=>{membership[i]=ci})});
  hexes.forEach((hex,i)=>{hex.properties._idx=i;hex.properties._cluster=membership[i]});

  clusterLayer=L.geoJSON(turf.featureCollection(hexes),{
    style(feature){
      const i=feature.properties._idx;
      const ci=feature.properties._cluster;
      if(ci<0){
        const t=counts[i][0]+counts[i][1]+counts[i][2];
        return t>0?{fillColor:'rgba(255,255,255,0.1)',fillOpacity:0.15,weight:0.3,color:'rgba(255,255,255,0.05)'}
          :{fillOpacity:0,weight:0};
      }
      return{fillColor:detectedClusters[ci].color,fillOpacity:0.5,weight:2,color:detectedClusters[ci].color};
    },
    onEachFeature(feature,layer){
      const i=feature.properties._idx;
      const ci=feature.properties._cluster;
      const c=counts[i];
      const t=c[0]+c[1]+c[2];
      if(t>0){
        let tip=ci>=0?`<b>Cluster #${ci+1}: ${esc(detectedClusters[ci].centroid.label)}</b><br>`:'';
        for(let j=0;j<3;j++){
          if(c[j])tip+=`<span style="color:${CAT_COLORS[j]}">${CAT_NAMES[j]}: ${c[j]}</span><br>`;
        }
        layer.bindTooltip(tip);
        layer.on('click',()=>showHexDetail(feature));
      }
    }
  }).addTo(map);

  // Add cluster centroid labels
  detectedClusters.forEach((cl,ci)=>{
    L.marker([cl.centroid.lat,cl.centroid.lon],{
      icon:L.divIcon({className:'',iconSize:[0,0],
        html:`<div style="background:${cl.color};color:#000;padding:2px 6px;border-radius:3px;font-size:10px;font-weight:700;white-space:nowrap;transform:translate(-50%,-50%)">#${ci+1}</div>`})
    }).addTo(clusterLayer);
  });

  document.getElementById('stat-hotspots').textContent=detectedClusters.length;
  renderClusterList();
  updateLegend();
}

function renderClusterList(){
  const el=document.getElementById('cluster-list');
  if(!detectedClusters.length){el.innerHTML='<div style="color:var(--text-dim);font-size:10px;padding:8px">No clusters found. Try lowering the threshold.</div>';return}
  let html='';
  detectedClusters.forEach((cl,ci)=>{
    const catBadges=cl.stats.map((v,i)=>v>0?
      `<span class="cluster-cat-badge" style="background:${CAT_COLORS[i]}22;color:${CAT_COLORS[i]}">${CAT_NAMES[i].split('/')[0]}: ${v}</span>`:''
    ).join('');
    html+=`<div class="cluster-item" data-cluster="${ci}">
      <span class="cluster-rank">#${ci+1}</span>
      <div class="cluster-name" style="color:${cl.color}">${esc(cl.centroid.label)}</div>
      <div class="cluster-stats">${cl.total.toLocaleString()} sightings &middot; ${cl.indices.length} hex cells &middot; ${cl.catCount}/3 categories</div>
      <div class="cluster-cats">${catBadges}</div>
    </div>`;
  });
  el.innerHTML=html;
  el.querySelectorAll('.cluster-item').forEach(item=>{
    item.addEventListener('click',()=>{
      const ci=parseInt(item.dataset.cluster);
      const cl=detectedClusters[ci];
      map.flyTo([cl.centroid.lat,cl.centroid.lon],8,{duration:1});
    });
  });
}

/* ========== PHASE 3: TEMPORAL CORRELATION ========== */
function buildMonthlyBinsData(){
  if(monthlyBins)return monthlyBins;
  const bins={};
  for(let cat=0;cat<3;cat++){
    filteredCat[cat].forEach(r=>{
      if(!r[F.DATE]||r[F.DATE].length<7)return;
      const ym=r[F.DATE].substring(0,7);
      if(!bins[ym])bins[ym]=[0,0,0];
      bins[ym][cat]++;
    });
  }
  monthlyBins=bins;
  return bins;
}

function rollingCorrelation(bins,catA,catB,windowMonths){
  const keys=Object.keys(bins).sort();
  const results=[];
  for(let i=windowMonths;i<keys.length;i++){
    const wKeys=keys.slice(i-windowMonths,i);
    const xArr=wKeys.map(k=>bins[k][catA]);
    const yArr=wKeys.map(k=>bins[k][catB]);
    const r=pearsonR(xArr,yArr);
    results.push({month:keys[i],r:isNaN(r)?0:r});
  }
  return results;
}

function seasonalProfile(){
  const seasonal=Array.from({length:12},()=>[0,0,0]);
  for(let cat=0;cat<3;cat++){
    filteredCat[cat].forEach(r=>{
      if(!r[F.DATE]||r[F.DATE].length<7)return;
      const m=parseInt(r[F.DATE].substring(5,7));
      if(m>=1&&m<=12)seasonal[m-1][cat]++;
    });
  }
  return seasonal;
}

function renderTemporalCharts(){
  const bins=buildMonthlyBinsData();
  const window=60; // 5 years
  const pairNames=['UFO\u2194Bigfoot','UFO\u2194Haunted','Bigfoot\u2194Haunted'];
  const pairColors=['#00cc88','#66aaff','#cc66ff'];
  const pairsSpec=[[0,1],[0,2],[1,2]];

  // Rolling correlation
  const rollingData=pairsSpec.map(([a,b])=>rollingCorrelation(bins,a,b,window));

  const svgR=d3.select('#temporal-rolling-svg');
  svgR.selectAll('*').remove();
  const container=document.querySelector('.temporal-content');
  const cw=(container.clientWidth||680)-24;
  const rh=130;
  const rm={top:10,right:10,bottom:22,left:36};
  svgR.attr('width',cw).attr('height',rh);
  const gR=svgR.append('g').attr('transform',`translate(${rm.left},${rm.top})`);
  const riw=cw-rm.left-rm.right,rih=rh-rm.top-rm.bottom;

  const allMonths=rollingData[0].map(d=>d.month);
  if(allMonths.length<2){gR.append('text').attr('fill','var(--text-dim)').attr('font-size',10).text('Not enough temporal data');return}

  const xR=d3.scalePoint().domain(allMonths).range([0,riw]);
  const yR=d3.scaleLinear().domain([-1,1]).range([rih,0]);

  // Zero line
  gR.append('line').attr('x1',0).attr('x2',riw).attr('y1',yR(0)).attr('y2',yR(0))
    .attr('stroke','var(--border)').attr('stroke-dasharray','4 3');

  // Lines
  rollingData.forEach((data,pi)=>{
    const line=d3.line().x(d=>xR(d.month)).y(d=>yR(d.r)).curve(d3.curveBasis);
    gR.append('path').datum(data).attr('d',line).attr('fill','none')
      .attr('stroke',pairColors[pi]).attr('stroke-width',1.5).attr('opacity',0.8);
  });

  // Axes
  const xTicks=allMonths.filter((_,i)=>i%(Math.ceil(allMonths.length/8))===0);
  gR.append('g').attr('class','timeline-axis').attr('transform',`translate(0,${rih})`)
    .call(d3.axisBottom(xR).tickValues(xTicks).tickFormat(d=>d.substring(0,4)));
  gR.append('g').attr('class','timeline-axis')
    .call(d3.axisLeft(yR).ticks(5).tickFormat(d3.format('.1f')));

  // Legend
  pairNames.forEach((n,i)=>{
    gR.append('line').attr('x1',riw-120).attr('x2',riw-108).attr('y1',8+i*12).attr('y2',8+i*12)
      .attr('stroke',pairColors[i]).attr('stroke-width',2);
    gR.append('text').attr('x',riw-104).attr('y',11+i*12).attr('font-size',8).attr('fill','var(--text-dim)').text(n);
  });

  // Seasonal chart
  const seasonal=seasonalProfile();
  const monthLabels=['J','F','M','A','M','J','J','A','S','O','N','D'];
  const svgS=d3.select('#temporal-seasonal-svg');
  svgS.selectAll('*').remove();
  const sh=110;
  const sm={top:6,right:10,bottom:20,left:36};
  svgS.attr('width',cw).attr('height',sh);
  const gS=svgS.append('g').attr('transform',`translate(${sm.left},${sm.top})`);
  const siw=cw-sm.left-sm.right,sih=sh-sm.top-sm.bottom;

  const xS=d3.scaleBand().domain(d3.range(12)).range([0,siw]).padding(0.15);
  const stackData=seasonal.map((s,i)=>({month:i,0:s[0],1:s[1],2:s[2]}));
  const stack=d3.stack().keys(['0','1','2']);
  const series=stack(stackData);
  const yMax=d3.max(series,s=>d3.max(s,d=>d[1]));
  const yS=d3.scaleLinear().domain([0,yMax||1]).range([sih,0]);

  series.forEach((s,i)=>{
    gS.selectAll(`.sbar-${i}`).data(s).join('rect')
      .attr('x',d=>xS(d.data.month)).attr('y',d=>yS(d[1])).attr('width',xS.bandwidth())
      .attr('height',d=>yS(d[0])-yS(d[1])).attr('fill',CAT_COLORS[i]).attr('opacity',0.8);
  });

  gS.append('g').attr('class','timeline-axis').attr('transform',`translate(0,${sih})`)
    .call(d3.axisBottom(xS).tickFormat(i=>monthLabels[i]));
  gS.append('g').attr('class','timeline-axis').call(d3.axisLeft(yS).ticks(3).tickFormat(d3.format('~s')));

  // Stats
  const peakMonth=seasonal.reduce((best,s,i)=>{
    const t=s[0]+s[1]+s[2];return t>(best.t||0)?{i,t}:best;
  },{}).i;
  const fullMonths=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const strongestPair=pairsSpec.reduce((best,[a,b],pi)=>{
    const data=rollingData[pi];
    const avgR=data.length?d3.mean(data,d=>d.r):0;
    return Math.abs(avgR)>Math.abs(best.r)?{pi,r:avgR}:best;
  },{pi:0,r:0});

  document.getElementById('temporal-stats').innerHTML=
    `<div class="temporal-stat"><div class="temporal-stat-val" style="color:var(--green)">${fullMonths[peakMonth]}</div><div class="temporal-stat-lbl">PEAK MONTH</div></div>`+
    `<div class="temporal-stat"><div class="temporal-stat-val" style="color:${pairColors[strongestPair.pi]}">${strongestPair.r.toFixed(3)}</div><div class="temporal-stat-lbl">STRONGEST PAIR r</div></div>`+
    `<div class="temporal-stat"><div class="temporal-stat-val" style="color:var(--cyan)">${pairNames[strongestPair.pi]}</div><div class="temporal-stat-lbl">MOST CORRELATED</div></div>`;
}

/* ========== PHASE 4: NEAREST-NEIGHBOR ANALYSIS ========== */
function sampleArray(arr,n){
  if(arr.length<=n)return arr.slice();
  const sampled=[];
  const step=arr.length/n;
  for(let i=0;i<n;i++)sampled.push(arr[Math.floor(i*step)]);
  return sampled;
}

function buildNNGrid(points,cellDeg){
  const grid={};
  points.forEach((pt,i)=>{
    const key=Math.floor(pt[F.LAT]/cellDeg)+','+Math.floor(pt[F.LON]/cellDeg);
    (grid[key]=grid[key]||[]).push(i);
  });
  return grid;
}

function nearestNeighborDist(qLat,qLon,targetGrid,targetPts,cellDeg){
  const r0=Math.floor(qLat/cellDeg),c0=Math.floor(qLon/cellDeg);
  let best=Infinity;
  for(let ring=0;ring<=20;ring++){
    for(let dr=-ring;dr<=ring;dr++){
      for(let dc=-ring;dc<=ring;dc++){
        if(ring>0&&Math.abs(dr)!==ring&&Math.abs(dc)!==ring)continue;
        const pts=targetGrid[(r0+dr)+','+(c0+dc)];
        if(!pts)continue;
        pts.forEach(j=>{
          const tPt=targetPts[j];
          const d=turf.distance(turf.point([qLon,qLat]),turf.point([tPt[F.LON],tPt[F.LAT]]),{units:'kilometers'});
          if(d<best)best=d;
        });
      }
    }
    if(best<ring*cellDeg*111+10)break;
  }
  return best;
}

async function computeNNAnalysis(){
  const sampleSize=3000;
  const cellDeg=2.0;
  const results={};
  const progEl=document.getElementById('nearest-progress');
  const fillEl=document.getElementById('nearest-progress-fill');
  const statusEl=document.getElementById('nearest-status');
  progEl.style.display='block';

  const totalSteps=6;let step=0;
  const allDistances={}; // For attraction zones

  for(let a=0;a<3;a++){
    results[a]={};
    if(!filteredCat[a].length){
      for(let b=0;b<3;b++) if(a!==b){results[a][b]=null;step++}
      continue;
    }
    const sampledA=sampleArray(filteredCat[a],sampleSize);
    for(let b=0;b<3;b++){
      if(a===b)continue;
      if(!filteredCat[b].length){results[a][b]=null;step++;continue}
      statusEl.textContent=`${CAT_NAMES[a].split('/')[0]} \u2192 ${CAT_NAMES[b].split('/')[0]}...`;
      fillEl.style.width=Math.round(step/totalSteps*100)+'%';

      // Yield to UI
      await new Promise(r=>requestAnimationFrame(r));

      const gridB=buildNNGrid(filteredCat[b],cellDeg);
      const distances=sampledA.map(r=>nearestNeighborDist(r[F.LAT],r[F.LON],gridB,filteredCat[b],cellDeg));

      results[a][b]={
        meanDist:d3.mean(distances)??null,medianDist:d3.median(distances)??null,
        stdDev:d3.deviation(distances)??0,sampleN:sampledA.length
      };
      allDistances[a+'_'+b]={pts:sampledA,dists:distances};
      step++;
    }
  }

  fillEl.style.width='100%';
  statusEl.textContent='Complete';
  setTimeout(()=>{progEl.style.display='none'},1500);

  nnResults={results,allDistances};
  renderNNResults(results);
  document.getElementById('attraction-toggle-row').style.display='flex';
}

function renderNNResults(results){
  const el=document.getElementById('nearest-results');
  const shortNames=['UFO','Bigfoot','Haunted'];
  let html='<table class="nn-table"><tr><th></th>';
  for(let b=0;b<3;b++)html+=`<th style="color:${CAT_COLORS[b]}">${shortNames[b]}</th>`;
  html+='</tr>';
  for(let a=0;a<3;a++){
    html+=`<tr><td style="color:${CAT_COLORS[a]};font-weight:700">${shortNames[a]}</td>`;
    for(let b=0;b<3;b++){
      if(a===b){html+='<td style="color:var(--text-dim)">--</td>';continue}
      const r=results[a]?.[b];
      if(!r||r.meanDist===null||!isFinite(r.meanDist)){html+='<td style="color:var(--text-dim)">N/A</td>';continue}
      const color=r.meanDist<50?'var(--green)':r.meanDist<100?'var(--cyan)':'var(--text)';
      const stdStr=isFinite(r.stdDev)?r.stdDev.toFixed(1):'--';
      html+=`<td><div class="nn-dist" style="color:${color}">${r.meanDist.toFixed(1)}km</div>`+
        `<div class="nn-stddev">&plusmn;${stdStr}</div></td>`;
    }
    html+='</tr>';
  }
  html+='</table>';
  el.innerHTML=html;
  el.style.display='block';
}

function renderAttractionZones(){
  if(attractionLayer){map.removeLayer(attractionLayer);attractionLayer=null}
  if(!nnResults)return;
  const hotPts=[];
  Object.entries(nnResults.allDistances).forEach(([key,{pts,dists}])=>{
    const thresh=d3.quantile(dists.slice().sort(d3.ascending),0.25);
    pts.forEach((pt,i)=>{
      if(dists[i]<=thresh)hotPts.push([pt[F.LAT],pt[F.LON],1.0]);
    });
  });
  if(!hotPts.length)return;
  attractionLayer=L.heatLayer(hotPts,{
    radius:22,blur:20,maxZoom:10,
    gradient:{0.2:'transparent',0.4:'rgba(255,51,102,0.25)',0.7:'rgba(255,51,102,0.6)',1.0:'#ff3366'}
  }).addTo(map);
}

function removeAttractionZones(){
  if(attractionLayer){map.removeLayer(attractionLayer);attractionLayer=null}
}

/* ========== CLUSTER GROUP ========== */
function createCluster(catIdx){
  const c=CAT_RGB[catIdx];
  return L.markerClusterGroup({
    chunkedLoading:true,chunkInterval:100,chunkDelay:10,
    maxClusterRadius:50,disableClusteringAtZoom:12,
    iconCreateFunction(cluster){
      const n=cluster.getChildCount();
      const sz=n<100?28:n<1000?36:44;
      const label=n+' '+CAT_NAMES[catIdx]+' sightings';
      return L.divIcon({className:'',iconSize:[sz,sz],
        html:`<div aria-label="${label}" style="background:rgba(${c},0.65);color:#fff;font-weight:700;font-size:${sz>36?12:10}px;
          width:${sz}px;height:${sz}px;border-radius:50%;display:flex;align-items:center;justify-content:center;
          border:2px solid rgba(${c},0.4);box-shadow:0 0 8px rgba(${c},0.3);font-family:var(--font-mono)">
          ${n>=1000?Math.round(n/1000)+'k':n}</div>`});
    }
  });
}

/* ========== APPLY FILTERS ========== */
function getFilters(){
  const yFrom=parseInt(document.getElementById('year-from').value)||0;
  const yTo=parseInt(document.getElementById('year-to').value)||9999;
  const stateRaw=document.getElementById('state-filter').value.trim().toUpperCase();
  const states=stateRaw?stateRaw.split(',').map(s=>s.trim()):[];
  const subRaw=document.getElementById('sub-filter').value.trim().toLowerCase();
  return{yFrom,yTo,states,subRaw};
}

function passesFilter(rec,f){
  if(rec[F.DATE]){
    const y=parseInt(rec[F.DATE].substring(0,4));
    if(!isNaN(y)&&(y<f.yFrom||y>f.yTo))return false;
  } else if(f.yFrom>0)return false;
  if(brushRange){
    if(rec[F.DATE]){
      const y=parseInt(rec[F.DATE].substring(0,4));
      if(!isNaN(y)&&(y<brushRange[0]||y>brushRange[1]))return false;
    }
  }
  if(f.states.length>0){
    const loc=(rec[F.LOC]||'').toUpperCase();
    if(!f.states.some(st=>loc.includes(st)))return false;
  }
  if(f.subRaw){
    const sub=(rec[F.SUB]||'').toLowerCase();
    if(!sub.includes(f.subRaw))return false;
  }
  return true;
}

function applyFilters(){
  invalidateAnalysisCache();
  const f=getFilters();
  let totalVis=0;
  for(let i=0;i<3;i++){
    const checked=document.querySelector(`[data-cat="${i}"]`).checked;
    if(!checked){
      filteredCat[i]=[];
      document.getElementById('count-'+i).textContent='off';
      continue;
    }
    filteredCat[i]=catArrays[i].filter(r=>passesFilter(r,f));
    document.getElementById('count-'+i).textContent=filteredCat[i].length.toLocaleString();
    totalVis+=filteredCat[i].length;
  }
  document.getElementById('stat-visible').textContent=totalVis.toLocaleString();
  renderCurrentView();
}

/* ========== RENDER VIEWS ========== */
function clearAllLayers(){
  for(let i=0;i<3;i++){
    if(clusterGroups[i]){map.removeLayer(clusterGroups[i]);clusterGroups[i]=null}
    if(heatLayers[i]){map.removeLayer(heatLayers[i]);heatLayers[i]=null}
  }
  if(hexLayer){map.removeLayer(hexLayer);hexLayer=null}
  if(corrLayer){map.removeLayer(corrLayer);corrLayer=null}
  if(clusterLayer){map.removeLayer(clusterLayer);clusterLayer=null}
  if(attractionLayer){map.removeLayer(attractionLayer);attractionLayer=null}
  clearProxCircle();
}

function updateLegend(){
  const el=document.getElementById('map-legend');
  if(!el)return;
  let html='';
  if(currentView==='hexbin'){
    html=`<div class="legend-title">Sighting Density</div>
      <div class="legend-gradient" style="background:linear-gradient(90deg,#440154,#31688e,#35b779,#fde725)"></div>
      <div class="legend-labels"><span>Few</span><span>Many</span></div>`;
  } else if(currentView==='heatmap'){
    html=`<div class="legend-title">Heat Intensity</div>`;
    for(let i=0;i<3;i++){
      const cb=document.querySelector('[data-cat="'+i+'"]');
      if(cb&&cb.checked){
        html+=`<div class="legend-row"><div class="legend-dot" style="background:${CAT_COLORS[i]}"></div>${CAT_NAMES[i]}</div>`;
      }
    }
    html+=`<div style="margin-top:4px;font-size:9px;color:var(--text-dim)">Brighter = higher concentration</div>`;
  } else if(currentView==='correlation'){
    if(corrSubMode==='spatial'){
      html=`<div class="legend-title">Co-occurrence</div>
        <div class="legend-gradient" style="background:linear-gradient(90deg,#a50026,#f46d43,#fee08b,#a6d96a,#1a9850)"></div>
        <div class="legend-labels"><span>Low</span><span>High</span></div>
        <div class="legend-row" style="margin-top:5px"><div class="legend-swatch legend-hotspot" style="background:rgba(26,152,80,0.7)"></div>Hotspot cell</div>`;
    } else if(corrSubMode==='clusters'){
      html=`<div class="legend-title">Cluster Detection</div>
        <div class="legend-row"><div class="legend-swatch" style="background:#00ffcc"></div>Cluster member</div>
        <div class="legend-row"><div class="legend-swatch" style="background:rgba(255,255,255,0.1)"></div>Background</div>`;
    } else {
      el.style.display='none';
      return;
    }
  } else {
    el.style.display='none';
    return;
  }
  el.innerHTML=html;
  el.style.display='';
}

function renderCurrentView(){
  clearAllLayers();
  if(typeof temporalWindow!=='undefined'&&temporalWindow)temporalWindow.hide();
  temporalOverlayVisible=false;
  if(currentView==='markers')renderMarkers();
  else if(currentView==='heatmap')renderHeatmap();
  else if(currentView==='hexbin')renderHexbin();
  else if(currentView==='correlation')renderCorrelation();
  updateLegend();
}

let markerRenderGen=0;
function renderMarkers(){
  const myGen=++markerRenderGen;
  const BATCH=5000;
  for(let i=0;i<3;i++){
    if(!filteredCat[i].length)continue;
    const group=createCluster(i);
    const data=filteredCat[i];
    // Batch marker creation so the main thread can breathe between chunks
    let idx=0;
    function addBatch(){
      if(markerRenderGen!==myGen)return; // stale render — abort
      const end=Math.min(idx+BATCH,data.length);
      const batch=[];
      for(;idx<end;idx++)batch.push(createMarker(data[idx]));
      group.addLayers(batch);
      if(idx<data.length)setTimeout(addBatch,0);
    }
    addBatch();
    group.addTo(map);
    clusterGroups[i]=group;
  }
}

function renderHeatmap(){
  // leaflet-heat intensity: f = 1/Math.pow(2, maxZoom - zoom)
  // maxZoom = zoom -> f=1 at current view; zooming in clamps f=1
  const catRGB=[[0,255,136],[255,102,34],[170,68,255]]; // green, orange, purple
  const zoom=map.getZoom();
  // Tighter radii for sharper hotspots (was 18 at zoom 4)
  const dynRadius=autoHeatRadius(zoom);
  const usePerCapita=perCapitaMode&&popDensityGrid;
  for(let i=0;i<3;i++){
    if(!filteredCat[i].length)continue;
    let pts;
    if(usePerCapita){
      // Per-capita: weight each point inversely by local population density
      // Use log scale to prevent extreme rural amplification
      pts=filteredCat[i].map(r=>{
        const density=getPopDensity(r[F.LAT],r[F.LON]);
        // weight: higher where density is lower (anomalous)
        // log(1 + baseline/density) gives smooth inverse relationship
        // baseline of 100 ppl/sqmi = median-ish US county density
        const weight=density>0?Math.min(1.0,Math.log1p(100/density)/Math.log1p(100)):0.5;
        return[r[F.LAT],r[F.LON],weight];
      });
    } else {
      pts=filteredCat[i].map(r=>[r[F.LAT],r[F.LON],0.6]);
    }
    const rgb=catRGB[i];
    const gradient=usePerCapita?{
      // Per-capita gradient: cyan-white to highlight anomalous areas
      0.0:'rgba(0,0,0,0)',
      0.15:`rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.2)`,
      0.35:`rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.5)`,
      0.6:`rgba(255,255,255,0.6)`,
      0.85:`rgba(255,255,${rgb[2]>200?255:200},0.85)`,
      1.0:'rgba(255,255,255,1)'
    }:{
      0.0:'rgba(0,0,0,0)',
      0.2:`rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.3)`,
      0.45:`rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.6)`,
      0.7:`rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.85)`,
      1.0:`rgba(${rgb[0]},${rgb[1]},${rgb[2]},1)`
    };
    heatLayers[i]=L.heatLayer(pts,{radius:dynRadius,blur:dynRadius*0.65,maxZoom:zoom,minOpacity:0.12,gradient}).addTo(map);
  }
  // Update per-capita indicator
  const pcLabel=document.getElementById('percapita-indicator');
  if(pcLabel)pcLabel.style.display=usePerCapita?'block':'none';
}

function renderHexbin(){
  const bounds=map.getBounds();
  const bbox=[bounds.getWest(),bounds.getSouth(),bounds.getEast(),bounds.getNorth()];
  // Auto-scale hex size based on zoom: bigger hexes when zoomed out
  const zoom=map.getZoom();
  const autoSize=autoHexSize(zoom);
  const cellSide=Math.max(autoSize,parseFloat(document.getElementById('corr-hex-size').value));
  const grid=turf.hexGrid(bbox,cellSide,{units:'kilometers'});

  // count all active categories per hex
  const allPts=[];
  for(let i=0;i<3;i++){
    filteredCat[i].forEach(r=>allPts.push(turf.point([r[F.LON],r[F.LAT]],{cat:i})));
  }
  const collected=turf.collect(grid,turf.featureCollection(allPts),'cat','cats');

  let maxCount=0;
  collected.features.forEach(f=>{
    f.properties.count=f.properties.cats.length;
    if(f.properties.count>maxCount)maxCount=f.properties.count;
  });

  // color scale
  const scale=d3.scaleSequential(d3.interpolateViridis).domain([0,Math.max(maxCount,1)]);

  hexLayer=L.geoJSON(collected,{
    style(feature){
      const c=feature.properties.count;
      if(c===0)return{fillOpacity:0,weight:0.3,color:'rgba(255,255,255,0.03)'};
      return{fillColor:scale(c),fillOpacity:0.75,weight:1,color:'rgba(255,255,255,0.2)'};
    },
    onEachFeature(feature,layer){
      if(feature.properties.count>0){
        const cats=feature.properties.cats;
        const breakdown=[0,0,0];cats.forEach(c=>breakdown[c]++);
        let tip=`<b>${feature.properties.count} sightings</b><br>`;
        for(let i=0;i<3;i++){
          if(breakdown[i])tip+=`<span style="color:${CAT_COLORS[i]}">${CAT_NAMES[i]}: ${breakdown[i]}</span><br>`;
        }
        layer.bindTooltip(tip);
        layer.on('click',()=>showHexDetail(feature));
      }
    }
  }).addTo(map);
}

/* ========== HEX DETAIL PANEL ========== */
// Note: All user-supplied strings are sanitized via esc() before insertion.
// Category names, colors, and structure come from app constants (CAT_NAMES, CAT_COLORS).
let hexDetailWindow=null;

function collectSightingsInHex(hexFeature){
  const poly=hexFeature;
  const bb=turf.bbox(poly);
  const results=[];
  for(let cat=0;cat<3;cat++){
    for(const r of filteredCat[cat]){
      if(r[F.LAT]<bb[1]||r[F.LAT]>bb[3]||r[F.LON]<bb[0]||r[F.LON]>bb[2])continue;
      if(turf.booleanPointInPolygon(turf.point([r[F.LON],r[F.LAT]]),poly)){
        results.push(r);
      }
    }
  }
  return results;
}

function buildHexDetailHTML(feature,sightings){
  const centroid=turf.centroid(feature);
  const [cLon,cLat]=centroid.geometry.coordinates;
  const total=sightings.length;

  // Category breakdown
  const catCounts=[0,0,0];
  sightings.forEach(r=>catCounts[r[F.CAT]]++);

  // Find best location name (most common) — normalize case to merge duplicates
  const locFreq={};
  const locDisplay={}; // keep a nicely formatted display name per normalized key
  sightings.forEach(r=>{
    if(!r[F.LOC])return;
    // Normalize: trim, title-case city, uppercase state abbreviation
    const raw=r[F.LOC].trim();
    const parts=raw.split(',');
    const norm=parts.map((p,i)=>{
      p=p.trim();
      if(i===parts.length-1&&p.length<=3)return p.toUpperCase(); // state abbrev
      return p.replace(/\w\S*/g,w=>w.charAt(0).toUpperCase()+w.slice(1).toLowerCase());
    }).join(', ');
    locFreq[norm]=(locFreq[norm]||0)+1;
    if(!locDisplay[norm])locDisplay[norm]=norm;
  });
  const topLocs=Object.entries(locFreq).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const bestLoc=topLocs.length?topLocs[0][0]:'Unknown';

  // Date range
  const dates=sightings.filter(r=>r[F.DATE]&&r[F.DATE].length>=4).map(r=>r[F.DATE]).sort();
  const dateMin=dates.length?dates[0]:'N/A';
  const dateMax=dates.length?dates[dates.length-1]:'N/A';

  // Years for temporal chart
  const yearBins={};
  sightings.forEach(r=>{
    if(!r[F.DATE]||r[F.DATE].length<4)return;
    const y=parseInt(r[F.DATE].substring(0,4));
    if(!isNaN(y)&&y>=1900&&y<=2030){
      if(!yearBins[y])yearBins[y]=[0,0,0];
      yearBins[y][r[F.CAT]]++;
    }
  });

  // Top subcategories
  const subFreq={};
  sightings.forEach(r=>{const s=r[F.SUB];if(s&&s.trim()){subFreq[s]=(subFreq[s]||0)+1}});
  const topSubs=Object.entries(subFreq).sort((a,b)=>b[1]-a[1]).slice(0,12);

  // Nearest military base
  let nearestMil=null;
  if(militaryData){
    const MF={LAT:0,LON:1,NAME:2,BRANCH:3};
    let bestDist=Infinity;
    militaryData.data.forEach(b=>{
      const d=turf.distance(centroid,turf.point([b[MF.LON],b[MF.LAT]]),{units:'kilometers'});
      if(d<bestDist){bestDist=d;nearestMil={name:b[MF.NAME],branch:b[MF.BRANCH],dist:d}}
    });
  }

  // Derived stats
  const area=turf.area(feature)/1e6;
  const density=(total/area).toFixed(1);
  const years=Object.keys(yearBins).map(Number);
  const yearSpan=years.length>1?years[years.length-1]-years[0]+1:1;
  const avgPerYear=(total/yearSpan).toFixed(1);

  // Build HTML — all user data escaped via esc()
  const parts=[];
  parts.push('<div class="hex-detail">');

  // Header
  parts.push(`<div class="hex-detail-header"><div>
    <div class="hex-detail-count">${total.toLocaleString()} sightings</div>
    <div class="hex-detail-loc">${esc(bestLoc)} &mdash; ${cLat.toFixed(2)}&deg;N, ${Math.abs(cLon).toFixed(2)}&deg;W</div>
  </div></div>`);

  // Category bars
  parts.push('<div class="hex-cat-bars">');
  for(let i=0;i<3;i++){
    if(catCounts[i]===0)continue;
    const pct=total>0?Math.round(catCounts[i]/total*100):0;
    // CAT_NAMES and CAT_COLORS are app constants, not user data
    parts.push(`<div class="hex-cat-row">
      <span class="hex-cat-label" style="color:${CAT_COLORS[i]}">${CAT_NAMES[i].split('/')[0]}</span>
      <div class="hex-cat-bar-track"><div class="hex-cat-bar-fill" style="width:${pct}%;background:${CAT_COLORS[i]}"></div></div>
      <span class="hex-cat-pct">${catCounts[i].toLocaleString()} (${pct}%)</span>
    </div>`);
  }
  parts.push('</div>');

  // Stat chips (all numeric/computed values)
  parts.push(`<div class="hex-stat-row">
    <div class="hex-stat-chip"><div class="hex-stat-chip-val">${dateMin.substring(0,4)}&ndash;${dateMax.substring(0,4)}</div><div class="hex-stat-chip-lbl">DATE RANGE</div></div>
    <div class="hex-stat-chip"><div class="hex-stat-chip-val">${density}</div><div class="hex-stat-chip-lbl">PER KM&sup2;</div></div>
    <div class="hex-stat-chip"><div class="hex-stat-chip-val">${avgPerYear}</div><div class="hex-stat-chip-lbl">PER YEAR</div></div>
    <div class="hex-stat-chip"><div class="hex-stat-chip-val">${catCounts.filter(c=>c>0).length}/3</div><div class="hex-stat-chip-lbl">CATEGORIES</div></div>
  </div>`);

  // Temporal chart placeholder
  parts.push('<div class="hex-section">TEMPORAL DISTRIBUTION</div>');
  parts.push('<div class="hex-temporal-chart"><svg id="hex-temporal-svg" width="100%" height="90"></svg></div>');

  // Top subcategories
  if(topSubs.length){
    parts.push('<div class="hex-section">TOP SUBCATEGORIES</div><div class="hex-tags">');
    topSubs.forEach(([sub,ct])=>{
      parts.push(`<span class="hex-tag">${esc(sub)}<span class="hex-tag-count">${ct}</span></span>`);
    });
    parts.push('</div>');
  }

  // Top locations
  if(topLocs.length>1){
    parts.push('<div class="hex-section">TOP LOCATIONS</div><div class="hex-locations">');
    topLocs.forEach(([loc,ct])=>{
      parts.push(`<div class="hex-loc-row"><span>${esc(loc)}</span><span>${ct}</span></div>`);
    });
    parts.push('</div>');
  }

  // Nearest military base
  if(nearestMil){
    parts.push(`<div class="hex-military"><b>${esc(nearestMil.name)}</b> (${esc(nearestMil.branch)}) &mdash; ${nearestMil.dist.toFixed(1)} km away</div>`);
  }

  // Sighting list header
  const showLimit=50;
  parts.push('<div class="hex-section">SIGHTING RECORDS</div><div class="hex-sighting-list">');
  parts.push(`<button class="hex-sighting-toggle" id="hex-sighting-toggle-btn">Show ${Math.min(total,showLimit)} of ${total.toLocaleString()} sightings &#9660;</button>`);
  parts.push('<div id="hex-sighting-items" style="display:none">');

  const sorted=[...sightings].sort((a,b)=>(b[F.DATE]||'').localeCompare(a[F.DATE]||''));
  sorted.slice(0,showLimit).forEach((r,idx)=>{
    parts.push(`<div class="hex-sighting-item">
      <div class="hex-sighting-item-head">
        <span class="hex-sighting-cat" style="color:${CAT_COLORS[r[F.CAT]]}">${CAT_NAMES[r[F.CAT]]}</span>
        ${r[F.DATE]?`<span class="hex-sighting-date">${esc(r[F.DATE])}</span>`:''}
        ${r[F.SUB]?`<span class="hex-sighting-sub">${esc(r[F.SUB])}</span>`:''}
      </div>
      ${r[F.LOC]?`<div class="hex-sighting-loc">${esc(r[F.LOC])}</div>`:''}
      ${r[F.DESC]?`<div class="hex-sighting-desc" data-idx="${idx}">${esc(r[F.DESC])}</div>`:''}
    </div>`);
  });
  if(total>showLimit){
    parts.push(`<div class="hex-sighting-more"><button id="hex-load-more-btn">Load ${Math.min(total-showLimit,100)} more...</button></div>`);
  }
  parts.push('</div></div>');

  // Zoom button
  parts.push('<button class="hex-zoom-btn" id="hex-zoom-btn">&#128269; ZOOM TO THIS AREA &amp; VIEW MARKERS</button>');
  parts.push('</div>');

  return{html:parts.join(''),yearBins,bestLoc,sorted,total,showLimit};
}

function setupDescExpand(el){
  // Check if text overflows the max-height after layout settles
  if(el.scrollHeight>el.clientHeight+2){
    el.classList.add('truncated');
    const link=document.createElement('span');
    link.className='hex-sighting-expand';
    link.textContent='\u25BC expand';
    link.addEventListener('click',(e)=>{
      e.stopPropagation();
      const isExpanded=el.classList.toggle('expanded');
      link.textContent=isExpanded?'\u25B2 collapse':'\u25BC expand';
    });
    el.parentElement.insertBefore(link,el.nextSibling);
  }
}

function showHexDetail(feature){
  const sightings=collectSightingsInHex(feature);
  if(!sightings.length)return;

  const{html,yearBins,bestLoc,sorted,total,showLimit}=buildHexDetailHTML(feature,sightings);

  // Expose selected hex data for SIGNAL AI access
  const centroid=turf.centroid(feature);
  const catCounts=[0,0,0];
  sightings.forEach(r=>catCounts[r[F.CAT]]++);
  const subFreq={};
  sightings.forEach(r=>{const s=r[F.SUB];if(s&&s.trim()){subFreq[s]=(subFreq[s]||0)+1}});
  const topSubs=Object.entries(subFreq).sort((a,b)=>b[1]-a[1]).slice(0,15);
  window._selectedHexData={
    location:bestLoc,
    lat:centroid.geometry.coordinates[1],
    lon:centroid.geometry.coordinates[0],
    total:total,
    categories:{ufo:catCounts[0],bigfoot:catCounts[1],haunted:catCounts[2]},
    topSubcategories:topSubs.map(([s,c])=>({name:s,count:c})),
    sightings:sightings.slice(0,100).map(r=>({
      category:CAT_NAMES[r[F.CAT]],date:r[F.DATE]||'',location:r[F.LOC]||'',
      subcategory:r[F.SUB]||'',description:(r[F.DESC]||'').substring(0,300)
    }))
  };

  // Create or update window
  if(!hexDetailWindow){
    hexDetailWindow=WindowManager.create({
      id:'hex-detail',
      title:'<span style="color:var(--cyan)">&#11042;</span> HEX ANALYSIS',
      content:'',
      defaultPos:{right:20,top:60},
      defaultSize:{width:420,height:560},
      minSize:{width:340,height:300}
    });
  }
  // Safe: html built from esc()-sanitized user data + app constants
  hexDetailWindow.bodyEl.innerHTML=html;
  hexDetailWindow.setTitle(`<span style="color:var(--cyan)">&#11042;</span> HEX ANALYSIS &mdash; ${esc(bestLoc)}`);
  hexDetailWindow.show();

  // Wire up interactions after DOM render
  requestAnimationFrame(()=>{
    renderHexTemporalChart(yearBins);

    // Sighting list toggle
    const toggleBtn=document.getElementById('hex-sighting-toggle-btn');
    const itemsEl=document.getElementById('hex-sighting-items');
    let expandSetup=false;
    if(toggleBtn&&itemsEl){
      toggleBtn.addEventListener('click',()=>{
        const open=itemsEl.style.display!=='none';
        itemsEl.style.display=open?'none':'block';
        toggleBtn.textContent=open
          ?'Show '+Math.min(total,showLimit)+' of '+total.toLocaleString()+' sightings \u25BC'
          :'Hide sighting list \u25B2';
        // Setup expand links on first open (elements need to be visible for scrollHeight measurement)
        if(!open&&!expandSetup){
          expandSetup=true;
          setTimeout(()=>{
            itemsEl.querySelectorAll('.hex-sighting-desc').forEach(el=>setupDescExpand(el));
          },50);
        }
      });
    }

    // Note: expand/collapse setup happens when sighting list is first opened (see toggle handler below)

    // Load more sightings
    const loadMoreBtn=document.getElementById('hex-load-more-btn');
    if(loadMoreBtn){
      loadMoreBtn.addEventListener('click',()=>{
        const container=loadMoreBtn.parentElement.parentElement;
        const next=sorted.slice(showLimit,showLimit+100);
        next.forEach(r=>{
          const item=document.createElement('div');
          item.className='hex-sighting-item';
          const head=document.createElement('div');
          head.className='hex-sighting-item-head';
          const catSpan=document.createElement('span');
          catSpan.className='hex-sighting-cat';
          catSpan.style.color=CAT_COLORS[r[F.CAT]];
          catSpan.textContent=CAT_NAMES[r[F.CAT]];
          head.appendChild(catSpan);
          if(r[F.DATE]){const d=document.createElement('span');d.className='hex-sighting-date';d.textContent=r[F.DATE];head.appendChild(d)}
          if(r[F.SUB]){const s=document.createElement('span');s.className='hex-sighting-sub';s.textContent=r[F.SUB];head.appendChild(s)}
          item.appendChild(head);
          if(r[F.LOC]){const loc=document.createElement('div');loc.className='hex-sighting-loc';loc.textContent=r[F.LOC];item.appendChild(loc)}
          if(r[F.DESC]){
            const desc=document.createElement('div');desc.className='hex-sighting-desc';
            desc.textContent=decodeEntities(r[F.DESC]);
            item.appendChild(desc);
          }
          container.insertBefore(item,loadMoreBtn.parentElement);
        });
        // Add expand/collapse to new items
        container.querySelectorAll('.hex-sighting-desc:not([data-wired])').forEach(el=>{
          el.dataset.wired='1';
          setupDescExpand(el);
        });
        loadMoreBtn.parentElement.remove();
      });
    }

    // Zoom button
    const zoomBtn=document.getElementById('hex-zoom-btn');
    if(zoomBtn){
      zoomBtn.addEventListener('click',()=>{
        const c=turf.centroid(feature).geometry.coordinates;
        // Zoom and render only this hex's sightings as markers (avoids 258K full render freeze)
        map.flyTo([c[1],c[0]],12,{duration:1});
        setTimeout(()=>{
          clearAllLayers();
          currentView='markers';
          document.querySelectorAll('.nav-btn,.view-btn').forEach(b=>b.classList.toggle('active',b.dataset.view==='markers'));
          // Only add markers for sightings within this hex
          for(let i=0;i<3;i++){
            const pts=sightings.filter(r=>r[F.CAT]===i);
            if(!pts.length)continue;
            const group=createCluster(i);
            group.addLayers(pts.map(r=>createMarker(r)));
            group.addTo(map);
            clusterGroups[i]=group;
          }
        },1200);
      });
    }
  });
}

function renderHexTemporalChart(yearBins){
  const svg=d3.select('#hex-temporal-svg');
  if(!svg.node())return;
  svg.selectAll('*').remove();

  const years=Object.keys(yearBins).map(Number).sort((a,b)=>a-b);
  if(years.length<2){svg.append('text').attr('x',10).attr('y',20).attr('fill','var(--text-dim)').attr('font-size',10).text('Insufficient temporal data');return}

  const container=svg.node().parentElement;
  const w=container.clientWidth||360;
  const h=90;
  const m={top:4,right:4,bottom:18,left:30};
  svg.attr('width',w).attr('height',h);
  const g=svg.append('g').attr('transform',`translate(${m.left},${m.top})`);
  const iw=w-m.left-m.right,ih=h-m.top-m.bottom;

  const stackData=years.map(y=>({year:y,0:yearBins[y][0],1:yearBins[y][1],2:yearBins[y][2]}));
  const x=d3.scaleBand().domain(years).range([0,iw]).padding(0.15);
  const stack=d3.stack().keys(['0','1','2']);
  const series=stack(stackData);
  const yMax=d3.max(series,s=>d3.max(s,d=>d[1]))||1;
  const y=d3.scaleLinear().domain([0,yMax]).range([ih,0]);

  series.forEach((s,i)=>{
    g.selectAll('.hbar-'+i).data(s).join('rect')
      .attr('x',d=>x(d.data.year)).attr('y',d=>y(d[1]))
      .attr('width',x.bandwidth()).attr('height',d=>y(d[0])-y(d[1]))
      .attr('fill',CAT_COLORS[i]).attr('opacity',0.8);
  });

  const xTicks=years.filter((_,i)=>i%(Math.ceil(years.length/6))===0);
  g.append('g').attr('class','timeline-axis').attr('transform',`translate(0,${ih})`)
    .call(d3.axisBottom(x).tickValues(xTicks).tickFormat(d3.format('d')));
  g.append('g').attr('class','timeline-axis')
    .call(d3.axisLeft(y).ticks(3).tickFormat(d3.format('~s')));
}

/* ========== OVERLAY POINT EXTRACTION FOR CORRELATION ========== */
const OVERLAY_META={
  airspace:{data:()=>airspaceData,color:'#ff4466',name:'Restricted Airspace',file:'data/restricted_airspace.json',setter:d=>{airspaceData=d}},
  earthquakes:{data:()=>earthquakeData,color:'#ff8844',name:'USGS Earthquakes',file:'data/usgs_earthquakes.json',setter:d=>{earthquakeData=d}},
  caves:{data:()=>caveData,color:'#aa8866',name:'Cave Systems',file:'data/us_caves.json',setter:d=>{caveData=d}},
  fireballs:{data:()=>fireballData,color:'#ffcc00',name:'NASA Fireballs',file:'data/nasa_fireballs.json',setter:d=>{fireballData=d}},
  cryptids:{data:()=>cryptidData,color:'#cc44ff',name:'Cryptid Sightings',file:'data/cryptid_sightings.json',setter:d=>{cryptidData=d}},
  missing411:{data:()=>missing411Data,color:'#ff2222',name:'Missing 411',file:'data/missing411.json',setter:d=>{missing411Data=d}},
  military:{data:()=>militaryData,color:'#4488ff',name:'Military Bases',file:null,setter:null}
};

async function ensureOverlayLoaded(key){
  const meta=OVERLAY_META[key];
  if(!meta)return null;
  if(meta.data())return meta.data();
  if(!meta.file)return null;
  try{
    const resp=await fetch(meta.file);
    const d=await resp.json();
    meta.setter(d);
    return d;
  }catch(e){console.warn('Failed to load '+key);return null}
}

function getOverlayPoints(key){
  const meta=OVERLAY_META[key];
  if(!meta)return[];
  const d=meta.data();
  if(!d||!d.data)return[];
  return d.data.map(r=>[r[0],r[1]]); // all overlays have lat,lon at index 0,1
}

function hexBinOverlayPoints(points,hexFeatures,cellDeg){
  const overlayCounts=new Array(hexFeatures.length).fill(0);
  // Build simple grid index for overlay points
  const idx={};
  points.forEach(p=>{
    const r=Math.floor(p[0]/cellDeg),c=Math.floor(p[1]/cellDeg);
    const k=r+','+c;
    if(!idx[k])idx[k]=[];
    idx[k].push(p);
  });
  hexFeatures.forEach((hex,hi)=>{
    const bb=turf.bbox(hex);
    const minR=Math.floor(bb[1]/cellDeg),maxR=Math.floor(bb[3]/cellDeg);
    const minC=Math.floor(bb[0]/cellDeg),maxC=Math.floor(bb[2]/cellDeg);
    for(let r=minR;r<=maxR;r++){
      for(let c=minC;c<=maxC;c++){
        const pts=idx[r+','+c];
        if(!pts)continue;
        pts.forEach(pt=>{
          if(turf.booleanPointInPolygon(turf.point([pt[1],pt[0]]),hex)){
            overlayCounts[hi]++;
          }
        });
      }
    }
  });
  return overlayCounts;
}

function parseCorrValue(val){
  if(val.startsWith('overlay:')){
    const key=val.substring(8);
    const meta=OVERLAY_META[key];
    return{type:'overlay',key,name:meta?meta.name:key,color:meta?meta.color:'#888'};
  }
  return{type:'sighting',catIdx:parseInt(val),name:CAT_NAMES[parseInt(val)],color:CAT_COLORS[parseInt(val)]};
}

async function renderCorrelation(){
  // Clear old analysis layers
  if(clusterLayer){map.removeLayer(clusterLayer);clusterLayer=null}
  // Re-render the active sub-mode so layers persist across filter/view changes
  if(corrSubMode==='spatial'){
    const valA=document.getElementById('corr-a').value;
    const valB=document.getElementById('corr-b').value;
    await runCorrelation(valA,valB);
  } else if(corrSubMode==='clusters'&&detectedClusters.length>0){
    // Re-render previously detected clusters
    await runClusterDetection();
  }
  // Matrix, temporal, nearest don't need map layers — they use windows/panels
}

/* ========== CORRELATION ENGINE ========== */
async function runCorrelation(valA,valB){
  if(corrLayer){map.removeLayer(corrLayer);corrLayer=null}

  const cellSide=parseFloat(document.getElementById('corr-hex-size').value);
  const{grid,counts}=await getOrBuildHexDataAsync(cellSide);
  const hexFeatures=grid.features;
  const cellDeg=cellSide/111;

  const specA=parseCorrValue(String(valA));
  const specB=parseCorrValue(String(valB));

  // Load overlay data if needed
  if(specA.type==='overlay')await ensureOverlayLoaded(specA.key);
  if(specB.type==='overlay')await ensureOverlayLoaded(specB.key);

  // Get counts for A and B
  let countsA,countsB;
  if(specA.type==='sighting'){
    countsA=counts.map(c=>c[specA.catIdx]);
  } else {
    const pts=getOverlayPoints(specA.key);
    countsA=hexBinOverlayPoints(pts,hexFeatures,cellDeg);
  }
  if(specB.type==='sighting'){
    countsB=counts.map(c=>c[specB.catIdx]);
  } else {
    const pts=getOverlayPoints(specB.key);
    countsB=hexBinOverlayPoints(pts,hexFeatures,cellDeg);
  }

  // Pearson correlation on cells with at least one data point
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

  // Compute Pearson r and p-value using permutation test
  const xArr=pairs.map(p=>p[0]),yArr=pairs.map(p=>p[1]);
  const r=pearsonR(xArr,yArr);
  const pVal=isNaN(r)?1:permutationPValue(xArr,yArr,r,999);

  // Display result
  const resultEl=document.getElementById('corr-result');
  resultEl.classList.add('visible');
  const rEl=document.getElementById('corr-r-value');
  const rDisplay=isNaN(r)?'N/A':r.toFixed(3);
  rEl.textContent=rDisplay;
  rEl.style.color=isNaN(r)?'var(--text-dim)':r>0.3?'var(--green)':r<-0.1?'var(--pink)':'var(--cyan)';

  const detailEl=document.getElementById('corr-detail');
  detailEl.textContent='';
  const d1=document.createElement('div');d1.textContent=interpretR(r);detailEl.appendChild(d1);
  const d2=document.createElement('div');d2.style.cssText='margin-top:3px;font-size:10px;color:'+(pVal<0.05?'var(--green)':'var(--text-dim)');
  d2.textContent=formatPValue(pVal);detailEl.appendChild(d2);
  const d3el=document.createElement('div');d3el.style.marginTop='4px';
  d3el.textContent=pairs.length+' hex cells analyzed \u00B7 '+hotspotCount+' hotspots';detailEl.appendChild(d3el);
  document.getElementById('stat-hotspots').textContent=hotspotCount;

  // Color scale: diverging red-blue through neutral
  const maxVal=d3.max(pairs,p=>p[0]+p[1])||1;
  const coOccScale=d3.scaleSequential(d3.interpolateRdYlGn).domain([0,maxVal]);

  const nameA=specA.name,nameB=specB.name;
  const colorA=specA.color,colorB=specB.color;

  corrLayer=L.geoJSON(turf.featureCollection(hexFeatures),{
    style(feature){
      const a=feature.properties.cA,b=feature.properties.cB;
      if(a===0&&b===0)return{fillOpacity:0,weight:0};
      const score=a+b;
      const isHotspot=feature.properties.hotspot;
      return{
        fillColor:coOccScale(score),
        fillOpacity:isHotspot?0.7:0.4,
        weight:isHotspot?2:0.5,
        color:isHotspot?'#fff':'rgba(255,255,255,0.1)'
      };
    },
    onEachFeature(feature,layer){
      const a=feature.properties.cA,b=feature.properties.cB;
      if(a>0||b>0){
        let tip='<b>Co-occurrence cell</b><br>';
        tip+='<span style="color:'+colorA+'">'+nameA+': '+a+'</span><br>';
        tip+='<span style="color:'+colorB+'">'+nameB+': '+b+'</span>';
        if(feature.properties.hotspot)tip+='<br><b style="color:var(--green)">HOTSPOT</b>';
        layer.bindTooltip(tip);
        layer.on('click',()=>showHexDetail(feature));
      }
    }
  }).addTo(map);
  updateLegend();
}

/* ========== TIMELINE (D3) ========== */
function buildTimeline(){
  if(timelineBuilt)return;
  timelineBuilt=true;

  const svg=d3.select('#timeline-svg');
  const container=document.getElementById('timeline-panel');
  const w=container.clientWidth-32;
  const h=parseInt(getComputedStyle(document.documentElement).getPropertyValue('--timeline-h'))-36;
  const margin={top:4,right:16,bottom:22,left:40};
  const iw=w-margin.left-margin.right;
  const ih=h-margin.top-margin.bottom;

  svg.attr('width',w).attr('height',h);
  const g=svg.append('g').attr('transform',`translate(${margin.left},${margin.top})`);

  // Aggregate by year per category
  const yearData={};
  allData.forEach(r=>{
    if(!r[F.DATE])return;
    const y=parseInt(r[F.DATE].substring(0,4));
    if(isNaN(y)||y<1900||y>2030)return;
    if(!yearData[y])yearData[y]=[0,0,0];
    yearData[y][r[F.CAT]]++;
  });

  const years=Object.keys(yearData).map(Number).sort((a,b)=>a-b);
  if(!years.length)return;
  const stackData=years.map(y=>({year:y,0:yearData[y][0],1:yearData[y][1],2:yearData[y][2]}));

  const x=d3.scaleBand().domain(years).range([0,iw]).padding(0.15);
  const stack=d3.stack().keys(['0','1','2']);
  const series=stack(stackData);
  const yMax=d3.max(series,s=>d3.max(s,d=>d[1]));
  const y=d3.scaleLinear().domain([0,yMax]).range([ih,0]);

  // Bars
  series.forEach((s,i)=>{
    g.selectAll(`.bar-${i}`).data(s).join('rect')
      .attr('class',`timeline-bar bar-${i}`)
      .attr('x',d=>x(d.data.year))
      .attr('y',d=>y(d[1]))
      .attr('width',x.bandwidth())
      .attr('height',d=>y(d[0])-y(d[1]))
      .attr('fill',CAT_COLORS[i])
      .attr('opacity',0.8)
      .on('mouseover',function(event,d){
        const tt=document.getElementById('timeline-tooltip');
        tt.style.display='block';
        tt.style.left=(event.offsetX+10)+'px';
        tt.style.top=(event.offsetY-30)+'px';
        tt.innerHTML=`<b>${d.data.year}</b><br>
          <span style="color:${CAT_COLORS[0]}">UFO: ${d.data[0]}</span><br>
          <span style="color:${CAT_COLORS[1]}">Bigfoot: ${d.data[1]}</span><br>
          <span style="color:${CAT_COLORS[2]}">Haunted: ${d.data[2]}</span>`;
      })
      .on('mouseout',()=>{document.getElementById('timeline-tooltip').style.display='none'});
  });

  // Axes
  const xAxis=d3.axisBottom(x).tickValues(years.filter(y=>y%10===0)).tickFormat(d3.format('d'));
  g.append('g').attr('class','timeline-axis').attr('transform',`translate(0,${ih})`).call(xAxis);
  const yAxis=d3.axisLeft(y).ticks(4).tickFormat(d3.format('~s'));
  g.append('g').attr('class','timeline-axis').call(yAxis);

  // Brush
  const brush=d3.brushX().extent([[0,0],[iw,ih]])
    .on('end',function(event){
      if(!event.selection){
        brushRange=null;
        applyFilters();
        return;
      }
      const [x0,x1]=event.selection;
      const selectedYears=years.filter(y=>{
        const bx=x(y)+x.bandwidth()/2;
        return bx>=x0&&bx<=x1;
      });
      if(selectedYears.length){
        brushRange=[selectedYears[0],selectedYears[selectedYears.length-1]];
      } else {
        brushRange=null;
      }
      applyFilters();
    });
  g.append('g').attr('class','brush-group').call(brush);
}

/* ========== VIEW SWITCHING ========== */
function setView(view){
  currentView=view;
  // Update nav buttons
  document.querySelectorAll('.nav-btn,.view-btn').forEach(b=>{
    b.classList.toggle('active',b.dataset.view===view);
  });
  // Show/hide correlation controls
  document.getElementById('corr-section').style.display=view==='correlation'?'block':'none';
  applyFilters();
}

/* ========== URL STATE ========== */
function saveState(){
  const center=map.getCenter();
  const params=new URLSearchParams();
  params.set('lat',center.lat.toFixed(4));
  params.set('lng',center.lng.toFixed(4));
  params.set('z',map.getZoom());
  params.set('v',currentView);
  const layers=[0,1,2].map(i=>document.querySelector(`[data-cat="${i}"]`).checked?1:0).join('');
  params.set('l',layers);
  const yf=document.getElementById('year-from').value;
  const yt=document.getElementById('year-to').value;
  if(yf)params.set('yf',yf);
  if(yt)params.set('yt',yt);
  const sf=document.getElementById('state-filter').value;
  if(sf)params.set('sf',sf);
  const sub=document.getElementById('sub-filter').value;
  if(sub)params.set('sub',sub);
  if(currentView==='correlation')params.set('csm',corrSubMode);
  if(perCapitaMode)params.set('pc','1');
  if(showMilitaryBases)params.set('mil','1');
  if(showAirspace)params.set('air','1');
  if(showEarthquakes)params.set('eq','1');
  if(showCaves)params.set('cav','1');
  if(showFireballs)params.set('fb','1');
  if(showCryptids)params.set('cry','1');
  if(showMissing411)params.set('m411','1');
  if(showGeomagnetic)params.set('geo','1');
  history.replaceState(null,'','#'+params.toString());
}

function loadState(){
  if(!location.hash)return;
  try{
    const params=new URLSearchParams(location.hash.substring(1));
    if(params.has('lat')&&params.has('lng')&&params.has('z')){
      map.setView([parseFloat(params.get('lat')),parseFloat(params.get('lng'))],parseInt(params.get('z')));
    }
    if(params.has('v'))currentView=params.get('v');
    if(params.has('l')){
      const l=params.get('l');
      [0,1,2].forEach(i=>{document.querySelector(`[data-cat="${i}"]`).checked=l[i]==='1'});
    }
    if(params.has('yf'))document.getElementById('year-from').value=params.get('yf');
    if(params.has('yt'))document.getElementById('year-to').value=params.get('yt');
    if(params.has('sf'))document.getElementById('state-filter').value=params.get('sf');
    if(params.has('sub'))document.getElementById('sub-filter').value=params.get('sub');
    if(params.has('csm')){const v=params.get('csm');if(['spatial','matrix','temporal','clusters','nearest'].includes(v))corrSubMode=v;}
    if(params.get('pc')==='1'){perCapitaMode=true;const el=document.getElementById('percapita-toggle');if(el)el.checked=true}
    if(params.get('mil')==='1'){showMilitaryBases=true;const el=document.getElementById('military-toggle');if(el)el.checked=true}
    // Restore new overlay toggles — actual data loading happens on first render via toggle handler
    const overlayFlags=[
      ['air','airspace-toggle',v=>{showAirspace=v}],
      ['eq','earthquakes-toggle',v=>{showEarthquakes=v}],
      ['cav','caves-toggle',v=>{showCaves=v}],
      ['fb','fireballs-toggle',v=>{showFireballs=v}],
      ['cry','cryptids-toggle',v=>{showCryptids=v}],
      ['m411','missing411-toggle',v=>{showMissing411=v}],
      ['geo','geomagnetic-toggle',v=>{showGeomagnetic=v}]
    ];
    overlayFlags.forEach(([key,toggleId,setter])=>{
      if(params.get(key)==='1'){
        setter(true);
        const el2=document.getElementById(toggleId);
        if(el2){el2.checked=true;el2.dispatchEvent(new Event('change'))}
      }
    })
  }catch(e){console.warn('Failed to load state from URL',e)}
}

/* ========== EXPORT CSV ========== */
function exportCSV(){
  const headers=['category','subcategory','date','latitude','longitude','location','description'];
  const rows=[headers.join(',')];
  for(let i=0;i<3;i++){
    filteredCat[i].forEach(r=>{
      const vals=[
        CAT_NAMES[r[F.CAT]],
        `"${(r[F.SUB]||'').replace(/"/g,'""')}"`,
        r[F.DATE]||'',
        r[F.LAT],r[F.LON],
        `"${(r[F.LOC]||'').replace(/"/g,'""')}"`,
        `"${(r[F.DESC]||'').replace(/"/g,'""')}"`
      ];
      rows.push(vals.join(','));
    });
  }
  const blob=new Blob(['\ufeff'+rows.join('\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download='sightings_export.csv';a.click();
  URL.revokeObjectURL(url);
}

/* ========== STATS HELPER ========== */
function getStats(){
  const vis=filteredCat.reduce((s,a)=>s+a.length,0);
  return{
    total:allData.length,visible:vis,
    categories:{'UFO/UAP':filteredCat[0].length,'Bigfoot/Sasquatch':filteredCat[1].length,'Haunted Place':filteredCat[2].length},
    filters:{
      yearFrom:document.getElementById('year-from').value||null,
      yearTo:document.getElementById('year-to').value||null,
      state:document.getElementById('state-filter').value||null
    }
  };
}

/* ========== SNAPSHOT EXPORT ========== */
async function exportSnapshot(){
  const btn=document.getElementById('snapshot-btn');
  if(!btn)return;
  const origText=btn.innerHTML;
  btn.innerHTML='&#9203; CAPTURING...';
  btn.disabled=true;

  try{
    const mapEl=document.getElementById('map');
    const canvas=await html2canvas(mapEl,{
      useCORS:true,allowTaint:true,backgroundColor:'#05060f',scale:2,logging:false
    });

    const stats=getStats();
    const center=map.getCenter();
    const zoom=map.getZoom();
    const timestamp=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);

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
${stats.filters.yearFrom||stats.filters.yearTo||stats.filters.state?'<h2>ACTIVE FILTERS</h2><table><tr><th>Filter</th><th>Value</th></tr>'
  +(stats.filters.yearFrom?'<tr><td>Year From</td><td>'+esc(String(stats.filters.yearFrom))+'</td></tr>':'')
  +(stats.filters.yearTo?'<tr><td>Year To</td><td>'+esc(String(stats.filters.yearTo))+'</td></tr>':'')
  +(stats.filters.state?'<tr><td>State</td><td>'+esc(stats.filters.state)+'</td></tr>':'')
  +'</table>':''}
<footer>Generated by Strange Signals // Paranormal Sightings Correlation Map<br>
<a href="${location.href}" style="color:#00d4ff">Restore this view</a></footer>
</body></html>`;

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

/* ========== GEOCODE SEARCH ========== */
async function geocodeSearch(query){
  if(!query.trim())return;
  try{
    const resp=await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
    if(!resp.ok)throw new Error('Geocode HTTP '+resp.status);
    const data=await resp.json();
    if(data.length){
      map.flyTo([parseFloat(data[0].lat),parseFloat(data[0].lon)],10,{duration:1.5});
    }
  }catch(e){console.warn('Geocode failed',e)}
}

/* ========== EVENT LISTENERS ========== */
// Layer toggles
document.querySelectorAll('[data-cat]').forEach(cb=>{
  cb.addEventListener('change',applyFilters);
});

// View mode buttons
document.querySelectorAll('[data-view]').forEach(btn=>{
  btn.addEventListener('click',()=>setView(btn.dataset.view));
});

// Correlation controls
document.getElementById('corr-run').addEventListener('click',()=>{
  if(currentView!=='correlation')setView('correlation');
  else renderCorrelation();
});
document.getElementById('corr-hex-size').addEventListener('input',e=>{
  document.getElementById('corr-hex-label').textContent=e.target.value+'km';
  invalidateAnalysisCache(); // hex size changed, invalidate cache
});

// Sub-mode tabs
document.querySelectorAll('[data-submode]').forEach(btn=>{
  btn.addEventListener('click',()=>setCorrSubMode(btn.dataset.submode));
});

// Matrix button
document.getElementById('matrix-run').addEventListener('click',()=>{
  if(currentView!=='correlation')setView('correlation');
  runMatrixCorrelation();
});

// Cluster button + threshold slider
document.getElementById('cluster-run').addEventListener('click',()=>{
  if(currentView!=='correlation')setView('correlation');
  runClusterDetection();
});
document.getElementById('cluster-threshold').addEventListener('input',e=>{
  document.getElementById('cluster-threshold-label').textContent=e.target.value;
});

// Temporal button (now uses WindowManager)
let temporalWindow=null;
document.getElementById('temporal-run').addEventListener('click',()=>{
  if(!temporalWindow){
    const content=document.getElementById('temporal-content-inner');
    if(content)content.style.display='block';
    temporalWindow=WindowManager.create({
      id:'temporal',
      title:'<span class="icon">&#9202;</span> TEMPORAL CORRELATION',
      content:content,
      defaultPos:{right:20,bottom:220},
      defaultSize:{width:720,height:400},
      minSize:{width:400,height:250},
      onClose:()=>{temporalOverlayVisible=false}
    });
  }
  temporalWindow.show();
  // Defer chart rendering until after the window is visible and has layout dimensions
  requestAnimationFrame(()=>requestAnimationFrame(()=>renderTemporalCharts()));
  temporalOverlayVisible=true;
});

// Nearest-neighbor button
document.getElementById('nearest-run').addEventListener('click',async ()=>{
  try{await computeNNAnalysis()}
  catch(e){
    console.error('NN analysis failed:',e);
    document.getElementById('nearest-results').innerHTML='<div style="color:var(--pink)">Analysis failed. Try adjusting filters.</div>';
    document.getElementById('nearest-results').style.display='block';
  }
});

// Attraction zones toggle
document.getElementById('show-attraction-zones').addEventListener('change',e=>{
  if(e.target.checked)renderAttractionZones();
  else removeAttractionZones();
});

// Proximity radius
document.getElementById('prox-radius').addEventListener('input',e=>{
  document.getElementById('prox-label').textContent=e.target.value+'km';
});

// Per-capita toggle
const pcToggleEl=document.getElementById('percapita-toggle');
if(pcToggleEl){
  pcToggleEl.addEventListener('change',e=>{
    perCapitaMode=e.target.checked;
    if(currentView==='heatmap')renderCurrentView();
  });
}

// Military bases toggle
const milToggleEl=document.getElementById('military-toggle');
if(milToggleEl){
  milToggleEl.addEventListener('change',e=>{
    showMilitaryBases=e.target.checked;
    if(showMilitaryBases)renderMilitaryBases();
    else removeMilitaryBases();
  });
}

// National Parks overlay
const parksToggleEl=document.getElementById('parks-toggle');
if(parksToggleEl){
  parksToggleEl.addEventListener('change',async function(){
    showParks=this.checked;
    if(showParks&&!parksData){
      try{
        const resp=await fetch('data/national_parks.json');
        parksData=await resp.json();
        document.getElementById('count-parks').textContent=parksData.data.length;
      }catch(e){console.warn('Parks data not found');this.checked=false;showParks=false;return}
    }
    if(showParks&&parksData){
      if(!parksLayer){
        parksLayer=L.layerGroup();
        parksData.data.forEach(p=>{
          const icon=L.divIcon({className:'overlay-marker parks-marker',html:'&#9830;',iconSize:[12,12]});
          const marker=L.marker([p[0],p[1]],{icon});
          marker.bindPopup('<b style="color:#22cc66">&#9830; '+esc(p[2])+'</b><br>'+esc(p[3])+'<br>'+p[4]+' km&sup2;');
          parksLayer.addLayer(marker);
        });
      }
      parksLayer.addTo(map);
    } else if(parksLayer){
      map.removeLayer(parksLayer);
    }
  });
}

// Historic Sites overlay
const histToggleEl=document.getElementById('historic-toggle');
if(histToggleEl){
  histToggleEl.addEventListener('change',async function(){
    showHistoric=this.checked;
    if(showHistoric&&!historicData){
      try{
        const resp=await fetch('data/historic_sites.json');
        historicData=await resp.json();
        document.getElementById('count-historic').textContent=historicData.data.length;
      }catch(e){console.warn('Historic data not found');this.checked=false;showHistoric=false;return}
    }
    if(showHistoric&&historicData){
      if(!historicLayer){
        historicLayer=L.layerGroup();
        historicData.data.forEach(s=>{
          const icon=L.divIcon({className:'overlay-marker historic-marker',html:'&#9632;',iconSize:[10,10]});
          const marker=L.marker([s[0],s[1]],{icon});
          marker.bindPopup('<b style="color:#ffaa22">&#9632; '+esc(s[2])+'</b><br>'+esc(s[3])+'<br>Listed: '+esc(String(s[4])));
          historicLayer.addLayer(marker);
        });
      }
      historicLayer.addTo(map);
    } else if(historicLayer){
      map.removeLayer(historicLayer);
    }
  });
}

// --- New overlay toggle handlers (lazy-load pattern) ---
function wireOverlayToggle(id,flagName,dataFile,countId,loadCb,renderCb,removeCb){
  const el=document.getElementById(id);
  if(!el)return;
  el.addEventListener('change',async function(){
    const checked=this.checked;
    // Set flag via closure reference
    loadCb.flag=checked;
    if(checked){
      let data=loadCb.cache;
      if(!data){
        try{
          const resp=await fetch(dataFile);
          data=await resp.json();
          loadCb.cache=data;
          if(countId){
            const ce=document.getElementById(countId);
            if(ce)ce.textContent=data.data?data.data.length:'';
          }
        }catch(e){console.warn(dataFile+' not found');this.checked=false;loadCb.flag=false;return}
      }
      renderCb(data);
    } else {
      removeCb();
    }
  });
}
// Airspace
wireOverlayToggle('airspace-toggle','showAirspace','data/restricted_airspace.json','count-airspace',
  {flag:false,cache:null},
  function(data){airspaceData=data;showAirspace=true;renderAirspace()},
  function(){showAirspace=false;removeAirspace()});
// Earthquakes
wireOverlayToggle('earthquakes-toggle','showEarthquakes','data/usgs_earthquakes.json','count-earthquakes',
  {flag:false,cache:null},
  function(data){earthquakeData=data;showEarthquakes=true;renderEarthquakes()},
  function(){showEarthquakes=false;removeEarthquakes()});
// Caves
wireOverlayToggle('caves-toggle','showCaves','data/us_caves.json','count-caves',
  {flag:false,cache:null},
  function(data){caveData=data;showCaves=true;renderCaves()},
  function(){showCaves=false;removeCaves()});
// Fireballs
wireOverlayToggle('fireballs-toggle','showFireballs','data/nasa_fireballs.json','count-fireballs',
  {flag:false,cache:null},
  function(data){fireballData=data;showFireballs=true;renderFireballs()},
  function(){showFireballs=false;removeFireballs()});
// Cryptids
wireOverlayToggle('cryptids-toggle','showCryptids','data/cryptid_sightings.json','count-cryptids',
  {flag:false,cache:null},
  function(data){cryptidData=data;showCryptids=true;renderCryptids()},
  function(){showCryptids=false;removeCryptids()});
// Missing 411
wireOverlayToggle('missing411-toggle','showMissing411','data/missing411.json','count-missing411',
  {flag:false,cache:null},
  function(data){missing411Data=data;showMissing411=true;renderMissing411()},
  function(){showMissing411=false;removeMissing411()});
// Geomagnetic storms (temporal)
wireOverlayToggle('geomagnetic-toggle','showGeomagnetic','data/geomagnetic_storms.json','count-geomagnetic',
  {flag:false,cache:null},
  function(data){geomagData=data;showGeomagnetic=true;renderGeomagBands()},
  function(){showGeomagnetic=false;removeGeomagBands()});

// Filters
document.getElementById('apply-filters').addEventListener('click',applyFilters);
document.getElementById('reset-filters').addEventListener('click',()=>{
  document.getElementById('year-from').value='';
  document.getElementById('year-to').value='';
  document.getElementById('state-filter').value='';
  document.getElementById('sub-filter').value='';
  brushRange=null;
  applyFilters();
});
['year-from','year-to','state-filter','sub-filter'].forEach(id=>{
  document.getElementById(id).addEventListener('keydown',e=>{if(e.key==='Enter')applyFilters()});
});

// Export
document.getElementById('export-csv').addEventListener('click',exportCSV);
document.getElementById('snapshot-btn').addEventListener('click',exportSnapshot);

// Search
document.getElementById('search-box').addEventListener('keydown',e=>{
  if(e.key==='Enter')geocodeSearch(e.target.value);
});

// Sidebar toggle
document.getElementById('sidebar-toggle').addEventListener('click',()=>{
  const sidebar=document.getElementById('sidebar');
  const isOpen=sidebar.classList.contains('open')||!sidebar.classList.contains('collapsed');
  sidebar.classList.toggle('collapsed',isOpen);
  sidebar.classList.toggle('open',!isOpen);
  document.getElementById('sidebar-toggle').setAttribute('aria-expanded',!isOpen);
});

// Timeline toggle
document.getElementById('timeline-toggle').addEventListener('click',()=>{
  const panel=document.getElementById('timeline-panel');
  panel.classList.toggle('collapsed');
  document.getElementById('timeline-toggle').textContent=panel.classList.contains('collapsed')?'\u25B2':'\u25BC';
  setTimeout(()=>map.invalidateSize(),350);
});

// URL state save on map move
map.on('moveend',saveState);

// Keyboard shortcuts
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
    const isOpen=!sb.classList.contains('collapsed')&&!sb.classList.contains('open')||sb.classList.contains('open');
    sb.classList.toggle('collapsed',isOpen);
    sb.classList.toggle('open',!isOpen);
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
  // Annotation mode
  else if(key==='a'){
    const annoBtn=document.getElementById('anno-toggle');
    if(annoBtn)annoBtn.click();
  }
  // Snapshot
  else if(key==='p'){exportSnapshot()}
  // Escape - close panels/overlays, then reset
  else if(key==='escape'){
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

/* ========== DATA LOADING ========== */
function yieldThread(){return new Promise(r=>setTimeout(r,0))}

// Parse, validate, filter, and categorize in a Web Worker.
// Worker sends results in small batches so structured clone never blocks >1-2s.
function parseInWorker(buffer){
  return new Promise((resolve,reject)=>{
    const cats=[[],[],[]];
    try{
      const w=new Worker('parse-worker.js');
      w.onmessage=function(e){
        const msg=e.data;
        if(msg.type==='batch'){
          // Push batch into category array — small enough to not block
          for(let i=0;i<msg.records.length;i++)cats[msg.cat].push(msg.records[i]);
          setProgress(0,nextVerb()+'...');
        } else if(msg.type==='done'){
          w.terminate();
          resolve({cats,total:msg.total});
        } else if(msg.type==='error'){
          w.terminate();
          reject(new Error(msg.error));
        }
      };
      w.onerror=function(err){
        w.terminate();
        // Fallback: parse on main thread
        try{
          const text=new TextDecoder().decode(buffer);
          const json=JSON.parse(text);
          const raw=json.data;
          for(let i=0;i<raw.length;i++){
            const r=raw[i];
            if(Array.isArray(r)&&r.length>=7&&typeof r[0]==='number'&&!isNaN(r[0])&&
              typeof r[1]==='number'&&!isNaN(r[1])&&r[2]>=0&&r[2]<=2)
              cats[r[2]].push(r);
          }
          resolve({cats,total:cats[0].length+cats[1].length+cats[2].length});
        }catch(e2){reject(e2)}
      };
      w.postMessage(buffer,[buffer]);
    }catch(e){
      try{
        const text=new TextDecoder().decode(buffer);
        const json=JSON.parse(text);
        const raw=json.data;
        for(let i=0;i<raw.length;i++){
          const r=raw[i];
          if(Array.isArray(r)&&r.length>=7&&typeof r[0]==='number'&&!isNaN(r[0])&&
            typeof r[1]==='number'&&!isNaN(r[1])&&r[2]>=0&&r[2]<=2)
            cats[r[2]].push(r);
        }
        resolve({cats,total:cats[0].length+cats[1].length+cats[2].length});
      }catch(e2){reject(e2)}
    }
  });
}

async function fetchWithProgress(url,label){
  const resp=await fetch(url);
  if(!resp.ok)throw new Error(`${label}: HTTP ${resp.status}`);
  const total=parseInt(resp.headers.get('Content-Length'))||0;
  if(!resp.body||!total){
    return resp.json();
  }
  const reader=resp.body.getReader();
  const chunks=[];
  let loaded=0;
  while(true){
    const{done,value}=await reader.read();
    if(done)break;
    chunks.push(value);
    loaded+=value.length;
    setBytes(loaded,total);
  }
  const buf=new Uint8Array(loaded);
  let pos=0;
  for(const chunk of chunks){buf.set(chunk,pos);pos+=chunk.length}
  // Send raw buffer to worker — NO TextDecoder or JSON.parse on main thread
  return parseInWorker(buf.buffer);
}

async function init(){
  loadState();
  setProgress(2,nextVerb()+'...');
  startFlavorRotation();

  // Phase 1: Fetch + parse in worker (main thread stays free)
  let result;
  try{
    const [sightResult,popResp,milResp]=await Promise.allSettled([
      fetchWithProgress('data/sightings_map_data.json','Sightings'),
      fetch('data/us_population_density.json').then(r=>r.json()),
      fetch('data/military_bases.json').then(r=>r.json())
    ]);
    if(sightResult.status==='rejected'){
      setProgress(0,'Error loading data: '+sightResult.reason);
      stopFlavorRotation();
      return;
    }
    result=sightResult.value;
    if(popResp.status==='fulfilled'){
      popDensityGrid=popResp.value;
      console.log('Population density grid loaded:',popResp.value.rows+'x'+popResp.value.cols);
    } else {
      console.warn('Population density data not available:',popResp.reason);
    }
    if(milResp.status==='fulfilled'){
      militaryData=milResp.value;
      console.log('Military bases loaded:',milResp.value.data.length,'installations');
    } else {
      console.warn('Military bases data not available:',milResp.reason);
    }
  }catch(err){
    setProgress(0,'Error loading data: '+err.message);
    stopFlavorRotation();
    return;
  }

  if(!result.total){
    setProgress(0,'No valid records found in data');
    stopFlavorRotation();
    return;
  }

  // Phase 2: Worker already parsed, filtered, and categorized.
  // Just assign the results — no heavy main-thread processing.
  catArrays[0]=result.cats[0];
  catArrays[1]=result.cats[1];
  catArrays[2]=result.cats[2];
  allData=[...catArrays[0],...catArrays[1],...catArrays[2]];

  // Clear the download counter — it's stale now
  const bytesEl=document.getElementById('loading-bytes');
  if(bytesEl)bytesEl.textContent='';

  console.log(`Loaded ${result.total.toLocaleString()} records: UFO=${catArrays[0].length}, Bigfoot=${catArrays[1].length}, Haunted=${catArrays[2].length}`);

  document.getElementById('stat-total').textContent=result.total.toLocaleString();
  document.getElementById('stat-zoom').textContent=map.getZoom();

  const pcToggle=document.getElementById('percapita-toggle');
  if(pcToggle&&!popDensityGrid)pcToggle.disabled=true;
  const milToggle=document.getElementById('military-toggle');
  if(milToggle&&!militaryData)milToggle.disabled=true;

  // Phase 3: Render — yield between each heavy step
  setProgress(0,nextVerb()+'...');
  await yieldThread();
  setView(currentView);

  await yieldThread();
  buildTimeline();

  stopFlavorRotation();
  const flavorEl=document.getElementById('loading-flavor');
  if(flavorEl)flavorEl.textContent='';
  if(bytesEl)bytesEl.textContent='';
  const pf=document.getElementById('progress-fill');
  if(pf){pf.style.animation='none';pf.style.width='100%';pf.style.transition='width 0.3s'}
  setProgress(100,'Systems online');
  setTimeout(()=>{document.getElementById('loading').style.display='none'},600);

  saveState();
}

init();

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
    corrSubMode='matrix';
    document.querySelectorAll('.corr-sub-btn').forEach(b=>b.classList.toggle('active',b.dataset.submode==='matrix'));
    document.querySelectorAll('.corr-subpanel').forEach(p=>p.style.display='none');
    document.getElementById('matrix-panel').style.display='block';
    await runMatrixCorrelation();
    return corrMatrix?{matrix:corrMatrix}:{computed:true};
  },
  detectClusters:async()=>{
    corrSubMode='clusters';
    document.querySelectorAll('.corr-sub-btn').forEach(b=>b.classList.toggle('active',b.dataset.submode==='clusters'));
    document.querySelectorAll('.corr-subpanel').forEach(p=>p.style.display='none');
    document.getElementById('cluster-panel').style.display='block';
    await runClusterDetection();
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

  // Temporal data aggregation
  getTemporalData:(category,state,yearFrom,yearTo,granularity)=>{
    granularity=granularity||'year';
    const buckets={};
    const cats=category!=null?[category]:[0,1,2];
    const stateUpper=state?state.toUpperCase():null;
    for(const cat of cats){
      for(const r of catArrays[cat]){
        if(!r[F.DATE])continue;
        const dateStr=r[F.DATE];
        const year=parseInt(dateStr.substring(0,4));
        if(isNaN(year))continue;
        if(yearFrom&&year<yearFrom)continue;
        if(yearTo&&year>yearTo)continue;
        if(stateUpper){
          const loc=r[F.LOC]||'';
          if(!loc.toUpperCase().includes(stateUpper))continue;
        }
        let key;
        if(granularity==='decade')key=Math.floor(year/10)*10+'s';
        else if(granularity==='month')key=dateStr.substring(0,7);
        else key=String(year);
        buckets[key]=(buckets[key]||0)+1;
      }
    }
    const result=Object.entries(buckets).map(([label,count])=>({label,count}));
    result.sort((a,b)=>a.label.localeCompare(b.label));
    return{buckets:result,total:result.reduce((s,b)=>s+b.count,0),
      filters:{category:category!=null?CAT_NAMES[category]:'all',state:state||'all',yearFrom,yearTo,granularity}};
  },

  // Hex data access (for anomaly detection) — uses full continental US bounds
  getHexCounts:(cellSide)=>{
    cellSide=cellSide||25;
    // Build hex grid over full continental US (not just viewport)
    const bbox=[-125,24,-66,50];
    const grid=turf.hexGrid(bbox,cellSide,{units:'kilometers'});
    const hexes=grid.features;
    const counts=hexes.map(()=>[0,0,0]);
    const cellDeg=cellSide/111;
    const idx=buildSpatialIndex(cellDeg);
    hexes.forEach((hex,hi)=>{
      const bb=turf.bbox(hex);
      const minR=Math.floor(bb[1]/cellDeg),maxR=Math.floor(bb[3]/cellDeg);
      const minC=Math.floor(bb[0]/cellDeg),maxC=Math.floor(bb[2]/cellDeg);
      for(let r=minR;r<=maxR;r++){
        for(let c=minC;c<=maxC;c++){
          const pts=idx[r+','+c];
          if(!pts)continue;
          pts.forEach(pt=>{
            if(turf.booleanPointInPolygon(turf.point([pt[F.LON],pt[F.LAT]]),hex)){
              counts[hi][pt[F.CAT]]++;
            }
          });
        }
      }
    });
    return{hexes:hexes.map((f,i)=>({
      lat:turf.centroid(f).geometry.coordinates[1],
      lon:turf.centroid(f).geometry.coordinates[0],
      counts:counts[i],
      total:counts[i][0]+counts[i][1]+counts[i][2]
    })),cellSide};
  },
  getPopDensityGrid:()=>popDensityGrid,

  // Overlay data access
  getOverlayData:()=>({
    airspace:airspaceData,earthquakes:earthquakeData,caves:caveData,
    fireballs:fireballData,cryptids:cryptidData,missing411:missing411Data,
    geomagnetic:geomagData,military:militaryData
  }),
  getActiveOverlays:()=>{
    const active=[];
    if(showMilitaryBases)active.push('military');
    if(showAirspace)active.push('airspace');
    if(showEarthquakes)active.push('earthquakes');
    if(showCaves)active.push('caves');
    if(showFireballs)active.push('fireballs');
    if(showCryptids)active.push('cryptids');
    if(showMissing411)active.push('missing411');
    if(showGeomagnetic)active.push('geomagnetic');
    return active;
  },
  getNearbyOverlays:(lat,lon,radiusKm)=>{
    const results={};
    const toRad=Math.PI/180;
    function haversine(lat1,lon1,lat2,lon2){
      const dLat=(lat2-lat1)*toRad,dLon=(lon2-lon1)*toRad;
      const a=Math.sin(dLat/2)**2+Math.cos(lat1*toRad)*Math.cos(lat2*toRad)*Math.sin(dLon/2)**2;
      return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
    }
    const r=radiusKm||50;
    if(airspaceData)results.airspace=airspaceData.data.filter(a=>haversine(lat,lon,a[0],a[1])<=r)
      .map(a=>({name:a[2],type:a[3],dist:Math.round(haversine(lat,lon,a[0],a[1]))}));
    if(caveData)results.caves=caveData.data.filter(c=>haversine(lat,lon,c[0],c[1])<=r)
      .map(c=>({name:c[2],state:c[3],type:c[4],dist:Math.round(haversine(lat,lon,c[0],c[1]))}));
    if(missing411Data)results.missing411=missing411Data.data.filter(m=>haversine(lat,lon,m[0],m[1])<=r)
      .map(m=>({name:m[2],park:m[3],state:m[4],dist:Math.round(haversine(lat,lon,m[0],m[1]))}));
    if(fireballData)results.fireballs=fireballData.data.filter(f=>haversine(lat,lon,f[0],f[1])<=r)
      .map(f=>({date:f[2],energy:f[3],dist:Math.round(haversine(lat,lon,f[0],f[1]))}));
    if(cryptidData)results.cryptids=cryptidData.data.filter(c=>haversine(lat,lon,c[0],c[1])<=r)
      .map(c=>({name:c[2],type:c[3],state:c[4],dist:Math.round(haversine(lat,lon,c[0],c[1]))}));
    if(militaryData)results.military=militaryData.data.filter(m=>haversine(lat,lon,m[0],m[1])<=r)
      .map(m=>({name:m[2],branch:m[3],dist:Math.round(haversine(lat,lon,m[0],m[1]))}));
    // Filter out empty arrays
    Object.keys(results).forEach(k=>{if(!results[k].length)delete results[k]});
    return results;
  },

  // Constants
  F,CAT_NAMES,CAT_COLORS
};

/* A11y: ensure all Leaflet marker icons have aria-label */
/* Only observe during initial data load, then disconnect to avoid performance overhead */
var ariaObserver=new MutationObserver(function(mutations){
  mutations.forEach(function(m){
    m.addedNodes.forEach(function(node){
      if(node.nodeType!==1)return;
      var icons=node.classList&&node.classList.contains('leaflet-marker-icon')?[node]:
        node.querySelectorAll?Array.from(node.querySelectorAll('.leaflet-marker-icon')):[];
      icons.forEach(function(el){
        if(el.getAttribute('role')==='button'&&!el.getAttribute('aria-label')){
          var inner=el.querySelector('[aria-label]');
          if(inner)el.setAttribute('aria-label',inner.getAttribute('aria-label'));
          else{
            var text=el.textContent.trim();
            el.setAttribute('aria-label',text?text+' sightings cluster':'Map marker');
          }
        }
      });
    });
  });
});
ariaObserver.observe(document.getElementById('map'),{childList:true,subtree:true});
// Disconnect after initial load settles (30s) — re-renders are handled by Leaflet's own a11y
setTimeout(function(){ariaObserver.disconnect()},30000);

})();
