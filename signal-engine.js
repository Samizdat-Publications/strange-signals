/* ============================================================
   SIGNAL ENGINE — statistical core for STRANGE SIGNALS v2
   Pure math, no DOM, no Leaflet/Turf dependencies.
   Exposed as window.SignalEngine.

   The central idea: the null hypothesis is "sightings are just
   people looking up." Expected counts per hex come from census
   population mass; everything is measured as departure from
   that baseline, with honest multiple-comparison control.
   ============================================================ */
(function(){
'use strict';

/* ---------- log-gamma (Lanczos approximation) ---------- */
const LANCZOS=[676.5203681218851,-1259.1392167224028,771.32342877765313,
  -176.61502916214059,12.507343278686905,-0.13857109526572012,
  9.9843695780195716e-6,1.5056327351493116e-7];
function lgamma(x){
  if(x<0.5)return Math.log(Math.PI/Math.sin(Math.PI*x))-lgamma(1-x);
  x-=1;
  let a=0.99999999999980993;
  const t=x+7.5;
  for(let i=0;i<8;i++)a+=LANCZOS[i]/(x+i+1);
  return 0.5*Math.log(2*Math.PI)+(x+0.5)*Math.log(t)-t+Math.log(a);
}

/* ---------- Poisson upper tail: P(X >= k | lambda) ----------
   Exact log-space summation for small lambda, normal
   approximation with continuity correction for large. */
function poissonTailP(k,lambda){
  if(k<=0)return 1;
  if(lambda<=0)return 0; // any observation where none expected is maximally surprising
  if(lambda<60){
    // P(X >= k) = 1 - P(X <= k-1), summed in log space for stability
    let cum=0;
    for(let i=0;i<k;i++){
      cum+=Math.exp(i*Math.log(lambda)-lambda-lgamma(i+1));
    }
    return Math.max(0,Math.min(1,1-cum));
  }
  // normal approximation with continuity correction
  const z=(k-0.5-lambda)/Math.sqrt(lambda);
  return normalUpperTail(z);
}

/* Lower tail for deficit detection: P(X <= k | lambda) */
function poissonLowerTailP(k,lambda){
  if(lambda<=0)return 1;
  if(lambda<60){
    let cum=0;
    for(let i=0;i<=k;i++){
      cum+=Math.exp(i*Math.log(lambda)-lambda-lgamma(i+1));
    }
    return Math.max(0,Math.min(1,cum));
  }
  const z=(k+0.5-lambda)/Math.sqrt(lambda);
  return 1-normalUpperTail(z);
}

/* Standard normal upper tail via Abramowitz-Stegun 26.2.17 */
function normalUpperTail(z){
  if(z<-8)return 1;
  if(z>8)return 0;
  const t=1/(1+0.2316419*Math.abs(z));
  const d=0.3989422804014327*Math.exp(-z*z/2);
  let p=d*t*(0.319381530+t*(-0.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));
  return z>=0?p:1-p;
}

/* ---------- Benjamini-Hochberg FDR ----------
   Input: array of p-values. Output: array of q-values
   (same order). NaN inputs pass through as NaN. */
function bhFdr(pvals){
  const idx=[];
  for(let i=0;i<pvals.length;i++){
    if(!isNaN(pvals[i]))idx.push(i);
  }
  const m=idx.length;
  if(!m)return pvals.map(()=>NaN);
  idx.sort((a,b)=>pvals[a]-pvals[b]);
  const q=new Array(pvals.length).fill(NaN);
  let prev=1;
  for(let rank=m;rank>=1;rank--){
    const i=idx[rank-1];
    const val=Math.min(prev,pvals[i]*m/rank);
    q[i]=val;
    prev=val;
  }
  return q;
}

/* ---------- Pearson r (standalone copy so engine has no deps) ---------- */
function pearson(x,y){
  const n=x.length;
  if(n<5)return NaN;
  let sx=0,sy=0;
  for(let i=0;i<n;i++){sx+=x[i];sy+=y[i]}
  const mx=sx/n,my=sy/n;
  let num=0,dx2=0,dy2=0;
  for(let i=0;i<n;i++){
    const dx=x[i]-mx,dy=y[i]-my;
    num+=dx*dy;dx2+=dx*dx;dy2+=dy*dy;
  }
  const den=Math.sqrt(dx2*dy2);
  return den>0?num/den:NaN;
}

function permutationP(x,y,observedR,nPerms){
  nPerms=nPerms||999;
  if(x.length<5||isNaN(observedR))return 1;
  let extreme=0;
  const yc=y.slice();
  for(let p=0;p<nPerms;p++){
    for(let i=yc.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [yc[i],yc[j]]=[yc[j],yc[i]];
    }
    const r=pearson(x,yc);
    if(!isNaN(r)&&Math.abs(r)>=Math.abs(observedR))extreme++;
  }
  return(extreme+1)/(nPerms+1);
}

/* ---------- Population-partialed correlation ----------
   Regress x and y each on covariate z (population mass),
   correlate the residuals (Freedman-Lane style permutation p).
   Answers: "do A and B still co-occur once population is
   accounted for?" */
function regressResiduals(x,z){
  const n=x.length;
  let sx=0,sz=0;
  for(let i=0;i<n;i++){sx+=x[i];sz+=z[i]}
  const mx=sx/n,mz=sz/n;
  let num=0,den=0;
  for(let i=0;i<n;i++){
    num+=(z[i]-mz)*(x[i]-mx);
    den+=(z[i]-mz)*(z[i]-mz);
  }
  const beta=den>0?num/den:0;
  const res=new Array(n);
  for(let i=0;i<n;i++)res[i]=x[i]-(mx+beta*(z[i]-mz));
  return res;
}

function partialCorrelation(x,y,z,nPerms){
  if(x.length<5)return{r:NaN,p:1};
  const rx=regressResiduals(x,z);
  const ry=regressResiduals(y,z);
  const r=pearson(rx,ry);
  const p=isNaN(r)?1:permutationP(rx,ry,r,nPerms||999);
  return{r,p};
}

/* ---------- Getis-Ord Gi* ----------
   values: numeric array; adj: array of neighbor index arrays.
   Binary weights including self. Returns z-score per cell;
   NaN where the input is NaN. */
function giStar(values,adj){
  const valid=[];
  for(let i=0;i<values.length;i++)if(!isNaN(values[i]))valid.push(i);
  const n=valid.length;
  const out=new Array(values.length).fill(NaN);
  if(n<8)return out;
  let sum=0,sumSq=0;
  valid.forEach(i=>{sum+=values[i];sumSq+=values[i]*values[i]});
  const mean=sum/n;
  const S=Math.sqrt(Math.max(0,sumSq/n-mean*mean));
  if(S===0)return out;
  valid.forEach(i=>{
    let w=1,local=values[i];
    adj[i].forEach(j=>{
      if(!isNaN(values[j])){w++;local+=values[j]}
    });
    const denom=S*Math.sqrt(Math.max(1e-12,(n*w-w*w)/(n-1)));
    out[i]=(local-mean*w)/denom;
  });
  return out;
}

/* ---------- Anomaly model ----------
   counts:  per-hex [c0,c1,c2] observed sighting counts
   popmass: per-hex relative population mass (>=0; 0/missing = unmodeled)
   adj:     per-hex neighbor index arrays (from hex adjacency)

   Returns per-hex records + summary. Each hex gets:
   O, E, RR, p, q, gi (Gi* z on Pearson residuals),
   coex (categories independently in excess), index 0-100,
   modeled flag, sig flag (q<0.05 & RR>1), deficit flag. */
const INDEX_WEIGHTS={sig:0.5,gi:0.35,coex:0.15};

function computeAnomaly(opts){
  const counts=opts.counts,popmass=opts.popmass,adj=opts.adj;
  const regional=opts.regionalCalibration!==false; // default ON
  const ringDepth=opts.ringDepth||4;
  const n=counts.length;
  const nCats=counts[0]?counts[0].length:3;
  const modeled=[];
  let totalPop=0;
  for(let i=0;i<n;i++){
    if(popmass[i]>0){modeled.push(i);totalPop+=popmass[i]}
  }
  const catTotals=new Array(nCats).fill(0);
  let T=0;
  modeled.forEach(i=>{
    for(let c=0;c<nCats;c++){catTotals[c]+=counts[i][c];T+=counts[i][c]}
  });

  // Stage 1: population-proportional expectation
  const Epop=new Array(n).fill(NaN);
  const Ototal=new Array(n).fill(0);
  for(let i=0;i<n;i++){
    Ototal[i]=counts[i].reduce((s,v)=>s+v,0);
    if(popmass[i]>0&&totalPop>0&&T>0)Epop[i]=T*(popmass[i]/totalPop);
  }

  // Stage 2: regional reporting-rate calibration. Reporting propensity
  // varies regionally (West Coast NUFORC culture etc.) — scale each
  // cell's expectation by its neighborhood's observed/expected ratio
  // (focal cell excluded), so anomalies are LOCAL excesses against the
  // regional baseline, not artifacts of broad reporting culture.
  const calib=new Array(n).fill(1);
  if(regional){
    for(const i of modeled){
      // BFS out to ringDepth, excluding the focal cell
      const seen=new Set([i]);
      let frontier=[i],sumO=0,sumE=0;
      for(let d=0;d<ringDepth;d++){
        const next=[];
        for(const u of frontier){
          for(const v of adj[u]){
            if(seen.has(v))continue;
            seen.add(v);next.push(v);
            if(!isNaN(Epop[v])){sumO+=Ototal[v];sumE+=Epop[v]}
          }
        }
        frontier=next;
        if(!frontier.length)break;
      }
      if(sumE>=20)calib[i]=Math.min(4,Math.max(0.25,sumO/sumE));
    }
  }

  const perHex=new Array(n);
  const pArr=new Array(n).fill(NaN);
  const residArr=new Array(n).fill(NaN);

  for(let i=0;i<n;i++){
    const O=Ototal[i];
    if(isNaN(Epop[i])){
      perHex[i]={O,E:NaN,Epop:NaN,RR:NaN,RRpop:NaN,p:NaN,q:NaN,gi:NaN,coex:0,index:null,modeled:false,sig:false,deficit:false};
      continue;
    }
    const E=Epop[i]*calib[i];
    const RR=E>0?O/E:NaN;
    const RRpop=Epop[i]>0?O/Epop[i]:NaN;
    const p=poissonTailP(O,E);
    pArr[i]=p;
    residArr[i]=(O-E)/Math.sqrt(Math.max(E,0.5));
    // per-category independent excess (co-excess across phenomena),
    // using the same regional calibration factor
    const share=popmass[i]/totalPop;
    let coex=0;
    for(let c=0;c<nCats;c++){
      const Ec=catTotals[c]*share*calib[i];
      if(counts[i][c]>=3&&poissonTailP(counts[i][c],Ec)<0.05)coex++;
    }
    perHex[i]={O,E,Epop:Epop[i],RR,RRpop,p,q:NaN,gi:NaN,coex,index:null,modeled:true,sig:false,deficit:false};
  }

  const qArr=bhFdr(pArr);
  const giArr=giStar(residArr,adj);

  let nSig=0,nDeficit=0,maxIndex=0;
  for(const i of modeled){
    const h=perHex[i];
    h.q=qArr[i];
    h.gi=giArr[i];
    // components, each normalized to [0,1]
    const sigScore=h.q<1?Math.min(1,-Math.log10(Math.max(h.q,1e-12))/6):0;
    const giScore=isNaN(h.gi)?0:Math.min(1,Math.max(0,h.gi)/6);
    const coexScore=h.coex>=2?(h.coex-1)/(Math.max(2,(counts[i].length-1))):0;
    h.components={sig:sigScore,gi:giScore,coex:coexScore};
    h.index=Math.round(100*(INDEX_WEIGHTS.sig*sigScore+INDEX_WEIGHTS.gi*giScore+INDEX_WEIGHTS.coex*coexScore));
    // statistical significance AND practical effect size: with hundreds of
    // thousands of records, q<0.05 alone lights up trivial 5% excesses
    h.sig=h.q<0.05&&h.RR>=1.5;
    if(h.sig){nSig++;if(h.index>maxIndex)maxIndex=h.index}
    // significant deficit: fewer than expected (underreporting or genuinely quiet)
    if(h.RR<1&&h.E>=5){
      h.deficit=poissonLowerTailP(h.O,h.E)<0.01;
      if(h.deficit)nDeficit++;
    }
  }

  return{
    perHex,
    summary:{nHexes:n,nModeled:modeled.length,nSig,nDeficit,maxIndex,total:T,catTotals}
  };
}

/* ---------- Flap detection (space-time bursts) ----------
   records: flat sighting records; F: field index map {LAT,LON,DATE}
   Bins into coarse geographic cells x calendar months; baseline
   per (cell,month) = nationalMonthTotal * cellShare. Months
   exceeding the Poisson-surprise threshold merge into events.

   Returns events sorted by total excess:
   {lat, lon, cellKey, start, end, months, observed, expected,
    excess, peakMonth, peakCount, minP} */
function detectFlaps(opts){
  const records=opts.records,F=opts.F;
  const cellDeg=opts.cellDeg||1.5;
  const minMonthCount=opts.minMonthCount||5;
  const pThresh=opts.pThresh||1e-4;
  const minYear=opts.minYear||1900;
  const maxEvents=opts.maxEvents||100;

  const cellMonth=new Map(); // cellKey -> Map(month -> count)
  const monthTotals=new Map(); // month -> count
  const cellTotals=new Map(); // cellKey -> count
  let T=0;

  for(const r of records){
    const d=r[F.DATE];
    if(!d||d.length<7)continue;
    const y=+d.substring(0,4);
    if(isNaN(y)||y<minYear)continue;
    const ym=d.substring(0,7);
    const key=Math.floor(r[F.LAT]/cellDeg)+','+Math.floor(r[F.LON]/cellDeg);
    let cm=cellMonth.get(key);
    if(!cm){cm=new Map();cellMonth.set(key,cm)}
    cm.set(ym,(cm.get(ym)||0)+1);
    monthTotals.set(ym,(monthTotals.get(ym)||0)+1);
    cellTotals.set(key,(cellTotals.get(key)||0)+1);
    T++;
  }
  if(!T)return[];

  // flag surprising (cell, month) pairs
  const flagged=new Map(); // cellKey -> [{ym, obs, exp, p}]
  cellMonth.forEach((cm,key)=>{
    const share=cellTotals.get(key)/T;
    cm.forEach((obs,ym)=>{
      if(obs<minMonthCount)return;
      const lambda=monthTotals.get(ym)*share;
      const p=poissonTailP(obs,lambda);
      if(p<pThresh){
        let arr=flagged.get(key);
        if(!arr){arr=[];flagged.set(key,arr)}
        arr.push({ym,obs,exp:lambda,p});
      }
    });
  });

  // merge consecutive months per cell into events (allow 1-month gaps)
  function monthIndex(ym){return +ym.substring(0,4)*12+(+ym.substring(5,7)-1)}
  const events=[];
  flagged.forEach((arr,key)=>{
    arr.sort((a,b)=>a.ym.localeCompare(b.ym));
    let cur=null;
    for(const m of arr){
      if(cur&&monthIndex(m.ym)-monthIndex(cur.lastYm)<=2){
        cur.months.push(m);cur.lastYm=m.ym;
      }else{
        if(cur)events.push(cur);
        cur={cellKey:key,months:[m],lastYm:m.ym};
      }
    }
    if(cur)events.push(cur);
  });

  const out=events.map(ev=>{
    const parts=ev.cellKey.split(',').map(Number);
    let observed=0,expected=0,minP=1,peakMonth=null,peakCount=0;
    ev.months.forEach(m=>{
      observed+=m.obs;expected+=m.exp;
      if(m.p<minP)minP=m.p;
      if(m.obs>peakCount){peakCount=m.obs;peakMonth=m.ym}
    });
    return{
      lat:(parts[0]+0.5)*cellDeg,
      lon:(parts[1]+0.5)*cellDeg,
      cellKey:ev.cellKey,
      start:ev.months[0].ym,
      end:ev.months[ev.months.length-1].ym,
      months:ev.months.length,
      observed,
      expected:+expected.toFixed(1),
      excess:+(observed-expected).toFixed(1),
      peakMonth,peakCount,minP
    };
  });
  out.sort((a,b)=>b.excess-a.excess);
  return out.slice(0,maxEvents);
}

/* ---------- public API ---------- */
window.SignalEngine={
  poissonTailP,
  poissonLowerTailP,
  bhFdr,
  pearson,
  permutationP,
  partialCorrelation,
  giStar,
  computeAnomaly,
  detectFlaps,
  INDEX_WEIGHTS
};

})();
