import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {Box3,Euler,Vector3} from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {batchModel} from './batch.mjs';
import {floorClearance,makeScene} from './model.mjs';
import {approachDoor,makeJourneys,makeStops} from './plan.mjs';

const directory=process.argv[2];
if (!directory) throw Error('Usage: node art/linterna/precinct/export.mjs OUTPUT_DIR');
await mkdir(directory,{recursive:true});

globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(bytes=>{this.result=bytes;this.onloadend?.();});
  }
};

const scenes = new Map(['approach','precinct'].map(stage=>[stage,makeScene(stage)]));
const stops=makeStops();
const journeys=makeJourneys();
const metres={approach:{min:[-.99,0,-1.98],max:[.99,2.75,1.98]}};
const report={units:'m',up:'+Y',facadeEntrance:'+Z',edgesChecked:0,models:{}};
const free=floorClearance(scenes.get('precinct').obstacles);

for (const [from,edges] of Object.entries(journeys)) {
  for (const [to,waypoints] of Object.entries(edges)) {
    assert.deepEqual(waypoints.at(-1),stops[to].point);
    assert.ok(journeys[to][from]);
    let previous=stops[from].point;
    for (const next of waypoints) {
      const steps=Math.ceil(Math.hypot(next[0]-previous[0],next[1]-previous[1])/.035);
      for (let i=0;i<=steps;i++) {
        const point=previous.map((value,index)=>value+(next[index]-value)*(i/Math.max(steps,1)));
        assert.ok(free(point),from+' → '+to+' obstructed at '+point.join(', '));
      }
      previous=next;
    }
    report.edgesChecked++;
  }
}
assert.ok(!free([0,6.5]),'the world table must block movement');
assert.ok(!free([2.65,-18.2]),'the side of the central temple must block entry');
assert.ok(floorClearance(scenes.get('approach').obstacles)([0,approachDoor]));

function colliderBoxes(obstacles) {
  return obstacles.map(mesh=>{
    const world=mesh.matrixWorld;
    const xyz=new Vector3().setFromMatrixPosition(world).toArray();
    const size=new Vector3().setFromMatrixScale(world).toArray();
    const degrees=new Euler().setFromRotationMatrix(world.clone().extractRotation(world),'YXZ').y*180/Math.PI;
    const round=value=>Math.round(value*10000)/10000;
    return {position:xyz.map(round),size:size.map(round),rotationY:round(degrees)};
  });
}

for (const [stage,{group,obstacles}] of scenes) {
  const root=stage==='approach' ? group.getObjectByName('Small street temple') : group;
  assert.ok(root);
  const model=batchModel(root);
  const bytes=Buffer.from(await new GLTFExporter().parseAsync(model,{binary:true,onlyVisible:true}));
  assert.ok(bytes.byteLength < 4*1024*1024);
  const loaded=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const bounds=new Box3().setFromObject(loaded.scene);
  const expected=metres[stage];
  if (expected) {
    assert.ok(bounds.min.toArray().every((value,index)=>value>=expected.min[index]-.001));
    assert.ok(bounds.max.toArray().every((value,index)=>value<=expected.max[index]+.001));
  }
  const triangles=model.children.reduce((sum,node)=>sum+(node.geometry.index?.count??node.geometry.attributes.position.count)/3,0);
  assert.ok(triangles>0&&triangles<100000);
  const filename='linterna-'+stage+'.glb';
  await writeFile(join(directory,filename),bytes);
  report.models[stage]={file:filename,bytes:bytes.length,triangles,draws:model.children.length,
    sha256:createHash('sha256').update(bytes).digest('hex'),bounds:[bounds.min.toArray(),bounds.max.toArray()]};
  await writeFile(join(directory,'linterna-'+stage+'-colliders.json'),JSON.stringify(colliderBoxes(obstacles),null,2)+'\n');
}
await writeFile(join(directory,'linterna-precinct-manifest.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
