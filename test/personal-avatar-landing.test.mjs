import assert from 'node:assert/strict';
import test from 'node:test';
import {AnimationClip,Bone,Group,QuaternionKeyframeTrack,VectorKeyframeTrack} from 'three';
import {bindPersonalAvatarLanding} from '../src/personal-avatar-landing.mjs';

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
  assert.ok(pelvis.position.y<0);
  assert.equal(mesh.position.y,0);
  landing.restore();
  assert.equal(pelvis.quaternion.y,0);
  assert.equal(pelvis.position.y,.1);
});
