import {createHash} from 'node:crypto';
import {lstatSync,readFileSync} from 'node:fs';
import {join} from 'node:path';

const RESOURCE=/^[a-f0-9]{32}$/;
const DIGEST=/^[a-f0-9]{64}$/;
const valid=(value,pattern)=>typeof value==='string'&&pattern.test(value);
const MODEL_LIMIT=384*1024;
const ALLOWED=new Set(['asset','scene','scenes','nodes','materials','meshes','accessors','bufferViews','buffers']);

function smallFile(path,limit){
  const stat=lstatSync(path);
  if(!stat.isFile()||stat.size>limit)throw Error('Collection asset exceeds its file bounds');
  return readFileSync(path);
}

function verifyModel(bytes,digest){
  if(createHash('sha256').update(bytes).digest('hex')!==digest||bytes.length<28||
     bytes.readUInt32LE(0)!==0x46546c67||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length||
     bytes.readUInt32LE(16)!==0x4e4f534a)throw Error('Invalid Collection model');
  const end=20+bytes.readUInt32LE(12);
  if(end+8>bytes.length||end>64*1024||bytes.readUInt32LE(end+4)!==0x004e4942||
     end+8+bytes.readUInt32LE(end)!==bytes.length)throw Error('Invalid Collection model chunks');
  const gltf=JSON.parse(bytes.subarray(20,end));
  if(!Object.keys(gltf).every(key=>ALLOWED.has(key))||
     gltf.buffers?.length!==1||Object.hasOwn(gltf.buffers[0],'uri')||
     gltf.scenes?.length!==1||!gltf.nodes?.length||gltf.nodes.length>128||
     !gltf.meshes?.length||gltf.meshes.length>64||!gltf.accessors?.length||gltf.accessors.length>384||
     gltf.accessors.some(value=>value.sparse||!Number.isInteger(value.count)||value.count<1||value.count>14400)||
     gltf.accessors.reduce((total,value)=>total+value.count,0)>48000)
    throw Error('Collection model must be a small static GLB');
  let triangles=0;
  for(const mesh of gltf.meshes){
    for(const primitive of mesh.primitives){
      const count=gltf.accessors[primitive.indices]?.count;
      if((primitive.mode??4)!==4||!count||count%3||primitive.targets||primitive.extensions)
        throw Error('Collection model must contain indexed static triangles');
      triangles+=count/3;
    }
  }
  if(!triangles||triangles>4800)throw Error('Collection model exceeds the triangle budget');
}

export function readCollectionRepresentatives(stateDir,selection){
  const entries=new Map();
  if(!stateDir||!selection)return entries;
  const directory=join(stateDir,'collection-representatives');
  let manifest;
  try{manifest=JSON.parse(smallFile(join(directory,'index.json'),16*1024));}
  catch(error){if(error.code==='ENOENT')return entries;throw error;}
  if(!manifest||manifest.schema!=='holodeck.collection-representatives/v1'||
     !Array.isArray(manifest.entries)||manifest.entries.length>18)throw Error('Invalid Collection representative index');
  const allowed=new Set(selection.projects.flatMap(project=>project.resources));
  for(const record of manifest.entries){
    if(!record||Object.keys(record).sort().join(',')!=='resource,scene,sha256,version'||
       !valid(record.resource,RESOURCE)||!allowed.has(record.resource)||!valid(record.version,DIGEST)||
       !valid(record.scene,DIGEST)||!valid(record.sha256,DIGEST))throw Error('Invalid Collection representative edition');
    const key=record.resource+':'+record.version;
    if(entries.has(key))throw Error('Select one representative per exact edition');
    const bytes=smallFile(join(directory,record.sha256+'.glb'),MODEL_LIMIT);
    verifyModel(bytes,record.sha256);
    entries.set(key,{...record,bytes});
  }
  return entries;
}
