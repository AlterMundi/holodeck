import {test} from 'node:test';
import assert from 'node:assert/strict';
import {arrivalDoor,doorLocation} from '../src/space-travel.mjs';

test('crossing a house threshold uses both sides of the same door',()=>{
  const exterior={id:'outside'};
  const interior={id:'studio',exitDoor:{x:0,y:.11,z:4.9},
    exteriorDoor:{x:-2.65,y:.11,z:15.5,facing:-1},exits:[]};
  const landing=arrivalDoor(exterior,interior);
  assert.deepEqual(landing,{x:0,y:.11,z:4,yaw:180});
  assert.ok(doorLocation(landing).split(',').map(Number).every(Number.isFinite));
  assert.deepEqual(arrivalDoor(interior,exterior),interior.exteriorDoor);
  assert.equal(arrivalDoor(interior,interior),null);
});

test('an interior crossing uses the authorized return passage in the destination',()=>{
  const door={x:-4.4,y:.12,z:1.2,yaw:90};
  const from={id:'gallery'};
  const next={id:'tower',exits:[{to:'workshop',door:{x:4}},{to:'gallery',door}]};
  assert.deepEqual(arrivalDoor(from,next),door);
  assert.equal(arrivalDoor({id:'unlinked'},next),null);
});
