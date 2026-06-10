/* ============================================================
   DEEP DIVE — regional dossier generator for STRANGE SIGNALS v2
   Right-click anywhere (or call window.DeepDive.run) to generate
   a full instrumented report on a location: anomaly verdict
   against the population × regional baseline, flap history,
   seasonality, overlay context, confounder ledger, exemplar
   cases. Renders into a WindowManager window; exports HTML.

   XSS note: every user-supplied string is passed through esc()
   before being concatenated into markup.
   ============================================================ */
(function(){
'use strict';

const RADIUS_DEFAULT=50; // km

function esc(s){
  if(s==null)return'';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ---------- analysis ---------- */
function analyze(lat,lon,radiusKm){
  const SS=window.StrangeSignals,SE=window.SignalEngine;
  const byCat=SS.getRecordsInRadius(lat,lon,radiusKm);
  const F=SS.F;
  const catO=byCat.map(a=>a.length);
  const O=catO[0]+catO[1]+catO[2];

  // expected counts: population share of CONUS, then regional calibration
  // from the surrounding annulus (radius..4x radius)
  const nat=SS.getNationalBaseline();
  let E_pop=NaN,E_adj=NaN,RRpop=NaN,RRreg=NaN,p=1,pLow=1,catStats=null,calib=1,modeled=false;
  if(nat&&nat.totalPop>0&&nat.total>0){
    const discPop=SS.getPopMassInRadius(lat,lon,radiusKm);
    if(discPop>0){
      modeled=true;
      const share=discPop/nat.totalPop;
      E_pop=nat.total*share;
      // annulus reporting rate vs national rate
      const outerCat=SS.getRecordsInRadius(lat,lon,radiusKm*4);
      const outerO=outerCat[0].length+outerCat[1].length+outerCat[2].length;
      const annO=Math.max(0,outerO-O);
      const annPop=SS.getPopMassInRadius(lat,lon,radiusKm*4)-discPop;
      if(annPop>0&&annO>=20){
        calib=Math.min(4,Math.max(0.25,(annO/annPop)/(nat.total/nat.totalPop)));
      }
      E_adj=E_pop*calib;
      RRpop=E_pop>0?O/E_pop:NaN;
      RRreg=E_adj>0?O/E_adj:NaN;
      p=SE.poissonTailP(O,E_adj);
      pLow=SE.poissonLowerTailP(O,E_adj);
      catStats=catO.map((o,c)=>{
        const eAdj=nat.catTotals[c]*share*calib;
        return{cat:c,O:o,E:eAdj,RR:eAdj>0?o/eAdj:NaN,
          p:SE.poissonTailP(o,eAdj)};
      });
    }
  }

  let verdict,verdictClass;
  if(!modeled){verdict='NO BASELINE MODEL (outside census grid)';verdictClass='dim'}
  else if(p<0.001&&RRreg>=1.5){verdict='SIGNIFICANT LOCAL EXCESS';verdictClass='hot'}
  else if(p<0.05&&RRreg>=1.2){verdict='ELEVATED';verdictClass='warm'}
  else if(pLow<0.01&&RRreg<=0.67){verdict='SIGNIFICANTLY QUIET';verdictClass='cold'}
  else{verdict='WITHIN EXPECTED RANGE';verdictClass='dim'}

  // yearly series + flap detection (disc monthly vs national trend)
  const natMonthly=SS.getMonthlyNationalSeries();
  let natTotal=0;Object.values(natMonthly).forEach(v=>natTotal+=v);
  const discMonthly={},yearly={};
  const all=[];
  byCat.forEach((arr,c)=>arr.forEach(r=>{
    all.push(r);
    const d=r[F.DATE];
    if(!d||d.length<4)return;
    const y=+d.substring(0,4);
    if(y>=1900&&y<=2030){
      if(!yearly[y])yearly[y]=[0,0,0];
      yearly[y][c]++;
    }
    if(d.length>=7){const ym=d.substring(0,7);discMonthly[ym]=(discMonthly[ym]||0)+1}
  }));
  const discShare=natTotal>0?O/natTotal:0;
  const flapMonths=[];
  Object.keys(discMonthly).sort().forEach(ym=>{
    const o=discMonthly[ym];
    if(o<3||!natMonthly[ym])return;
    const lambda=natMonthly[ym]*discShare;
    const fp=SE.poissonTailP(o,lambda);
    if(fp<0.001)flapMonths.push({ym,obs:o,exp:lambda,p:fp});
  });
  // merge consecutive flap months (allow 1-month gap)
  const mi=ym=>+ym.substring(0,4)*12+(+ym.substring(5,7)-1);
  const flaps=[];
  let cur=null;
  flapMonths.forEach(m=>{
    if(cur&&mi(m.ym)-mi(cur.end)<=2){cur.end=m.ym;cur.obs+=m.obs;cur.exp+=m.exp;cur.minP=Math.min(cur.minP,m.p)}
    else{if(cur)flaps.push(cur);cur={start:m.ym,end:m.ym,obs:m.obs,exp:m.exp,minP:m.p}}
  });
  if(cur)flaps.push(cur);
  flaps.sort((a,b)=>(b.obs-b.exp)-(a.obs-a.exp));

  // seasonality: disc month-of-year vs national month-of-year share
  const discMo=new Array(12).fill(0),natMo=new Array(12).fill(0);
  const moIdx=ym=>{const m=+ym.substring(5,7);return m>=1&&m<=12?m-1:null};
  Object.keys(discMonthly).forEach(ym=>{const m=moIdx(ym);if(m!=null)discMo[m]+=discMonthly[ym]});
  Object.keys(natMonthly).forEach(ym=>{const m=moIdx(ym);if(m!=null)natMo[m]+=natMonthly[ym]});
  const natMoTotal=natMo.reduce((s,v)=>s+v,0)||1;
  const seasonal=discMo.map((v,m)=>{
    const expected=O*(natMo[m]/natMoTotal);
    return{month:m,obs:v,exp:expected,ratio:expected>0?v/expected:NaN};
  });

  // top subcategories + locations + exemplar cases
  const subFreq={},locFreq={};
  all.forEach(r=>{
    if(r[F.SUB])subFreq[r[F.SUB]]=(subFreq[r[F.SUB]]||0)+1;
    if(r[F.LOC])locFreq[r[F.LOC]]=(locFreq[r[F.LOC]]||0)+1;
  });
  const topSubs=Object.entries(subFreq).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const topLocs=Object.entries(locFreq).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const label=topLocs.length?topLocs[0][0]:lat.toFixed(2)+', '+lon.toFixed(2);
  const exemplars=[...all].filter(r=>r[F.DESC]&&r[F.DESC].length>80)
    .sort((a,b)=>b[F.DESC].length-a[F.DESC].length).slice(0,12);
  // prefer category diversity among exemplars
  const picked=[];const seenCats=new Set();
  exemplars.forEach(r=>{if(picked.length<4&&(!seenCats.has(r[F.CAT])||picked.length>=3-seenCats.size)){picked.push(r);seenCats.add(r[F.CAT])}});
  while(picked.length<Math.min(4,exemplars.length)){const r=exemplars.find(x=>!picked.includes(x));if(!r)break;picked.push(r)}

  // geocode quality guard
  const coordFreq={};let maxDup=0;
  all.forEach(r=>{const k=r[F.LAT].toFixed(3)+','+r[F.LON].toFixed(3);coordFreq[k]=(coordFreq[k]||0)+1;if(coordFreq[k]>maxDup)maxDup=coordFreq[k]});

  // matched-control comparison: how does this place compare to other US
  // locations with the SAME population in the same radius? Controls are
  // lattice sites whose disc population mass matches the target (±30%,
  // widening if needed), at least 3 radii away. Rates are per-capita to
  // cancel residual population differences.
  let controls=null;
  if(modeled&&nat){
    const targetPop=SS.getPopMassInRadius(lat,lon,radiusKm);
    const g=SS.getPopDensityGrid();
    const sites=[];
    const stepDeg=0.75;
    for(let sLat=g.lat_min+0.5;sLat<g.lat_max-0.5;sLat+=stepDeg){
      for(let sLon=g.lon_min+0.5;sLon<g.lon_max-0.5;sLon+=stepDeg){
        const dKm=Math.sqrt(Math.pow((sLat-lat)*111,2)+Math.pow((sLon-lon)*111*Math.cos(lat*Math.PI/180),2));
        if(dKm<radiusKm*3)continue; // don't let the target overlap its own controls
        sites.push([sLat,sLon]);
      }
    }
    // score every site by how closely its population matches (log ratio),
    // keep the best 30 within a 2.5x band — symmetric in both directions,
    // so a metro only matches other metros and a hamlet other hamlets
    const scored=[];
    for(const[sLat,sLon]of sites){
      const m=SS.getPopMassInRadius(sLat,sLon,radiusKm);
      if(m<=0)continue;
      const d=Math.abs(Math.log(m/targetPop));
      if(d<=Math.log(2.5))scored.push([sLat,sLon,m,d]);
    }
    scored.sort((x,y)=>x[3]-y[3]);
    const matched=scored.slice(0,30);
    if(matched.length>=8){
      const rates=matched.map(([sLat,sLon,m])=>{
        const rc=SS.getRecordsInRadius(sLat,sLon,radiusKm);
        const o=rc[0].length+rc[1].length+rc[2].length;
        return{lat:sLat,lon:sLon,pop:m,obs:o,rate:o/m};
      });
      const targetRate=targetPop>0?O/targetPop:NaN;
      const below=rates.filter(r=>r.rate<targetRate).length;
      const sortedObs=rates.map(r=>r.obs).sort((a,b)=>a-b);
      controls={
        n:rates.length,
        percentile:Math.round(100*below/rates.length),
        medianObs:sortedObs[Math.floor(sortedObs.length/2)],
        maxObs:sortedObs[sortedObs.length-1],
        targetObs:O,
        targetRate,
        rates
      };
    }
  }

  return{lat,lon,radiusKm,label,O,catO,E_pop,E_adj,RRpop,RRreg,p,pLow,calib,modeled,
    verdict,verdictClass,catStats,yearly,flaps,seasonal,topSubs,topLocs,controls,
    exemplars:picked,dupShare:O>0?maxDup/O:0,
    filters:SS.getStats?SS.getStats().filters:{}};
}

/* ---------- charts (d3, inline SVG) ---------- */
function yearlyChart(container,yearly,flaps){
  const years=Object.keys(yearly).map(Number).sort((a,b)=>a-b);
  if(years.length<2)return;
  const W=container.clientWidth||600,H=120,m={t:8,r:8,b:18,l:34};
  const svg=d3.select(container).append('svg').attr('width','100%').attr('height',H).attr('viewBox','0 0 '+W+' '+H);
  const x=d3.scaleBand().domain(d3.range(years[0],years[years.length-1]+1)).range([m.l,W-m.r]).padding(0.15);
  const totals={};years.forEach(y=>{totals[y]=yearly[y][0]+yearly[y][1]+yearly[y][2]});
  const yMax=d3.max(Object.values(totals))||1;
  const y=d3.scaleLinear().domain([0,yMax]).range([H-m.b,m.t]);
  const flapYears=new Set();
  flaps.forEach(f=>{for(let yy=+f.start.substring(0,4);yy<=+f.end.substring(0,4);yy++)flapYears.add(yy)});
  Object.keys(totals).forEach(yy=>{
    yy=+yy;
    svg.append('rect').attr('x',x(yy)).attr('y',y(totals[yy]))
      .attr('width',Math.max(1,x.bandwidth())).attr('height',H-m.b-y(totals[yy]))
      .attr('fill',flapYears.has(yy)?'#ffcc00':'#00ff88').attr('opacity',flapYears.has(yy)?0.95:0.65);
  });
  const ticks=x.domain().filter(v=>v%10===0);
  svg.append('g').attr('transform','translate(0,'+(H-m.b)+')')
    .call(d3.axisBottom(x).tickValues(ticks).tickSize(2))
    .call(g=>{g.selectAll('text').attr('fill','#556').attr('font-size',8);g.selectAll('line,path').attr('stroke','#223')});
  svg.append('g').attr('transform','translate('+m.l+',0)')
    .call(d3.axisLeft(y).ticks(3).tickSize(2))
    .call(g=>{g.selectAll('text').attr('fill','#556').attr('font-size',8);g.selectAll('line,path').attr('stroke','#223')});
}

function seasonalChart(container,seasonal){
  const W=container.clientWidth||600,H=86,m={t:6,r:8,b:16,l:34};
  const names=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const svg=d3.select(container).append('svg').attr('width','100%').attr('height',H).attr('viewBox','0 0 '+W+' '+H);
  const x=d3.scaleBand().domain(d3.range(12)).range([m.l,W-m.r]).padding(0.2);
  const yMax=d3.max(seasonal,s=>Math.max(s.obs,s.exp))||1;
  const y=d3.scaleLinear().domain([0,yMax]).range([H-m.b,m.t]);
  seasonal.forEach(s=>{
    const over=!isNaN(s.ratio)&&s.ratio>1.25&&s.obs>=5;
    svg.append('rect').attr('x',x(s.month)).attr('y',y(s.obs))
      .attr('width',x.bandwidth()).attr('height',H-m.b-y(s.obs))
      .attr('fill',over?'#ffcc00':'#00ff88').attr('opacity',over?0.95:0.55);
    // expected tick from the national month-of-year pattern
    svg.append('line').attr('x1',x(s.month)-1).attr('x2',x(s.month)+x.bandwidth()+1)
      .attr('y1',y(s.exp)).attr('y2',y(s.exp)).attr('stroke','#00d4ff').attr('stroke-width',1).attr('opacity',0.8);
  });
  svg.append('g').attr('transform','translate(0,'+(H-m.b)+')')
    .call(d3.axisBottom(x).tickFormat(i=>names[i]).tickSize(0))
    .call(g=>{g.selectAll('text').attr('fill','#556').attr('font-size',7);g.selectAll('path').attr('stroke','#223')});
}

/* strip plot: control locations as dim dots on a log scale, target as a
   labeled green marker — "is this place actually unusual for its size?" */
function controlsChart(container,c){
  const W=container.clientWidth||600,H=64,m={l:34,r:14};
  const svg=d3.select(container).append('svg').attr('width','100%').attr('height',H).attr('viewBox','0 0 '+W+' '+H);
  const maxV=Math.max(c.targetObs,c.maxObs,10);
  const x=d3.scaleLog().domain([1,maxV*1.3]).range([m.l,W-m.r]).clamp(true);
  const cy=H/2-6;
  svg.append('line').attr('x1',m.l).attr('x2',W-m.r).attr('y1',cy).attr('y2',cy)
    .attr('stroke','#223').attr('stroke-width',1);
  c.rates.forEach(r=>{
    svg.append('circle').attr('cx',x(Math.max(1,r.obs))).attr('cy',cy)
      .attr('r',3.5).attr('fill','#3a4a66').attr('opacity',0.8);
  });
  const tx=x(Math.max(1,c.targetObs));
  svg.append('line').attr('x1',tx).attr('x2',tx).attr('y1',cy-13).attr('y2',cy+13)
    .attr('stroke','#00ff88').attr('stroke-width',2);
  svg.append('text').attr('x',tx).attr('y',cy-18).attr('text-anchor','middle')
    .attr('fill','#00ff88').attr('font-size',8).attr('font-family','Orbitron,monospace')
    .text('THIS AREA');
  svg.append('text').attr('x',m.l).attr('y',H-4).attr('fill','#556').attr('font-size',7)
    .text('reports per matched location (log scale)');
}

/* ---------- dossier rendering ---------- */
let dossierCount=0;
let circleLayer=null;

async function run(opts){
  const SS=window.StrangeSignals;
  const lat=opts.lat,lon=opts.lon;
  const radiusKm=opts.radiusKm||RADIUS_DEFAULT;
  await SS.ensureOverlaysLoaded(['airspace','caves','fireballs','cryptids','missing411','earthquakes','airports']);
  const a=analyze(lat,lon,radiusKm);
  const label=opts.label||a.label;
  const ctx=SS.getNearbyOverlays(lat,lon,radiusKm);
  // earthquakes within radius (not covered by getNearbyOverlays)
  const ov=SS.getOverlayData();
  let quakeCount=0,quakeMax=0;
  if(ov.earthquakes&&ov.earthquakes.data){
    const cosLat=Math.cos(lat*Math.PI/180);
    ov.earthquakes.data.forEach(e=>{
      const d=Math.sqrt(Math.pow((e[0]-lat)*111,2)+Math.pow((e[1]-lon)*111*cosLat,2));
      if(d<=radiusKm){quakeCount++;if(e[3]>quakeMax)quakeMax=e[3]}
    });
  }

  // draw the survey circle on the map
  const map=SS.getMap();
  if(circleLayer){map.removeLayer(circleLayer);circleLayer=null}
  circleLayer=L.circle([lat,lon],{radius:radiusKm*1000,color:'#00ff88',weight:1.5,
    dashArray:'8 5',fillColor:'rgba(0,255,136,0.04)',fillOpacity:0.35,className:'dossier-circle'}).addTo(map);

  const body=buildDossierDOM(a,label,ctx,{quakeCount,quakeMax});
  dossierCount++;
  const win=WindowManager.create({
    id:'dossier-'+dossierCount,
    title:'<span class="icon">&#9678;</span> DOSSIER — '+esc(label).toUpperCase(),
    content:body,
    defaultPos:{right:48,top:64},
    defaultSize:{width:700,height:640},
    minSize:{width:480,height:360},
    onClose:()=>{if(circleLayer){map.removeLayer(circleLayer);circleLayer=null}}
  });
  win.show();

  // charts after insertion (need layout)
  setTimeout(()=>{
    const yc=body.querySelector('.dossier-yearly');
    if(yc)yearlyChart(yc,a.yearly,a.flaps);
    const sc=body.querySelector('.dossier-seasonal');
    if(sc)seasonalChart(sc,a.seasonal);
    const cc=body.querySelector('.dossier-controls');
    if(cc&&a.controls)controlsChart(cc,a.controls);
  },60);

  // return a machine-readable summary (for the AI assistant)
  return{
    label,lat,lon,radius_km:radiusKm,verdict:a.verdict,
    observed:a.O,expected_population:isNaN(a.E_pop)?null:+a.E_pop.toFixed(1),
    expected_regional:isNaN(a.E_adj)?null:+a.E_adj.toFixed(1),
    rate_ratio_population:isNaN(a.RRpop)?null:+a.RRpop.toFixed(2),
    rate_ratio_regional:isNaN(a.RRreg)?null:+a.RRreg.toFixed(2),
    p_value:+a.p.toPrecision(2),
    categories:a.catStats?a.catStats.map(c=>({name:SS.CAT_NAMES[c.cat],observed:c.O,
      expected:+c.E.toFixed(1),rate_ratio:isNaN(c.RR)?null:+c.RR.toFixed(2),p:+c.p.toPrecision(2)})):null,
    flaps:a.flaps.slice(0,6).map(f=>({start:f.start,end:f.end,observed:f.obs,expected:+f.exp.toFixed(1)})),
    matched_controls:a.controls?{n:a.controls.n,percentile:a.controls.percentile,
      median_control_reports:a.controls.medianObs,this_location_reports:a.controls.targetObs}:null,
    top_subcategories:a.topSubs.slice(0,6).map(s=>({name:s[0],count:s[1]})),
    overlay_context:ctx,
    earthquakes:{count:quakeCount,max_magnitude:quakeMax},
    geocode_duplicate_share:+a.dupShare.toFixed(2),
    window_id:'dossier-'+dossierCount
  };
}

function buildDossierDOM(a,label,ctx,extra){
  const SS=window.StrangeSignals;
  const CAT_NAMES=SS.CAT_NAMES,CAT_COLORS=SS.CAT_COLORS;
  const body=document.createElement('div');
  body.className='dossier';

  const fmt=(v,d)=>v==null||isNaN(v)?'—':(+v).toFixed(d==null?1:d);
  const parts=[];

  // header strip
  parts.push(`<div class="dossier-head">
    <div class="dossier-coords">${a.lat.toFixed(3)}&deg;, ${a.lon.toFixed(3)}&deg; &middot; r=${a.radiusKm} km${a.filters&&(a.filters.yearFrom||a.filters.yearTo)?' &middot; filtered '+esc(a.filters.yearFrom||'')+'&ndash;'+esc(a.filters.yearTo||''):''}</div>
  </div>`);

  // verdict instrument
  const vColor=a.verdictClass==='hot'?'var(--green,#00ff88)':a.verdictClass==='warm'?'#ffcc00':a.verdictClass==='cold'?'#6ca6dd':'#667';
  parts.push(`<div class="dossier-verdict" style="border-color:${vColor}">
    <div class="dossier-verdict-label" style="color:${vColor}">${a.verdict}</div>
    <div class="dossier-verdict-grid">
      <div><span class="dv-num">${a.O.toLocaleString()}</span><span class="dv-lbl">OBSERVED</span></div>
      <div><span class="dv-num">${fmt(a.E_adj)}</span><span class="dv-lbl">EXPECTED</span></div>
      <div><span class="dv-num">${fmt(a.RRreg,2)}&times;</span><span class="dv-lbl">VS REGION</span></div>
      <div><span class="dv-num">${fmt(a.RRpop,2)}&times;</span><span class="dv-lbl">VS POPULATION</span></div>
      <div><span class="dv-num">${a.p<0.001?'&lt;0.001':fmt(a.p,3)}</span><span class="dv-lbl">P-VALUE</span></div>
    </div>
  </div>`);

  // category composition with per-category rate ratios
  parts.push('<div class="dossier-section">COMPOSITION VS BASELINE</div>');
  if(a.catStats){
    parts.push('<div class="dossier-cats">');
    a.catStats.forEach(c=>{
      if(c.O===0&&c.E<1)return;
      const sig=c.p<0.01&&c.RR>=1.5;
      parts.push(`<div class="dossier-cat-row">
        <span class="dc-name" style="color:${CAT_COLORS[c.cat]}">${CAT_NAMES[c.cat].split('/')[0]}</span>
        <span class="dc-obs">${c.O.toLocaleString()} obs</span>
        <span class="dc-exp">vs ${fmt(c.E)} expected</span>
        <span class="dc-rr" style="color:${sig?'var(--green,#00ff88)':'#667'}">${fmt(c.RR,2)}&times;${sig?' &#9650;':''}</span>
      </div>`);
    });
    parts.push('</div>');
  } else {
    parts.push('<div class="dossier-note">No census baseline at this location — raw counts only.</div>');
  }

  // activity timeline
  parts.push('<div class="dossier-section">ACTIVITY TIMELINE <span class="dossier-section-note">amber = flap episode</span></div>');
  parts.push('<div class="dossier-yearly dossier-chart"></div>');
  if(a.flaps.length){
    parts.push('<div class="dossier-flaps">');
    a.flaps.slice(0,5).forEach(f=>{
      parts.push(`<div class="dossier-flap-row"><span class="df-period">${esc(f.start)}${f.end!==f.start?' &rarr; '+esc(f.end):''}</span>
        <span class="df-stat">${f.obs} reports vs ${f.exp.toFixed(1)} expected</span>
        <span class="df-x">${(f.obs/Math.max(f.exp,0.1)).toFixed(1)}&times;</span></div>`);
    });
    parts.push('</div>');
  } else {
    parts.push('<div class="dossier-note">No statistically significant flap episodes detected.</div>');
  }

  // seasonality
  parts.push('<div class="dossier-section">SEASONALITY <span class="dossier-section-note">cyan tick = national-pattern expectation</span></div>');
  parts.push('<div class="dossier-seasonal dossier-chart"></div>');

  // matched-control comparison
  if(a.controls){
    const c=a.controls;
    const pctColor=c.percentile>=90?'var(--green,#00ff88)':c.percentile>=70?'#ffcc00':'#889';
    parts.push(`<div class="dossier-section">MATCHED CONTROLS <span class="dossier-section-note">${c.n} same-population US locations</span></div>`);
    parts.push(`<div class="dossier-controls-verdict">More activity than <b style="color:${pctColor}">${c.percentile}%</b> of population-matched locations &middot; median control: ${c.medianObs.toLocaleString()} reports &middot; here: <b>${c.targetObs.toLocaleString()}</b></div>`);
    parts.push('<div class="dossier-controls dossier-chart"></div>');
  }

  // overlay context
  parts.push('<div class="dossier-section">PROXIMITY CONTEXT</div>');
  const ctxRows=[];
  if(ctx.military)ctx.military.slice(0,3).forEach(m=>ctxRows.push(['MILITARY',esc(m.name)+' ('+esc(m.branch)+')',m.dist+' km']));
  if(ctx.airports)ctx.airports.slice(0,3).forEach(a=>ctxRows.push(['AIRPORT',esc(a.name)+(a.iata?' ('+esc(a.iata)+')':'')+' — '+(a.type==='large'?'large hub':'regional'),a.dist+' km']));
  if(ctx.airspace)ctx.airspace.slice(0,3).forEach(x=>ctxRows.push(['AIRSPACE',esc(x.name)+' — '+esc(x.type),x.dist+' km']));
  if(ctx.caves)ctx.caves.slice(0,3).forEach(c=>ctxRows.push(['CAVES',esc(c.name),c.dist+' km']));
  if(ctx.missing411)ctx.missing411.slice(0,3).forEach(m=>ctxRows.push(['MISSING 411',esc(m.name)+' — '+esc(m.park||m.state||''),m.dist+' km']));
  if(ctx.cryptids)ctx.cryptids.slice(0,3).forEach(c=>ctxRows.push(['CRYPTID',esc(c.name)+' ('+esc(c.type)+')',c.dist+' km']));
  if(ctx.fireballs)ctx.fireballs.slice(0,2).forEach(f=>ctxRows.push(['FIREBALL',esc(f.date)+' — '+esc(f.energy)+' kt',f.dist+' km']));
  if(extra.quakeCount)ctxRows.push(['SEISMIC',extra.quakeCount+' quakes M2.5+ (2019-25), max M'+extra.quakeMax.toFixed(1),'in radius']);
  if(ctxRows.length){
    parts.push('<div class="dossier-ctx">');
    ctxRows.forEach(r=>parts.push(`<div class="dossier-ctx-row"><span class="dx-kind">${r[0]}</span><span class="dx-name">${r[1]}</span><span class="dx-dist">${r[2]}</span></div>`));
    parts.push('</div>');
  } else {
    parts.push('<div class="dossier-note">No overlay features within radius.</div>');
  }

  // confounder ledger
  const ledger=[];
  if(ctx.airports&&ctx.airports.length){
    const nearest=ctx.airports[0];
    ledger.push((nearest.type==='large'?'Major hub airport':'Airport')+' within '+nearest.dist+' km — aircraft landing lights, holding patterns and approach corridors are the most common source of misidentified UAP reports.');
  }
  if(ctx.military&&ctx.military.length)ledger.push('Military installation within radius — aviation activity is a plausible mundane source for UAP reports.');
  if(ctx.airspace&&ctx.airspace.length)ledger.push('Special-use airspace overlaps the area — training flights, flares and drones inflate report rates.');
  if(a.dupShare>0.5)ledger.push(Math.round(a.dupShare*100)+'% of records share one exact coordinate — coarse geocoding may be concentrating a wider area\'s reports here.');
  if(extra.quakeCount>50)ledger.push('Seismically active area — earthquake lights and tremor-triggered attention are documented report drivers.');
  if(ledger.length){
    parts.push('<div class="dossier-section">CONFOUNDER LEDGER</div><div class="dossier-ledger">');
    ledger.forEach(l=>parts.push('<div class="dossier-ledger-row">'+l+'</div>'));
    parts.push('</div>');
  }

  // exemplar cases
  if(a.exemplars.length){
    parts.push('<div class="dossier-section">EXEMPLAR CASES</div><div class="dossier-cases">');
    const F=SS.F;
    a.exemplars.forEach(r=>{
      parts.push(`<div class="dossier-case">
        <div class="dossier-case-head"><span style="color:${CAT_COLORS[r[F.CAT]]}">${CAT_NAMES[r[F.CAT]]}</span>
        <span>${esc(r[F.DATE]||'')}</span><span>${esc(r[F.LOC]||'')}</span></div>
        <div class="dossier-case-desc">${esc((r[F.DESC]||'').substring(0,420))}${(r[F.DESC]||'').length>420?'&hellip;':''}</div>
      </div>`);
    });
    parts.push('</div>');
  }

  // markup is fully esc()-sanitized above
  body.insertAdjacentHTML('beforeend',parts.join(''));

  // footer buttons (DOM-built so listeners attach cleanly)
  const btnRow=document.createElement('div');
  btnRow.className='dossier-btns';
  const zoomBtn=document.createElement('button');
  zoomBtn.className='dossier-btn';
  zoomBtn.textContent='ZOOM TO AREA';
  zoomBtn.addEventListener('click',()=>{SS.getMap().flyTo([a.lat,a.lon],9,{duration:1.2})});
  const dlBtn=document.createElement('button');
  dlBtn.className='dossier-btn';
  dlBtn.textContent='EXPORT HTML';
  dlBtn.addEventListener('click',()=>exportDossier(label,body));
  btnRow.appendChild(zoomBtn);btnRow.appendChild(dlBtn);
  body.appendChild(btnRow);
  return body;
}

function exportDossier(label,bodyEl){
  const clone=bodyEl.cloneNode(true);
  clone.querySelectorAll('button').forEach(b=>b.remove());
  const css=`body{background:#05060f;color:#cfd6e4;font-family:"Space Mono","Courier New",monospace;font-size:12px;line-height:1.6;max-width:860px;margin:0 auto;padding:28px}
.dossier-head{margin-bottom:14px}.dossier-coords{font-size:10px;color:#667;letter-spacing:1px}
.dossier-verdict{border:1px solid #0f8;border-radius:6px;padding:14px;margin-bottom:10px}
.dossier-verdict-label{font-size:15px;letter-spacing:3px;font-weight:700;margin-bottom:10px}
.dossier-verdict-grid{display:flex;gap:22px;flex-wrap:wrap}
.dossier-verdict-grid>div{display:flex;flex-direction:column}
.dv-num{font-size:18px;font-weight:700;color:#e8eef8}.dv-lbl{font-size:8px;color:#667;letter-spacing:1.5px}
.dossier-section{font-size:9px;letter-spacing:2px;color:#00d4ff;margin:18px 0 8px;border-bottom:1px solid #1a2236;padding-bottom:3px}
.dossier-section-note{color:#556;letter-spacing:0.5px;float:right}
.dossier-cat-row,.dossier-ctx-row,.dossier-flap-row{display:flex;gap:12px;padding:3px 0;font-size:11px}
.dc-name{width:90px}.dc-rr{margin-left:auto}.dx-kind{width:90px;color:#667;font-size:9px;letter-spacing:1px}.dx-dist{margin-left:auto;color:#667}
.df-period{width:170px}.df-x{margin-left:auto;color:#ffcc00}
.dossier-ledger-row{font-size:10px;color:#cfa93f;padding:3px 0}
.dossier-case{border:1px solid #1a2236;border-radius:4px;padding:10px;margin-bottom:8px}
.dossier-case-head{display:flex;gap:14px;font-size:9px;margin-bottom:5px;color:#889}
.dossier-case-desc{font-size:10px;color:#aab;line-height:1.6}
.dossier-note{font-size:10px;color:#556}
svg{background:transparent}svg text{font-family:"Space Mono",monospace}`;
  const html='<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    +'<title>DOSSIER — '+esc(label)+'</title><style>'+css+'</style></head><body>'
    +'<h2 style="font-size:16px;color:#00ff88;letter-spacing:3px;margin:0">DOSSIER — '+esc(label).toUpperCase()+'</h2>'
    +'<div style="font-size:9px;color:#556;letter-spacing:1px;margin-bottom:16px">STRANGE SIGNALS // SIGNAL ENGINE — '+new Date().toLocaleString()+'</div>'
    +clone.innerHTML+'</body></html>';
  const blob=new Blob([html],{type:'text/html'});
  const url=URL.createObjectURL(blob);
  const aEl=document.createElement('a');
  aEl.href=url;
  aEl.download='dossier-'+label.replace(/[^a-zA-Z0-9 ]/g,'').replace(/ +/g,'-').toLowerCase()+'.html';
  aEl.click();
  URL.revokeObjectURL(url);
}

/* ---------- geocoded entry ---------- */
async function runForPlace(query,radiusKm){
  const resp=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q='+encodeURIComponent(query));
  const results=await resp.json();
  if(!results.length)throw new Error('Place not found: '+query);
  const r=results[0];
  return run({lat:+r.lat,lon:+r.lon,radiusKm:radiusKm||RADIUS_DEFAULT,label:query});
}

/* ---------- map entry point: right-click ---------- */
function wireContextMenu(){
  const SS=window.StrangeSignals;
  if(!SS||!SS.getMap)return;
  const map=SS.getMap();
  map.on('contextmenu',e=>{
    const c=document.createElement('div');
    c.className='dossier-ctxmenu';
    const btn=document.createElement('button');
    btn.className='dossier-btn';
    btn.textContent='RUN DEEP DIVE HERE';
    const sub=document.createElement('div');
    sub.className='dossier-ctxmenu-sub';
    sub.textContent=e.latlng.lat.toFixed(3)+', '+e.latlng.lng.toFixed(3)+' · 50 km survey';
    c.appendChild(btn);c.appendChild(sub);
    const popup=L.popup({closeButton:false,className:'dossier-popup'})
      .setLatLng(e.latlng).setContent(c).openOn(map);
    btn.addEventListener('click',()=>{
      map.closePopup(popup);
      run({lat:e.latlng.lat,lon:e.latlng.lng});
    });
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wireContextMenu);
else wireContextMenu();

window.DeepDive={run,runForPlace,analyze};

})();
