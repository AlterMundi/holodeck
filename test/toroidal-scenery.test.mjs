import assert from 'node:assert/strict';
import test from 'node:test';
import {Scene,Vector3} from 'three';
import {approachCover,ToroidalScenery} from '../src/toroidal-scenery.mjs';
import {meadowBankPlants} from '../src/toroidal-meadow-banks.mjs';
import {TOROIDAL_TERRAIN,terrainPosition,terrainTrail,TOROIDAL_SPAWN} from '../src/toroidal-terrain.mjs';

test('the meadow profiles share rooted banks outside the trail and dispose their instance buffers',()=>{
  const normal=meadowBankPlants(false),light=meadowBankPlants(true);
  assert.deepEqual(meadowBankPlants(false),normal);
  assert.equal(normal.length,5);
  for(const [index,plants] of normal.entries()){
    assert.ok(plants.length>light[index].length);
    const selected=plants.filter(p=>light[index].some(q=>p.u===q.u&&p.v===q.v));
    assert.deepEqual(selected,light[index]);
    assert.ok(plants.every(p=>terrainTrail(p.u,p.v)<=.10&&p.size<=1&&p.h>TOROIDAL_TERRAIN.waterLevel));
  }
  const scene=new Scene(),cover=new ToroidalScenery(scene);
  const spawn=new Vector3(TOROIDAL_SPAWN.x,TOROIDAL_SPAWN.y,TOROIDAL_SPAWN.z);
  const batches=()=>cover.meadow.profiles.find(p=>p.group.visible).group.children;
  const triangleCount=()=>batches().reduce((total,batch)=>total+batch.count*batch.geometry.attributes.position.count/3,0);
  cover.update(spawn,false);
  assert.equal(triangleCount(),10564);
  assert.equal(batches().length,10);
  const original=batches()[0];
  cover.update(spawn,true);
  assert.equal(triangleCount(),2466);
  cover.update(spawn,false);
  assert.equal(batches()[0],original);
  cover.update(new Vector3().fromArray(terrainPosition(.4,.25,25)),false);
  assert.equal(cover.meadow.group.visible,false);
  let disposed=false;
  original.addEventListener('dispose',()=>{disposed=true;});
  cover.dispose();
  assert.ok(disposed);
  assert.equal(scene.children.length,0);
});

test('trail-edge planting preserves the clear route and keeps the same flowers in both profiles',()=>{
  const normal=approachCover(false),light=approachCover(true);
  assert.ok(normal.length>light.length);
  assert.deepEqual(normal.filter(p=>p.kind==='bloom'),light.filter(p=>p.kind==='bloom'));
  assert.deepEqual(normal,approachCover(false));
  for(const plant of normal){
    assert.ok(terrainTrail(plant.u,plant.v)<=.22);
    const arc=plant.u*2*Math.PI*TOROIDAL_TERRAIN.majorRadius;
    assert.ok(plant.v<.25 || Math.abs(arc-15.5)>=1.9);
    assert.ok([plant.h,plant.size,plant.yaw].every(Number.isFinite));
  }
  const scene=new Scene(),cover=new ToroidalScenery(scene);
  cover.update(new Vector3(TOROIDAL_SPAWN.x,TOROIDAL_SPAWN.y,TOROIDAL_SPAWN.z),false);
  assert.equal(cover.blooms.count,normal.filter(p=>p.kind==='bloom').length);
  assert.ok(cover.meshes.every(mesh=>mesh.count<=mesh.instanceMatrix.count));
  cover.update(new Vector3().fromArray(terrainPosition(.4,.25,25)),false);
  assert.equal(cover.blooms.count,0);
  cover.dispose();
  assert.equal(scene.children.length,0);
});

test('the permitted entrance anchors bounded approach planting without filling the passage',()=>{
  const door={x:1797.925,y:498.11,z:15.5,facing:-1};
  const light=approachCover(true,door),normal=approachCover(false,door);
  assert.notDeepEqual(light,approachCover(true));
  assert.deepEqual(light.filter(p=>p.kind==='bloom'),normal.filter(p=>p.kind==='bloom'));
  const localArc=plant=>plant.u*2*Math.PI*TOROIDAL_TERRAIN.majorRadius;
  assert.ok(normal.every(plant=>plant.v<.25 || Math.abs(localArc(plant)-door.z)>=1.9));
  const scene=new Scene(),cover=new ToroidalScenery(scene);
  const position=new Vector3(TOROIDAL_SPAWN.x,TOROIDAL_SPAWN.y,TOROIDAL_SPAWN.z);
  cover.update(position,false,door);
  assert.equal(cover.ribbonGrass.count,normal.filter(p=>p.kind==='grass').length);
  cover.update(position,false);
  assert.equal(cover.ribbonGrass.count,approachCover(false).filter(p=>p.kind==='grass').length);
  cover.dispose();
});

test('Sand3D batches admit only the composed verge outside the route and flagstone apron',async()=>{
  const {sand3dTrailPlacement}=await import('../src/sand3d-trail.mjs');
  const door={x:1797.925,y:498.11,z:15.5,facing:-1};
  const placed=sand3dTrailPlacement(door);
  assert.equal(placed.length,14);
  assert.deepEqual(sand3dTrailPlacement(null),[]);
  assert.deepEqual(sand3dTrailPlacement(door),placed);
  assert.equal(placed.filter(({name})=>name==='feather-reed-grass').length,6);
  const tau=2*Math.PI;
  for(const plant of placed){
    assert.ok(terrainTrail(plant.u,plant.v)<=.22);
    const x=(.25-plant.v)*tau*(TOROIDAL_TERRAIN.tubeRadius+18);
    const z=plant.u*tau*TOROIDAL_TERRAIN.majorRadius;
    const axial=(x-door.x+TOROIDAL_TERRAIN.majorRadius)*door.facing;
    const clearance=plant.scale*.55;
    assert.ok(axial<=-4.8-clearance||axial>=1.25+clearance||Math.abs(z-door.z)>=2.8+clearance);
  }
});

test('lightweight and distant approaches do not start optional trail downloads',async()=>{
  const {Sand3DTrail}=await import('../src/sand3d-trail.mjs');
  const scene=new Scene(),origin=[1799,498,23],position=new Vector3(...origin);
  const cover=new Sand3DTrail(scene,new URL('https://fixture.test/'),origin,()=>{},{value:1});
  const door={x:1797.925,y:498.11,z:15.5,facing:-1};
  let requests=0;
  cover.load=()=>{requests++;};
  cover.update(position,true,door);
  cover.update(new Vector3(1799,498,100),false,door);
  cover.update(position,false,null);
  assert.equal(requests,0);
  cover.update(position,false,door);
  cover.update(position,false,door);
  assert.equal(requests,1);
  cover.update(new Vector3(1799,498,72),false,door);
  cover.update(position,false,door);
  assert.equal(requests,1);
  cover.update(new Vector3(1799,498,100),false,door);
  cover.update(position,false,door);
  assert.equal(requests,2);
  cover.dispose();
  assert.equal(scene.children.length,0);
});
