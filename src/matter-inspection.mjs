import {Euler,Matrix4,PerspectiveCamera,Quaternion,Ray,Raycaster,Spherical,Vector2,Vector3} from 'three';

const near=.10,clearance=.055;
const up=new Vector3(0,1,0);
const inspectionKeys=new Set(['KeyA','KeyD','KeyQ','KeyE','KeyW','KeyS','ArrowLeft','ArrowRight','ArrowUp','ArrowDown']);
const cameraOffsets=[[0,0,0],[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
const point=(event)=>new Vector2(event.clientX,event.clientY);

export class MatterInspection {
  constructor(collisions){
    this.collisions=collisions;
    this.eye=new Vector3();
    this.rotation=new Quaternion();
    this.pivot=new Vector3();
    this.ray=new Ray();
    this.camera=new PerspectiveCamera();
    this.aim=new Raycaster();
    this.keys=new Set();
    this.releasing=new Set();
  }

  enter(state,player,bench){
    if(this.active||!player||!bench)return false;
    this.camera.aspect=state.aspect;
    this.camera.fov=state.fov;
    this.pivot.set(bench.x,bench.y+.24,bench.z);
    this.eye.set(player.x,player.y+1.43,player.z);
    const orientation=new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(this.eye,this.pivot,up));
    if(!this.acceptRotation(orientation))return false;
    this.lastFrame=performance.now();
    this.saved={position:new Vector3().copy(state.position),rotation:new Quaternion().copy(state.rotation),fov:state.fov};
    this.anchor=null;
    return true;
  }

  get active(){return Boolean(this.saved);}

  exit(state){
    if(!this.saved)return;
    state.position.copy(this.saved.position);
    state.rotation.copy(this.saved.rotation);
    state.fov=this.saved.fov;
    this.saved=null;
    this.anchor=null;
    for(const code of this.keys)this.releasing.add(code);
    this.keys.clear();
  }

  apply(state){
    if(!this.saved)return false;
    const now=performance.now();
    this.moveFromKeys(Math.min(.05,Math.max(0,(now-this.lastFrame)/1000)));
    this.lastFrame=now;
    state.position.copy(this.eye);
    state.rotation.copy(this.rotation);
    state.fov=this.saved.fov;
    this.camera.aspect=state.aspect;
    return true;
  }

  nearHalfHeight(){
    return near*Math.tan(this.camera.fov*Math.PI/360);
  }

  acceptRotation(rotation){
    const height=this.nearHalfHeight(),width=height*this.camera.aspect;
    for(const [x,y] of [[0,0],[-1,-1],[1,-1],[-1,1],[1,1]]){
      const direction=new Vector3(x*width,y*height,-near).applyQuaternion(rotation);
      const distance=direction.length();
      this.ray.set(this.eye,direction.divideScalar(distance));
      if(this.collisions.raycastFirst(this.ray,distance+clearance))return false;
    }
    this.rotation.copy(rotation);
    return true;
  }

  move(delta){
    const length=delta.length();
    if(length<1e-5)return 0;
    const direction=delta.clone().divideScalar(length);
    let distance=length;
    const origin=new Vector3();
    const height=this.nearHalfHeight(),radius=Math.hypot(near,height,height*this.camera.aspect);
    for(const [x,y,z] of cameraOffsets){
      origin.set(x,y,z).multiplyScalar(radius).add(this.eye);
      this.ray.set(origin,direction);
      const hit=this.collisions.raycastFirst(this.ray,length+clearance);
      if(hit)distance=Math.min(distance,Math.max(0,hit[0]-clearance));
    }
    this.eye.addScaledVector(direction,distance);
    return distance/length;
  }

  orbit(dx,dy){
    const offset=new Spherical().setFromVector3(this.eye.clone().sub(this.pivot));
    offset.theta-=dx;
    offset.phi=Math.max(.18,Math.min(Math.PI-.18,offset.phi-dy));
    const desired=new Vector3().setFromSpherical(offset).add(this.pivot);
    this.move(desired.sub(this.eye));
    if(!this.acceptRotation(new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(this.eye,this.pivot,up))))
      this.resetPivot();
    this.anchor=null;
  }

  tilt(dx,dy){
    const angles=new Euler().setFromQuaternion(this.rotation,'YXZ');
    angles.y-=dx;
    angles.x=Math.max(-1.4,Math.min(1.4,angles.x-dy));
    if(this.acceptRotation(new Quaternion().setFromEuler(angles)))this.resetPivot();
    this.anchor=null;
  }

  resetPivot(){
    const distance=Math.max(.3,this.eye.distanceTo(this.pivot));
    this.pivot.set(0,0,-distance).applyQuaternion(this.rotation).add(this.eye);
  }

  translate(x,y,z=0){
    const delta=new Vector3(x,0,z).applyQuaternion(this.rotation);
    delta.y+=y;
    const moved=this.move(delta);
    this.pivot.addScaledVector(delta,moved);
    this.anchor=null;
  }

  pan(x,y,keepAnchor=false){
    const delta=new Vector3(x,y,0).applyQuaternion(this.rotation);
    const moved=this.move(delta);
    this.pivot.addScaledVector(delta,moved);
    if(!keepAnchor)this.anchor=null;
  }

  lockAnchor(cursor,rect,hit){
    if(!rect.width||!rect.height||!this.camera.aspect)return;
    if(!this.anchor||this.anchor.cursor.distanceTo(cursor)>5){
      this.camera.position.copy(this.eye);
      this.camera.quaternion.copy(this.rotation);
      this.camera.fov=this.saved.fov;
      this.camera.updateProjectionMatrix();
      this.camera.updateMatrixWorld();
      this.aim.setFromCamera(new Vector2(2*(cursor.x-rect.left)/rect.width-1,1-2*(cursor.y-rect.top)/rect.height),this.camera);
      const target=hit(cursor.x,cursor.y)?.point??this.aim.ray.at(Math.max(.45,this.eye.distanceTo(this.pivot)),new Vector3());
      this.anchor={cursor:cursor.clone(),target};
    }
  }

  dolly(amount,cursor,rect,hit,keepAnchor=false){
    if(!this.anchor||!keepAnchor)this.lockAnchor(cursor,rect,hit);
    if(!this.anchor)return;
    const delta=this.anchor.target.clone().sub(this.eye);
    const distance=delta.length();
    const step=amount>=0?Math.min(.20,Math.max(0,distance-.24),distance*amount):Math.max(-.25,distance*amount);
    if(distance>.001&&this.move(delta.multiplyScalar(step/distance)))this.resetPivot();
  }

  moveFromKeys(dt){
    const direction=(negative,positive)=>Number(this.keys.has(positive))-Number(this.keys.has(negative));
    const v=new Vector3(direction('KeyA','KeyD'),direction('KeyQ','KeyE'),direction('KeyW','KeyS'));
    if(v.lengthSq())this.translate(...v.normalize().multiplyScalar(dt*1.15).toArray());
    const tiltX=direction('ArrowLeft','ArrowRight'),tiltY=direction('ArrowUp','ArrowDown');
    if(tiltX||tiltY)this.tilt(tiltX*dt,tiltY*dt);
  }

  key(event){
    if(this.releasing.has(event.code))return true;
    if(!this.active||event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||event.isComposing||
      event.target?.closest?.('button,input,select,textarea,[contenteditable]')||!inspectionKeys.has(event.code))return false;
    this.keys.add(event.code);
    return true;
  }

  releaseKey(code){
    this.keys.delete(code);
    this.releasing.delete(code);
  }

  clearInput(){
    this.keys.clear();
    this.releasing.clear();
    this.anchor=null;
  }

}

