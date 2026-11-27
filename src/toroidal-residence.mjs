// Residencia de la Nobleza IA: CompAII's walkable palace in the toroidal world.
// The visual and collision models are exported from art/residencia-nobleza in
// Blender (metres, glTF Y up, entrance +Z). The palace stands on the planar
// grade in toroidal-terrain.mjs, so the walking solver carries its floors and
// stairs and the collision shell only bounds walls, columns, portal and roof.
import {Group, Matrix4, Quaternion, Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {residenceFrame} from './toroidal-terrain.mjs';
import {disposeModel} from './gallery-models.mjs';
import {residenceAssets} from './toroidal-residence-assets.mjs';

export {residenceAssets};

const SHOW_DISTANCE=900, COLLIDE_DISTANCE=95, RELEASE_DISTANCE=110;

export function residencePlacement(){
  const {origin,up,ex,ez}=residenceFrame;
  const basis=new Matrix4().makeBasis(new Vector3(...ex),new Vector3(...up),new Vector3(...ez));
  const quaternion=new Quaternion().setFromRotationMatrix(basis);
  return {origin:new Vector3(...origin),quaternion};
}

async function fetchExact(base,{path,bytes,sha256},signal){
  const response=await fetch(new URL(path,base),{signal,redirect:'error'});
  if(!response.ok){await response.body?.cancel();throw Error('Residence model unavailable');}
  const buffer=await response.arrayBuffer();
  if(buffer.byteLength!==bytes)throw Error('Residence model size changed');
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),
    byte=>byte.toString(16).padStart(2,'0')).join('');
  if(digest!==sha256)throw Error('Residence model changed');
  return buffer;
}

export class ToroidalResidence {
  constructor(scene,base,colliders,{loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),fetchModel=fetchExact}={}){
    Object.assign(this,{scene,base,colliders,loader,fetchModel});
    const {origin,quaternion}=residencePlacement();
    this.origin=origin;
    this.root=new Group();
    this.root.name='Residencia de la Nobleza IA';
    this.root.position.copy(origin);
    this.root.quaternion.copy(quaternion);
    this.root.visible=false;
    this.obstruction=null;
    this.colliding=false;
    this.loading=null;
  }

  update(position){
    if(!this.base)return;
    const distance=this.origin.distanceTo(position);
    if(!Number.isFinite(distance))return;
    if(distance<SHOW_DISTANCE&&!this.loaded&&!this.loading)void this.load();
    this.root.visible=Boolean(this.loaded)&&distance<SHOW_DISTANCE*1.1;
    if(!this.obstruction||!this.colliders)return;
    if(!this.colliding&&distance<COLLIDE_DISTANCE){
      this.colliders.addCollider(this.obstruction);
      this.colliding=true;
    }else if(this.colliding&&distance>RELEASE_DISTANCE)this.removeCollision();
  }

  async load(){
    const loading=this.loading=new AbortController();
    const signal=AbortSignal.any([loading.signal,AbortSignal.timeout(20000)]);
    try{
      const [visual,collision]=await Promise.all([residenceAssets.visual,residenceAssets.collision]
        .map(asset=>this.fetchModel(this.base,asset,signal).then(buffer=>this.loader.parseAsync(buffer,''))));
      if(this.loading!==loading){disposeModel(visual.scene);disposeModel(collision.scene);return;}
      const shell=collision.scene.getObjectByProperty('isMesh',true);
      if(!shell)throw Error('Residence collision shell missing');
      visual.scene.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;}});
      this.root.add(visual.scene);
      shell.removeFromParent();
      shell.visible=false;
      shell.name='Residence walls, columns and roof collision';
      this.root.add(shell);
      this.scene.add(this.root);
      this.root.updateWorldMatrix(true,true);
      disposeModel(collision.scene);
      this.obstruction=shell;
      this.loaded=true;
    }catch{
      // A failed or changed download leaves the world unchanged; the next approach retries.
    }finally{
      if(this.loading===loading)this.loading=null;
    }
  }

  removeCollision(){
    if(!this.colliding)return;
    this.colliders.removeCollider(this.obstruction);
    this.colliding=false;
  }

  dispose(){
    this.loading?.abort();
    this.loading=null;
    this.removeCollision();
    this.root.removeFromParent();
    disposeModel(this.root);
    this.loaded=false;
    this.obstruction=null;
  }
}
