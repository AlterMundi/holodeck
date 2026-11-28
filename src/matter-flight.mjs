import {Box3, Line3, MeshStandardMaterial, Vector3} from 'three';

import {matterAvatarScale} from './worktable-navigation.mjs';
export {matterAvatarScale} from './worktable-navigation.mjs';
export const matterEyeHeight=1.75*matterAvatarScale;
const up={x:0,y:1,z:0};
const cameraFields=['minDistance','maxDistance','distance','targetDistance','desiredDistance'];
const signedAngle=angle=>Math.atan2(Math.sin(angle),Math.cos(angle));
const permittedSpeed=(requested,actual)=>Math.sign(requested)*Math.max(0,
  Math.min(Math.abs(requested),actual*Math.sign(requested)));

export class MatterFlight{
  constructor(camera){
    this.camera=camera;
    this.active=false;
    this.reviewTarget=null;
    this.bounds=new Box3();
    this.point=new Vector3();
    this.capsule=new Line3();
    this.velocity=new Vector3();
  }

  enter(controller,bench,{reviewTarget=null}={}){
    if(this.active||!controller||!bench)return false;
    const {position,quaternion}=controller.config;
    this.returnPose={controller,position:{...position},rotation:{...quaternion}};
    this.yaw=Math.atan2(2*(quaternion.w*quaternion.y+quaternion.x*quaternion.z),
      1-2*(quaternion.x**2+quaternion.y**2));
    this.velocity.set(0,0,0);
    // The pad is 2.42 × 1.30 m. Leave room to circle models at its edges.
    this.bounds.min.set(bench.x-1.38,bench.y+.045,bench.z-.78);
    this.bounds.max.set(bench.x+1.38,bench.y+1.12,bench.z+.78);
    this.bounds.clampPoint(this.point.set(position.x,bench.y+.27,position.z),this.point);
    position.copy(this.point);
    controller.characterVelocity.set(0,0,0);
    this.cameraRanges=Object.fromEntries(cameraFields.map(key=>[key,this.camera[key]]));
    this.eyeOffset=0;
    this.reviewTarget=reviewTarget;
    this.returnOrbit=reviewTarget?{yaw:this.camera.targetTheta,tilt:this.camera.targetPhi}:null;
    const distance=reviewTarget ? .96 : .68;
    Object.assign(this.camera,{minDistance:.27,maxDistance:1.25,distance,targetDistance:distance,desiredDistance:distance});
    this.active=true;
    return true;
  }

  liftCamera(_controller,distance){
    this.eyeOffset=Math.max(-.23,Math.min(.38,this.eyeOffset+distance));
  }

  setReviewAngle(angle){
    if(!this.reviewTarget)return;
    // The review presets and the standalone viewer use +Z as front.
    this.camera.setOrbitAngle(Math.PI/2-angle);
    this.camera.targetPhi=Math.PI/2-.12;
  }

  exit(controller){
    if(!this.active)return;
    this.active=false;
    this.reviewTarget=null;
    this.velocity.set(0,0,0);
    const pose=this.returnPose;
    this.returnPose=null;
    Object.assign(this.camera,this.cameraRanges);
    if(this.returnOrbit){
      this.camera.setOrbitAngle(this.returnOrbit.yaw);
      this.camera.targetPhi=this.returnOrbit.tilt;
      this.returnOrbit=null;
    }
    if(controller===pose.controller){
      const {position,quaternion}=controller.config;
      position.set(pose.position.x,pose.position.y,pose.position.z);
      quaternion.set(pose.rotation.x,pose.rotation.y,pose.rotation.z,pose.rotation.w);
      controller.characterVelocity.set(0,0,0);
      controller.updateNetworkState();
    }
  }

  resolvePosition(controller,position){
    const {collisionsManager}=controller.config;
    const radius=controller.capsuleInfo.radius*matterAvatarScale;
    const capsuleHeight=controller.capsuleInfo.segment.end.y*matterAvatarScale;
    this.bounds.clampPoint(position,this.point);
    this.capsule.start.copy(this.point);
    this.capsule.start.y+=radius;
    this.capsule.end.copy(this.capsule.start);
    this.capsule.end.y+=capsuleHeight;
    collisionsManager.setCharacterPosition(this.point);
    collisionsManager.applyColliders(this.capsule,radius);
    this.capsule.start.y-=radius;
    return this.bounds.clampPoint(this.capsule.start,this.point);
  }

