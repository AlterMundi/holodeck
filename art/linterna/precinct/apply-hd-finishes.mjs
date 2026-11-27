import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';

const limit=768*1024;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const JSON_CHUNK=0x4e4f534a;
const BINARY_CHUNK=0x004e4942;
const surfaces=[
  {names:['chalk','trim','limestone','ivory'],map:'marble',roughness:.49,relief:.52},
  {names:['oak','cedar','warmWood','Round atlas timber rim'],map:'cedar',roughness:.62,relief:.31},
  {names:['porticoTile'],map:'terracotta',roughness:.78,relief:.50},
  {names:['palePath','warmPath','darkPath'],map:'paving',roughness:.62,relief:.36},
  {names:['pompeian'],map:'fresco',roughness:.89,relief:.46},
];
const pigment={
  chalk:[1,.99,.98],trim:[.98,.95,.90],limestone:[.85,.82,.74],ivory:[1,.98,.94],
  cedar:[.53,.54,.55],oak:[.33,.34,.35],warmWood:[.90,.86,.80],
  'Round atlas timber rim':[.86,.79,.72],
  palePath:[1,.94,.85],warmPath:[.91,.80,.67],darkPath:[.78,.65,.50],
};

function unpack(bytes){
  assert.ok(bytes.length>=28&&bytes.toString('ascii',0,4)==='glTF'&&
    bytes.readUInt32LE(4)===2&&bytes.readUInt32LE(8)===bytes.length&&bytes.readUInt32LE(16)===JSON_CHUNK);
  const offset=20+bytes.readUInt32LE(12);
  assert.ok(offset+8<=bytes.length&&bytes.readUInt32LE(offset+4)===BINARY_CHUNK&&
    bytes.readUInt32LE(offset)===bytes.length-offset-8,'Use one embedded glTF buffer');
  const gltf=JSON.parse(bytes.toString('utf8',20,offset));
  assert.ok(gltf.buffers?.length===1&&!gltf.buffers[0].uri&&
    (gltf.images??[]).every(image=>!image.uri),'All original art must be embedded');
  return {gltf,bin:bytes.subarray(offset+8)};
}

function pack(gltf,bin){
  const json=Buffer.from(JSON.stringify(gltf));
  const padded=Math.ceil(json.length/4)*4;
  const buffer=Buffer.alloc(28+padded+bin.length);
  buffer.write('glTF');
  buffer.writeUInt32LE(2,4);
  buffer.writeUInt32LE(buffer.length,8);
  buffer.writeUInt32LE(padded,12);
  buffer.writeUInt32LE(JSON_CHUNK,16);
  buffer.fill(0x20,20,20+padded);
  json.copy(buffer,20);
  buffer.writeUInt32LE(bin.length,20+padded);
  buffer.writeUInt32LE(BINARY_CHUNK,24+padded);
  bin.copy(buffer,28+padded);
  return buffer;
}

function applyFinishes(bytes,maps){
  const {gltf,bin}=unpack(bytes);
  const vertices=gltf.meshes.flatMap(mesh=>mesh.primitives);
  const chunks=[bin];
  const added=new Map();
  let length=bin.length;
  const textureFor=name=>{
    if(added.has(name))return added.get(name);
    const image=maps.get(name);
    const padding=(4-image.length%4)%4;
    const bufferView=gltf.bufferViews.push({buffer:0,byteOffset:length,byteLength:image.length})-1;
    chunks.push(image,Buffer.alloc(padding));
    length+=image.length+padding;
    const source=gltf.images.push({name,bufferView,mimeType:'image/jpeg'})-1;
    const texture=gltf.textures.push({name,source,sampler:0})-1;
    added.set(name,texture);
    return texture;
  };
  const changed=[];
  for(const [index,material] of gltf.materials.entries()){
    const finish=surfaces.find(candidate=>candidate.names.includes(material.name));
    if(!finish)continue;
    const primitives=vertices.filter(primitive=>primitive.material===index);
    if(!primitives.length||primitives.some(primitive=>primitive.attributes.TEXCOORD_0===undefined))continue;
    const pbr=material.pbrMetallicRoughness;
    assert.ok(pbr?.baseColorTexture&&gltf.samplers?.length,material.name+' must have an existing UV material');
    pbr.baseColorFactor=[...(pigment[material.name]??[1,1,1]),1];
    pbr.baseColorTexture={index:textureFor(finish.map)};
    pbr.roughnessFactor=finish.roughness;
    material.normalTexture={index:textureFor(finish.map+'-normal'),scale:finish.relief};
    changed.push(material.name);
  }
  if(!changed.length)return {bytes,changed};
  gltf.buffers[0].byteLength=length;
  const packed=pack(gltf,Buffer.concat(chunks,length));
  assert.ok(packed.length<=limit,'The finished asset exceeds the 768 KiB part limit: '+packed.length);
  return {bytes:packed,changed};
}

