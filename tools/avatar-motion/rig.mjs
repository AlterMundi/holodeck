// Load the shipped avatar rigs outside a browser and drive the same runtime
// modules the client uses. Textures and Draco surfaces are left out. Bones,
// bind matrices and animation channels are the packaged bytes.
import {readFileSync} from 'node:fs';
import {AnimationMixer,Bone,Group,Matrix4,Skeleton,SkinnedMesh} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {CompanionAvatar} from '../../src/companion-avatar.mjs';

const assets=new URL('../../public/assets/',import.meta.url);

export function untextured(bytes){
  const length=bytes.readUInt32LE(12);
  const contents=JSON.parse(bytes.toString('utf8',20,20+length));
  for(const material of contents.materials??[]){
    for(const key of ['normalTexture','occlusionTexture','emissiveTexture'])delete material[key];
    delete material.pbrMetallicRoughness?.baseColorTexture;
    delete material.pbrMetallicRoughness?.metallicRoughnessTexture;
  }
  delete contents.images;delete contents.textures;delete contents.samplers;
  const text=Buffer.from(JSON.stringify(contents));
  const json=Buffer.alloc(Math.ceil(text.length/4)*4,32);
  text.copy(json);
  const header=Buffer.from(bytes.subarray(0,20)),rest=bytes.subarray(20+length);
  header.writeUInt32LE(20+json.length+rest.length,8);
  header.writeUInt32LE(json.length,12);
  return Buffer.concat([header,json,rest]);
}

export async function parseGlb(path){
  const bytes=untextured(readFileSync(path));
  const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length);
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buffer,'');
}

export const presentation=({reduced=false}={})=>{
  const media={matches:reduced};
  return {hidden:false,media,defaultView:{matchMedia:()=>media},addEventListener(){},removeEventListener(){}};
};

// The companion normally fetches its packaged GLB over HTTP. Read the same
// registered file instead, then use its controller and mixer as they are.
export async function loadCompanion({document=presentation(),model=new URL('avatar/navegante-blender.glb',assets)}={}){
  const loadAsync=GLTFLoader.prototype.loadAsync;
  GLTFLoader.prototype.loadAsync=()=>parseGlb(model);
  const scene=new Group();
  try{
    const avatar=new CompanionAvatar({scene,document,base:new URL('http://fixture.invalid/')});
    for(let tries=0;!avatar.figure&&tries<400;tries++)await new Promise(resolve=>setTimeout(resolve,5));
    if(!avatar.figure)throw Error('The companion did not load');
    return {avatar,scene,document};
  }finally{GLTFLoader.prototype.loadAsync=loadAsync;}
}

export function humanAvatar(file){
  const bytes=readFileSync(new URL(file,assets));
  const length=bytes.readUInt32LE(12);
  const {nodes,skins,accessors,bufferViews,scenes}=JSON.parse(bytes.toString('utf8',20,20+length));
  const {joints,inverseBindMatrices}=skins[0];
  const bones=new Set(joints);
  const objects=nodes.map((entry,index)=>{
    const object=bones.has(index)?new Bone():new Group();
    object.name=entry.name;
    if(entry.translation)object.position.fromArray(entry.translation);
    if(entry.rotation)object.quaternion.fromArray(entry.rotation);
    if(entry.scale)object.scale.fromArray(entry.scale);
    return object;
  });
  nodes.forEach((entry,index)=>{for(const child of entry.children??[])objects[index].add(objects[child]);});
  const {bufferView,byteOffset=0,count}=accessors[inverseBindMatrices];
  const start=28+length+(bufferViews[bufferView].byteOffset??0)+byteOffset;
  const inverse=Array.from({length:count},(_,i)=>new Matrix4().fromArray(
    Array.from({length:16},(_,j)=>bytes.readFloatLE(start+i*64+j*4))));
  const root=new Group(),mesh=new SkinnedMesh();
  for(const node of scenes[0].nodes)mesh.add(objects[node]);
  mesh.skeleton=new Skeleton(joints.map(index=>objects[index]),inverse);
  root.add(mesh);
  root.getMesh=()=>mesh;
  return {root,mesh};
}

// The stock locomotion clips, blended over the rig the way a mixer would.
export async function stockLocomotion(mesh){
  const mixer=new AnimationMixer(mesh);
  const names=new Set();
  mesh.traverse(object=>names.add(object.name));
  const clips={};
  for(const name of ['idle','jog','run','air']){
    const {animations:[clip]}=await parseGlb(new URL(`anim_${name}.glb`,assets));
    const copy=clip.clone();
    copy.tracks=copy.tracks.filter(track=>{
      const [bone,property]=track.name.split('.');
      return names.has(bone)&&(property==='quaternion'||bone==='pelvis'&&property==='position');
    });
    clips[name]=mixer.clipAction(copy).play().setEffectiveWeight(name==='idle'?1:0);
  }
  return {mixer,clips};
}
