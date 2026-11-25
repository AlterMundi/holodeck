import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Plane,Quaternion,Vector2,Vector3} from 'three';
import {constrainInteriorCamera} from '../src/interior-camera.mjs';
import {MatterInspection} from '../src/matter-inspection.mjs';

const cameraState=()=>({position:new Vector3(0,2,4),rotation:new Quaternion(),fov:61,aspect:1.5});
const bench={x:0,y:.95,z:0},player={x:0,y:.1,z:1.6};

test('inspection applies an independent eye pose and restores the native camera',()=>{
  const state=cameraState();
  let mainUpdates=0;
  const camera={distance:NaN,getMainCameraState:()=>state,isFlyCameraOn:()=>false,update(){mainUpdates++;}};
  const collisionsManager={raycastFirst:()=>null};
  const inspection=new MatterInspection(collisionsManager);
  constrainInteriorCamera({coreCameraManager:camera,collisionsManager},()=>'matter',inspection);
  assert.equal(inspection.enter(state,player,bench),true);
  camera.update();
  assert.deepEqual(state.position.toArray(),[0,1.53,1.6]);
  assert.equal(state.fov,61);
  assert.equal(mainUpdates,0);
  const rotation=state.rotation.clone();
  inspection.tilt(.1,.1);
  camera.update();
  assert.ok(state.rotation.angleTo(rotation)>0);
  inspection.exit(state);
  assert.deepEqual(state.position.toArray(),[0,2,4]);
  assert.equal(state.rotation.angleTo(new Quaternion()),0);
  camera.update();
  assert.equal(mainUpdates,1);
});

test('dolly stays on a cursor-selected world ray and leaves the FOV unchanged',()=>{
  const state=cameraState(),inspection=new MatterInspection({raycastFirst:()=>null});
  inspection.enter(state,player,bench);
  inspection.apply(state);
  const rect={left:0,top:0,width:600,height:400},cursor=new Vector2(425,230);
  inspection.dolly(0,cursor,rect,()=>null);
  const target=inspection.anchor.target.clone();
  const before=state.position.clone(),rotation=state.rotation.clone();
  inspection.dolly(.25,cursor,rect,()=>assert.fail('Reuse anchor during a wheel gesture'));
  inspection.apply(state);
  assert.ok(state.position.distanceTo(target)<before.distanceTo(target));
  assert.ok(new Vector3().subVectors(target,before).cross(state.position.clone().sub(before)).length()<1e-6);
  assert.ok(state.rotation.angleTo(rotation)<1e-6);
  assert.equal(state.fov,61);
});

test('inspection movement keeps the eye footprint clear of wall and ceiling',()=>{
  const planes=[new Plane(new Vector3(-1,0,0),.6),new Plane(new Vector3(0,-1,0),2.1)];
  const inspection=new MatterInspection({raycastFirst(ray,limit){
    const hits=planes.map(plane=>ray.distanceToPlane(plane)).filter(distance=>distance!==null&&distance>=0&&distance<=limit);
    return hits.length?[Math.min(...hits)]:null;
  }});
  inspection.enter(cameraState(),player,bench);
  inspection.move(new Vector3(3,0,0));
  inspection.move(new Vector3(0,3,0));
  assert.ok(inspection.eye.x<.45);
  assert.ok(inspection.eye.y<1.95);
});

test('held inspection movement combines axes at a frame rate independent speed',()=>{
  const inspection=new MatterInspection({raycastFirst:()=>null}),state=cameraState();
  inspection.enter(state,player,bench);
  const start=inspection.eye.clone();
  assert.equal(inspection.key({code:'KeyW'}),true);
  assert.equal(inspection.key({code:'KeyD'}),true);
  inspection.moveFromKeys(.05);
  assert.ok(Math.abs(inspection.eye.distanceTo(start)-.0575)<1e-6);
  assert.ok(inspection.eye.x>start.x&&inspection.eye.z<start.z);
  inspection.exit(state);
  assert.equal(inspection.key({code:'KeyW',repeat:true}),true);
  inspection.releaseKey('KeyW');
  assert.equal(inspection.key({code:'KeyW'}),false);
});
