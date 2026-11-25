import assert from 'node:assert/strict';
import test from 'node:test';
import {Quaternion, Vector3} from 'three';
import {ToroidalLocomotion, toroidalRotation} from '../src/toroidal-locomotion.mjs';
import {
  TOROIDAL_OVERLOOK, TOROIDAL_TERRAIN, terrainElevation, terrainFrame, terrainPosition, terrainWaterDepth, toroidalSpurPoint,
} from '../src/toroidal-terrain.mjs';

const EPS = 1e-9;

function simulate(motion, seconds, rate, input) {
  for (let i = 0; i < seconds * rate; i += 1) motion.update(1 / rate, input);
  return motion.pose();
}

test('locomotion crosses both terrain seams on the seeded surface', () => {
  const motion = new ToroidalLocomotion({u: .9999, v: .9999});
  const pose = simulate(motion, 2, 60, {right: 1, forward: 1, sprint: true});
  assert.ok(motion.u > 0 && motion.u < .01);
  assert.ok(motion.v > 0 && motion.v < .01);
  assert.equal(pose.grounded, true);
  assert.equal(motion.height, terrainElevation(motion.u, motion.v));
});

test('matched inputs at 30 and 120 Hz produce the same grounded pose', () => {
  const start = {u: .997, v: .999};
  const slow = new ToroidalLocomotion(start);
  const fast = new ToroidalLocomotion(start);
  const action = {forward: .8, right: -.3, yaw: .4, sprint: true};
  assert.deepEqual(simulate(slow, 3, 30, action), simulate(fast, 3, 120, action));
});

test('jump rises along the local up axis and lands at the same point on every face', () => {
  for (const v of [0, .25, .5, .75]) {
    const motion = new ToroidalLocomotion({u: .42, v, ground: () => 6});
    const start = motion.pose();
    const {position, grounded} = simulate(motion, .2, 60, {jump: true});
    assert.equal(grounded, false);
    const offset = new Vector3(position.x - start.position.x, position.y - start.position.y, position.z - start.position.z);
    const frame = terrainFrame(.42, v);
    assert.ok(offset.length() > .5);
    assert.ok(offset.normalize().distanceTo(new Vector3(...frame.up)) < EPS);
    assert.deepEqual(simulate(motion, 1.25, 60, {jump: true}), start);
  }
});

test('the existing position-and-yaw wire shape reconstructs local up and heading', () => {
  const yaw = -.8;
  for (const [u, v] of [[0, 0], [.999999, .25], [.47, .5], [.002, .75]]) {
    const {position, rotation} = new ToroidalLocomotion({u, v, yaw}).pose();
    const remote = JSON.parse(JSON.stringify({position, rotation}));
    const first = toroidalRotation(position, rotation.eulerY);
    const second = toroidalRotation(remote.position, remote.rotation.eulerY, new Quaternion());
    assert.ok(first.angleTo(second) < 1e-7);
    const frame = terrainFrame(u, v);
    const observedUp = new Vector3(0, 1, 0).applyQuaternion(second);
    const observedHeading = new Vector3(0, 0, 1).applyQuaternion(second);
    const expectedHeading = new Vector3(...frame.aroundTube).multiplyScalar(Math.cos(yaw))
      .addScaledVector(new Vector3(...frame.alongRing), Math.sin(yaw));
    assert.ok(observedUp.distanceTo(new Vector3(...frame.up)) < EPS);
    assert.ok(observedHeading.distanceTo(expectedHeading) < EPS);
  }
});

test('radial motion can complete a lap around the ring on a level reference surface', () => {
  const terrain = {majorRadius: 100, tubeRadius: 30};
  const motion = new ToroidalLocomotion({u: .012, v: .75, ground: () => 0, terrain});
  let wraps = 0;
  let previousU = motion.u;
  for (let i = 0; i < 80 * 60; i += 1) {
    motion.update(1 / 60, {right: 1, sprint: true});
    if (motion.u < previousU) wraps += 1;
    previousU = motion.u;
  }
  assert.equal(wraps, 1);
  assert.ok(motion.u > .02 && motion.u < .04);
  assert.equal(motion.v, .75);
  assert.equal(motion.height, 0);
});

test('the seeded shore supports wading, a deep crossing and return to dry land', () => {
  const motion = new ToroidalLocomotion({u: .0155,v: .237});
  const seen = new Set();
  for (let frame = 0; frame < 55 * 60; frame += 1) {
    motion.update(1/60,{forward:1,sprint:true});
    const depth=terrainWaterDepth(motion.u,motion.v);
    if (depth===0) seen.add('dry');
    else if (depth<.8) seen.add('wading');
    else if (depth>2&&motion.grounded) {
      seen.add('floating');
      assert.ok(motion.height > terrainElevation(motion.u,motion.v) + 1);
      assert.ok(motion.height > TOROIDAL_TERRAIN.waterLevel - 1);
      assert.ok(motion.crossSpeed < 4);
    }
    if(seen.has('floating')&&depth===0&&motion.v>.27)break;
  }
  assert.deepEqual([...seen],['dry','wading','floating']);
  assert.equal(terrainWaterDepth(motion.u,motion.v),0);
  assert.ok(motion.v>.27);
});

