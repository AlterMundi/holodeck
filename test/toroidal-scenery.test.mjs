import assert from 'node:assert/strict';
import test from 'node:test';
import {Scene,Vector3} from 'three';
import {approachCover,ToroidalScenery} from '../src/toroidal-scenery.mjs';
import {TOROIDAL_TERRAIN,terrainPosition,terrainTrail,TOROIDAL_SPAWN} from '../src/toroidal-terrain.mjs';

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
