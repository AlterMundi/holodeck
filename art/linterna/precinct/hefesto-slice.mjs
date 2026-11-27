import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {Euler,Object3D,Texture,Vector3} from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {batchModel} from './batch.mjs';
import {embedFinishMaps} from './finish-maps.mjs';
import dimensions from '../dimensions.json' with {type:'json'};
import {floorClearance,makeHefestoSliceScenes} from './model.mjs';
import {hall,makeJourneys,makeStops,pavilionDoor,pavilions,place,roomCenters,roomPartition} from './plan.mjs';

const [directory,workshopFile]=process.argv.slice(2);
if (!directory||!workshopFile)
  throw Error('Usage: node art/linterna/precinct/hefesto-slice.mjs OUTPUT_DIR REVIEWED_WORKSHOP_GLB');
const MAX_PART_BYTES=768*1024;
const workshopDigest='fd17011c6e2caf35c2804f353fc4ac658b88ffd4739149d0e1bf63d95225bace';
const workshopBytes=await readFile(workshopFile);
assert.ok(workshopBytes.length<=MAX_PART_BYTES);
assert.equal(createHash('sha256').update(workshopBytes).digest('hex'),workshopDigest);
const jsonLength=workshopBytes.readUInt32LE(12);
assert.equal(workshopBytes.toString('ascii',0,4),'glTF');
assert.equal(workshopBytes.toString('ascii',16,20),'JSON');
const gltf=JSON.parse(workshopBytes.toString('utf8',20,20+jsonLength));
const workshopRoot=gltf.nodes[gltf.scenes[gltf.scene].nodes[0]];
const {worktable,datumY}=workshopRoot.extras;
assert.deepEqual(worktable,{id:'room-marker',anchor:[0,.45,-2],turntable:[0,1.146,-2]});
assert.equal(datumY,.1);
assert.equal(gltf.images.length,4);
assert.ok(gltf.images.every(image=>image.mimeType==='image/jpeg'&&Number.isInteger(image.bufferView)));
assert.ok(gltf.buffers.every(buffer=>!buffer.uri));

