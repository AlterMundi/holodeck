import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Plane,Vector3} from 'three';
import {createAvatarHeadroom} from '../src/avatar-headroom.mjs';

test('the swept capsule stops below an overhead surface on both local gravity axes',()=>{
  const clear=createAvatarHeadroom();
  const capsule={radius:.45,segment:{end:{y:1.05}}};
  const right=new Vector3(0,0,1);
  for(const up of [new Vector3(0,1,0),new Vector3(-1,0,0)]){
    const side=new Vector3().crossVectors(up,right);
    const ceiling=new Plane(up,-4.01);
    const hit=new Vector3();
    const collision={raycastFirst(ray,limit){
      if(!ray.intersectPlane(ceiling,hit))return null;
      const distance=hit.distanceTo(ray.origin);
      return distance<limit?[distance]:null;
    }};
    const rise=4;
    const destination=up.clone().multiplyScalar(rise+.10);
    const allowed=clear(destination,rise,capsule,collision,up,right,side);
    const apex=.10+allowed+1.95;
    assert.ok(apex>3.96&&apex<4.01,apex);
    assert.equal(clear(destination,-1,capsule,collision,up,right,side),-1);
  }
});
