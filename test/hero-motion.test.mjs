import assert from 'node:assert/strict';
import test from 'node:test';
import {Quaternion,Vector3} from 'three';
import {presentedYaw} from '../src/avatar-facing.mjs';
import {gaitDirection,travelAngle} from '../src/humanoid-directional-gait.mjs';
import {groundGaitSample} from '../src/humanoid-ground-gait.mjs';
import {runSequence} from '../tools/avatar-motion/sequence.mjs';
import {toroidalRotation} from '../src/toroidal-locomotion.mjs';

const explorer='avatar/explorer-hero-v30.glb';

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

test('a pilot keeps facing the view: lies out ahead, leans into a strafe, stands to back away',async()=>{
  const route=[['launch',1.2,{flight:true,vertical:1}],['ahead',2,{flight:true,forward:1,sprint:true}],
    ['side',2,{flight:true,right:1,sprint:true}],['back',2.2,{flight:true,forward:-1}],
    ['strafe-after-back',2.8,{flight:true,right:-1,sprint:true}]];
  const seen={};let lastPosition=null;
  await runSequence({file:explorer,route,pilot:true,onFrame({name,phase,root}){
    const position=root.position.clone();
    if(phase>1.6&&lastPosition&&name!=='launch'){
      const travel=position.clone().sub(lastPosition).normalize();
      const upright=new Vector3(0,1,0).applyQuaternion(toroidalRotation(root.position,0));
      const body=new Vector3(0,1,0).applyQuaternion(root.quaternion);
      const facing=new Vector3(0,0,1).applyQuaternion(root.quaternion);
      seen[name]={upright:body.dot(upright),lean:body.dot(travel),facing:facing.dot(travel)};
    }
    lastPosition=position;
  }});
  const note=JSON.stringify(seen);
  assert.ok(seen.ahead.lean>.8,note);                       // lying out along the travel
  assert.ok(seen.side.upright>.6&&seen.side.lean>.2,note);   // upright, leaning into the strafe
  assert.ok(Math.abs(seen.side.facing)<.45,note);            // still facing the view, not turned sideways
  assert.ok(seen.back.upright>.75,note);                     // standing up to back away
  // The backward lean releases into the strafe lean.
  assert.ok(seen['strafe-after-back'].upright>.6&&seen['strafe-after-back'].lean>.2,note);
});

test('a submerged strafe stays upright while a forward stroke lies out',async()=>{
  const start={u:.005,v:.325,height:-11,cameraSteering:true};
  const route=[['forward',2,{forward:1}],['strafe',2.5,{right:1}]];
  const alignment={};
  await runSequence({file:explorer,route,start,pilot:true,onFrame({name,phase,root}){
    if(phase<1.6)return;
    const upright=new Vector3(0,1,0).applyQuaternion(toroidalRotation(root.position,0));
    alignment[name]=new Vector3(0,1,0).applyQuaternion(root.quaternion).dot(upright);
  }});
  assert.ok(alignment.forward<.65,JSON.stringify(alignment));
  assert.ok(alignment.strafe>.8,JSON.stringify(alignment));
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
  assert.ok(lowest<start.pelvis.y-.05,note); // the ready stance settles
  assert.ok(left>.05&&right>.05,note); // weight onto each leg
});

test('every double jump is a superhero surge: no spins, twice as high, none repeated in a row',async()=>{
  const {HEROIC_ROUTE}=await import('../tools/avatar-motion/heroics.mjs');
  const {TRICKS}=await import('../src/flight-avatar-animation.mjs');
  const route=HEROIC_ROUTE.filter(([name])=>/^(still|hop|trick|land)/.test(name));
  const turn=new Map(),lift=new Map(),hands=new Map();let start=null,base=null;
  const result=await runSequence({file:explorer,route,pilot:true,onFrame({name,phase,root,mesh,motion}){
    if(name.startsWith('hop')&&phase<.02){start=root.quaternion.clone();base=motion.height;}
    if(!name.startsWith('trick'))return;
    turn.set(name,Math.max(turn.get(name)??0,root.quaternion.angleTo(start)));
    lift.set(name,Math.max(lift.get(name)??0,motion.height-base));
    if(phase>.4&&!hands.has(name)){
      const inverse=root.quaternion.clone().invert();
      const at=bone=>mesh.getObjectByName(bone).getWorldPosition(new Vector3()).sub(root.position).applyQuaternion(inverse);
      hands.set(name,[at('hand_l'),at('hand_r')].map(h=>h.toArray().map(v=>+v.toFixed(1)).join()).join('|'));
    }
  }});
  assert.ok(TRICKS.length>=4);
  for(const [name,angle] of turn)assert.ok(angle<.7,`${name} turned ${angle}`);
  for(const [name,height] of lift)assert.ok(height>1.6,`${name} height ${height}`);
  assert.ok(new Set(hands.values()).size>=3,[...hands.values()].join(' / '));
  assert.ok(result.bursts>=TRICKS.length,'each surge breaks away with a burst');
});

