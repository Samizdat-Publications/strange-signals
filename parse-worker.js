// Web Worker: decompress (gzip) -> decode -> parse -> validate.
// Each input is ONE category's payload — the caller knows the cat index from
// the URL it requested, so this worker just returns a flat record list.
// Sends results back in small batches so structured clone never blocks the UI.
self.onmessage=async function(e){
  try{
    let bytes=e.data;
    // Detect gzip magic 0x1F 0x8B and decompress via DecompressionStream
    // (Chromium 80+, Safari 16.4+, Firefox 113+).
    const head=new Uint8Array(bytes,0,Math.min(2,bytes.byteLength));
    if(head.length>=2&&head[0]===0x1f&&head[1]===0x8b){
      if(typeof DecompressionStream==='undefined'){
        self.postMessage({type:'error',error:'Browser lacks DecompressionStream — please update.'});
        return;
      }
      const stream=new Response(bytes).body.pipeThrough(new DecompressionStream('gzip'));
      bytes=await new Response(stream).arrayBuffer();
    }
    const text=new TextDecoder().decode(bytes);
    const json=JSON.parse(text);
    const raw=json.data;
    if(!Array.isArray(raw)){
      self.postMessage({type:'error',error:'Invalid payload — missing data array'});
      return;
    }
    // Validate per-record shape: [lat, lon, cat, date, loc, sub, desc]
    // Date normalization: ~24% of records (HF NUFORC import) carry US-format
    // slash dates (M/D/YYYY). Everything downstream (timeline, year filters,
    // flap detection) assumes ISO YYYY-MM-DD, so normalize here, once.
    const slashRe=/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/;
    const records=[];
    for(let i=0;i<raw.length;i++){
      const r=raw[i];
      if(!Array.isArray(r)||r.length<7)continue;
      if(typeof r[0]!=='number'||isNaN(r[0]))continue;
      if(typeof r[1]!=='number'||isNaN(r[1]))continue;
      const d=r[3];
      if(typeof d==='string'){
        const m=d.match(slashRe);
        if(m){
          let y=+m[3];
          if(m[3].length<=2)y=y<=26?2000+y:1900+y; // 2-digit pivot
          const mo=Math.min(12,Math.max(1,+m[1]));
          const day=Math.min(31,Math.max(1,+m[2]));
          r[3]=y+'-'+String(mo).padStart(2,'0')+'-'+String(day).padStart(2,'0');
        }
      }
      records.push(r);
    }
    // Stream back in batches so a single 5K-record postMessage never freezes
    // the main thread on structured clone.
    const BATCH=5000;
    for(let i=0;i<records.length;i+=BATCH){
      self.postMessage({type:'batch',records:records.slice(i,i+BATCH)});
    }
    self.postMessage({type:'done',total:records.length});
  }catch(err){
    self.postMessage({type:'error',error:err.message||String(err)});
  }
};
