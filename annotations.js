/* ========== MAP ANNOTATIONS ========== */
(function(){
'use strict';

var STORAGE_KEY='ss-annotations';
var annotations=[];
var annoLayer=null;
var annoMode=false;
var nextId=1;

var ICONS={
  pin:'\ud83d\udccd',
  eye:'\ud83d\udc41',
  alert:'\u26a0\ufe0f',
  star:'\u2b50',
  skull:'\ud83d\udc80',
  ufo:'\ud83d\udef8'
};

function init(){
  var map=window.StrangeSignals&&window.StrangeSignals.getMap();
  if(!map){setTimeout(init,500);return}

  annoLayer=L.layerGroup().addTo(map);
  loadAnnotations();
  renderAll();

  map.on('click',function(e){
    if(!annoMode)return;
    var anno={id:nextId++,lat:e.latlng.lat,lon:e.latlng.lng,
      icon:'pin',note:'',color:'#ff3366',created:new Date().toISOString()};
    annotations.push(anno);
    addMarker(anno);
    saveAnnotations();
    openEditor(anno);
  });

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

  L.popup({maxWidth:260,className:'dark-popup'})
    .setLatLng([anno.lat,anno.lon])
    .setContent(
      '<div class="anno-popup">'+
      '<textarea id="anno-note-'+anno.id+'" placeholder="Add a note...">'+(anno.note||'').replace(/</g,'&lt;')+'</textarea>'+
      '<div class="anno-popup-actions">'+
        '<select id="anno-icon-'+anno.id+'">'+iconOptions+'</select>'+
        '<button class="anno-delete" onclick="window.Annotations.remove('+anno.id+')">DELETE</button>'+
      '</div></div>')
    .openOn(map);

  map.once('popupclose',function(){
    var noteEl=document.getElementById('anno-note-'+anno.id);
    var iconEl=document.getElementById('anno-icon-'+anno.id);
    if(noteEl)anno.note=noteEl.value;
    if(iconEl&&iconEl.value!==anno.icon){
      anno.icon=iconEl.value;
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

window.Annotations={
  remove:removeAnnotation,
  getAll:function(){return annotations.slice()},
  getCount:function(){return annotations.length}
};

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',init);
} else {
  init();
}

})();
