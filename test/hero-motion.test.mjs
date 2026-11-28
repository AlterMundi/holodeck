import assert from 'node:assert/strict';
import test from 'node:test';
import {Quaternion,Vector3} from 'three';
import {presentedYaw} from '../src/avatar-facing.mjs';
import {gaitDirection,travelAngle} from '../src/humanoid-directional-gait.mjs';
import {groundGaitSample} from '../src/humanoid-ground-gait.mjs';
import {runSequence} from '../tools/avatar-motion/sequence.mjs';
import {toroidalRotation} from '../src/toroidal-locomotion.mjs';

const explorer='avatar/explorer-hero-v29.glb';

test('a moving body faces the view and a resting one keeps its heading',()=>{
  assert.equal(presentedYaw({moving:true,cameraYaw:1,travelYaw:2.5,restingYaw:0}),1);
  assert.equal(presentedYaw({flying:true,cameraYaw:1,travelYaw:2.5,restingYaw:0}),1);
  assert.equal(presentedYaw({cameraYaw:1,travelYaw:0,restingYaw:.4}),.4);
});

test('legs turn into the travel and back away past the side, with hysteresis',()=>{
  assert.equal(travelAngle(1,0),Math.PI/2);
  assert.deepEqual(gaitDirection(0),{backward:false,hips:0});
  assert.ok(Math.abs(gaitDirection(Math.PI/4).hips-Math.PI/4)<1e-9);
  const back=gaitDirection(Math.PI);
  assert.equal(back.backward,true);
  assert.ok(Math.abs(back.hips)<1e-9);
  // Near the side the current choice holds.
  assert.equal(gaitDirection(1.7,false).backward,false);
  assert.equal(gaitDirection(1.7,true).backward,true);
  assert.equal(gaitDirection(1.0,true).backward,false);
});

test('a backward gait runs the same cycle in reverse',()=>{
  const times={1:.2,2:.2},weights={1:1,2:0},step=1/60;
  const ahead=groundGaitSample(.5,times,weights,.08,step,step,false).phase;
  const back=groundGaitSample(.5,times,weights,.08,step,step,true).phase;
  assert.ok(ahead>.5&&back<.5);
  assert.ok(Math.abs((ahead-.5)-(.5-back))<1e-9);
});

test('the planted foot moves against the travel in every direction',async()=>{
  const route=[['forward',2,{forward:1}],['right',2,{right:1}],['back',2,{forward:-1}],['diagonal',2,{forward:-1,right:-1}]];
  const sums={};let previous=null;
  await runSequence({file:explorer,route,pilot:true,onFrame({name,phase,mesh,root,dt}){
    if(phase<.8){previous=null;return;}
    const inverse=root.quaternion.clone().invert();
    const feet=['ball_l','ball_r'].map(bone=>mesh.getObjectByName(bone).getWorldPosition(new Vector3()).sub(root.position).applyQuaternion(inverse));
    const low=feet[0].y<feet[1].y?0:1;
    if(previous?.low===low){
      const sum=sums[name]??=new Vector3();
      sum.add(feet[low].clone().sub(previous.feet[low]).divideScalar(dt));
    }
    previous={low,feet};
  }});
  // The body frame has +Z forward; find which way is right from the route.
  const forward=sums.forward.clone().normalize(),right=sums.right.clone().normalize(),back=sums.back.clone().normalize();
  assert.ok(forward.z<-.9,JSON.stringify(sums));
  assert.ok(back.z>.9,JSON.stringify(sums));
  assert.ok(Math.abs(right.x)>.9,JSON.stringify(sums));
  const diagonal=sums.diagonal.clone().normalize();
  assert.ok(diagonal.z>.5&&Math.sign(diagonal.x)===-Math.sign(right.x),JSON.stringify(sums));
});

test('a pilot flies head first along a sideways boost and leans back when backing away',async()=>{
  const route=[['launch',1.2,{flight:true,vertical:1}],['side',2,{flight:true,right:1,sprint:true}],['back',2.2,{flight:true,forward:-1}],['strafe-after-back',2.8,{flight:true,right:-1,sprint:true}]];
  let lastPosition=null,alignment=0,strafeAfterBack=0,backTilt=-1;
  await runSequence({file:explorer,route,pilot:true,onFrame({name,phase,root}){
    const position=root.position.clone();
    if((name==='side'||name==='strafe-after-back')&&phase>1.6&&lastPosition){
      const travel=position.clone().sub(lastPosition).normalize();
      // Lying out, the body's long axis (its local up) runs along the travel.
      const length=new Vector3(0,1,0).applyQuaternion(root.quaternion);
      if(name==='side')alignment=Math.max(alignment,length.dot(travel));
      else strafeAfterBack=Math.max(strafeAfterBack,length.dot(travel));
    }
    if(name==='back'&&phase>2){
      const upright=new Vector3(0,1,0).applyQuaternion(toroidalRotation(root.position,0));
      backTilt=new Vector3(0,1,0).applyQuaternion(root.quaternion).dot(upright);
    }
    lastPosition=position;
  }});
  assert.ok(alignment>.8,`alignment ${alignment}`);
  assert.ok(strafeAfterBack>.8,`strafe after backing ${strafeAfterBack}`);
  // Backing away the pilot stands up instead of lying out.
  assert.ok(backTilt>.75,`upright ${backTilt}`);
});

test('the explorer idles through its repertoire with both feet planted',async()=>{
  let drift=0,lowest=Infinity,left=0,right=0,reach=-Infinity,start=null;
  await runSequence({file:explorer,route:[['idle',62,{}]],pilot:true,onFrame({phase,mesh,root}){
    if(phase<1)return;
    const inverse=root.quaternion.clone().invert();
    const at=bone=>mesh.getObjectByName(bone).getWorldPosition(new Vector3()).sub(root.position).applyQuaternion(inverse);
    const feet=[at('foot_l'),at('foot_r')],pelvis=at('pelvis');
    start??={feet,pelvis};
    drift=Math.max(drift,...feet.map((foot,index)=>foot.distanceTo(start.feet[index])));
    lowest=Math.min(lowest,pelvis.y);
    left=Math.max(left,pelvis.x-start.pelvis.x);right=Math.max(right,start.pelvis.x-pelvis.x);
    reach=Math.max(reach,at('hand_l').y,at('hand_r').y);
  }});
  const note=JSON.stringify({drift,lowest,left,right,reach});
  assert.ok(drift<.01,note);
  assert.ok(lowest<.7,note);         // a squat
  assert.ok(left>.05&&right>.05,note); // weight onto each leg
  assert.ok(reach>1.7,note);         // a stretch overhead
});
