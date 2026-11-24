import assert from 'node:assert/strict';
import test from 'node:test';
import {Vector3} from 'three';
import {createToroidalCameraClearance} from '../src/toroidal-camera-clearance.mjs';
import {toroidalRotation} from '../src/toroidal-locomotion.mjs';
import {terrainElevation,terrainFrame,terrainPosition} from '../src/toroidal-terrain.mjs';

const empty={raycastFirst:()=>null};
test('the camera boom stops above radial ground on multiple flanks', () => {
  for (const v of [0,.25,.5,.75]) {
    const u=.31;
    const floor=terrainElevation(u,v);
    const target=new Vector3(...terrainPosition(u,v,floor+1.65));
    const orientation=toroidalRotation(target,0);
    const offset=new Vector3(...terrainFrame(u,v).down).multiplyScalar(4);
    const clearance=createToroidalCameraClearance();
    clearance.constrain(target,offset,orientation,60,16/9,empty);
    assert.ok(offset.length()>1.2 && offset.length()<1.65,'the boom intersects the terrain');
  }
});
test('solid cave or house geometry cuts the camera immediately and lets it ease back', () => {
  const u=.007,v=.25;
  const target=new Vector3(...terrainPosition(u,v,terrainElevation(u,v)+1.75));
  const orientation=toroidalRotation(target,0);
  const offset=()=>new Vector3(...terrainFrame(u,v).alongRing).multiplyScalar(3);
  const clearance=createToroidalCameraClearance();
  const obstacle={raycastFirst:()=>[1.5]};
  const blocked=clearance.constrain(target,offset(),orientation,60,1,obstacle).length();
  const released=clearance.constrain(target,offset(),orientation,60,1,empty).length();
  assert.ok(blocked>1.2&&blocked<1.5);
  assert.ok(released>blocked&&released<blocked+.181);
  clearance.reset();
  assert.ok(Math.abs(clearance.constrain(target,offset(),orientation,60,1,empty).length()-3)<1e-10);
});
