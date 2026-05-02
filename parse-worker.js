// Web Worker: decompress (gzip) → decode → parse → validate → categorize.
// All off the main thread. Sends results back in small batches so structured
// clone never blocks the UI.
self.onmessage=async function(e){
  try{
    let bytes=e.data;
    // Detect gzip magic bytes 1F 8B. If present, decompress via the platform
    // DecompressionStream (Chromium 80+, Safari 16.4+, Firefox 113+).
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
    if(!Array.isArray(raw)||!raw.length){
      self.postMessage({type:'error',error:'Invalid or empty data'});
      return;
    }
    // Filter + categorize in one pass
    const cats=[[],[],[]];
    for(let i=0;i<raw.length;i++){
      const r=raw[i];
      if(!Array.isArray(r)||r.length<7)continue;
      if(typeof r[0]!=='number'||isNaN(r[0]))continue;
      if(typeof r[1]!=='number'||isNaN(r[1]))continue;
      if(r[2]<0||r[2]>2)continue;
      cats[r[2]].push(r);
    }
    const total=cats[0].length+cats[1].length+cats[2].length;
    // Send back in small batches to avoid structured clone blocking main thread
    const BATCH=5000;
    for(let cat=0;cat<3;cat++){
      for(let i=0;i<cats[cat].length;i+=BATCH){
        self.postMessage({type:'batch',cat:cat,records:cats[cat].slice(i,i+BATCH)});
      }
    }
    self.postMessage({type:'done',total:total});
  }catch(err){
    self.postMessage({type:'error',error:err.message||String(err)});
  }
};
