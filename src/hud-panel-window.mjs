// Keep a complete conversation and a separate, touch-sized movement region.
const insetEdges=['left','right','top','bottom'];

export function conversationTravelLane({width,height,visualHeight,touch,zoom},previous=''){
  if(!touch||zoom>1.05||height-visualHeight>125)return '';
  if(width>height&&height<=540&&width>=(previous==='side'?680:700)&&height>=360)return 'side';
  if(height>=(previous==='bottom'?640:660))return 'bottom';
  return '';
}

/** Local placement for a floating HUD panel with explicit drag and resize grips. */
export function bindHudPanelWindow(panel,{move,resize,readInsets=()=>({})}){
  const window=panel.ownerDocument.defaultView;
  const abort=new AbortController();
  const listener={signal:abort.signal};
  let placement,lane='',edge=0,safe={};
  const gap=8;
  const size=()=>({width:window.innerWidth,height:window.innerHeight});
  const coarse=window.matchMedia('(pointer: coarse)');
  const viewport=window.visualViewport;
  const limits=()=>{
    const {width,height}=size();
    return {left:lane==='side'?edge:Math.max(gap,safe.left??0),right:width-Math.max(gap,safe.right??0),
      top:Math.max(gap,safe.top??0),bottom:height-(lane==='bottom'?edge:Math.max(gap,safe.bottom??0))};
  };
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const rect=()=>{
    const {left,top,width,height}=panel.getBoundingClientRect();
    return {left,top,width,height};
  };
  function place(next,remember=true){
    const {left:minLeft,right,top:minTop,bottom}=limits();
    const maxWidth=Math.max(1,right-minLeft),maxHeight=Math.max(1,bottom-minTop);
    const width=clamp(next.width,Math.min(280,maxWidth),maxWidth);
    const height=clamp(next.height,Math.min(255,maxHeight),maxHeight);
    const left=clamp(next.left,minLeft,Math.max(minLeft,right-width));
    const top=clamp(next.top,minTop,Math.max(minTop,bottom-height));
    if(remember)placement={left,top,width,height};
    Object.assign(panel.style,{left:left+'px',top:top+'px',width:width+'px',height:height+'px',
      right:'auto',bottom:'auto',maxWidth:'none',transform:'none'});
  }

  function fit(reflow=false){
    const dimensions=size();
    const nextInsets=readInsets();
    const insetsChanged=insetEdges.some(edge=>(safe[edge]??0)!==(nextInsets[edge]??0));
    safe=nextInsets;
    let next=panel.hidden||!panel.classList.contains('shared-conversation')?'':conversationTravelLane({
      ...dimensions,touch:coarse.matches&&window.navigator.maxTouchPoints>0&&safe.movementReady,
      visualHeight:viewport?.height??dimensions.height,zoom:viewport?.scale??1,
    },lane);
    let nextEdge=next==='side'?254+(safe.left??12):next==='bottom'?safe.travelBottom:0;
    if(next==='bottom'&&dimensions.height-nextEdge-Math.max(10,safe.top??0)<280||
       next==='side'&&dimensions.width-nextEdge-Math.max(8,safe.right??0)<280){
      next='';nextEdge=0;
    }
    const changed=next!==lane||nextEdge!==edge;
    if(changed){
      lane=next;edge=nextEdge;
      if(lane){
        panel.dataset.travelLane=lane;
        panel.style.setProperty('--conversation-travel-edge',edge+'px');
      }else{
        delete panel.dataset.travelLane;
        panel.style.removeProperty('--conversation-travel-edge');
      }
    }
    if(placement&&(reflow||changed||insetsChanged))place(placement,false);
  }

  for(const [grip,resizing] of [[move,false],[resize,true]]){
    let drag;
    const offset=(start,x,y)=>resizing
      ?{...start,width:Math.min(limits().right-start.left,start.width+x),
        height:Math.min(limits().bottom-start.top,start.height+y)}
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
      if(!direction||event.altKey||event.ctrlKey||event.metaKey){
        if(event.code==='Space')event.stopPropagation();
        return;
      }
      const step=event.shiftKey?32:8;
      place(offset(rect(),direction[0]*step,direction[1]*step));
      event.preventDefault();
      event.stopPropagation();
    },listener);
  }
  const onResize=()=>fit(true);
  window.addEventListener('resize',onResize,listener);
  viewport?.addEventListener('resize',onResize,listener);
  coarse.addEventListener('change',onResize,listener);
  return fit;
}
