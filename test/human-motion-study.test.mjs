import assert from 'node:assert/strict';
import test from 'node:test';
import {Group} from 'three';
import {createHumanMotionStudy,humanMotionStudies,motionStudyRate} from '../src/human-motion-study.mjs';
import {humanAvatar,stockLocomotion} from '../tools/avatar-motion/rig.mjs';

test('a sampled live flight pose plays on the same rig in either direction',async()=>{
  const {mesh}=humanAvatar('avatar-1-bodyA-skin01.glb');
  const {clips}=await stockLocomotion(mesh);
  const run=createHumanMotionStudy(mesh,clips.idle.getClip(),humanMotionStudies['estudio-vuelo']);
  const mount=new Group();
  const snapshot=frame=>{
    const water=run.apply(mesh,mount,frame);
    assert.ok(Number.isNaN(water));
    return [mount.quaternion.toArray(),mesh.getObjectByName('upperarm_l').quaternion.toArray()];
  };
  assert.equal(run.count,6*motionStudyRate);
  const airborne=snapshot(78);
  assert.notDeepEqual(airborne,snapshot(0));
  assert.notDeepEqual(airborne,snapshot(run.count));
  assert.deepEqual(airborne,snapshot(78));
});

test('the swim study follows the actual water surface and revisits identical submerged joints',async()=>{
  const {mesh}=humanAvatar('avatar-2-bodyB-skin03.glb');
  const {clips}=await stockLocomotion(mesh);
  const run=createHumanMotionStudy(mesh,clips.idle.getClip(),humanMotionStudies['estudio-nado']);
  const mount=new Group();
  const water=frame=>run.apply(mesh,mount,frame);
  const baseline=water(14);
  const submerged=water(81);
  assert.ok(submerged>baseline+.1,{baseline,submerged});
  const arm=mesh.getObjectByName('upperarm_l').quaternion.toArray();
  assert.notEqual(water(144),submerged);
  assert.equal(water(81),submerged);
  assert.deepEqual(mesh.getObjectByName('upperarm_l').quaternion.toArray(),arm);
});
