import assert from 'node:assert/strict';
import test from 'node:test';
import {Group,Quaternion,Vector3} from 'three';
import {bindAvatarFraming,bindCloseAvatar} from '../src/avatar-camera.mjs';

test('Shift wheel alone shifts the pivot along avatar up without mutating the supplied target',()=>{
  const canvas=new EventTarget();
  const camera={isFlyCameraOn:()=>false,setTarget(target){this.pivot=target.clone();}};
  const rotation=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),Math.PI/2);
  const target=new Vector3(5,8,4);
  const dispose=bindAvatarFraming(camera,canvas,()=>rotation);
  function wheel(shift){
    const event=new Event('wheel',{cancelable:true});
    Object.assign(event,{shiftKey:shift,deltaY:0,deltaX:200,deltaMode:0});
    canvas.dispatchEvent(event);
    for(let i=0;i<40;i++)camera.setTarget(target);
    return event;
  }
  assert.equal(wheel(false).defaultPrevented,false);
  assert.deepEqual(camera.pivot.toArray(),target.toArray());
  assert.equal(wheel(true).defaultPrevented,true);
  assert.ok(Math.abs(camera.pivot.x-5.48)<.001);
  assert.ok(Math.abs(camera.pivot.y-8)<1e-10);
  assert.deepEqual(target.toArray(),[5,8,4]);
  dispose();
  assert.equal(wheel(true).defaultPrevented,false);
  assert.deepEqual(camera.pivot.toArray(),target.toArray());
});

test('close framing hides the entire local model and restores it when the eye retreats',()=>{
  const character=new Group(),mesh=new Group(),peer=new Group();
  character.add(mesh);
  character.rotation.z=Math.PI/2;
  character.getMesh=()=>mesh;
  const controller={loadedCharacters:new Map([[1,{character}],[2,{character:peer}]]),update:()=>1};
  const cameraEye=new Vector3();
  const camera={getCameraState:()=>({position:cameraEye})};
  let enabled=true;
  const dispose=bindCloseAvatar(controller,camera,()=>enabled);
  const update=distance=>{
    cameraEye.set(-1.5,0,distance);
    assert.equal(controller.update({localCharacterId:1}),1);
    return mesh.visible;
  };
  assert.equal(update(.8),true);
  assert.equal(update(.69),false);
  assert.equal(update(.8),false);
  assert.equal(peer.visible,true);
  assert.equal(update(.9),true);
  assert.equal(update(.68),false);
  enabled=false;
  assert.equal(update(.4),true);
  dispose();
});
