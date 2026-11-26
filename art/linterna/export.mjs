import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import * as T from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createFacade,createRoom} from './model.mjs';

const outputDir=process.argv[2];
if(!outputDir)throw Error('Usage: node art/linterna/export.mjs OUTPUT_DIR');
const target=resolve(outputDir);
const dimensions=JSON.parse(await readFile(new URL('./dimensions.json',import.meta.url),'utf8'));

// The mesh-only exporter reads its final GLB Blob via FileReader.
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(buffer=>{
      this.result=buffer;
      this.onloadend?.();
    });
  }
};

function materialBatches(root){
  root.updateMatrixWorld(true);
  const batches=new Map();
  root.traverse(item=>{
    if(!item.isMesh)return;
    const geometry=item.geometry.index?item.geometry.toNonIndexed():item.geometry.clone();
    for(const name of Object.keys(geometry.attributes))
      if(name!=='position'&&name!=='normal')geometry.deleteAttribute(name);
    geometry.applyMatrix4(item.matrixWorld);
    for(const attr of ['position','normal']){
      const values=geometry.getAttribute(attr)?.array;
      assert.ok(values?.every(Number.isFinite),item.name+' needs finite '+attr+' data');
    }
    if(!batches.has(item.material))batches.set(item.material,[]);
    batches.get(item.material).push(geometry);
  });
  const model=new T.Group();
  model.name=root.name;
  for(const [finish,geometries] of batches){
    const merged=mergeGeometries(geometries);
    geometries.forEach(geometry=>geometry.dispose());
    assert.ok(merged);
    const mesh=new T.Mesh(merged,finish);
    mesh.name=finish.name;
    model.add(mesh);
  }
  return model;
}

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const asBounds=group=>{
  const result=new T.Box3().setFromObject(group);
  return {min:result.min.toArray(),max:result.max.toArray()};
};
function inside(a,b){
  return a.min.every((value,i)=>value>=b.min[i]-1e-5)&&a.max.every((value,i)=>value<=b.max[i]+1e-5);
}
const definitions={
  facade:createFacade(dimensions),
  ...Object.fromEntries(Object.keys(dimensions.rooms).map(id=>[id,createRoom(id,dimensions)])),
};
const results={units:'m',up:'Y',facadeEntrance:'+Z',roomCoordinates:'room-local',three:T.REVISION,assets:{}};
await mkdir(target,{recursive:true});
for(const [id,original] of Object.entries(definitions)){
  const model=materialBatches(original);
  const bytes=await new GLTFExporter().parseAsync(model,{binary:true,onlyVisible:true});
  const reopened=await new GLTFLoader().parseAsync(bytes,'');
  const bounds=asBounds(reopened.scene);
  const originalBounds=asBounds(model);
  assert.ok(inside(bounds,originalBounds)&&inside(originalBounds,bounds));
  const coat=id==='facade'?{min:[-1,0,-2],max:[1,2.62,2]}:{min:[-5.9,0,-5.9],max:[5.9,3.3,5.9]};
  assert.ok(inside(bounds,coat),id+' exceeds the selected envelope');
  if(id==='facade'){
    assert.ok(Math.abs(bounds.min[0]+.78)<1e-5&&Math.abs(bounds.max[0]-.78)<1e-5);
    assert.ok(Math.abs(bounds.min[2]+1.68)<1e-5&&Math.abs(bounds.max[2]-1.95)<1e-5);
  }
  const triangles=model.children.reduce((count,mesh)=>count+mesh.geometry.attributes.position.count/3,0);
  assert.ok(triangles>0&&triangles<=14000);
  assert.ok(bytes.byteLength<=768*1024,id+' exceeds the owned kit byte bound');
  const file='linterna-'+id+'.glb';
  const buffer=Buffer.from(bytes);
  await writeFile(join(target,file),buffer);
  results.assets[id]={file,bytes:buffer.byteLength,sha256:digest(buffer),bounds,triangles,materialBatches:model.children.length};
}
await writeFile(join(target,'linterna-models.json'),JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results,null,2));
