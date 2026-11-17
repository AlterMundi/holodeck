/** Freeze creation geometry for the existing GLB viewer/Nexus static3D adapter.
 * This is content export, not world replay or evidence of a rendered human view.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {BoxGeometry,CylinderGeometry,SphereGeometry,Matrix4,Quaternion,Euler,Vector3,Color} from 'three';
import {worldDocument} from '../src/world.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export function exportWorldSnapshot(observation,scenery){
 if(observation?.schema!=='holodeck.situation/v1'||observation.place?.id!=='island-workshop'
  ||typeof observation.run!=='string'||typeof observation.edition!=='string'
  ||!Number.isSafeInteger(observation.source?.through)||observation.source.through<0||typeof observation.entities?.bridge?.raised!=='boolean'
  ||!Number.isSafeInteger(observation.entities.bridge.revision)||observation.entities.bridge.revision<0
  ||Object.keys(observation.entities).length>32)throw Error('Select a bounded workshop situation');
 for(const [id,entity]of Object.entries(observation.entities))if(id!=='bridge'){
  if(!/^garden-[a-z0-9-]{1,40}$/.test(id)||!Number.isFinite(entity.x)||!Number.isFinite(entity.z)
   ||Math.abs(entity.x)>7||Math.abs(entity.z)>6||!['mint','amber','rose'].includes(entity.color)
   ||!Number.isSafeInteger(entity.revision)||entity.revision<0||(entity.deleted!==undefined&&typeof entity.deleted!=='boolean'))throw Error('Unsupported creation element');
 }
 if(scenery.length>600000||scenery.readUInt32LE(0)!==0x46546c67||scenery.readUInt32LE(4)!==2||scenery.readUInt32LE(8)!==scenery.length)throw Error('Select the bounded authored scenery GLB');
 const jsonLength=scenery.readUInt32LE(12),document=JSON.parse(scenery.subarray(20,20+jsonLength).toString());
 const binaryStart=20+jsonLength;
 if(scenery.readUInt32LE(binaryStart+4)!==0x004e4942||document.images?.length||document.buffers.length!==1)throw Error('Unsupported scenery resource graph');
 const initial=scenery.subarray(binaryStart+8,binaryStart+8+scenery.readUInt32LE(binaryStart));
 const chunks=[initial],staticRoots=[...document.scenes[document.scene||0].nodes];let offset=initial.length;
 document.scenes=[{nodes:[]}];document.scene=0;document.asset.generator='Holodeck content snapshot exporter';
 document.asset.copyright='2026 Holodeck contributors; original workshop art under MIT';
 document.extras={holodeck:{schema:'holodeck.content-snapshot/v1',run:observation.run,edition:observation.edition,
  semanticSequence:observation.source.through,observation:observation.id,normalizedObservationSha256:digest(JSON.stringify(observation)),
  scenerySha256:digest(scenery),meaning:'Creation geometry from the selected authored source and captured semantic state; not running-world replay or a human-view capture',participantsExported:false}};
 function node(value,parent){const id=document.nodes.length;document.nodes.push(value);if(parent===null)document.scenes[0].nodes.push(id);else(document.nodes[parent].children??=[]).push(id);return id;}
 function data(array){const bytes=Buffer.from(array.buffer,array.byteOffset,array.byteLength);const id=document.bufferViews.length;document.bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length});chunks.push(bytes);offset+=bytes.length;return id;}
 function mesh(geometry,color,world,parent,name){
  const g=(geometry.index?geometry.toNonIndexed():geometry).applyMatrix4(world);g.computeVertexNormals();
  const position=g.attributes.position.array,normal=g.attributes.normal.array,mins=[Infinity,Infinity,Infinity],maxs=[-Infinity,-Infinity,-Infinity];
  position.forEach((value,index)=>{mins[index%3]=Math.min(mins[index%3],value);maxs[index%3]=Math.max(maxs[index%3],value);});
  const p=document.accessors.length;document.accessors.push({bufferView:data(position),componentType:5126,count:position.length/3,type:'VEC3',min:mins,max:maxs});
  const n=document.accessors.length;document.accessors.push({bufferView:data(normal),componentType:5126,count:normal.length/3,type:'VEC3'});
  const c=new Color(color),material=document.materials.length;document.materials.push({pbrMetallicRoughness:{baseColorFactor:[c.r,c.g,c.b,1],metallicFactor:0,roughnessFactor:.85}});
  const index=document.meshes.length;document.meshes.push({primitives:[{attributes:{POSITION:p,NORMAL:n},material}]});node({name,mesh:index},parent);g.dispose();
 }
 const room={run:observation.run,edition:observation.edition,sequence:observation.source.through,entities:observation.entities,projections:new Map()};
 const stack=[{node:null,world:new Matrix4()}];let count=0;
 for(const match of worldDocument(room).matchAll(/<(\/?)(m-[a-z-]+)\b([^>]*)>/g)){
  const [,closing,tag,raw]=match;if(closing){if(tag==='m-group')stack.pop();continue;}
  const attrs=Object.fromEntries([...raw.matchAll(/([\w-]+)="([^"]*)"/g)].map(row=>[row[1],row[2]]));
  const number=(key,fallback=0)=>attrs[key]===undefined?fallback:Number(attrs[key]);
  const local=new Matrix4().compose(new Vector3(number('x'),number('y'),number('z')),
   new Quaternion().setFromEuler(new Euler(number('rx')*Math.PI/180,number('ry')*Math.PI/180,number('rz')*Math.PI/180)),new Vector3(1,1,1));
  const current=stack.at(-1),world=current.world.clone().multiply(local);
  if(tag==='m-group'){
   const value={name:attrs.id||'Group',extras:{holodeckEntity:attrs.id||null,revision:number('data-entity-revision',null)}};
   stack.push({node:node(value,current.node),world});continue;
  }
  if(tag==='m-model'){
   if(attrs.id!=='island-scenery'||attrs.src!=='/assets/island-scenery.glb')throw Error('Unsupported authored model');
   for(const id of staticRoots)(document.nodes[current.node].children??=[]).push(id);continue;
  }
  if(number('opacity',1)===0)continue;
  let geometry;
  if(tag==='m-cube')geometry=new BoxGeometry(number('width',1),number('height',1),number('depth',1));
  else if(tag==='m-cylinder')geometry=new CylinderGeometry(number('radius',1),number('radius',1),number('height',1),16);
  else if(tag==='m-sphere')geometry=new SphereGeometry(number('radius',1),16,12);
  else throw Error('Unsupported snapshot primitive');
  mesh(geometry,attrs.color||'#ffffff',world,current.node,`${tag.slice(2)}-${++count}`);
 }
 document.buffers=[{byteLength:offset}];
 let json=Buffer.from(JSON.stringify(document));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,0x20)]);
 const binary=Buffer.concat(chunks),length=28+json.length+binary.length;
 if(length>2*1024*1024)throw Error('Snapshot exceeds its two-MiB bound');
 const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
 const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(binary.length);binHeader.writeUInt32LE(0x004e4942,4);
 return Buffer.concat([header,json,binHeader,binary]);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('Usage: node tools/export-world-snapshot.mjs SITUATION.json SNAPSHOT.glb');
 const bytes=readFileSync(input);if(bytes.length>256*1024)throw Error('Situation input exceeds256KiB');
 const value=JSON.parse(bytes);if(value.ok===false)throw Error('The world observation was not confirmed');
 const result=exportWorldSnapshot(value.result||value.observation||value,readFileSync(new URL('../public/assets/island-scenery.glb',import.meta.url)));
 writeFileSync(output,result,{flag:'wx',mode:0o600});console.log(JSON.stringify({bytes:result.length,sha256:digest(result)}));
}
