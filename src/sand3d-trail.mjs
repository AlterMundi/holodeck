import {Group,InstancedMesh,Object3D,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {disposeModel} from './gallery-models.mjs';
import {sand3dTrailAssets} from './sand3d-trail-assets.mjs';
import {toroidalRotation} from './toroidal-locomotion.mjs';
import {TOROIDAL_TERRAIN,terrainElevation,terrainPosition,terrainTrail} from './toroidal-terrain.mjs';

const tau=2*Math.PI;
export const approachCoordinates=(x,z)=>({
  u:z/(tau*TOROIDAL_TERRAIN.majorRadius),
  v:.25-x/(tau*(TOROIDAL_TERRAIN.tubeRadius+18)),
});

// Irregular groups share a verge instead of making a row parallel to the facade.
const clumps=[
  ['pumice',-3.85,11.45,.65,1.12],['sensitive-fern',-3.48,11.90,.54,3.85],['feather-reed-grass',-3.98,12.40,.69,.96],
  ['pumice',3.55,16.70,.50,2.65],['sensitive-fern',3.88,17.10,.43,4.47],['feather-reed-grass',3.67,17.80,.74,5.60],
  ['feather-reed-grass',-3.22,18.80,.55,1.58],['sensitive-fern',-3.48,19.25,.53,2.72],
  ['pumice',-3.68,22.90,.52,1.98],['sensitive-fern',-3.32,23.55,.51,.48],['feather-reed-grass',-3.93,24.20,.68,3.23],
  ['pumice',3.56,28.45,.52,3.84],['feather-reed-grass',3.89,28.92,.81,.65],['feather-reed-grass',4.25,29.20,.47,2.18],
];

export function sand3dTrailPlacement(door){
  if(!door||![door.x,door.z].every(Number.isFinite)||Math.abs(door.facing)!==1)return [];
  const localDoor=door.x-TOROIDAL_TERRAIN.majorRadius;
  return clumps.flatMap(([name,x,z,scale,yaw])=>{
    const {u,v}=approachCoordinates(x,z);
    const along=(x-localDoor)*door.facing;
    const clearance=scale*.55;
    if(terrainTrail(u,v)>.22||along>-4.8-clearance&&along<1.25+clearance&&Math.abs(z-door.z)<2.8+clearance)
      return [];
    return [{name,u,v,scale,yaw}];
  });
}

export class Sand3DTrail{
  constructor(scene,base,origin,applyDaylight,daylight){
    Object.assign(this,{base,applyDaylight,daylight,active:false,attempted:false,groups:new Map()});
    this.group=new Group();
    this.group.name='Sand3D approach planting';
    this.group.position.fromArray(origin);
    this.group.visible=false;
    this.center=this.group.position;
    scene.add(this.group);
  }

  update(position,lightweight,door){
    const radius=this.active?56:42;
    const active=!lightweight&&!!door&&this.center.distanceToSquared(position)<radius**2;
    if(active!==this.active){
      this.active=active;
      if(!active){
        this.group.visible=false;
        this.loading?.abort();
        this.loading=null;
        this.attempted=false;
      }
    }
    if(!active)return;
    if(!this.attempted&&!this.groups.size){
      this.attempted=true;
      void this.load();
    }
    if(!this.groups.size)return;
    const doorKey=[door.x,door.z,door.facing].join(':');
    if(doorKey!==this.doorKey){
      this.doorKey=doorKey;
      this.place(sand3dTrailPlacement(door));
    }
    this.group.visible=true;
  }

  async load(){
    const loading=this.loading=new AbortController();
    const signal=AbortSignal.any([loading.signal,AbortSignal.timeout(8000)]);
    const loader=new GLTFLoader();
    const results=await Promise.allSettled(Object.entries(sand3dTrailAssets).map(async ([name,{path,bytes,sha256}])=>{
      const response=await fetch(new URL(path,this.base),{signal,redirect:'error'});
      if(!response.ok){await response.body?.cancel();throw Error('Trail model unavailable');}
      const buffer=await response.arrayBuffer();
      if(buffer.byteLength!==bytes)throw Error('Trail model size changed');
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),
        byte=>byte.toString(16).padStart(2,'0')).join('');
      if(digest!==sha256)throw Error('Trail model changed');
      const {scene}=await loader.parseAsync(buffer,'');
      return {name,scene};
    }));
    if(this.loading!==loading||signal.aborted||results.some(result=>result.status==='rejected')){
      for(const result of results)if(result.status==='fulfilled')disposeModel(result.value.scene);
      if(this.loading===loading)this.loading=null;
      return;
    }
    this.loading=null;
    const models=results.map(r=>r.value);
    if(!models.every(({scene})=>scene.children.length===1&&scene.children[0].isMesh&&!Array.isArray(scene.children[0].material))){
      for(const {scene} of models)disposeModel(scene);
      return;
    }
    for(const {name,scene} of models){
      const {geometry,material}=scene.children[0];
      const count=clumps.filter(entry=>entry[0]===name).length;
      const batch=new InstancedMesh(geometry,material,count);
      batch.name='Trail '+name;
      batch.count=0;
      this.applyDaylight(material,this.daylight);
      this.groups.set(name,batch);
      this.group.add(batch);
    }
  }

  place(placements){
    const transform=new Object3D(),point=new Vector3();
    for(const batch of this.groups.values())batch.count=0;
    for(const {name,u,v,scale,yaw} of placements){
      const batch=this.groups.get(name);
      point.fromArray(terrainPosition(u,v,terrainElevation(u,v)-.021));
      toroidalRotation(point,yaw,transform.quaternion);
      transform.position.copy(point).sub(this.center);
      transform.scale.setScalar(scale);
      transform.updateMatrix();
      batch.setMatrixAt(batch.count++,transform.matrix);
    }
    for(const batch of this.groups.values()){
      batch.instanceMatrix.needsUpdate=true;
      batch.computeBoundingSphere();
    }
  }

  dispose(){
    this.loading?.abort();
    this.loading=null;
    for(const batch of this.groups.values())batch.dispose();
    disposeModel(this.group);
    this.groups.clear();
  }
}
