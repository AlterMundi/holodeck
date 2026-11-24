// Keep the host's picking gestures and touch orbit. Mouse look can use raw
// movement while locked so a sustained drag can pass the edge of the screen.
export function bindWorldOrbitInput(camera,canvas,sensitivity){
  const document=canvas.ownerDocument;
  const abort=new AbortController(),capture={capture:true,signal:abort.signal};
  let rightHeld=false;
  const turn=(x,y)=>{
    const scale=20*sensitivity();
    camera.targetTheta+=x/canvas.clientWidth*scale;
    camera.targetPhi=Math.max(camera.minPolarAngle,Math.min(camera.maxPolarAngle,
      camera.targetPhi-y/canvas.clientHeight*scale));
  };
  canvas.addEventListener('pointerdown',event=>{
    if(event.pointerType!=='mouse'||event.button!==2||!canvas.requestPointerLock)return;
    rightHeld=true;
    try{canvas.requestPointerLock()?.catch(()=>{});}catch{}
  },capture);
  document.addEventListener('pointermove',event=>{
    if(event.pointerType!=='mouse'||camera.isFlyCameraOn()||!canvas.clientWidth||!canvas.clientHeight)return;
    const pointer=camera.activePointers.get(event.pointerId);
    if(document.pointerLockElement===canvas){
      turn(event.movementX,event.movementY);
    }else if(pointer&&camera.activePointers.size===1){
      turn(event.clientX-pointer.x,event.clientY-pointer.y);
      pointer.x=event.clientX;
      pointer.y=event.clientY;
    }else return;
    event.preventDefault();
    if(document.pointerLockElement===canvas)event.stopImmediatePropagation();
  },capture);
  const release=()=>{
    rightHeld=false;
    if(document.pointerLockElement===canvas)document.exitPointerLock();
  };
  document.addEventListener('pointerup',event=>{if(event.button===2)release();},capture);
  document.addEventListener('pointercancel',event=>{if(event.pointerType==='mouse')release();},capture);
  document.addEventListener('pointerlockchange',()=>{
    if(!rightHeld&&document.pointerLockElement===canvas)document.exitPointerLock();
  },capture);
  return ()=>{
    abort.abort();
    release();
  };
}