test('each boost breaks away with a burst and a fresh flight style',async()=>{
  const {HEROIC_ROUTE}=await import('../tools/avatar-motion/heroics.mjs');
  const route=HEROIC_ROUTE.filter(([name])=>/^(still|launch|cruise|boost|brake)/.test(name));
  const hands=new Map();
  const result=await runSequence({file:explorer,route,pilot:true,onFrame({name,phase,mesh,root}){
    if(!name.startsWith('boost')||phase<1.2||hands.has(name))return;
    const inverse=root.quaternion.clone().invert();
    const at=bone=>mesh.getObjectByName(bone).getWorldPosition(new Vector3()).sub(root.position).applyQuaternion(inverse);
    hands.set(name,[at('hand_l'),at('hand_r')].map(hand=>hand.toArray().map(v=>+v.toFixed(1)).join()).join('|'));
  }});
  assert.ok(result.bursts>=5);
  assert.ok(new Set(hands.values()).size>=4,[...hands.values()].join(' / '));
});

test('a chosen crouch is a low stealth stance with a raised guard',async()=>{
  const heights={};
  await runSequence({file:explorer,route:[['stand',1.5,{}],['crouch',1.6,{crouch:true}]],pilot:true,onFrame({name,phase,mesh,root}){
    if(phase<1.2)return;
    const inverse=root.quaternion.clone().invert();
    const at=bone=>mesh.getObjectByName(bone).getWorldPosition(new Vector3()).sub(root.position).applyQuaternion(inverse).y;
    heights[name]={pelvis:at('pelvis'),hand:Math.max(at('hand_l'),at('hand_r')),chest:at('spine_05')};
  }});
  const {stand,crouch}=heights;
  assert.ok(stand.pelvis-crouch.pelvis>.2,JSON.stringify(heights));
  assert.ok(crouch.hand>crouch.chest-.05,JSON.stringify(heights));
});

test('mashing flight keys leans and settles the body instead of whipping it around',async()=>{
  const {keyMash}=await import('../tools/avatar-motion/key-mash.mjs');
  const {worst,mean}=await keyMash({flight:true});
  assert.ok(worst<5&&mean<2,JSON.stringify({worst,mean}));
});

test('a camera-steered vertical loop flies like a plane, body along the travel all the way round',async()=>{
  // Pitch the camera through a full loop while holding forward.
  const steps=24,route=[['launch',1.2,{flight:true,vertical:1}],['level',1,{flight:true,forward:1,pitch:0}]];
  for(let i=1;i<=steps;i++)route.push([`loop-${i}`,.12,{flight:true,forward:1,pitch:i/steps*2*Math.PI}]);
  let previous=null,worst=1;const samples=[];
  // The sampler's locomotion does not steer by pitch; drive the climb from it.
  for(const leg of route)if(leg[0].startsWith('loop')){const p=leg[2].pitch;leg[2]={...leg[2],forward:Math.cos(p),vertical:Math.sin(p)};}
  await runSequence({file:explorer,route,pilot:true,onFrame({name,phase,root}){
    const position=root.position.clone();
    if(name.startsWith('loop')&&phase>.06&&previous){
      const travel=position.clone().sub(previous);
      if(travel.length()>.02){
        const along=new Vector3(0,1,0).applyQuaternion(root.quaternion).dot(travel.normalize());
        samples.push(along);worst=Math.min(worst,along);
      }
    }
    previous=position;
  }});
  assert.ok(samples.length>10,`samples ${samples.length}`);
  assert.ok(worst>.6,`worst alignment ${worst} of ${samples.map(v=>v.toFixed(2)).join(' ')}`);
});
