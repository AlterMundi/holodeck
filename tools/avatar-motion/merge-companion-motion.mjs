// Keep the qualified companion's skeletal tracks on an export with the same
// joint names. Leave the new mesh, materials, weights and facial morphs intact.
// Usage: node tools/avatar-motion/merge-companion-motion.mjs INPUT.glb OUTPUT.glb
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {parseGlb} from './rig.mjs';

const bytes=readFileSync(process.argv[2]);
const jsonLength=bytes.readUInt32LE(12);
const binStart=28+jsonLength;
const doc=JSON.parse(bytes.toString('utf8',20,20+jsonLength));
const rig=new Map(doc.nodes.map(({name},i)=>[name,i]));
const {animations}=await parseGlb(new URL('../../public/assets/avatar/navegante-blender.glb',import.meta.url));
assert.deepEqual(animations.map(x=>x.name).sort(),doc.animations.map(x=>x.name).sort());
const chunks=[bytes.subarray(binStart)];
let offset=chunks[0].length;
function append(values,type){
  const data=Buffer.alloc(values.length*4);
  for(const [i,value] of values.entries())data.writeFloatLE(value,i*4);
  const bufferView=doc.bufferViews.push({buffer:0,byteOffset:offset,byteLength:data.length})-1;
  chunks.push(data);
  offset+=data.length;
  return doc.accessors.push({bufferView,componentType:5126,type,count:values.length/({SCALAR:1,VEC3:3,VEC4:4}[type]),
    ...(type==='SCALAR'?{min:[values[0]],max:[values.at(-1)]}:{})})-1;
}
const channels={position:['translation','VEC3'],quaternion:['rotation','VEC4'],scale:['scale','VEC3']};
doc.animations=animations.map(clip=>{
  const samplers=[];
  const targets=clip.tracks.flatMap(track=>{
    const [name,prop]=track.name.split('.');
    // The model's visible face is driven by its own speech and eye hooks.
    if(prop==='morphTargetInfluences')return [];
    const node=rig.get(name),[path,type]=channels[prop];
    assert.ok(Number.isInteger(node)&&path,track.name);
    const sampler=samplers.push({input:append(track.times,'SCALAR'),output:append(track.values,type),interpolation:'LINEAR'})-1;
    return [{sampler,target:{node,path}}];
  });
  return {name:clip.name,samplers,channels:targets};
});
doc.buffers[0].byteLength=offset;
const json=Buffer.from(JSON.stringify(doc));
const padded=Buffer.alloc((json.length+3)&~3,32);json.copy(padded);
const header=Buffer.from(bytes.subarray(0,20));
header.writeUInt32LE(28+padded.length+offset,8);
header.writeUInt32LE(padded.length,12);
const binary=Buffer.from(bytes.subarray(binStart-8,binStart));
binary.writeUInt32LE(offset,0);
writeFileSync(process.argv[3],Buffer.concat([header,padded,binary,...chunks]),{mode:0o600,flag:'wx'});