export function bindMatterInspection({canvas,inspection,picker,overHud,sensitivity}){
  const controller=new AbortController(),listeners={capture:true,passive:false,signal:controller.signal};
  const pointers=new Map();
  const consume=event=>{event.preventDefault();event.stopImmediatePropagation();};
  const hit=(x,y)=>picker()?.hit(x,y);
  const touchPositions=()=>[...pointers.values()].filter(entry=>entry.touch).map(entry=>entry.last);
  const multi=([left,right])=>right?{center:left.clone().add(right).multiplyScalar(.5),span:left.distanceTo(right)}:null;
  const finish=()=>{
    for(const id of pointers.keys())if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
    pointers.clear();
    picker()?.cancel();
    inspection.anchor=null;
  };
  canvas.addEventListener('pointerdown',event=>{
    if(!inspection.active)return;
    if(overHud(event)){consume(event);return;}
    const touch=event.pointerType==='touch';
    canvas.ownerDocument.activeElement?.blur();
    if(pointers.has(event.pointerId)){consume(event);return;}
    if(!touch&&event.button===0){
      pointers.set(event.pointerId,{select:true});
      picker()?.down(event);
      consume(event);
      return;
    }
    const last=point(event);
    pointers.set(event.pointerId,{last,start:last,drag:false,touch,pan:event.button===1||event.shiftKey,tilt:event.altKey});
    if(pointers.size===1&&touch)picker()?.down(event);
    else picker()?.cancel();
    try{canvas.setPointerCapture(event.pointerId);}catch{}
    consume(event);
  },listeners);
  canvas.addEventListener('pointermove',event=>{
    if(!inspection.active)return;
    const entry=pointers.get(event.pointerId);
    if(!entry)return;
    if(entry.select){picker()?.move(event);consume(event);return;}
    const before=multi(touchPositions());
    const next=point(event),dx=next.x-entry.last.x,dy=next.y-entry.last.y;
    if(!entry.drag&&next.distanceTo(entry.start)>5)entry.drag=true;
    entry.last=next;
    const after=multi(touchPositions());
    const speed=.004*sensitivity();
    if(before&&after){
      picker()?.cancel();
      for(const pointer of pointers.values())pointer.drag=true;
      const rect=canvas.getBoundingClientRect();
      if(!inspection.anchor)inspection.lockAnchor(before.center,rect,hit);
      const forward=new Vector3(0,0,-1).applyQuaternion(inspection.rotation);
      const depth=inspection.anchor?.target.clone().sub(inspection.eye).dot(forward)??1;
      const units=2*inspection.nearHalfHeight()/near*Math.max(.24,depth)/Math.max(1,rect.height);
      inspection.pan((before.center.x-after.center.x)*units,(after.center.y-before.center.y)*units,true);
      inspection.dolly((after.span-before.span)*.005,after.center,rect,hit,true);
    }else if(entry.drag){
      picker()?.cancel();
      if(entry.pan)inspection.pan(-dx*.002,dy*.002);
      else if(entry.tilt)inspection.tilt(dx*speed,dy*speed);
      else inspection.orbit(dx*speed,dy*speed);
    }
    consume(event);
  },listeners);
  canvas.addEventListener('pointerup',event=>{
    if(!inspection.active)return;
    const entry=pointers.get(event.pointerId);
    if(!entry)return;
    pointers.delete(event.pointerId);
    if(entry.touch)inspection.anchor=null;
    if(entry.select||(entry.touch&&!entry.drag))picker()?.up(event);
    consume(event);
  },listeners);
  for(const type of ['pointercancel','lostpointercapture'])canvas.addEventListener(type,event=>{
    if(pointers.delete(event.pointerId))picker()?.cancel();
  },listeners);
  canvas.addEventListener('contextmenu',event=>{if(inspection.active)consume(event);},listeners);
  canvas.addEventListener('wheel',event=>{
    if(!inspection.active)return;
    if(!overHud(event)){
      const factor=event.deltaMode===1?16:event.deltaMode===2?canvas.clientHeight:1;
      inspection.dolly(-Math.max(-.25,Math.min(.25,event.deltaY*factor*.0012)),point(event),canvas.getBoundingClientRect(),hit);
    }
    consume(event);
  },listeners);
  canvas.ownerDocument.defaultView.addEventListener('blur',()=>{finish();inspection.clearInput();},{signal:controller.signal});
  canvas.ownerDocument.addEventListener('keyup',event=>inspection.releaseKey(event.code),{capture:true,signal:controller.signal});
  canvas.ownerDocument.addEventListener('pointerlockchange',()=>{
    if(inspection.active&&canvas.ownerDocument.pointerLockElement===canvas)canvas.ownerDocument.exitPointerLock();
  },{signal:controller.signal});
  return {finish,dispose(){finish();controller.abort();}};
}
