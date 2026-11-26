import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Box3,BoxGeometry,Mesh,MeshBasicMaterial,Scene,Vector3} from 'three';
import {CompanionRoomClearance} from '../src/companion-room-clearance.mjs';
import {CompanionTransfer} from '../src/companion-transfer.mjs';
import {passageAt,upperLandingCollision} from '../src/interior-geometry.mjs';
import {loadCompanion} from '../tools/avatar-motion/rig.mjs';
import {ToroidalLocomotion} from '../src/toroidal-locomotion.mjs';
import {terrainCoordinates,TOROIDAL_SPAWN} from '../src/toroidal-terrain.mjs';

function boxes(...geometry){
  const hit=new Vector3();
  return {raycastFirst:(ray,max)=>{
    const distances=geometry.map(box=>ray.intersectBox(box,hit)?
      ray.origin.distanceTo(hit):Infinity).filter(distance=>distance<max);
    return distances.length?[Math.min(...distances)]:null;
  }};
}

test('the companion avoids the Matter table on arrival and when taking a step',()=>{
  const floor=new Box3(new Vector3(-6,-.1,-6),new Vector3(6,.1,6));
  const table=new Box3(new Vector3(-1.36,.1,-1.22),new Vector3(1.36,1.058,.36));
  const colliders=boxes(floor,table);
  const clearance=new CompanionRoomClearance();
  const leader=new Vector3(2.152,.1,.338);
  const desired=new Vector3(.85,.1,-.12);
  assert.equal(clearance.clear(leader,desired,colliders),false);
  assert.equal(clearance.chooseTarget(leader,desired,colliders,true),true);
  assert.ok(clearance.clear(leader,desired,colliders));
  const last=desired.clone();
  desired.set(.85,1.18,-.12);
  assert.equal(clearance.chooseTarget(new Vector3(2.152,1.18,.338),desired,colliders,false),true);
  assert.deepEqual(desired.toArray(),last.toArray());
  const beside=new Vector3(1.77,.1,-.25),step=new Vector3(1.27,.1,-.25);
  assert.equal(clearance.clear(beside,step,colliders),false);
  assert.equal(clearance.step(beside,step,colliders),true);
  assert.ok(step.x>=1.65);
});

test('the companion uses the stair between the actual landing rails without intersecting the visitor',()=>{
  const {door}=passageAt({level:-1},{kind:'door'},0,{level:0},true);
  const leader=new Vector3(door.x,door.y,door.z);
  const geometry=[...upperLandingCollision(0).matchAll(/<m-cube x="([^"]+)" y="([^"]+)" z="([^"]+)" width="([^"]+)" height="([^"]+)" depth="([^"]+)"/g)]
    .map(parts=>{
      const [x,y,z,width,height,depth]=parts.slice(1).map(Number);
      return new Box3().setFromCenterAndSize(new Vector3(x-3,y,z-5.86),new Vector3(width,height,depth));
    });
  const colliders=boxes(...geometry);
  const clearance=new CompanionRoomClearance();
  for(const sign of [1,-1]){
    const target=leader.clone().add(new Vector3(1.35*sign,0,.6075*sign));
    assert.equal(clearance.chooseTarget(leader,target,colliders,true),true);
    assert.ok(clearance.clear(leader,target,colliders));
    assert.ok(leader.distanceTo(target)>=.8);
    assert.ok(Math.abs(target.x-leader.x)<.65);
  }
  clearance.reset();
  assert.equal(clearance.chooseTarget(leader,leader.clone(),boxes(),true),false);
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


test('a straight exterior sprint settles without a rebound at 20 or 60 Hz',async()=>{
  const {x,y,z}=TOROIDAL_SPAWN;
  const start=terrainCoordinates([x,y,z]);
  const yaw=-Math.PI/2;
  for(const hz of [20,60]){
    const {avatar}=await loadCompanion();
    try{
      const motion=new ToroidalLocomotion({...start,height:start.height});
      let close=false,previousHeading,previousPosition;
      for(let frame=0;frame<7*hz;frame++){
        const time=frame/hz;
        motion.update(1/hz,{forward:time>=1&&time<4?1:0,yaw,sprint:true});
        const {position:{x,y,z}}=motion.pose();
        avatar.update({position:new Vector3(x,y,z),yaw:1.145,outdoor:true,
          visible:true,seconds:1/hz,grounded:true});
        const root=avatar.figure.root;
        if(time>=4){
          const gap=avatar.target.clone().sub(root.position);
          gap.addScaledVector(root.up,-root.up.dot(gap));
          if(gap.length()<.27)close=true;
          if(close)assert.ok(gap.length()<.35,'moves away again after reaching the target');
          const step=root.position.clone().sub(previousPosition);
          assert.ok(step.dot(gap)>=-1e-6,'travels away from a settled follow target');
          const turnLimit=avatar.travelHeading?301:201;
          assert.ok(previousHeading.angleTo(root.quaternion)*180/Math.PI*hz<=turnLimit,
            'turns faster than the selected heading limit after release');
        }
        previousHeading=root.quaternion.clone();
        previousPosition=root.position.clone();
      }
      assert.ok(close,'reaches the target after the stop');
      assert.equal(avatar.followResting,true,'latches rest once the player and companion settle');
    }finally{
      avatar.dispose();
    }
  }
});
