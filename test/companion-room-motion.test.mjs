import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Box3,BoxGeometry,Mesh,MeshBasicMaterial,Scene,Vector3} from 'three';
import {CompanionRoomClearance} from '../src/companion-room-clearance.mjs';
import {CompanionTransfer} from '../src/companion-transfer.mjs';

test('the companion avoids the Matter table on arrival and when taking a step',()=>{
  const floor=new Box3(new Vector3(-6,-.1,-6),new Vector3(6,.1,6));
  const table=new Box3(new Vector3(-1.36,.1,-1.22),new Vector3(1.36,1.058,.36));
  const hit=new Vector3();
  const colliders={raycastFirst:(ray,max)=>{
    const distances=[floor,table].map(box=>ray.intersectBox(box,hit)?
      ray.origin.distanceTo(hit):Infinity).filter(distance=>distance<max);
    return distances.length?[Math.min(...distances)]:null;
  }};
  const clearance=new CompanionRoomClearance();
  const leader=new Vector3(2.152,.1,.338);
  const desired=new Vector3(.85,.1,-.12);
  assert.equal(clearance.clear(leader,desired,colliders),false);
  clearance.chooseTarget(leader,desired,colliders,true,leader);
  assert.ok(clearance.clear(leader,desired,colliders));
  const last=desired.clone();
  desired.set(.85,1.18,-.12);
  clearance.chooseTarget(new Vector3(2.152,1.18,.338),desired,colliders,false,leader);
  assert.deepEqual(desired.toArray(),last.toArray());
  const beside=new Vector3(1.77,.1,-.25),step=new Vector3(1.27,.1,-.25);
  assert.equal(clearance.clear(beside,step,colliders),false);
  assert.equal(clearance.step(beside,step,colliders),true);
  assert.ok(step.x>=1.65);
});

test('companion recovers from a blocked route nearby without transferring while making progress',()=>{
  const clearance=new CompanionRoomClearance();
  const root=new Vector3(0,.1,0),target=new Vector3(0,.1,4);
  const wall={raycastFirst:ray=>ray.direction.y<0?[1.27]:[.15]};
  for(let frame=0;frame<16;frame++){
    assert.equal(clearance.needsTransfer(root,target,.1),false);
    assert.equal(clearance.step(root,new Vector3(0,.1,.1),wall),false);
  }
  assert.equal(clearance.needsTransfer(root,target,.1),true);
  assert.equal(clearance.needsTransfer(root.setZ(.32),target,.1),false);
});

test('catch-up transfer relocates when invisible and restores original rendering',()=>{
  const scene=new Scene(),root=new Mesh(new BoxGeometry(),new MeshBasicMaterial());
  root.castShadow=true;
  scene.add(root);
  const transfer=new CompanionTransfer(scene);
  transfer.begin();
  assert.equal(transfer.advance(.08),false);
  transfer.paint(root,false);
  assert.ok(root.material.opacity>0&&root.material.opacity<1);
  assert.equal(transfer.advance(.1),true);
  transfer.paint(root,true);
  assert.equal(root.material.opacity,0);
  assert.equal(transfer.advance(.12),false);
  transfer.paint(root,false);
  assert.ok(root.material.opacity>0&&root.material.opacity<1);
  assert.equal(transfer.advance(.2),false);
  assert.equal(root.material.opacity,1);
  assert.equal(root.material.transparent,false);
  assert.equal(root.castShadow,true);
  transfer.dispose();
  assert.deepEqual(scene.children,[root]);
  root.geometry.dispose();root.material.dispose();
});
