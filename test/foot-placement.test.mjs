import test from 'node:test';
import assert from 'node:assert/strict';
import {Bone,Group,Quaternion,Vector3} from 'three';
import {bindFootPlacement,solveTwoBone} from '../src/foot-placement.mjs';

function leg(side){
  const thigh=new Bone(),calf=new Bone(),foot=new Bone();
  thigh.name='thigh_'+side;calf.name='calf_'+side;foot.name='foot_'+side;
  thigh.position.set(side==='l'?.1:-.1,1,0);calf.position.set(0,-.48,.02);foot.position.set(0,-.46,-.02);
  thigh.add(calf);calf.add(foot);
  return thigh;
}

test('a leg reaches a raised target and keeps its foot orientation',()=>{
  const root=new Group(),thigh=leg('l');root.add(thigh);root.updateMatrixWorld(true);
  const [calf,foot]=[thigh.children[0],thigh.children[0].children[0]];
  const before=foot.getWorldQuaternion(new Quaternion());
  const goal=foot.getWorldPosition(new Vector3()).add(new Vector3(0,.2,0));
  assert.ok(solveTwoBone(thigh,calf,foot,goal,new Vector3(1,0,0)));
  root.updateMatrixWorld(true);
  assert.ok(foot.getWorldPosition(new Vector3()).distanceTo(goal)<1e-3);
  assert.ok(foot.getWorldQuaternion(new Quaternion()).angleTo(before)<1e-3);
  // The knee bends forward, not backward.
  assert.ok(calf.getWorldPosition(new Vector3()).z>.02);
});

test('on a slope the body drops for the low foot and everything restores',()=>{
  const mesh=new Group(),parent=new Group(),pelvis=new Bone();pelvis.name='pelvis';parent.add(mesh);
  mesh.add(pelvis);pelvis.add(leg('l'),leg('r'));parent.updateMatrixWorld(true);
  const placement=bindFootPlacement(mesh);
  const up=new Vector3(0,1,0),right=new Vector3(1,0,0);
  const feet=()=>['foot_l','foot_r'].map(n=>mesh.getObjectByName(n).getWorldPosition(new Vector3()));
  const [l0,r0]=feet();
  // Ground rises to the left: +.1 under the left foot, -.1 under the right.
  placement.apply(mesh,up,right,p=>p.x>0?.1:-.1,1);
  parent.updateMatrixWorld(true);
  const [l1,r1]=feet();
  assert.ok(Math.abs(l1.y-(l0.y+.1))<2e-3,`left ${l1.y}`);
  assert.ok(Math.abs(r1.y-(r0.y-.1))<2e-3,`right ${r1.y}`);
  assert.ok(Math.abs(pelvis.position.y+.1)<1e-6);
  placement.restore();parent.updateMatrixWorld(true);
  const [l2,r2]=feet();
  assert.ok(l2.distanceTo(l0)<1e-6&&r2.distanceTo(r0)<1e-6&&pelvis.position.y===0);
});
