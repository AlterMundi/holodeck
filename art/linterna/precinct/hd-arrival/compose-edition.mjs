import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

const [base,art,out]=process.argv.slice(2);
if(!out)throw Error('Usage: compose-edition.mjs BASE_EDITION ARRIVAL_EXPORT OUTPUT_EDITION');
const predecessor=await readFile(join(base,'manifest.json'));
const manifest=JSON.parse(predecessor);
const report=JSON.parse(await readFile(join(art,'arrival-report.json')));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sane=value=>Math.round(value*10000)/10000;
const digestFile=(dir,file)=>readFile(join(dir,file)).then(bytes=>({bytes,sha256:sha(bytes)}));
assert.equal(manifest.schema,'holodeck.linterna.hefesto-slice/v2');
assert.ok(manifest.cells.arrival&&manifest.cells.athena&&manifest.cells.hefesto);
assert.ok(report.files.length<=6&&report.files.length>0);
assert.equal(new Set(report.files.map(part=>part.name)).size,report.files.length);
await mkdir(out,{recursive:false});
const parts=[];
for(const part of report.files){
  assert.match(part.name,/^(hall|hall-detail|temples|landscape|planting|foliage)$/);
  const {bytes,sha256}=await digestFile(art,part.name+'.glb');
  assert.equal(bytes.toString('ascii',0,4),'glTF');
  assert.equal(part.bytes,bytes.length);
  assert.ok(bytes.length<=768*1024);
  const file='linterna-hd-'+part.name+'-'+sha256.slice(0,12)+'.glb';
  await writeFile(join(out,file),bytes);
  parts.push({file,sha256,bytes:bytes.length});
}
manifest.cells.arrival.models=parts;
const newHallFloor=.05;
const platform=manifest.cells.arrival.floor.find(floor=>floor.top>0);
assert.ok(platform);
const oldHallFloor=platform.top;
platform.top=newHallFloor;
manifest.cells.arrival.colliders=report.obstacles.map(collider=>({
  position:collider.position.map(sane),size:collider.size.map(sane),rotationY:sane(collider.rotationY*180/Math.PI),
}));
assert.ok(manifest.cells.arrival.colliders.length<=192);
const arrivalDoors=[];
for(const {sides} of manifest.passages){
  const side=sides.find(side=>side.cell==='arrival');
  if(!side)continue;
  if(side.surfaceY===oldHallFloor)side.surfaceY=newHallFloor;
  const adjacent=sides.find(other=>other!==side);
  arrivalDoors.push({exterior:adjacent?.keepParcelOffer===true,stand:side.stand,threshold:side.threshold});
}
let total=parts.reduce((n,v)=>n+v.bytes,0);
for(const [cell,selection] of Object.entries(manifest.cells)){
  if(cell==='arrival')continue;
  for(const model of selection.models){
    assert.match(model.file,/^[a-z][a-z0-9-]{0,95}\.glb$/);
    const existing=await digestFile(base,model.file);
    assert.equal(existing.sha256,model.sha256);
    assert.equal(existing.bytes.length,model.bytes);
    await copyFile(join(base,model.file),join(out,model.file));
    total+=model.bytes;
  }
}
const content=Buffer.from(JSON.stringify(manifest,null,2)+'\n');
assert.ok(content.length<=96000&&total+content.length<=12*1024*1024);
const blocked=(point,radius=.24)=>manifest.cells.arrival.colliders.some(collider=>{
  const [width,height,depth]=collider.size,[x,y,z]=collider.position;
  if(y+height/2<=.10||y-height/2>=1.68)return false;
  const yaw=collider.rotationY*Math.PI/180, dx=point[0]-x, dz=point[1]-z;
  return Math.abs(Math.cos(yaw)*dx-Math.sin(yaw)*dz)<width/2+radius&&
    Math.abs(Math.sin(yaw)*dx+Math.cos(yaw)*dz)<depth/2+radius;
});
for(const {stand,threshold} of arrivalDoors){
  assert.ok(!blocked(stand), 'Door landing blocked at '+stand);
  for(let t=.04;t<1;t+=.1){
    const point=threshold.map((value,index)=>value+(stand[index]-value)*t);
    assert.ok(!blocked(point,.17),'Door approach blocked at '+point);
  }
}
// Flood the admitted flat ground with avatar clearance. Every arrival
// doorway must connect to the exterior stand without passing through art.
const start=arrivalDoors.find(door=>door.exterior).stand;
const key=(x,z)=>x+':'+z;
const resolution=.25;
const grid=([x,z])=>[Math.round(x/resolution),Math.round(z/resolution)];
const seen=new Set(), queue=[grid(start)];
while(queue.length){
  const [x,z]=queue.pop();
  const id=key(x,z);
  if(seen.has(id)||x < -26/resolution||x > 26/resolution||z < -33/resolution||z > 21/resolution)continue;
  if(blocked([x*resolution,z*resolution]))continue;
  seen.add(id);
  queue.push([x+1,z],[x-1,z],[x,z+1],[x,z-1]);
}
for(const item of arrivalDoors)assert.ok(seen.has(key(...grid(item.stand))), 'Door cannot be reached '+item.stand);
await writeFile(join(out,'manifest.json'),content);
console.log(JSON.stringify({before:sha(predecessor),after:sha(content),models:parts,totalBytes:total+content.length,
  cells:Object.keys(manifest.cells),floor:newHallFloor,colliders:manifest.cells.arrival.colliders.length,
  reachableDoorCount:arrivalDoors.length,reachableGridPoints:seen.size},null,2));
