import {Box3, Line3, MeshStandardMaterial, Vector3} from 'three';

export const matterAvatarScale=.19;
const up={x:0,y:1,z:0};
const cameraFields=['minDistance','maxDistance','distance','targetDistance','desiredDistance'];

export class MatterFlight{
  constructor(camera){
    this.camera=camera;
    this.active=false;
    this.bounds=new Box3();
    this.point=new Vector3();
    this.capsule=new Line3();
  }

  enter(controller,bench){
    if(this.active||!controller||!bench)return false;
    const {position,quaternion}=controller.config;
    this.returnPose={controller,position:{...position},rotation:{...quaternion}};
    // The pad is 2.42 × 1.30 m. Leave room to circle models at its edges.
    this.bounds.min.set(bench.x-1.38,bench.y+.045,bench.z-.78);
    this.bounds.max.set(bench.x+1.38,bench.y+1.12,bench.z+.78);
    this.bounds.clampPoint(this.point.set(position.x,bench.y+.27,position.z),this.point);
    position.copy(this.point);
    controller.characterVelocity.set(0,0,0);
    this.cameraRanges=Object.fromEntries(cameraFields.map(key=>[key,this.camera[key]]));
    Object.assign(this.camera,{minDistance:.27,maxDistance:1.25,distance:.68,targetDistance:.68,desiredDistance:.68});
    this.active=true;
    return true;
  }

  exit(controller){
    if(!this.active)return;
    this.active=false;
    const pose=this.returnPose;
    this.returnPose=null;
    Object.assign(this.camera,this.cameraRanges);
    if(controller===pose.controller){
      const {position,quaternion}=controller.config;
      position.set(pose.position.x,pose.position.y,pose.position.z);
      quaternion.set(pose.rotation.x,pose.rotation.y,pose.rotation.z,pose.rotation.w);
      controller.characterVelocity.set(0,0,0);
      controller.updateNetworkState();
    }
  }

  move(controller,seconds,inputAllowed){
    const {position,quaternion,keyInputManager,additionalInputProvider,collisionsManager}=controller.config;
    const control=inputAllowed?(keyInputManager.getOutput()||additionalInputProvider?.getOutput()||null):null;
    const dt=Math.min(.15,Math.max(0,seconds));
    const heading=Number.isFinite(control?.direction)?Math.PI/2-this.camera.theta+control.direction:null;
    const speed=control?.isSprinting?1.44:.94;
    const vertical=inputAllowed?(Number(Boolean(keyInputManager.getJump()||control?.jump))-
      Number(keyInputManager.isKeyPressed('shift')))*.76:0;
    const vx=heading===null?0:Math.sin(heading)*speed;
    const vz=heading===null?0:Math.cos(heading)*speed;
    if(heading!==null)quaternion.setFromAxisAngle(up,heading);
    const radius=controller.capsuleInfo.radius*matterAvatarScale;
    const capsuleHeight=controller.capsuleInfo.segment.end.y*matterAvatarScale;
    const steps=Math.max(1,Math.ceil(dt*60)),step=dt/steps;
    for(let index=0;index<steps;index++){
      this.point.set(position.x+vx*step,position.y+vertical*step,position.z+vz*step);
      this.bounds.clampPoint(this.point,this.point);
      this.capsule.start.copy(this.point);
      this.capsule.start.y+=radius;
      this.capsule.end.copy(this.capsule.start);
      this.capsule.end.y+=capsuleHeight;
      collisionsManager.setCharacterPosition(this.point);
      collisionsManager.applyColliders(this.capsule,radius);
      this.capsule.start.y-=radius;
      this.bounds.clampPoint(this.capsule.start,this.point);
      position.copy(this.point);
    }
    controller.controlState=control;
    controller.characterOnGround=false;
    controller.characterVelocity.set(0,0,0);
    controller.currentHeight=2;
    controller.updateNetworkState();
  }
}

export function bindMatterFlight(manager,camera,flight,inputAllowed,onLost){
  const update=manager.update,setTarget=camera.setTarget;
  function target(point){
    if(flight.active)point.y-=1.75*(1-matterAvatarScale);
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
  manager.update=updateWithFlight;
  camera.setTarget=target;
  return ()=>{
    flight.exit(manager.localController);
    if(manager.update===updateWithFlight)manager.update=update;
    if(camera.setTarget===target)camera.setTarget=setTarget;
  };
}

export function bindMatterHologram(manager,flight,tabletopPlayers=()=>[]){
  const update=manager.update;
  const saved=new Map();

  function restore(id){
    const {character,scale,appearance}=saved.get(id);
    character.scale.copy(scale);
    for(const [mesh,entry] of appearance)restoreMesh(mesh,entry);
    saved.delete(id);
  }

  function restoreMesh(mesh,{source,materials,shadow}){
    if(mesh.material===materials)mesh.material=source;
    mesh.castShadow=shadow;
    for(const material of Array.isArray(materials)?materials:[materials])material.dispose();
  }

  function syncMeshes({root,appearance}){
    const current=new Set();
    root.traverse(mesh=>{
      if(!mesh.isMesh||!mesh.material)return;
      current.add(mesh);
      const previous=appearance.get(mesh);
      if(mesh.material===previous?.materials)return;
      if(previous)restoreMesh(mesh,previous);
      const source=mesh.material;
      const translucent=material=>{
        const clone=new MeshStandardMaterial().copy(material);
        clone.transparent=true;
        clone.opacity*=.55;
        clone.depthWrite=false;
        return clone;
      };
      const materials=Array.isArray(source)?source.map(translucent):translucent(source);
      appearance.set(mesh,{source,materials,shadow:mesh.castShadow});
      mesh.material=materials;
      mesh.castShadow=false;
    });
    for(const [mesh,entry] of appearance){
      if(current.has(mesh))continue;
      restoreMesh(mesh,entry);
      appearance.delete(mesh);
    }
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
        entry={character,root,appearance:new Map(),scale:character.scale.clone(),nextScan:now};
        saved.set(id,entry);
        character.scale.multiplyScalar(matterAvatarScale);
      }
      // The SDK can attach or replace a model after admitting its empty root.
      if(now>=entry.nextScan){
        syncMeshes(entry);
        entry.nextScan=now+125;
      }
    }
    return result;
  }
  manager.update=draw;
  return ()=>{for(const id of saved.keys())restore(id);if(manager.update===draw)manager.update=update;};
}
