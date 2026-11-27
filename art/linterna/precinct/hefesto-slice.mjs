import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {Box3,Euler,Vector3} from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {batchModel} from './batch.mjs';
import {floorClearance,makeHefestoSliceScenes} from './model.mjs';
import {hall,makeJourneys,makeStops,pavilionDoor,pavilions,place,roomCenters,roomPartition} from './plan.mjs';

const directory=process.argv[2];
if (!directory) throw Error('Usage: node art/linterna/precinct/hefesto-slice.mjs OUTPUT_DIR');
const MAX_PART_BYTES=768*1024;
const FLOOR_TOP=.0215;
const pavers={top:FLOOR_TOP,depth:.2};
const land={top:-.015,depth:.2};
const hefesto=pavilions.find(pavilion=>pavilion.id==='hephaestus');
const rooms=roomCenters(hefesto);
const halfRoom=(rooms[1].x-rooms[0].x)/2;
const cells={
  arrival:{origin:[0,0],floor:[{...land,x:[-25.5,25.5],z:[-33,21]},
    {...pavers,x:[-hall.halfWidth,hall.halfWidth],z:[.9,12.63]}]},
  hefesto:{origin:hefesto.origin,floor:[{...pavers,x:[-halfRoom*2,halfRoom*2],z:[roomPartition,pavilionDoor+.82]}]},
  ...Object.fromEntries(rooms.map(({id,x})=>[id,{origin:place(hefesto,x,-1.58),
    floor:[{...pavers,x:[-halfRoom,halfRoom],z:[-2.8,.88]}]}])),
};
const round=value=>Number(value.toFixed(4));
const point=(cell,precinct)=>precinct.map((value,index)=>round(value-cells[cell].origin[index]));
const halfClearance=.68;
function floorTop(cell,[x,z]) {
  const surfaces=cells[cell].floor.filter(floor=>x>=floor.x[0]&&x<=floor.x[1]&&z>=floor.z[0]&&z<=floor.z[1]);
  return surfaces.length ? Math.max(...surfaces.map(floor=>floor.top)) : null;
}
function side(cell,threshold,xz) {
  const degrees=Math.atan2(xz[0]-threshold[0],xz[1]-threshold[1])*180/Math.PI;
  const stand=point(cell,xz);
  return {cell,stand,surfaceY:floorTop(cell,stand),yaw:round((degrees+360)%360)};
}
const exteriorThreshold=[0,hall.entrance];
const hefestoThreshold=place(hefesto,0,pavilionDoor);
const passages=[
  {threshold:exteriorThreshold,sides:[{cell:'street',keepParcelOffer:true},
    side('arrival',exteriorThreshold,[0,11.35])]},
  {threshold:hefestoThreshold,sides:[
    side('arrival',hefestoThreshold,place(hefesto,0,pavilionDoor+halfClearance)),
    side('hefesto',hefestoThreshold,place(hefesto,0,pavilionDoor-halfClearance))]},
  ...rooms.map(({id,x})=>{
    const threshold=place(hefesto,x,roomPartition);
    return {threshold,sides:[
      side('hefesto',threshold,place(hefesto,x,roomPartition+halfClearance)),
      side(id,threshold,place(hefesto,x,roomPartition-halfClearance))]};
  }),
];
const table={
  cell:'atelier',center:[0,.85,-2],workSurfaceY:.91,topSize:[1.71,.73],rotationY:0,
  proposedInteractionRadius:1.1,
};
const layers=makeHefestoSliceScenes();
for (const cell of Object.keys(cells)) {
  const solids=layers.filter(layer=>layer.cell===cell).flatMap(layer=>layer.obstacles);
  const passable=floorClearance(solids);
  const hasFloor=xz=>floorTop(cell,xz)!==null;
  assert.ok(solids.length>0);
  for (const entry of passages.flatMap(passage=>passage.sides).filter(entry=>entry.cell===cell)) {
    assert.ok(hasFloor(entry.stand) && passable(entry.stand),cell+' must have a clear landing');
  }
  const checkPath=path=>{
    for (let index=1;index<path.length;index++) {
      const from=path[index-1], to=path[index];
      const steps=Math.max(1,Math.ceil(Math.hypot(to[0]-from[0],to[1]-from[1])/.035));
      for(let step=0;step<=steps;step++) {
        const probe=from.map((value,axis)=>value+(to[axis]-value)*step/steps);
        assert.ok(hasFloor(probe)&&passable(probe),cell+' failed at '+probe);
      }
    }
  };
  if (cell==='arrival') {
    const {world,garden}=makeStops(), journeys=makeJourneys();
    checkPath([world.point,...journeys.world.garden,...journeys.garden.hephaestus.slice(0,-2),passages[1].sides[0].stand]);
    assert.ok(!passable([0,6.5]),'the map table must remain solid');
  } else if (cell==='hefesto') {
    const entry=passages[1].sides[1].stand;
    for (const room of passages.slice(2))
      checkPath([entry,[room.sides[0].stand[0],1.38],room.sides[0].stand]);
  } else {
    const entry=passages.find(passage=>passage.sides[1].cell===cell).sides[1].stand;
    const workPosition=[0,-1.1];
    checkPath([entry,workPosition]);
    assert.ok(!passable([table.center[0],table.center[2]]),'the table must remain solid');
    if(cell==='atelier'){
      const distance=([x,z])=>Math.hypot(x-table.center[0],z-table.center[2]);
      assert.ok(distance(entry)>table.proposedInteractionRadius&&distance(workPosition)<table.proposedInteractionRadius,
        'the compact room needs separate door and table approach areas');
    }
  }
  for (const passage of passages.slice(1).filter(passage=>passage.sides.some(entry=>entry.cell===cell)))
    assert.ok(!passable(point(cell,passage.threshold)),cell+' must require an authorized door transition');
}

globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(bytes=>{this.result=bytes;this.onloadend?.();});
  }
};

function collider(mesh) {
  const world=mesh.matrixWorld;
  return {
    position:new Vector3().setFromMatrixPosition(world).toArray().map(round),
    size:new Vector3().setFromMatrixScale(world).toArray().map(round),
    rotationY:round(new Euler().setFromRotationMatrix(world.clone().extractRotation(world),'YXZ').y*180/Math.PI),
  };
}

const files=new Map();
for (const {cell,name,group,obstacles} of layers) {
  const model=batchModel(group);
  const binary=await new GLTFExporter().parseAsync(model,{binary:true,onlyVisible:true});
  const bytes=Buffer.from(binary);
  assert.ok(bytes.length<=MAX_PART_BYTES,name+' exceeds the per-file art bound');
  const glb=await new GLTFLoader().parseAsync(binary,'');
  if(cell!=='printing')glb.scene.traverse(mesh=>{
    if(mesh.isMesh)assert.ok(!['slate','terracotta'].includes(mesh.material.name),
        'AnyPrinter fixtures must remain in its own scene');
  });
  if (cell==='atelier') {
    const bounds=new Box3().setFromObject(glb.scene);
    const min=new Vector3(-table.topSize[0]/2,table.workSurfaceY-.12,-2-table.topSize[1]/2);
    const max=new Vector3(table.topSize[0]/2,table.workSurfaceY,-2+table.topSize[1]/2);
    let topFound=false;
    const vertex=new Vector3();
    glb.scene.updateMatrixWorld(true);
    glb.scene.traverse(mesh=>{
      if (mesh.isMesh && mesh.material.name==='warmWood') {
        const positions=mesh.geometry.attributes.position;
        const wood=new Box3();
        for(let i=0;i<positions.count;i++)wood.expandByPoint(vertex.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld));
        topFound=wood.min.distanceTo(min)<.001&&wood.max.distanceTo(max)<.001;
      }
    });
    assert.ok(topFound,'the reopened GLB must have the selected table center, height and unrotated tabletop');
    assert.ok(bounds.min.x>=-2.2&&bounds.max.x<=2.2,'Atelier may not include AnyPrinter geometry');
  }
  const sha256=createHash('sha256').update(bytes).digest('hex');
  const file=`linterna-${name}-${sha256.slice(0,12)}.glb`;
  files.set(file,bytes);
  (cells[cell].models??=[]).push({file,bytes:bytes.length,sha256});
  (cells[cell].colliders??=[]).push(...obstacles.map(collider));
}

await mkdir(directory,{recursive:true});
for (const [file,bytes] of files) await writeFile(join(directory,file),bytes);
const manifest={schema:'holodeck.linterna.hefesto-slice/v1',units:'m',up:'+Y',cells,passages,table};
await writeFile(join(directory,'linterna-hefesto-slice.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({models:Object.values(cells).flatMap(cell=>cell.models).length,
  largestPart:Math.max(...Array.from(files.values(),bytes=>bytes.length)),
  cells:Object.keys(cells),doors:passages.length,table}));