const workshop=dimensions.rooms.workshop;
const workshopHalf=dimensions.roomSize/2;
const [landing]=workshop.routes[0];
const [{x:returnX,z:returnZ}]=workshop.doors;
// The visual door is in front of the wall plane in the reviewed GLB.
const workshopThreshold=[returnX,returnZ+.18];
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
  atelier:{floor:[{top:datumY,depth:.2,x:[-workshopHalf,workshopHalf],z:[-workshopHalf,workshopHalf]}]},
  printing:{origin:place(hefesto,rooms.find(room=>room.id==='printing').x,-1.58),
    floor:[{...pavers,x:[-halfRoom,halfRoom],z:[-2.8,.88]}]},
};
const round=value=>Number(value.toFixed(4));
const point=(cell,precinct)=>precinct.map((value,index)=>round(value-cells[cell].origin[index]));
const halfClearance=.68;
function floorTop(cell,[x,z]) {
  const surfaces=cells[cell].floor.filter(floor=>x>=floor.x[0]&&x<=floor.x[1]&&z>=floor.z[0]&&z<=floor.z[1]);
  return surfaces.length ? Math.max(...surfaces.map(floor=>floor.top)) : null;
}
function side(cell,threshold,stand) {
  const degrees=Math.atan2(stand[0]-threshold[0],stand[1]-threshold[1])*180/Math.PI;
  return {cell,threshold,stand,surfaceY:floorTop(cell,stand),yaw:round((degrees+360)%360)};
}
function precinctSide(cell,threshold,stand) {
  return side(cell,point(cell,threshold),point(cell,stand));
}
const exteriorThreshold=[0,hall.entrance];
const hefestoThreshold=place(hefesto,0,pavilionDoor);
const passages=[
  {threshold:exteriorThreshold,sides:[{cell:'street',keepParcelOffer:true},
    precinctSide('arrival',exteriorThreshold,[0,11.35])]},
  {threshold:hefestoThreshold,sides:[
    precinctSide('arrival',hefestoThreshold,place(hefesto,0,pavilionDoor+halfClearance)),
    precinctSide('hefesto',hefestoThreshold,place(hefesto,0,pavilionDoor-halfClearance))]},
  ...rooms.map(({id,x})=>{
    const threshold=place(hefesto,x,roomPartition);
    return {threshold,sides:[
      precinctSide('hefesto',threshold,place(hefesto,x,roomPartition+halfClearance)),
      id==='atelier'?side(id,workshopThreshold,landing):
        precinctSide(id,threshold,place(hefesto,x,roomPartition-halfClearance))]};
  }),
];
const table={
  cell:'atelier',id:worktable.id,anchor:worktable.anchor,turntable:worktable.turntable,
  rotationY:0,interactionRadius:2.4,
};
const layers=makeHefestoSliceScenes();
function boxCollider(x,y,z,width,height,depth) {
  const box=new Object3D();
  box.position.set(x,y,z);
  box.scale.set(width,height,depth);
  box.updateMatrixWorld();
  return box;
}
const furnitureHeights={worktable:.92,bench:.95,shelf:2.1};
const atelierObstacles=workshop.objects.map(({x,z,w,d,style})=>{
  const height=furnitureHeights[style];
  assert.ok(height>0);
  return boxCollider(x,datumY+height/2,z,w,height,d);
});
for(const sign of [-1,1]){
  const edge=sign*(workshopHalf-.075),height=dimensions.roomHeight;
  atelierObstacles.push(boxCollider(edge,height/2,0,.15,height,dimensions.roomSize),
    boxCollider(0,height/2,edge,dimensions.roomSize,height,.15));
}
atelierObstacles.push(boxCollider(returnX,1.12,workshopThreshold[1],1.48,2.05,.07));
for (const cell of Object.keys(cells)) {
  const solids=cell==='atelier'?atelierObstacles:layers.filter(layer=>layer.cell===cell).flatMap(layer=>layer.obstacles);
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
  } else if(cell==='atelier'){
    for(const route of workshop.routes)checkPath(route);
    assert.ok(!passable([table.anchor[0],table.anchor[2]]),'the table must remain solid');
    const distance=([x,z])=>Math.hypot(x-table.anchor[0],z-table.anchor[2]);
    assert.ok(distance(landing)>table.interactionRadius &&
      distance(workshop.routes[0].at(-1))<table.interactionRadius,'door and table use areas must stay separate');
  } else {
    const entry=passages.find(passage=>passage.sides[1].cell===cell).sides[1].stand;
    const workPosition=[0,-1.1];
    checkPath([entry,workPosition]);
    assert.ok(!passable([0,-2]),'the printing bench must remain solid');
  }
  for (const entry of passages.slice(1).flatMap(passage=>passage.sides).filter(entry=>entry.cell===cell))
    assert.ok(!passable(entry.threshold),cell+' must require an authorized door transition');
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
const workshopName=`linterna-atelier-${workshopDigest.slice(0,12)}.glb`;
files.set(workshopName,workshopBytes);
cells.atelier.models=[{file:workshopName,bytes:workshopBytes.length,sha256:workshopDigest}];
cells.atelier.colliders=atelierObstacles.map(collider);
for (const {cell,name,group,obstacles} of layers) {
  const model=batchModel(group,{finishUV:true});
  const exporter=new GLTFExporter().register(embedFinishMaps);
  const binary=await exporter.parseAsync(model,{binary:true,onlyVisible:true});
  const bytes=Buffer.from(binary);
  assert.ok(bytes.length<=MAX_PART_BYTES,name+' exceeds the per-file art bound');
  // Node reopens geometry and materials. The browser check separately decodes
  // the embedded JPEGs using the same GLBs seen by the receiving engine.
  const loader=new GLTFLoader().register(()=>({name:'Linterna offline inspection',
    loadTexture:()=>Promise.resolve(new Texture()),
  }));
  const glb=await loader.parseAsync(binary,'');
  for(const primitive of glb.parser.json.meshes.flatMap(mesh=>mesh.primitives)){
    const material=glb.parser.json.materials[primitive.material];
    if(material.pbrMetallicRoughness.baseColorTexture)
      assert.ok(Number.isInteger(primitive.attributes.TEXCOORD_0),'a textured surface must have UVs');
  }
  if(cell!=='printing')glb.scene.traverse(mesh=>{
    if(mesh.isMesh)assert.ok(!['slate','terracotta'].includes(mesh.material.name),
        'AnyPrinter fixtures must remain in its own scene');
  });
  const sha256=createHash('sha256').update(bytes).digest('hex');
  const file=`linterna-${name}-${sha256.slice(0,12)}.glb`;
  files.set(file,bytes);
  (cells[cell].models??=[]).push({file,bytes:bytes.length,sha256});
  (cells[cell].colliders??=[]).push(...obstacles.map(collider));
}

await mkdir(directory,{recursive:true});
for (const [file,bytes] of files) await writeFile(join(directory,file),bytes);
const manifest={schema:'holodeck.linterna.hefesto-slice/v2',units:'m',up:'+Y',cells,passages,table};
await writeFile(join(directory,'linterna-hefesto-slice.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({models:Object.values(cells).flatMap(cell=>cell.models).length,
  largestPart:Math.max(...Array.from(files.values(),bytes=>bytes.length)),
  cells:Object.keys(cells),doors:passages.length,table}));