  move(controller,seconds,inputAllowed){
    const {position,quaternion,keyInputManager,additionalInputProvider}=controller.config;
    const keyboard=inputAllowed?keyInputManager.getOutput():null;
    const touch=inputAllowed?additionalInputProvider?.getOutput():null;
    const control=Number.isFinite(keyboard?.direction)?keyboard:touch??keyboard;
    const dt=Number.isFinite(seconds)?Math.min(.15,Math.max(0,seconds)):0;
    const heading=Number.isFinite(control?.direction)?Math.PI/2-this.camera.theta+control.direction:null;
    const speed=control?.isSprinting?1.44:.94;
    const vertical=inputAllowed?(Number(Boolean(keyInputManager.getJump()||touch?.jump||touch?.vertical>0))-
      Number(Boolean(keyInputManager.isKeyPressed('alt')||touch?.vertical<0)))*.76:0;
    const vx=heading===null?0:Math.sin(heading)*speed;
    const vz=heading===null?0:Math.cos(heading)*speed;
    const {velocity}=this;
    if(heading===null){velocity.x=0;velocity.z=0;}
    if(!vertical)velocity.y=0;
    const steps=Math.max(1,Math.ceil(dt*60)),step=dt/steps;
    const response=1-Math.exp(-step*12);
    for(let index=0;step>0&&index<steps;index++){
      velocity.x+=(vx-velocity.x)*response;
      velocity.y+=(vertical-velocity.y)*response;
      velocity.z+=(vz-velocity.z)*response;
      this.point.copy(position).addScaledVector(velocity,step);
      this.resolvePosition(controller,this.point);
      if(heading!==null){
        velocity.x=permittedSpeed(velocity.x,(this.point.x-position.x)/step);
        velocity.z=permittedSpeed(velocity.z,(this.point.z-position.z)/step);
      }
      if(vertical)velocity.y=permittedSpeed(velocity.y,(this.point.y-position.y)/step);
      position.copy(this.point);
    }
    if(heading!==null&&dt>0){
      const delta=signedAngle(heading-this.yaw);
      const response=delta*(1-Math.exp(-dt*13));
      this.yaw=signedAngle(this.yaw+Math.max(-dt*8,Math.min(dt*8,response)));
      quaternion.setFromAxisAngle(up,this.yaw);
    }
    controller.controlState=control;
    controller.characterOnGround=false;
    controller.characterVelocity.set(0,0,0);
    controller.currentHeight=2;
    controller.updateNetworkState();
  }
}

export function bindMatterFlight(manager,camera,flight,inputAllowed,onLost){
  const update=manager.update,setTarget=camera.setTarget,updateCamera=camera.update;
  function target(point){
    if(flight.reviewTarget)return setTarget.call(this,flight.reviewTarget);
    if(flight.active)point.y+=matterEyeHeight-1.75+flight.eyeOffset;
    return setTarget.call(this,point);
  }
  function updateWithFlight(...args){
    const local=this.localController;
    if(flight.active&&local!==flight.returnPose?.controller){flight.exit(local);onLost?.();}
    if(!flight.active)return update.apply(this,args);
    const step=local.update;
    local.update=seconds=>flight.move(local,seconds,inputAllowed());
    try{return update.apply(this,args);}
    finally{local.update=step;}
  }
  function updateWithReviewEye(...args){
    updateCamera.apply(this,args);
    flight.placeReviewEye(this.getMainCameraState(),manager.localController);
  }
  if(updateCamera&&flight.placeReviewEye)camera.update=updateWithReviewEye;
  manager.update=updateWithFlight;
  camera.setTarget=target;
  return ()=>{
    flight.exit(manager.localController);
    if(manager.update===updateWithFlight)manager.update=update;
    if(camera.setTarget===target)camera.setTarget=setTarget;
    if(camera.update===updateWithReviewEye)camera.update=updateCamera;
  };
}

