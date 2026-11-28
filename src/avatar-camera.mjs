import {Vector3} from 'three';

export function verticalWheelDistance(event,pageHeight){
  if(!event.shiftKey||event.ctrlKey||event.metaKey)return null;
  // Chromium may remap the wheel to the horizontal axis while Shift is held.
  const units=event.deltaMode===1?16:event.deltaMode===2?pageHeight:1;
  return -(event.deltaY||event.deltaX)*units*.0024;
}

export function bindAvatarFraming(camera,canvas,characterRotation,available=()=>true,shake=null){
  const abort=new AbortController();
  const setTarget=camera.setTarget;
  const aim=new Vector3(),up=new Vector3(),side=new Vector3();
  let requested=0,offset=0;
  canvas.addEventListener('wheel',event=>{
    if(camera.isFlyCameraOn()||!available())return;
    const change=verticalWheelDistance(event,canvas.clientHeight);
    if(!change)return;
    requested=Math.max(-1.02,Math.min(.38,requested+change));
    event.preventDefault();
    event.stopImmediatePropagation();
  },{capture:true,passive:false,signal:abort.signal});
  camera.setTarget=function(target){
    const rotation=characterRotation();
    if(!rotation||camera.isFlyCameraOn()||!available())return setTarget.call(this,target);
    offset+=(requested-offset)*.17;
    up.set(0,1,0).applyQuaternion(rotation);
    side.set(1,0,0).applyQuaternion(rotation);
    const kick=shake?.(up,side);
    const kicked=kick&&kick.lengthSq()>1e-10;
    if(Math.abs(offset)<.0001&&!kicked)return setTarget.call(this,target);
    aim.copy(target).addScaledVector(up,offset);
    if(kicked)aim.add(kick);
    return setTarget.call(this,aim);
  };
  return ()=>{
    abort.abort();
    camera.setTarget=setTarget;
  };
}

// The dither begins near 0.8 m from a surface. Hide the whole local rig
// partway into this region and use hysteresis when the camera backs out.
export function bindCloseAvatar(characterManager,camera,enabled=()=>true){
  const update=characterManager.update;
  const eye=new Vector3();
  let hiddenMesh=null;
  characterManager.update=function(state,...args){
    if(!enabled()){
      if(hiddenMesh){hiddenMesh.visible=true;hiddenMesh=null;}
      return update.call(this,state,...args);
    }
    const result=update.call(this,state,...args);
    const character=this.loadedCharacters.get(state.localCharacterId)?.character;
    const mesh=character?.getMesh();
    if(hiddenMesh&&hiddenMesh!==mesh){hiddenMesh.visible=true;hiddenMesh=null;}
    if(!mesh)return result;
    character.worldToLocal(eye.copy(camera.getCameraState().position));
    const upperBody=Math.max(.9,(character.model?.characterHeight??1.8)-.22);
    eye.y-=Math.max(.15,Math.min(upperBody,eye.y));
    if(eye.lengthSq()<(hiddenMesh ? .86 : .72)**2){
      if(mesh.visible){mesh.visible=false;hiddenMesh=mesh;}
    }else if(hiddenMesh){
      hiddenMesh.visible=true;
      hiddenMesh=null;
    }
    return result;
  };
  return ()=>{
    characterManager.update=update;
    if(hiddenMesh)hiddenMesh.visible=true;
  };
}