const [baseArg,facadeArg,mapsArg,outArg]=process.argv.slice(2);
if(!baseArg||!facadeArg||!mapsArg||!outArg)
  throw Error('Usage: node art/linterna/precinct/apply-hd-finishes.mjs BASE_EDITION_DIR BASE_FACADE_GLB BAKED_MAP_DIR OUTPUT_DIR');
const base=resolve(baseArg), output=resolve(outArg);
assert.notEqual(base,output,'Use a separate directory for the finished edition');
const manifestName='linterna-all-temples.json';
const manifest=JSON.parse(await readFile(join(base,manifestName),'utf8'));
assert.equal(manifest.schema,'holodeck.linterna.hefesto-slice/v2');
assert.ok(manifest.cells.arrival&&manifest.cells.hefesto&&manifest.cells.atelier);
const maps=new Map();
for(const {map} of surfaces){
  for(const name of [map,map+'-normal']){
    const data=await readFile(join(mapsArg,name+'.jpg'));
    assert.ok(data.length>=4&&data.length<64000&&data.readUInt16BE(0)===0xffd8,'Invalid baked JPEG: '+name);
    maps.set(name,data);
  }
}

const results=new Map();
const report={files:[],maps:Object.fromEntries([...maps].map(([name,data])=>[name,digest(data)]))};
function stage(file,original,finished){
  const sha256=digest(finished.bytes);
  results.set(file,finished.bytes);
  report.files.push({file,from:digest(original),sha256,bytes:finished.bytes.length,materials:finished.changed});
  return {file,sha256,bytes:finished.bytes.length};
}
const facade=await readFile(facadeArg);
const dressedFacade=applyFinishes(facade,maps);
assert.ok(dressedFacade.changed.length>0,'The previous portico must expose the authored material slots');
stage('linterna-approach.glb',facade,dressedFacade);
for(const [room,data] of Object.entries(manifest.cells)){
  for(const [index,asset] of data.models.entries()){
    assert.match(asset.file,/^linterna-[a-z0-9-]+-[0-9a-f]{12}\.glb$/);
    const original=await readFile(join(base,asset.file));
    assert.ok(original.length===asset.bytes&&digest(original)===asset.sha256,'Base room art does not match the manifest');
    // The selected functional workshop edition owns its own finish and mesh.
    const finished=room==='atelier'?{bytes:original,changed:[]}:applyFinishes(original,maps);
    const name=finished.changed.length?asset.file.replace(/-[0-9a-f]{12}\.glb$/,'-'+digest(finished.bytes).slice(0,12)+'.glb'):asset.file;
    data.models[index]=stage(name,original,finished);
  }
}
const total=[...results.values()].reduce((sum,part)=>sum+part.length,0)-dressedFacade.bytes.length;
assert.ok(total<=12*1024*1024,'The finished edition exceeds the receiver budget');
await mkdir(output,{recursive:true});
for(const [file,bytes] of results)await writeFile(join(output,file),bytes);
const manifestBytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');
await writeFile(join(output,manifestName),manifestBytes);
report.manifestSha256=digest(manifestBytes);
await writeFile(join(output,'linterna-hd-finishes.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({dressed:report.files.filter(file=>file.materials.length).length,total,
  largest:Math.max(...[...results.values()].map(part=>part.length)),manifestSha256:report.manifestSha256}));