export class MatterHologram{
  constructor(root,{depthWrite=false}={}){
    this.root=root;
    this.depthWrite=depthWrite;
    this.appearance=new Map();
  }

  restoreMesh(mesh,{source,materials,shadow}){
    if(mesh.material===materials)mesh.material=source;
    mesh.castShadow=shadow;
    for(const material of Array.isArray(materials)?materials:[materials])if(!material.userData?.keepInHologram)material.dispose();
  }

  sync(){
    const current=new Set();
    this.root.traverse(mesh=>{
      if(!mesh.isMesh||!mesh.material)return;
      current.add(mesh);
      const previous=this.appearance.get(mesh);
      if(mesh.material===previous?.materials)return;
      if(previous)this.restoreMesh(mesh,previous);
      const source=mesh.material,shadow=mesh.castShadow;
      const translucent=material=>{
        // Self-lit screens (Navegante's visor) already read as light.
        if(material.userData?.keepInHologram)return material;
        const clone=material.userData?.keepShaderInHologram?material.clone():new MeshStandardMaterial().copy(material);
        if(material.userData?.keepShaderInHologram){
          clone.onBeforeCompile=material.onBeforeCompile;
          clone.customProgramCacheKey=material.customProgramCacheKey;
        }
        clone.transparent=true;
        clone.opacity*=.55;
        clone.alphaTest*=.55;
        clone.depthWrite=this.depthWrite;
        clone.forceSinglePass=this.depthWrite;
        return clone;
      };
      const materials=Array.isArray(source)?source.map(translucent):translucent(source);
      this.appearance.set(mesh,{source,materials,shadow});
      mesh.material=materials;
      mesh.castShadow=false;
    });
    for(const [mesh,entry] of this.appearance){
      if(current.has(mesh))continue;
      this.restoreMesh(mesh,entry);
      this.appearance.delete(mesh);
    }
  }

  restore(){
    for(const [mesh,entry] of this.appearance)this.restoreMesh(mesh,entry);
    this.appearance.clear();
  }
}

export function bindMatterHologram(manager,flight,tabletopPlayers=()=>[]){
  const update=manager.update;
  const saved=new Map();

  function restore(id){
    const {character,root,scale,hologram,hidden}=saved.get(id);
    if(hidden!==undefined)root.visible=hidden;
    character.scale.copy(scale);
    hologram.restore();
    saved.delete(id);
  }

  function draw(state,...args){
    const result=update.call(this,state,...args);
    const players=new Set(tabletopPlayers());
    players.delete(state.localCharacterId);
    if(flight.active)players.add(state.localCharacterId);
    for(const [id,{character,root}] of saved){
      const loaded=manager.loadedCharacters.get(id)?.character;
      if(!players.has(id)||loaded!==character||loaded.getMesh()!==root)restore(id);
    }
    const now=performance.now();
    for(const id of players){
      let entry=saved.get(id);
      if(!entry){
        const character=manager.loadedCharacters.get(id)?.character;
        const root=character?.getMesh();
        if(!root)continue;
        entry={character,root,hologram:new MatterHologram(root),scale:character.scale.clone(),nextScan:now};
        saved.set(id,entry);
        character.scale.multiplyScalar(matterAvatarScale);
      }
      const inspecting=id===state.localCharacterId&&flight.inspectParts;
      if(inspecting){
        if(entry.hidden===undefined)entry.hidden=entry.root.visible;
        entry.root.visible=false;
        continue;
      }
      if(entry.hidden!==undefined){
        entry.root.visible=entry.hidden;
        entry.hidden=undefined;
      }
      // The SDK can attach or replace a model after admitting its empty root.
      if(!entry.hologram.appearance.size||now>=entry.nextScan){
        entry.hologram.sync();
        entry.nextScan=now+125;
      }
    }
    return result;
  }
  manager.update=draw;
  return ()=>{for(const id of saved.keys())restore(id);if(manager.update===draw)manager.update=update;};
}
