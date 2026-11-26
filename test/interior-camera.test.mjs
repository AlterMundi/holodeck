import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Plane, Quaternion, Vector3} from 'three';
import {constrainInteriorCamera} from '../src/interior-camera.mjs';
import {passageMarkup} from '../src/interior-geometry.mjs';

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


test('closed fitted doors block the boom from the wall to the handle',()=>{
  const passage={slot:0,kind:'door',rise:0,label:'Taller'};
  const envelope=markup=>markup.match(/<m-cube[^>]*id="passage-leaf-collider-0"[^>]*>/)?.[0];
  const volume=envelope(passageMarkup(passage,{houseDoor:true}));
  assert.match(volume,/z="0.28".*depth="0.84".*opacity="0"/);
  assert.doesNotMatch(volume,/collide="false"/);
  assert.equal(envelope(passageMarkup(passage,{houseDoor:true,existingDoor:true})),undefined);
  const returnDoor=envelope(passageMarkup(passage,{returnLeaf:{src:'return.glb',onLanding:true}}));
  assert.match(returnDoor,/y="2.06".*depth="0.43".*opacity="0"/);
  assert.equal(envelope(passageMarkup({...passage,kind:'portal'},{houseDoor:true})),undefined);
});
