import assert from 'node:assert/strict';
import test from 'node:test';
import {AnimationClip,Bone,Group,QuaternionKeyframeTrack,Vector3,VectorKeyframeTrack} from 'three';
import {bindPersonalAvatarLanding,landingBlendWeight} from '../src/personal-avatar-landing.mjs';

test('the authored landing layers onto the animated bones and restores their prior pose',()=>{
  const mesh=new Group(),pelvis=new Bone();
  pelvis.name='pelvis';
  mesh.add(pelvis);
  mesh.animations=[new AnimationClip('hero_landing',1,[
    new QuaternionKeyframeTrack('pelvis.quaternion',[0,1],[0,0,0,1,0,1,0,0]),
    new VectorKeyframeTrack('pelvis.position',[0,1],[0,0,0,0,-.3,0]),
  ])];
  pelvis.position.y=.1;
  const landing=bindPersonalAvatarLanding(mesh);
  landing.apply(.5,.5);
  assert.ok(pelvis.quaternion.y>.3);
  assert.equal(pelvis.position.y,.1);
  assert.equal(mesh.position.y,0);
  landing.restore();
  assert.equal(pelvis.quaternion.y,0);
  assert.equal(pelvis.position.y,.1);
});

test('forward gait takes over after the first planted contact',()=>{
  assert.equal(landingBlendWeight(0,.65,4.5,1),0);
  assert.ok(landingBlendWeight(.10,.65,4.5,1)>.62);
  assert.ok(landingBlendWeight(.23,.65,4.5,1)<.16);
  assert.ok(landingBlendWeight(.23,.65,0,0)>.95);
  assert.equal(landingBlendWeight(.65,.65,0,0),0);
});

test('landing keeps the lowest boot at ground-gait height while the knees bend',()=>{
  const character=new Group(),mesh=new Group(),pelvis=new Bone(),foot=new Bone();
  character.rotation.z=.42;
  character.add(mesh);
  mesh.add(pelvis);
  pelvis.add(foot);
  pelvis.name='pelvis';
  pelvis.position.y=1;
  foot.name='ball_l';
  foot.position.y=-1;
  mesh.animations=[new AnimationClip('hero_landing',1,[
    new QuaternionKeyframeTrack('pelvis.quaternion',[0,1],[0,0,0,1,0,0,1,0]),
  ])];
  const landing=bindPersonalAvatarLanding(mesh);
  const baseline=foot.getWorldPosition(new Vector3());
  const up=new Vector3(-Math.sin(.42),Math.cos(.42),0);
  landing.captureSupport(character);
  character.rotateX(.12);
  landing.apply(.5,1);
  assert.ok(foot.getWorldPosition(new Vector3()).sub(baseline).dot(up)>.9);
  landing.plant();
  assert.ok(Math.abs(foot.getWorldPosition(new Vector3()).sub(baseline).dot(up))<1e-9);
  assert.equal(pelvis.position.y,1);
  landing.restore();
  assert.ok(mesh.position.length()<1e-9);
  assert.equal(pelvis.quaternion.z,0);
});
