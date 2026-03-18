/* ========== WINDOW MANAGER ========== */
(function(){
'use strict';

let zCounter=1200;
const windows={};
let dockEl=null;

function ensureDock(){
  if(dockEl)return dockEl;
  dockEl=document.createElement('div');
  dockEl.className='ss-dock';
  document.getElementById('map-container').appendChild(dockEl);
  return dockEl;
}

function clamp(val,min,max){return Math.max(min,Math.min(max,val))}

class SSWindow{
  constructor(opts){
    this.id=opts.id;
    this.onClose=opts.onClose||null;
    this.onResize=opts.onResize||null;
    this._minimized=false;
    this._hidden=true;

    // Create DOM
    this.el=document.createElement('div');
    this.el.className='ss-window';
    this.el.id='win-'+this.id;
    this.el.style.display='none';

    // Titlebar
    const titlebar=document.createElement('div');
    titlebar.className='ss-window-titlebar';
    this._titleEl=document.createElement('span');
    this._titleEl.className='ss-window-title';
    this._titleEl.innerHTML=opts.title||'';
    titlebar.appendChild(this._titleEl);

    const controls=document.createElement('div');
    controls.className='ss-window-controls';

    const minBtn=document.createElement('button');
    minBtn.className='ss-win-btn minimize';
    minBtn.title='Minimize';
    minBtn.innerHTML='&#9472;';
    minBtn.addEventListener('click',()=>this.minimize());
    controls.appendChild(minBtn);

    const closeBtn=document.createElement('button');
    closeBtn.className='ss-win-btn close';
    closeBtn.title='Close';
    closeBtn.innerHTML='&times;';
    closeBtn.addEventListener('click',()=>this.hide());
    controls.appendChild(closeBtn);

    titlebar.appendChild(controls);
    this.el.appendChild(titlebar);

    // Body
    this.bodyEl=document.createElement('div');
    this.bodyEl.className='ss-window-body';
    if(opts.content){
      if(typeof opts.content==='string'){
        this.bodyEl.innerHTML=opts.content;
      } else {
        this.bodyEl.appendChild(opts.content);
      }
    }
    this.el.appendChild(this.bodyEl);

    // Resize handle
    const resizeHandle=document.createElement('div');
    resizeHandle.className='ss-window-resize';
    this.el.appendChild(resizeHandle);

    // Set size
    const dw=opts.defaultSize||{width:500,height:400};
    this.el.style.width=dw.width+'px';
    this.el.style.height=dw.height+'px';

    // Set position
    const dp=opts.defaultPos||{right:20,bottom:60};
    if(dp.right!==undefined)this.el.style.right=dp.right+'px';
    if(dp.left!==undefined)this.el.style.left=dp.left+'px';
    if(dp.top!==undefined)this.el.style.top=dp.top+'px';
    if(dp.bottom!==undefined)this.el.style.bottom=dp.bottom+'px';

    // Restore saved position
    this._restorePosition();

    // Append to map container
    document.getElementById('map-container').appendChild(this.el);

    // Focus on click
    this.el.addEventListener('mousedown',()=>this.focus());

    // Drag
    this._initDrag(titlebar);
    // Resize
    this._initResize(resizeHandle,opts.minSize||{width:300,height:200});

    windows[this.id]=this;
  }

  _initDrag(handle){
    let startX,startY,startLeft,startTop;
    const onMove=(e)=>{
      const dx=(e.clientX||e.touches[0].clientX)-startX;
      const dy=(e.clientY||e.touches[0].clientY)-startY;
      // Switch to left/top positioning for drag
      this.el.style.right='auto';
      this.el.style.bottom='auto';
      const container=this.el.parentElement;
      this.el.style.left=clamp(startLeft+dx,0,container.clientWidth-50)+'px';
      this.el.style.top=clamp(startTop+dy,0,container.clientHeight-50)+'px';
    };
    const onUp=()=>{
      document.removeEventListener('mousemove',onMove);
      document.removeEventListener('mouseup',onUp);
      document.removeEventListener('touchmove',onMove);
      document.removeEventListener('touchend',onUp);
      this._savePosition();
    };
    handle.addEventListener('mousedown',(e)=>{
      if(e.target.closest('.ss-win-btn'))return;
      e.preventDefault();
      this.focus();
      startX=e.clientX;startY=e.clientY;
      const rect=this.el.getBoundingClientRect();
      const parentRect=this.el.parentElement.getBoundingClientRect();
      startLeft=rect.left-parentRect.left;
      startTop=rect.top-parentRect.top;
      // Convert to left/top
      this.el.style.left=startLeft+'px';
      this.el.style.top=startTop+'px';
      this.el.style.right='auto';
      this.el.style.bottom='auto';
      document.addEventListener('mousemove',onMove);
      document.addEventListener('mouseup',onUp);
    });
    handle.addEventListener('touchstart',(e)=>{
      if(e.target.closest('.ss-win-btn'))return;
      this.focus();
      startX=e.touches[0].clientX;startY=e.touches[0].clientY;
      const rect=this.el.getBoundingClientRect();
      const parentRect=this.el.parentElement.getBoundingClientRect();
      startLeft=rect.left-parentRect.left;
      startTop=rect.top-parentRect.top;
      this.el.style.left=startLeft+'px';
      this.el.style.top=startTop+'px';
      this.el.style.right='auto';
      this.el.style.bottom='auto';
      document.addEventListener('touchmove',onMove,{passive:false});
      document.addEventListener('touchend',onUp);
    },{passive:false});
  }

  _initResize(handle,minSize){
    let startX,startY,startW,startH;
    const onMove=(e)=>{
      const dx=(e.clientX||e.touches[0].clientX)-startX;
      const dy=(e.clientY||e.touches[0].clientY)-startY;
      this.el.style.width=Math.max(minSize.width,startW+dx)+'px';
      this.el.style.height=Math.max(minSize.height,startH+dy)+'px';
      if(this.onResize)this.onResize();
    };
    const onUp=()=>{
      document.removeEventListener('mousemove',onMove);
      document.removeEventListener('mouseup',onUp);
      this._savePosition();
    };
    handle.addEventListener('mousedown',(e)=>{
      e.preventDefault();e.stopPropagation();
      startX=e.clientX;startY=e.clientY;
      startW=this.el.offsetWidth;startH=this.el.offsetHeight;
      document.addEventListener('mousemove',onMove);
      document.addEventListener('mouseup',onUp);
    });
  }

  _savePosition(){
    try{
      localStorage.setItem('ss-win-'+this.id,JSON.stringify({
        left:this.el.style.left,top:this.el.style.top,
        width:this.el.style.width,height:this.el.style.height
      }));
    }catch(e){}
  }

  _restorePosition(){
    try{
      const saved=JSON.parse(localStorage.getItem('ss-win-'+this.id));
      if(saved){
        if(saved.left){this.el.style.left=saved.left;this.el.style.right='auto'}
        if(saved.top){this.el.style.top=saved.top;this.el.style.bottom='auto'}
        if(saved.width)this.el.style.width=saved.width;
        if(saved.height)this.el.style.height=saved.height;
      }
    }catch(e){}
  }

  focus(){
    Object.values(windows).forEach(w=>w.el.classList.remove('focused'));
    this.el.classList.add('focused');
    this.el.style.zIndex=++zCounter;
  }

  show(){
    this._hidden=false;
    this._minimized=false;
    this.el.style.display='flex';
    this.el.classList.remove('minimized');
    this.focus();
    this._updateDock();
  }

  hide(){
    this._hidden=true;
    this.el.style.display='none';
    if(this.onClose)this.onClose();
    this._updateDock();
  }

  minimize(){
    this._minimized=true;
    this.el.style.display='none';
    this._updateDock();
  }

  toggle(){
    if(this._hidden||this._minimized)this.show();
    else this.hide();
  }

  setTitle(html){this._titleEl.innerHTML=html}

  _updateDock(){
    const dock=ensureDock();
    // Remove existing dock button for this window
    const existing=dock.querySelector(`[data-win="${this.id}"]`);
    if(existing)existing.remove();
    // Add dock button if minimized
    if(this._minimized){
      const btn=document.createElement('button');
      btn.className='ss-dock-btn';
      btn.dataset.win=this.id;
      btn.textContent=this._titleEl.textContent;
      btn.addEventListener('click',()=>this.show());
      dock.appendChild(btn);
    }
    // Hide dock if empty
    dock.style.display=dock.children.length?'flex':'none';
  }
}

window.WindowManager={
  create(opts){return new SSWindow(opts)},
  get(id){return windows[id]||null},
  getAll(){return{...windows}}
};

})();
