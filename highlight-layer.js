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
