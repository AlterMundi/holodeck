// Keep the host's picking gestures and touch orbit. Mouse look can use raw
// movement while locked so a sustained drag can pass the edge of the screen.
export function bindWorldOrbitInput(camera,canvas,sensitivity,blocked=()=>false,inspection,canLoop=()=>false,canPitch=()=>false,canFreeLook=()=>true){
  const document=canvas.ownerDocument;
  const abort=new AbortController(),capture={capture:true,signal:abort.signal};
  let rightHeld=false,locked=false,pan=null,tableDrag=null,loopPitch=null,loopPole=0;
  // Free look: a left drag (or a finger dragged on the world) orbits the
  // camera alone. The body keeps steering by the angles it had, recorded as
  // an offset from the camera. A right drag steers body and camera together.
  let leftHeld=false,lastTheta=null,lastPhi=null,offsetTheta=0,offsetPhi=0,lookByTouch=false,anchored=false;
  const lookTouches=new Set();
  const touchIds=new Set();
  const inspect=event=>inspection?.available(event);
  const dolly=(delta,clientX,clientY)=>{
    const rect=canvas.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    inspection.dolly(delta,2*(clientX-rect.left)/rect.width-1,
      1-2*(clientY-rect.top)/rect.height,clientX,clientY);
  };
  canvas.addEventListener('wheel',event=>{
    if(inspection?.wheel?.(event)||!inspection?.active())return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if(!inspect(event))return;
    const rect=canvas.getBoundingClientRect();
    const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?rect.height:1);
    dolly(delta,event.clientX,event.clientY);
  },{...capture,passive:false});
  canvas.addEventListener('mousedown',event=>{
    if(event.button===1&&inspect(event))event.preventDefault();
  },capture);
  const turn=(x,y)=>{
    const scale=20*sensitivity();
    camera.targetTheta+=x/canvas.clientWidth*scale;
    const delta=y/canvas.clientHeight*scale;
    if(canPitch()){
      // Apply only the pilot's displacement. There is no pitch timer,
      // pole threshold, or queued turn when the pointer stops.
      camera.phi-=delta;
      camera.targetPhi=camera.phi;
      return;
    }
    const next=camera.targetPhi-delta;
    if(!rightHeld||!canLoop())loopPitch=null;
    else if(loopPitch===null&&(next<camera.minPolarAngle||next>camera.maxPolarAngle)){
      loopPitch=Math.PI/2-camera.targetPhi;
      loopPole=Math.sign(loopPitch)||Math.sign(y);
    }
    if(loopPitch!==null&&y!==0){
      let angle=loopPitch+y/canvas.clientHeight*scale;
      angle=Math.atan2(Math.sin(angle),Math.cos(angle));
      if(Math.abs(angle)<1.36)loopPitch=null;
      else loopPitch=angle;
      // Stay on the same camera side during the maneuver. The signed flight
      // direction can continue turning without orbiting to the opposite pole.
      camera.targetPhi=loopPitch===null?Math.PI/2-angle:
        loopPole>0?camera.minPolarAngle:camera.maxPolarAngle;
    }else if(loopPitch===null)camera.targetPhi=next;
    camera.targetPhi=Math.max(camera.minPolarAngle,Math.min(camera.maxPolarAngle,camera.targetPhi));
  };
  const looking=()=>leftHeld||lookTouches.size>0;
  const recordLook=()=>{
    if(!looking()||rightHeld||blocked()||camera.isFlyCameraOn())return;
    if(lastTheta!==null){
      offsetTheta+=camera.targetTheta-lastTheta;
      offsetPhi+=camera.targetPhi-lastPhi;
    }
    lastTheta=camera.targetTheta;lastPhi=camera.targetPhi;
  };
  const beginLook=()=>{
    if(looking())return;
    if(!anchored){
      // Freeze the body's actual heading, even if the view was still easing.
      offsetTheta=camera.targetTheta-camera.theta;
      offsetPhi=camera.targetPhi-camera.phi;
    }
    lastTheta=camera.targetTheta;lastPhi=camera.targetPhi;
    anchored=true;
  };
  canvas.addEventListener('pointerdown',event=>{
    if(canFreeLook()&&!blocked()&&!camera.isFlyCameraOn()&&!inspect(event)&&
        !inspection?.tableOrbit?.()&&!inspection?.overControl?.(event)){
      if(event.pointerType==='touch'){beginLook();lookTouches.add(event.pointerId);lookByTouch=true;}
      if(event.pointerType==='mouse'&&event.button===0){beginLook();leftHeld=true;lookByTouch=false;}
    }
    if(event.pointerType==='touch'&&inspect(event)){
      touchIds.add(event.pointerId);
      return;
    }
    if(blocked()||event.pointerType!=='mouse')return;
    if(event.button===1&&inspect(event)){
      pan={id:event.pointerId,x:event.clientX,y:event.clientY};
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if(event.button!==2)return;
    if(inspection?.tableOrbit?.()){
      tableDrag={id:event.pointerId,x:event.clientX,y:event.clientY};
      canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    rightHeld=true;
    // The body turns to wherever the camera now looks.
    offsetTheta=offsetPhi=0;anchored=false;
    try{canvas.requestPointerLock?.()?.catch(()=>{});}catch{}
  },capture);
  document.addEventListener('pointermove',event=>{
    if(event.pointerType==='touch'&&inspection?.active()&&touchIds.has(event.pointerId)&&camera.activePointers.size===2){
      const pointer=camera.activePointers.get(event.pointerId);
      const other=[...camera.activePointers].find(([id])=>id!==event.pointerId&&touchIds.has(id))?.[1];
      if(!pointer||!other)return;
      const x=(event.clientX+other.x)/2,y=(event.clientY+other.y)/2;
      if(!inspect({clientX:x,clientY:y})){
        releaseTouches();
        return;
      }
      const priorSpread=Math.hypot(pointer.x-other.x,pointer.y-other.y);
      const spread=Math.hypot(event.clientX-other.x,event.clientY-other.y);
      pointer.x=event.clientX;
      pointer.y=event.clientY;
      if(priorSpread>5&&spread>5){
        dolly(-Math.log(spread/priorSpread)/.0018,x,y);
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if(event.pointerType==='touch'&&canPitch()&&!blocked()&&!camera.isFlyCameraOn()&&
        canvas.clientWidth&&canvas.clientHeight&&camera.activePointers.size===1){
      const pointer=camera.activePointers.get(event.pointerId);
      if(pointer){
        turn(event.clientX-pointer.x,event.clientY-pointer.y);
        pointer.x=event.clientX;
        pointer.y=event.clientY;
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      return;
    }
    if(event.pointerType!=='mouse')return;
    if(tableDrag?.id===event.pointerId){
      if(!(event.buttons&2)||blocked()||!inspection.tableOrbit()||!canvas.clientWidth||!canvas.clientHeight){
        releaseTableDrag();
        return;
      }
      turn(event.clientX-tableDrag.x,event.clientY-tableDrag.y);
      tableDrag.x=event.clientX;
      tableDrag.y=event.clientY;
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if(pan?.id===event.pointerId){
      if(!(event.buttons&4)||!inspect(event)||!canvas.clientWidth||!canvas.clientHeight){pan=null;return;}
      inspection.pan(-2*(event.clientX-pan.x)/canvas.clientWidth,2*(event.clientY-pan.y)/canvas.clientHeight);
      pan.x=event.clientX;
      pan.y=event.clientY;
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if(rightHeld&&!(event.buttons&2))release();
    if(blocked()||camera.isFlyCameraOn()||!canvas.clientWidth||!canvas.clientHeight)return;
    const pointer=camera.activePointers.get(event.pointerId);
    if(document.pointerLockElement===canvas){
      turn(event.movementX,event.movementY);
    }else if(pointer&&camera.activePointers.size===1){
      turn(event.clientX-pointer.x,event.clientY-pointer.y);
      pointer.x=event.clientX;
      pointer.y=event.clientY;
    }else return;
    event.preventDefault();
    if(canPitch()||document.pointerLockElement===canvas)event.stopImmediatePropagation();
  },capture);
  const releaseTouches=()=>{
    for(const id of touchIds)camera.activePointers.delete(id);
    touchIds.clear();
    if(!camera.activePointers.size)document.body.style.cursor='';
  };
  const releaseTableDrag=()=>{
    const drag=tableDrag;
    tableDrag=null;
    if(drag&&canvas.hasPointerCapture(drag.id))canvas.releasePointerCapture(drag.id);
  };
  canvas.addEventListener('lostpointercapture',event=>{
    if(event.pointerId===tableDrag?.id)releaseTableDrag();
  },capture);
  const release=()=>{
    releaseTableDrag();
    pan=null;
    releaseTouches();
    recordLook();
    rightHeld=false;
    leftHeld=false;
    lookTouches.clear();
    if(!canFreeLook()){offsetTheta=offsetPhi=0;anchored=false;}
    loopPitch=null;
    if(document.pointerLockElement===canvas)document.exitPointerLock();
  };
  document.addEventListener('pointerup',event=>{
    recordLook();
    touchIds.delete(event.pointerId);
    lookTouches.delete(event.pointerId);
    if(event.button===0&&event.pointerType==='mouse')leftHeld=false;
    if(event.button===2)release();
    else if(event.button===1&&pan?.id===event.pointerId)pan=null;
  },capture);
  document.addEventListener('pointercancel',event=>{
    recordLook();
    touchIds.delete(event.pointerId);
    lookTouches.delete(event.pointerId);
    if(event.pointerType==='mouse')leftHeld=false;
    if(event.pointerType==='mouse')release();
  },capture);
  document.defaultView?.addEventListener('blur',release,{signal:abort.signal});
  document.addEventListener('visibilitychange',release,{signal:abort.signal});
  document.addEventListener('pointerlockchange',()=>{
    if(document.pointerLockElement===canvas){
      if(rightHeld)locked=true;
      else document.exitPointerLock();
    }else if(locked){
      locked=false;
      release();
    }
  },capture);
  const dispose=()=>{
    abort.abort();
    release();
  };
  dispose.aiming=()=>rightHeld&&!blocked()&&!camera.isFlyCameraOn();
  dispose.pitch=()=>dispose.aiming()&&canLoop()?loopPitch:null;
  dispose.release=release;
  // Once per movement update: the angles the body steers by. While a free
  // look is held the camera's own turns become offset. Released and moving,
  // a mouse view swings back behind the body; a touch view hands its
  // heading to the body, so a finger can still steer.
  dispose.look=(moving=false,seconds=0)=>{
    if(looking())recordLook();
    else if(moving&&!rightHeld&&!blocked()&&(offsetTheta||offsetPhi)){
      const settle=1-Math.exp(-Math.max(0,seconds)*4);
      const dt=offsetTheta*settle,dp=offsetPhi*settle;
      offsetTheta-=dt;offsetPhi-=dp;
      if(!lookByTouch){
        camera.targetTheta-=dt;camera.targetPhi-=dp;
        camera.targetPhi=Math.max(camera.minPolarAngle,Math.min(camera.maxPolarAngle,camera.targetPhi));
      }
      if(Math.abs(offsetTheta)+Math.abs(offsetPhi)<1e-4)offsetTheta=offsetPhi=0;
    }
    if(anchored&&!looking()&&!offsetTheta&&!offsetPhi&&
      Math.abs(camera.targetTheta-camera.theta)+Math.abs(camera.targetPhi-camera.phi)<1e-4)anchored=false;
    return {theta:anchored?camera.targetTheta-offsetTheta:camera.theta,phi:dispose.steerPhi()};
  };
  dispose.steerPhi=()=>anchored?camera.targetPhi-offsetPhi:camera.phi;
  return dispose;
}
