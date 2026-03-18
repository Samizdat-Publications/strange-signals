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
function setProgress(pct,msg){
  document.getElementById('progress-fill').style.width=pct+'%';
  document.getElementById('loading-status').textContent=msg;
}

/* ========== ESCAPE HTML ========== */
function esc(s){return s?s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'):''}

/* ========== CREATE MARKER ========== */
function makeIcon(catIdx){
  const c=CAT_COLORS[catIdx];
  return L.divIcon({className:'',iconSize:[8,8],iconAnchor:[4,4],
    html:`<div style="width:8px;height:8px;background:${c};border-radius:50%;border:1px solid rgba(255,255,255,0.3);opacity:0.85"></div>`});
}
const icons=[makeIcon(0),makeIcon(1),makeIcon(2)];

function makePopup(rec){
  const cat=rec[F.CAT];
  let h=`<div class="popup-cat" style="color:${CAT_COLORS[cat]}">${CAT_NAMES[cat]}</div>`;
  h+=`<div class="popup-loc">${esc(rec[F.LOC])||'Unknown location'}</div>`;
  if(rec[F.DATE])h+=`<div class="popup-date">${rec[F.DATE]}</div>`;
  if(rec[F.SUB])h+=`<div class="popup-sub">${esc(rec[F.SUB])}</div>`;
  if(rec[F.DESC])h+=`<div class="popup-desc">${esc(rec[F.DESC])}</div>`;
  h+=`<div class="popup-coords">${rec[F.LAT].toFixed(4)}, ${rec[F.LON].toFixed(4)}</div>`;
  // proximity analysis
  const radius=parseInt(document.getElementById('prox-radius').value);
  const pt=turf.point([rec[F.LON],rec[F.LAT]]);
  let proxHtml='';
  for(let i=0;i<3;i++){
    if(i===cat)continue;
    if(!document.querySelector(`[data-cat="${i}"]`).checked)continue;
    let count=0;
    filteredCat[i].forEach(r=>{
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
  const m=L.marker([rec[F.LAT],rec[F.LON]],{icon:icons[rec[F.CAT]]});
  m._rec=rec;
  m.bindPopup(()=>makePopup(rec),{maxWidth:300});
  m.on('click',function(){showProxCircle(rec)});
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
    document.getElementById('temporal-overlay').style.display='none';
    temporalOverlayVisible=false;
  }
}

/* ========== PHASE 1: MATRIX CORRELATION ========== */
function runMatrixCorrelation(){
  const cellSide=parseFloat(document.getElementById('corr-hex-size').value);
  const{grid,counts}=getOrBuildHexData(cellSide);
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

function runClusterDetection(){
  const cellSide=parseFloat(document.getElementById('corr-hex-size').value);
  const threshold=parseInt(document.getElementById('cluster-threshold').value);
  const{grid,counts}=getOrBuildHexData(cellSide);
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
  const cw=container.clientWidth-24;
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
        meanDist:d3.mean(distances),medianDist:d3.median(distances),
        stdDev:d3.deviation(distances)||0,sampleN:sampledA.length
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
      if(!r){html+='<td>N/A</td>';continue}
      const color=r.meanDist<50?'var(--green)':r.meanDist<100?'var(--cyan)':'var(--text)';
      html+=`<td><div class="nn-dist" style="color:${color}">${r.meanDist.toFixed(1)}km</div>`+
        `<div class="nn-stddev">&plusmn;${r.stdDev.toFixed(1)}</div></td>`;
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
      return L.divIcon({className:'',iconSize:[sz,sz],
        html:`<div style="background:rgba(${c},0.65);color:#fff;font-weight:700;font-size:${sz>36?12:10}px;
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

function renderCurrentView(){
  clearAllLayers();
  document.getElementById('temporal-overlay').style.display='none';
  temporalOverlayVisible=false;
  if(currentView==='markers')renderMarkers();
  else if(currentView==='heatmap')renderHeatmap();
  else if(currentView==='hexbin')renderHexbin();
  else if(currentView==='correlation')renderCorrelation();
}

function renderMarkers(){
  for(let i=0;i<3;i++){
    if(!filteredCat[i].length)continue;
    const group=createCluster(i);
    const markers=filteredCat[i].map(r=>createMarker(r));
    group.addLayers(markers);
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
      }
    }
  }).addTo(map);
}

function renderCorrelation(){
  // Clear old analysis layers
  if(clusterLayer){map.removeLayer(clusterLayer);clusterLayer=null}
  // Dispatch based on sub-mode; only spatial auto-renders on view switch
  if(corrSubMode==='spatial'){
    const catA=parseInt(document.getElementById('corr-a').value);
    const catB=parseInt(document.getElementById('corr-b').value);
    runCorrelation(catA,catB);
  }
  // Other sub-modes require manual button click
}

/* ========== CORRELATION ENGINE ========== */
function runCorrelation(catA,catB){
  if(corrLayer){map.removeLayer(corrLayer);corrLayer=null}

  const cellSide=parseFloat(document.getElementById('corr-hex-size').value);
  const{grid,counts}=getOrBuildHexData(cellSide);
  const hexFeatures=grid.features;

  // Extract per-category counts from shared spatial-indexed hex data
  const countsA=counts.map(c=>c[catA]);
  const countsB=counts.map(c=>c[catB]);

  // Pearson correlation on cells with at least one sighting
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

  document.getElementById('corr-detail').innerHTML=
    `<div>${interpretR(r)}</div>`+
    `<div style="margin-top:3px;font-size:10px;color:${pVal<0.05?'var(--green)':'var(--text-dim)'}">${formatPValue(pVal)}</div>`+
    `<div style="margin-top:4px">${pairs.length} hex cells analyzed &middot; ${hotspotCount} hotspots</div>`;
  document.getElementById('stat-hotspots').textContent=hotspotCount;

  // Color scale: diverging red-blue through neutral
  const maxVal=d3.max(pairs,p=>p[0]+p[1])||1;
  const coOccScale=d3.scaleSequential(d3.interpolateRdYlGn).domain([0,maxVal]);

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
        let tip=`<b>Co-occurrence cell</b><br>`;
        tip+=`<span style="color:${CAT_COLORS[catA]}">${CAT_NAMES[catA]}: ${a}</span><br>`;
        tip+=`<span style="color:${CAT_COLORS[catB]}">${CAT_NAMES[catB]}: ${b}</span>`;
        if(feature.properties.hotspot)tip+=`<br><b style="color:var(--green)">HOTSPOT</b>`;
        layer.bindTooltip(tip);
      }
    }
  }).addTo(map);
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
    if(params.has('csm'))corrSubMode=params.get('csm');
    if(params.get('pc')==='1'){perCapitaMode=true;const el=document.getElementById('percapita-toggle');if(el)el.checked=true}
    if(params.get('mil')==='1'){showMilitaryBases=true;const el=document.getElementById('military-toggle');if(el)el.checked=true}
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
  const blob=new Blob([rows.join('\n')],{type:'text/csv'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download='sightings_export.csv';a.click();
  URL.revokeObjectURL(url);
}

/* ========== GEOCODE SEARCH ========== */
async function geocodeSearch(query){
  if(!query.trim())return;
  try{
    const resp=await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
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

// Temporal button + close
document.getElementById('temporal-run').addEventListener('click',()=>{
  document.getElementById('temporal-overlay').style.display='block';
  temporalOverlayVisible=true;
  renderTemporalCharts();
});
document.getElementById('temporal-close').addEventListener('click',()=>{
  document.getElementById('temporal-overlay').style.display='none';
  temporalOverlayVisible=false;
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

// Search
document.getElementById('search-box').addEventListener('keydown',e=>{
  if(e.key==='Enter')geocodeSearch(e.target.value);
});

// Sidebar toggle
document.getElementById('sidebar-toggle').addEventListener('click',()=>{
  const sidebar=document.getElementById('sidebar');
  sidebar.classList.toggle('collapsed');
  document.getElementById('sidebar-toggle').setAttribute('aria-expanded',!sidebar.classList.contains('collapsed'));
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
  if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT'||e.target.tagName==='TEXTAREA')return;
  const key=e.key.toLowerCase();
  if(key==='1'||key==='2'||key==='3'){
    const i=parseInt(key)-1;
    const cb=document.querySelector(`[data-cat="${i}"]`);
    cb.checked=!cb.checked;applyFilters();
  }
  else if(key==='m')setView('markers');
  else if(key==='h')setView('heatmap');
  else if(key==='x')setView('hexbin');
  else if(key==='c')setView('correlation');
  else if(key==='/'){e.preventDefault();document.getElementById('search-box').focus()}
  else if(key==='s'){document.getElementById('sidebar').classList.toggle('collapsed')}
  else if(key==='escape'){
    document.getElementById('search-box').blur();
    brushRange=null;applyFilters();
  }
});

/* ========== DATA LOADING ========== */
async function init(){
  loadState();
  setProgress(5,'Fetching sighting data...');

  // Load sightings + overlay data in parallel
  let json;
  try{
    const [sightResp,popResp,milResp]=await Promise.allSettled([
      fetch('data/sightings_map_data.json').then(r=>r.json()),
      fetch('data/us_population_density.json').then(r=>r.json()),
      fetch('data/military_bases.json').then(r=>r.json())
    ]);
    if(sightResp.status==='rejected'){
      setProgress(0,'Error loading data: '+sightResp.reason);
      return;
    }
    json=sightResp.value;
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
    return;
  }

  allData=json.data;
  if(!Array.isArray(allData)||!allData.length){
    setProgress(0,'Invalid or empty data');
    return;
  }
  // Filter out records with invalid coordinates or category
  allData=allData.filter(r=>
    Array.isArray(r)&&r.length>=7&&
    typeof r[F.LAT]==='number'&&!isNaN(r[F.LAT])&&
    typeof r[F.LON]==='number'&&!isNaN(r[F.LON])&&
    r[F.CAT]>=0&&r[F.CAT]<3
  );
  if(!allData.length){
    setProgress(0,'No valid records found in data');
    return;
  }
  setProgress(40,`Processing ${allData.length.toLocaleString()} records...`);

  // Sort into categories
  await new Promise(resolve=>{
    let idx=0;
    const batch=30000;
    function process(){
      const end=Math.min(idx+batch,allData.length);
      for(;idx<end;idx++){
        const r=allData[idx];
        catArrays[r[F.CAT]].push(r);
      }
      if(idx<allData.length){
        setProgress(40+Math.round(idx/allData.length*30),
          `Indexing ${idx.toLocaleString()} of ${allData.length.toLocaleString()}...`);
        requestAnimationFrame(process);
      } else resolve();
    }
    requestAnimationFrame(process);
  });

  document.getElementById('stat-total').textContent=allData.length.toLocaleString();
  document.getElementById('stat-zoom').textContent=map.getZoom();

  // Enable/disable per-capita toggle based on data availability
  const pcToggle=document.getElementById('percapita-toggle');
  if(pcToggle&&!popDensityGrid)pcToggle.disabled=true;
  // Enable/disable military toggle based on data availability
  const milToggle=document.getElementById('military-toggle');
  if(milToggle&&!militaryData)milToggle.disabled=true;

  setProgress(80,'Building map layers...');
  // Set initial view from URL state
  setView(currentView);
  // applyFilters() is called inside setView

  setProgress(90,'Building timeline...');
  buildTimeline();

  setProgress(100,'Systems online');
  setTimeout(()=>{document.getElementById('loading').style.display='none'},500);

  // Save state after full load
  saveState();
}

init();

})();
