import {Box3,Group,Matrix4,Mesh,MeshBasicMaterial,SphereGeometry,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {teleportModelId} from './teleport-hud.mjs';
import {faceViewer,showNodes,stationMotion,stationParts,TELEPORT_STATION_ASSET,
  TELEPORT_MINIATURES_ASSET,TELEPORT_MINIATURE_KINDS,TELEPORT_CLIPS} from './teleport-station-asset.mjs';

const assetUrl=(base,path)=>new URL('assets/'+path,base);
function releaseScenes(...scenes){
  const resources=new Set();
  for(const scene of scenes)scene?.traverse(object=>{
    if(object.geometry)resources.add(object.geometry);
    for(const material of [object.material].flat().filter(Boolean)){
      resources.add(material);
      for(const value of Object.values(material))if(value?.isTexture)resources.add(value);
    }
  });
  for(const resource of resources)resource.dispose();
}

export class TeleportModels {
  constructor(teleport,{base,reduced,invalidate}){
    Object.assign(this,{teleport,base,reduced,invalidate});
    this.instrument=new Group();
    this.controls=new Map();
    this.inverse=new Matrix4();
    this.transform=new Matrix4();
    this.center=new Vector3();
    this.eye=new Vector3();
    this.offset=new Vector3();
  }

  clearFigure(state){
    state.loadingIcon?.abort();
    state.loadingIcon=null;
    if(state.generated)releaseScenes(state.generated);
    state.generated=null;
    state.figure?.removeFromParent();
    state.figure=null;
  }

  syncFigure(state){
    const {slot,anchor}=state;
    const entry=slot>=0?this.teleport.slots?.[slot]:this.teleport.entries?.find(item=>item.id===this.teleport.branch);
    if(state.key===entry?.id&&state.iconUrl===entry?.icon)return;
    this.clearFigure(state);
    state.key=entry?.id;
    state.iconUrl=entry?.icon;
    if(!entry)return;
    const model=this.figures.get(teleportModelId(entry.id)).clone();
    model.position.set(0,0,0);
    const bounds=new Box3().setFromObject(model),center=bounds.getCenter(new Vector3());
    model.position.set(-center.x,-bounds.min.y,-center.z);
    const figure=state.figure=new Group();
    figure.add(model);
    anchor.add(figure);
    if(!entry.icon)return;
    const loadingIcon=state.loadingIcon=new AbortController();
    const signal=AbortSignal.any([loadingIcon.signal,AbortSignal.timeout(8000)]);
    fetch(new URL(entry.icon,this.base),{signal})
      .then(response=>{if(!response.ok)throw Error('Icon unavailable');return response.arrayBuffer();})
      .then(bytes=>new GLTFLoader().parseAsync(bytes,''))
      .then(({scene})=>{
        if(signal.aborted||state.figure!==figure){releaseScenes(scene);return;}
        scene.traverse(object=>{
          if(!object.isMesh)return;
          object.material.vertexColors=true;
          object.material.flatShading=true;
          object.material.needsUpdate=true;
        });
        state.generated=scene;
        figure.clear();
        figure.add(scene);
        this.invalidate();
      }).catch(()=>{}).finally(()=>{
        if(state.loadingIcon===loadingIcon)state.loadingIcon=null;
      });
  }

  async prepare(){
    if(this.parts)return true;
    this.pending??=this.load().finally(()=>{this.pending=null;});
    return this.pending;
  }

  async load(){
    const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const load=async path=>{
      const url=assetUrl(this.base,path);
      const response=await fetch(url,{signal:AbortSignal.timeout(8000)});
      if(!response.ok)throw Error('Teleport asset unavailable');
      return loader.parseAsync(await response.arrayBuffer(),new URL('.',url).href);
    };
    const assets=await Promise.allSettled([load(TELEPORT_STATION_ASSET),load(TELEPORT_MINIATURES_ASSET)]);
    const [station,miniatures]=assets.map(result=>result.value);
    try{
      if(this.disposed||!station||!miniatures)throw Error('Teleport assets unavailable');
      const parts=stationParts(station.scene);
      const figures=new Map(TELEPORT_MINIATURE_KINDS.map(kind=>[kind,miniatures.scene.getObjectByName('tp_mini_'+kind)]));
      if([...figures.values()].some(figure=>!figure))throw Error('Teleport miniatures unavailable');
      Object.assign(this,{parts,figures,source:miniatures.scene});
      this.instrument.add(station.scene);
      this.motion=stationMotion(station.scene,station.animations,{reduced:this.reduced});
      this.travelDuration=station.animations.find(clip=>clip.name===TELEPORT_CLIPS.travel)?.duration??0;
      return true;
    }catch{
      releaseScenes(station?.scene,miniatures?.scene);
      return false;
    }
  }

  attach(surface){
    if(!this.parts)return;
    this.surface=surface;
    surface.add(this.instrument);
    this.motion.mixer.stopAllAction();
    this.motion.deploy();
    this.motion.idle();
    this.lastFrame=null;
    this.lastLevel=null;
  }

  detach(){
    this.surface=null;
    for(const state of this.controls.values()){this.clearFigure(state);state.key=undefined;}
    this.instrument.removeFromParent();
    this.motion?.mixer.stopAllAction();
  }

  setWorldMode(world){
    this.instrument.rotation.x=world?0:.57;
    this.instrument.position.y=world?0:-.66;
  }

  create({componentId:id}){
    if(!this.parts)return;
    const slot=/^slot[0-3]$/.test(id)?Number(id.at(-1)):-1;
    const anchor=slot>=0?this.parts.nodes[slot]:id==='back'?this.parts.parent:id==='go'?this.parts.travelSlot:null;
    if(!anchor)return;
    const object=new Group();
    const hit=new Mesh(new SphereGeometry(id==='go'?.115:.165,12,8),
      new MeshBasicMaterial({colorWrite:false,depthWrite:false}));
    hit.position.y=id==='go'?0:.087;
    object.add(hit);
    const state={anchor,slot,object,hit,figure:null,key:null,disabled:false};
    this.controls.set(id,state);
    return {object,targets:[hit],update:({disabled,pressed})=>{
      state.disabled=disabled;
      if(id==='go')return;
      state.pressed=pressed;
    },focus:focused=>{state.focused=focused;this.invalidate();},dispose:()=>{
      if(this.controls.get(id)===state)this.controls.delete(id);
      this.clearFigure(state);
      hit.geometry.dispose();hit.material.dispose();
    }};
  }

  playTravel(){
    if(!this.motion||this.reduced()||!this.travelDuration)return;
    this.motion.travel();
    this.invalidate();
    return this.travelDuration*1000;
  }

  animate(camera,now=performance.now()){
    if(!this.surface)return false;
    const dt=this.lastFrame===null?0:Math.min(.25,(now-this.lastFrame)/1000);
    this.lastFrame=now;
    const count=this.teleport.slots?.length??0;
    showNodes(this.parts,count,{parent:Boolean(this.teleport.branch)});
    if(this.lastLevel!==this.teleport.level){
      this.lastLevel=this.teleport.level;
      this.openedAt=now;
    }
    this.motion.update(dt);
    this.surface.updateWorldMatrix(true,true);
    faceViewer(this.parts,camera.getWorldPosition(this.eye),1-Math.exp(-12*Math.max(dt,1/60)));
    this.surface.updateWorldMatrix(true,true);
    this.inverse.copy(this.surface.matrixWorld).invert();
    this.parts.center.getWorldPosition(this.center);
    const t=this.reduced()?1:1-(1-Math.min(1,(now-this.openedAt)/480))**3;
    for(const [id,state] of this.controls){
      if(id!=='go')this.syncFigure(state);
      this.transform.multiplyMatrices(this.inverse,state.anchor.matrixWorld);
      this.transform.decompose(state.object.position,state.object.quaternion,state.object.scale);
      state.object.visible=state.anchor.visible&&!state.disabled&&
        (state.slot>=0?state.slot<count:id==='back'?Boolean(this.teleport.branch):true);
      if(state.figure){
        const emphasis=state.focused||state.pressed?1.08:1;
        state.figure.scale.setScalar(emphasis*(state.slot>=0?.42+.58*t:1));
        if(state.slot>=0){
          state.anchor.worldToLocal(this.offset.copy(this.center)).multiplyScalar(1-t);
          state.figure.position.copy(this.offset);
          state.hit.position.copy(this.offset);
          state.hit.position.y+=.087;
        }
      }
      state.object.updateMatrixWorld(true);
    }
    return !this.reduced();
  }

  dispose(){
    this.disposed=true;
    this.detach();
    this.motion?.dispose();
    releaseScenes(this.instrument,this.source);
  }
}
