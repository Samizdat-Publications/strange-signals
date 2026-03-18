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
