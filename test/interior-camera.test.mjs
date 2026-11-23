import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Plane, Quaternion, Vector3} from 'three';
import {constrainInteriorCamera} from '../src/interior-camera.mjs';

test('interior camera retracts before rendering a newly occluded orbit and clears its limit on exit',()=>{
  let room='foyer';
  let direction=new Vector3(0,0,1);
  const state={position:new Vector3(),rotation:new Quaternion(),fov:65,aspect:16/9};
  const camera={distance:4,getMainCameraState:()=>state,isFlyCameraOn:()=>false,
    update(){
      state.position.copy(direction).multiplyScalar(this.distance);
      state.rotation.setFromUnitVectors(new Vector3(0,0,1),direction);
    }};
  const wall=new Plane(new Vector3(-1,0,0),2);
  const target=new Vector3();
  const collisionsManager={raycastFirst(ray,max){
    const hit=ray.intersectPlane(wall,target);
    const distance=hit?.distanceTo(ray.origin);
    return distance!=null&&distance<max?[distance]:null;
  }};
  constrainInteriorCamera({coreCameraManager:camera,collisionsManager},()=>room);

  camera.update();
  assert.equal(state.position.z,4);
  direction=new Vector3(1,0,1).normalize();
  camera.update();
  assert.ok(state.position.x<1.95,'same-frame clearance on diagonal orbit');

  const distance=state.position.length();
  direction=new Vector3(0,0,1);
  camera.update();
  assert.ok(state.position.length()>distance&&state.position.length()<=distance+.19);
  room=null;
  camera.update();
  assert.equal(state.position.z,4);
});