test('the authored spur can be followed from the first shore to the inner overlook',()=>{
  const motion=new ToroidalLocomotion(toroidalSpurPoint(.309));
  const destination=TOROIDAL_OVERLOOK.v,{waterLevel,majorRadius,tubeRadius}=TOROIDAL_TERRAIN;
  const here=new Vector3(),next=new Vector3(),direction=new Vector3(),axis=new Vector3();
  let dove=false,resurfaced=false;
  for(let frame=0;frame<260*60&&motion.v<destination-.00035;frame++){
    const point=toroidalSpurPoint(Math.min(destination,motion.v+.0032));
    const ground=terrainElevation(point.u,point.v);
    const position=motion.pose().position;
    here.set(position.x,position.y,position.z);
    direction.fromArray(terrainPosition(point.u,point.v,Math.max(ground,waterLevel-.96))).sub(here);
    const {alongRing,aroundTube}=terrainFrame(motion.u,motion.v);
    const yaw=Math.atan2(direction.dot(axis.fromArray(alongRing)),direction.dot(axis.fromArray(aroundTube)));
    const vertical=motion.v>.345&&motion.v<.356?-1:motion.v>=.356&&!resurfaced?1:0;
    motion.update(1/60,{forward:1,yaw,vertical});
    const after=motion.pose().position;
    assert.ok(next.set(after.x,after.y,after.z).distanceTo(here)<.145);
    const delta=motion.u-toroidalSpurPoint(motion.v).u;
    const radius=majorRadius+(tubeRadius+motion.height)*Math.cos(motion.v*2*Math.PI);
    assert.ok(Math.abs(delta-Math.round(delta))*radius*2*Math.PI<2);
    dove ||= motion.swimming&&motion.height<waterLevel-3;
    resurfaced ||= dove&&motion.height>=waterLevel-1&&terrainWaterDepth(motion.u,motion.v)>3;
  }
  assert.ok(dove&&resurfaced&&motion.grounded);
  assert.ok(Math.abs(motion.v-destination)<.00035);
  assert.ok(Math.abs(motion.u-TOROIDAL_OVERLOOK.u)<.0004);
  assert.equal(terrainWaterDepth(motion.u,motion.v),0);
  assert.equal(motion.height,terrainElevation(motion.u,motion.v));
  assert.ok(motion.height>35);
});

test('a continuous route completes the ring on the production seed', () => {
  const motion = new ToroidalLocomotion({u:0,v:.25});
  let crossed=false;
  let traversedWater=false;
  for(let frame=0;frame<45*60*10;frame++){
    const previous=motion.u;
    motion.update(.1,{right:1,sprint:true});
    traversedWater ||= terrainWaterDepth(motion.u,motion.v)>2;
    if(motion.u<previous){
      crossed=true;
      break;
    }
  }
  assert.equal(crossed,true);
  assert.equal(traversedWater,true);
  assert.equal(motion.v,.25);
});


test('flight climbs, hovers, descends and returns to the seeded surface',()=>{
  const pilot=new ToroidalLocomotion({u:.013,v:.26});
  const base=pilot.height;
  const advance=(frames,controls)=>{
    for(let i=0;i<frames;i++)pilot.update(1/60,controls);
  };
  advance(60,{flight:true,vertical:1});
  assert.ok(pilot.height>base+4.8);
  const hover=pilot.height;
  advance(60,{flight:true});
  assert.equal(pilot.height,hover);
  advance(30,{flight:true,vertical:-1});
  assert.ok(pilot.height<hover-2.4);
  advance(120,{});
  assert.equal(pilot.height,base);
  assert.equal(pilot.grounded,true);
});

test('descent enters the water and swimming can reach the bottom and resurface',()=>{
  const terrain={...TOROIDAL_TERRAIN,waterLevel:-3};
  const motion=new ToroidalLocomotion({u:.1,v:.2,terrain,ground:()=>-12});
  assert.ok(motion.height>terrain.waterLevel-1);
  simulate(motion,1,60,{vertical:-1});
  assert.equal(motion.swimming,true);
  assert.ok(motion.height<terrain.waterLevel-2);
  simulate(motion,6,60,{vertical:-1});
  assert.equal(motion.height,-12);
  simulate(motion,5,60,{vertical:1});
  assert.equal(motion.swimming,false);
  assert.ok(motion.height>=terrain.waterLevel-1);
});

test('crouching holds the lip of a ledge instead of walking off it',()=>{
  const terrain={...TOROIDAL_TERRAIN,waterLevel:-500};
  const ground=(u,v)=>v<.201?0:-2;
  const start={u:.1,v:.2009,terrain,ground};
  const careful=new ToroidalLocomotion(start);
  simulate(careful,2,60,{forward:1,crouch:true});
  assert.ok(careful.v<.201);
  assert.equal(careful.height,0);
  const ordinary=new ToroidalLocomotion(start);
  simulate(ordinary,2,60,{forward:1});
  assert.ok(ordinary.v>.201);
  assert.equal(ordinary.height,-2);
});

test('boost flight travels at least three times the flat ground run speed',()=>{
  const motion=height=>new ToroidalLocomotion({u:.02,v:.25,height,ground:()=>18});
  const run=motion(18),fly=motion(32);
  const speeds=[run,fly].map((pilot,index)=>{
    const input={forward:1,sprint:true,flight:index===1};
    const start=simulate(pilot,1,60,input).position;
    const end=simulate(pilot,1,60,input).position;
    return new Vector3().copy(end).distanceTo(start);
  });
  assert.ok(speeds[0]>7.9&&speeds[0]<8.1);
  assert.ok(speeds[1]>=3*speeds[0]&&speeds[1]<25.1);
});
