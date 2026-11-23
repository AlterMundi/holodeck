import {Box3,Group,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {sameVisitPin,validVisitPin} from './content-visits.mjs';
import {GALLERY_STAGES} from './gallery-display.mjs';

const MODEL_BYTES=4*1024*1024;
const LEASE_MS=30000;
const hex=(s,n)=>typeof s==='string'&&s.length===n&&/^[a-f0-9]+$/.test(s);

async function read(request,path,signal,limit,version){
  const response=await request(path,{credentials:'same-origin',cache:'no-store',redirect:'error',signal});
  if(!response.ok||response.redirected||Number(response.headers.get('Content-Length'))>limit||
     version&&response.headers.get('X-Home-Version')!==version){
    await response.body?.cancel();
    throw Error('Gallery source unavailable');
  }
  const reader=response.body.getReader(),chunks=[];
  let bytes=0;
  try{
    for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      bytes+=value.byteLength;
      if(bytes>limit)throw Error('Gallery source exceeds size limit');
      chunks.push(value);
    }
  }finally{reader.cancel().catch(()=>{});}
  const result=new Uint8Array(bytes);let offset=0;
  for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.byteLength;}
  return result;
}

const json=bytes=>JSON.parse(new TextDecoder().decode(bytes));
export async function readGalleryModel(pin,{request=fetch,signal}={}){
  if(!validVisitPin(pin)||pin.kind!=='artifact_review'||pin.adapter!=='interactive_3d')
    throw Error('Select an exact 3D review');
  const manifest=json(await read(request,'/nexus/api/tables/'+encodeURIComponent(pin.tableId)+'/artifact-review',signal,16384));
  const {source}=manifest;
  if(manifest.schema_version!==1||manifest.table_id!==pin.tableId||manifest.review_id!==pin.reviewId||
     manifest.revision!==pin.revision||manifest.adapter!==pin.adapter||
     !hex(source?.resource,32)||!hex(source.publicationVersion,64))
    throw Error('Gallery edition changed');
  const version=source.publicationVersion,prefix='/works/'+source.resource+'/'+version+'/';
  const creation=json(await read(request,prefix+'creation.json',signal,131072,version));
  if(creation.schema!=='holodeck.creation-source/v1'||!hex(creation.snapshotSha256,64))
    throw Error('Gallery snapshot unavailable');
  const bytes=await read(request,prefix+'snapshot.glb',signal,MODEL_BYTES,version);
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
  if(hash!==creation.snapshotSha256)throw Error('Gallery snapshot changed');
  const header=new DataView(bytes.buffer);
  if(bytes.byteLength<28||header.getUint32(0,true)!==0x46546c67||header.getUint32(4,true)!==2||
     header.getUint32(8,true)!==bytes.byteLength||header.getUint32(16,true)!==0x4e4f534a)
    throw Error('Gallery snapshot is not a GLB');
  const end=20+header.getUint32(12,true);
  if(end+8>bytes.byteLength||end>512*1024||header.getUint32(end+4,true)!==0x004e4942||
     end+8+header.getUint32(end,true)!==bytes.byteLength)throw Error('Invalid gallery chunks');
  const gltf=json(bytes.subarray(20,end));
  // Only the self-contained, untextured static snapshot emitted by the
  // existing Holodeck publisher is mounted here. Nexus remains the viewer
  // for other model formats and interactive reviews.
  if(gltf.buffers?.length!==1||gltf.buffers[0].uri!==undefined||gltf.images?.length||
     gltf.extensionsUsed?.length||gltf.extensionsRequired?.length||gltf.animations?.length||
     gltf.skins?.length||gltf.scenes?.length!==1||!gltf.meshes?.length||gltf.meshes.length>256||
     !gltf.nodes?.length||gltf.nodes.length>512||
     !gltf.accessors?.length||gltf.accessors.length>2048||
     gltf.accessors.some(accessor=>accessor.sparse||!Number.isSafeInteger(accessor.count)||accessor.count<1||accessor.count>300000)||
     gltf.accessors.reduce((sum,accessor)=>sum+accessor.count,0)>1200000||
     gltf.meshes.reduce((sum,mesh)=>sum+mesh.primitives.length,0)>256)
    throw Error('Gallery snapshot exceeds its display format');
  return bytes.buffer;
}

function disposeModel(root){
  const geometry=new Set(),materials=new Set();
  root.traverse(node=>{
    if(node.geometry)geometry.add(node.geometry);
    if(node.material)for(const material of [node.material].flat())materials.add(material);
  });
  root.removeFromParent();
  for(const item of geometry)item.dispose();
  for(const item of materials)item.dispose();
}

export function placeGalleryModel(scene,plinth){
  const model=new Group();model.add(scene);
  const omit=[];
  scene.traverse(node=>{
    if(node.isMesh&&(Array.isArray(node.material)?node.material:[node.material]).every(material=>material?.name==='water'))omit.push(node);
  });
  // Invisible meshes stay owned by the model for disposal.
  for(const node of omit)node.visible=false;
  model.updateMatrixWorld(true);
  const bounds=new Box3();
  scene.traverse(node=>{
    if(!node.isMesh||omit.includes(node))return;
    node.castShadow=true;
    node.receiveShadow=true;
    node.geometry.computeBoundingBox();
    bounds.union(node.geometry.boundingBox.clone().applyMatrix4(node.matrixWorld));
  });
  const size=bounds.getSize(new Vector3()),center=bounds.getCenter(new Vector3());
  const scale=Math.min(1.10/size.x,.83/size.z,.65/size.y);
  if(bounds.isEmpty()||!Number.isFinite(scale)||scale<=0){disposeModel(model);throw Error('Gallery snapshot has no displayable bounds');}
  model.scale.setScalar(scale);
  model.position.set(plinth.x-center.x*scale,plinth.y+.015-bounds.min.y*scale,plinth.z-center.z*scale);
  return model;
}

export class GalleryModels{
  constructor(scene,{readModel=readGalleryModel,loader=new GLTFLoader(),now=()=>performance.now()}={}){
    Object.assign(this,{scene,readModel,loader,now});this.items=new Map();
  }

  sync(entries){
    const current=entries.filter(entry=>entry.galleryDisplay===true&&Object.hasOwn(GALLERY_STAGES,entry.id));
    for(const [id,item] of this.items){
      if(item.failed||!current.some(entry=>entry.id===id&&entry.nodeRevision===item.entry.nodeRevision&&sameVisitPin(entry.pin,item.entry.pin)))this.remove(id);
    }
    for(const entry of current){
      const item=this.items.get(entry.id);
      if(item)item.expires=this.now()+LEASE_MS;
      else this.load(entry);
    }
  }

  load(entry){
    const controller=new AbortController(),item={entry,controller,expires:this.now()+LEASE_MS};
    this.items.set(entry.id,item);
    this.readModel(entry.pin,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(9000)])})
      .then(bytes=>this.loader.parseAsync(bytes,'')).then(({scene})=>{
        if(this.items.get(entry.id)!==item||this.now()>=item.expires){disposeModel(scene);return;}
        const model=placeGalleryModel(scene,GALLERY_STAGES[entry.id].position);
        model.name=entry.id+'-display';
        this.scene.add(model);item.model=model;
      }).catch(()=>{item.failed=true;});
  }

  update(){
    for(const [id,item] of this.items)if(this.now()>=item.expires)this.remove(id);
  }

  remove(id){
    const item=this.items.get(id);
    item.controller.abort();
    if(item.model)disposeModel(item.model);
    this.items.delete(id);
  }

  clear(){for(const id of this.items.keys())this.remove(id);}
}
