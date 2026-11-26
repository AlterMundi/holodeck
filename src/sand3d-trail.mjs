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

const retryDelay=[1000,4000];
class InvalidTrailModel extends Error{}

async function trailBytes(response,bytes){
  if(!response.body||Number(response.headers.get('Content-Length'))>bytes){
    await response.body?.cancel();
    throw new InvalidTrailModel('Trail model size changed');
  }
  const result=new Uint8Array(bytes),reader=response.body.getReader();
  let offset=0;
  try{
    for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      if(offset+value.byteLength>bytes)throw new InvalidTrailModel('Trail model size changed');
      result.set(value,offset);
      offset+=value.byteLength;
    }
  }finally{await reader.cancel().catch(()=>{});}
  if(offset!==bytes)throw new InvalidTrailModel('Trail model size changed');
  return result.buffer;
}

export class Sand3DTrail{
  constructor(scene,base,origin,applyDaylight,daylight){
    Object.assign(this,{base,applyDaylight,daylight,groups:new Map(),
      attempts:new Map(Object.keys(sand3dTrailAssets).map(name=>[name,{count:0,retryAt:0}]))});
    this.group=new Group();
    this.group.name='Sand3D approach planting';
    this.group.position.fromArray(origin);
    this.group.visible=false;
    this.center=this.group.position;
    scene.add(this.group);
  }

  update(position,lightweight,door,now=performance.now()){
    const radius=this.activation?56:42;
    if(lightweight||!door||this.center.distanceToSquared(position)>=radius**2){
      this.suspend();
      return;
    }
    this.activation??=new AbortController();
    for(const [name,attempt] of this.attempts){
      if(!attempt.pending&&attempt.count<=retryDelay.length&&now>=attempt.retryAt){
        attempt.pending=true;
        attempt.count++;
        void this.load(name,attempt,this.activation);
      }
    }
    if(!this.groups.size)return;
    const doorKey=[door.x,door.z,door.facing].join(':');
    if(doorKey!==this.doorKey){
      this.doorKey=doorKey;
      this.place(sand3dTrailPlacement(door));
    }
    this.group.visible=true;
  }

  suspend(){
    if(!this.activation)return;
    this.activation.abort();
    this.activation=null;
    this.group.visible=false;
    for(const attempt of this.attempts.values())attempt.pending=false;
  }

  async load(name,attempt,activation){
    const {path,bytes,sha256}=sand3dTrailAssets[name];
    const signal=AbortSignal.any([activation.signal,AbortSignal.timeout(8000)]);
    let scene;
    try{
      const response=await fetch(new URL(path,this.base),{signal,redirect:'manual'});
      if(!response.ok){
        await response.body?.cancel();
        const {status}=response;
        if(status===408||status===429||status>=500)throw Error('Trail model temporarily unavailable');
        throw new InvalidTrailModel('Trail model unavailable');
      }
      const buffer=await trailBytes(response,bytes);
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),
        byte=>byte.toString(16).padStart(2,'0')).join('');
      if(digest!==sha256)throw new InvalidTrailModel('Trail model changed');
      signal.throwIfAborted();
      try{({scene}=await new GLTFLoader().parseAsync(buffer,''));}
      catch{throw new InvalidTrailModel('Trail model is not a valid GLB');}
      signal.throwIfAborted();
      const [mesh]=scene.children;
      if(scene.children.length!==1||!mesh.isMesh||Array.isArray(mesh.material))
        throw new InvalidTrailModel('Trail model must contain a single mesh');
      const {geometry,material}=mesh;
      const count=clumps.filter(entry=>entry[0]===name).length;
      const batch=new InstancedMesh(geometry,material,count);
      batch.name='Trail '+name;
      batch.count=0;
      this.applyDaylight(material,this.daylight);
      this.groups.set(name,batch);
      this.group.add(batch);
      this.doorKey=null;
      attempt.retryAt=Infinity;
      scene=null; // The batch owns the validated geometry and material.
    }catch(error){
      if(!activation.signal.aborted){
        const delay=retryDelay[attempt.count-1];
        attempt.retryAt=error instanceof InvalidTrailModel||delay===undefined?Infinity:performance.now()+delay;
      }
    }finally{
      if(scene)disposeModel(scene);
      if(this.activation===activation)attempt.pending=false;
    }
  }

  place(placements){
    const transform=new Object3D(),point=new Vector3();
    for(const batch of this.groups.values())batch.count=0;
    for(const {name,u,v,scale,yaw} of placements){
      const batch=this.groups.get(name);
      if(!batch)continue;
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
    this.suspend();
    for(const batch of this.groups.values())batch.dispose();
    disposeModel(this.group);
    this.groups.clear();
  }
}
