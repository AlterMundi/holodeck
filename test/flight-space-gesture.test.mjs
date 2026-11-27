import test from 'node:test';
import assert from 'node:assert/strict';
import {bindFlightSpaceGesture} from '../src/flight-space-gesture.mjs';

test('the second press distinguishes a short tap, a hold and an interruption',()=>{
  const calls=[];
  const space={code:'Space'};
  let now=0,allowed=true;
  const gesture=bindFlightSpaceGesture({allowed:()=>allowed,clock:()=>now,
    onFlight:()=>calls.push('flight'),onDoubleJump:()=>calls.push('jump')});
  const pair=base=>{
    now=base;gesture.down(space);
    now+=55;gesture.up(space);
    now+=95;gesture.down(space);
  };
  pair(0);
  now+=70;gesture.up(space);
  pair(600);
  now+=250;gesture.up(space);
  pair(1200);
  gesture.cancel();gesture.up(space);
  allowed=false;pair(1800);gesture.up(space);
  assert.deepEqual(calls,['jump','flight']);
});
