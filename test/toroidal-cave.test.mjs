import assert from 'node:assert/strict';
import test from 'node:test';
import {DoubleSide, MeshBasicMaterial, Raycaster, Scene, Vector3} from 'three';
import {CAVE, ToroidalCave} from '../src/toroidal-cave.mjs';
import {terrainElevation, terrainFrame, terrainPosition} from '../src/toroidal-terrain.mjs';

const point = (u,v,offset=0) => new Vector3(...terrainPosition(u,v,terrainElevation(u,v)+offset));

test('the shared collision shell has two open mouths and two covered chambers', () => {
  const scene = new Scene();
  const colliders = new Set();
  const cave = new ToroidalCave(scene,{addCollider:mesh=>colliders.add(mesh),removeCollider:mesh=>colliders.delete(mesh)});
  cave.update(point(CAVE.from,CAVE.latitude));
  const {mesh} = cave;
  assert.ok(mesh && colliders.has(mesh));
  assert.ok(mesh.geometry.index.count / 3 < 2500);
  const original=mesh.material;
  const twoSided=new MeshBasicMaterial({side:DoubleSide});
  mesh.material=twoSided;
  const radialHit=(u,v)=>new Raycaster(point(u,v,.26),new Vector3(...terrainFrame(u,v).up),0,9)
    .intersectObject(mesh,false)[0]?.distance;
  assert.equal(radialHit(CAVE.from-.00013,CAVE.latitude),undefined);
  assert.equal(radialHit(CAVE.to+.00013,CAVE.latitude),undefined);
  const chamber=t=>radialHit(CAVE.from+(CAVE.to-CAVE.from)*t,CAVE.latitude);
  assert.ok(chamber(.25)>2.5 && chamber(.75)>2.5);
  assert.ok(chamber(.25)>chamber(.5) && chamber(.75)>chamber(.5));
  for (const [u,sign] of [[CAVE.from-.00012,1],[CAVE.to+.00012,-1]]) {
    const along=new Vector3(...terrainFrame(u,CAVE.latitude).alongRing).multiplyScalar(sign);
    const mouth=new Raycaster(point(u,CAVE.latitude,1.1),along,0,3).intersectObject(mesh,false);
    assert.equal(mouth.length,0);
  }

  mesh.material=original;
  twoSided.dispose();
  cave.update(point(.3,.25));
  assert.equal(scene.children.length,0);
  assert.equal(colliders.size,0);
  assert.equal(cave.mesh,null);
});
