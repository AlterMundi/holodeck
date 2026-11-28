import {Box3,Group} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {disposeModel} from './gallery-models.mjs';
import {fetchExact} from './toroidal-residence.mjs';

const viewDistance=900;
const empty=[];

class HouseExterior {
  constructor(scene,base,colliders,description,loader){
    Object.assign(this,{base,colliders,description,loader});
    const {origin,yaw,title}=description;
    this.root=new Group();
    this.root.name=title;
    this.root.position.set(origin.x,origin.y,origin.z);
    this.root.rotation.y=yaw*Math.PI/180;
    this.root.visible=false;
    this.models=new Map();
    this.pending=new Map();
    this.retryAt=new Map();
    scene.add(this.root);
  }

  async load(kind){
    if(this.models.has(kind)||this.pending.has(kind)||(this.retryAt.get(kind)??0)>performance.now())return;
    const controller=new AbortController();
    this.pending.set(kind,controller);
    try{
      const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(15000)]);
      const bytes=await fetchExact(this.base,this.description.assets[kind],signal);
      const {scene}=await this.loader.parseAsync(bytes,'');
      const bounds=new Box3().setFromObject(scene);
      if(controller.signal.aborted||bounds.isEmpty()||bounds.min.x < -36.05||bounds.max.x > 36.05||
        bounds.min.z < -36.05||bounds.max.z > 36.05){
        disposeModel(scene);
        throw Error('Exterior model does not fit its parcel');
      }
      scene.name='Owner exterior '+kind;
      scene.visible=false;
      scene.traverse(node=>{
        if(node.isMesh&&kind==='near'){node.castShadow=true;node.receiveShadow=true;}
      });
      this.root.add(scene);
      this.root.updateWorldMatrix(true,true);
      this.models.set(kind,scene);
      if(kind==='collision')this.collision=scene.getObjectByProperty('isMesh',true);
    }catch{
      this.retryAt.set(kind,performance.now()+8000);
    }finally{
      this.pending.delete(kind);
    }
  }

  update(position){
    const distance=this.root.position.distanceTo(position);
    const {nearUntilMetres,distanceFromMetres}=this.description;
    const near=this.models.get('near'),distant=this.models.get('distance');
    this.root.visible=distance<viewDistance;
    if(this.root.visible){
      if(distance<distanceFromMetres){
        void this.load('near');
        void this.load('collision');
      }
      if(!near||distance>=nearUntilMetres)void this.load('distance');
    }
    if(distance<nearUntilMetres)this.showNear=true;
    else if(distance>=distanceFromMetres)this.showNear=false;
    if(near)near.visible=this.showNear||!distant;
    if(distant)distant.visible=!near?.visible;
    const collision=this.root.visible&&this.collision&&distance<distanceFromMetres;
    if(Boolean(collision)!==Boolean(this.colliding)){
      if(collision)this.colliders.addCollider(this.collision);
      else this.colliders.removeCollider(this.collision);
      this.colliding=Boolean(collision);
    }
  }

  dispose(){
    for(const operation of this.pending.values())operation.abort();
    if(this.colliding)this.colliders.removeCollider(this.collision);
    this.root.removeFromParent();
    disposeModel(this.root);
  }
}

export function bindToroidalHouseExteriors(scene,base,colliders){
  const loader=new GLTFLoader(),houses=new Map();
  let selected;
  return {
    update(position,descriptions=empty){
      if(selected!==descriptions){
        selected=descriptions;
        for(const [id,house] of houses)
          if(!descriptions.some(description=>description.house===id&&description.revision===house.description.revision)){
            house.dispose();
            houses.delete(id);
          }
        for(const description of descriptions)
          if(!houses.has(description.house))houses.set(description.house,new HouseExterior(scene,base,colliders,description,loader));
      }
      if(position)for(const house of houses.values())house.update(position);
    },
    dispose(){for(const house of houses.values())house.dispose();houses.clear();selected=null;},
  };
}
