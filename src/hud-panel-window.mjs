/** Local placement for a floating HUD panel with explicit drag and resize grips. */
export function bindHudPanelWindow(panel,{move,resize}){
  const window=panel.ownerDocument.defaultView;
  const abort=new AbortController();
  const listener={signal:abort.signal};
  let placement;
  const gap=8;
  const margin=2*gap;
  const size=()=>({width:window.innerWidth,height:window.innerHeight});
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const rect=()=>{
    const {left,top,width,height}=panel.getBoundingClientRect();
    return {left,top,width,height};
  };
  function place(next){
    const view=size();
    const maxWidth=Math.max(1,view.width-margin),maxHeight=Math.max(1,view.height-margin);
    const width=clamp(next.width,Math.min(280,maxWidth),maxWidth);
    const height=clamp(next.height,Math.min(255,maxHeight),maxHeight);
    const left=clamp(next.left,gap,Math.max(gap,view.width-gap-width));
    const top=clamp(next.top,gap,Math.max(gap,view.height-gap-height));
    placement={left,top,width,height};
    Object.assign(panel.style,{left:left+'px',top:top+'px',width:width+'px',height:height+'px',
      right:'auto',bottom:'auto',maxWidth:'none',transform:'none'});
  }

  for(const [grip,resizing] of [[move,false],[resize,true]]){
    let drag;
    const offset=(start,x,y)=>resizing
      ?{...start,width:Math.min(window.innerWidth-gap-start.left,start.width+x),
        height:Math.min(window.innerHeight-gap-start.top,start.height+y)}
      :{...start,left:start.left+x,top:start.top+y};
    grip.addEventListener('pointerdown',event=>{
      if(!event.isPrimary||event.button!==0)return;
      drag={id:event.pointerId,x:event.clientX,y:event.clientY,start:rect()};
      grip.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    },listener);
    grip.addEventListener('pointermove',event=>{
      if(drag?.id!==event.pointerId)return;
      place(offset(drag.start,event.clientX-drag.x,event.clientY-drag.y));
      event.stopPropagation();
    },listener);
    for(const type of ['pointerup','pointercancel','lostpointercapture'])
      grip.addEventListener(type,event=>{if(drag?.id===event.pointerId)drag=null;},listener);
    grip.addEventListener('keydown',event=>{
      const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
      if(!direction||event.altKey||event.ctrlKey||event.metaKey)return;
      const step=event.shiftKey?32:8;
      place(offset(rect(),direction[0]*step,direction[1]*step));
      event.preventDefault();
      event.stopPropagation();
    },listener);
  }
  window.addEventListener('resize',()=>{if(placement)place(placement);},listener);
  return ()=>abort.abort();
}
