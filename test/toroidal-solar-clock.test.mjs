import assert from 'node:assert/strict';
import test from 'node:test';
import {argentineSun} from '../src/toroidal-solar-clock.mjs';

test('the same UTC instant yields daylight and darkness on the Argentine cycle',()=>{
  const noon=argentineSun(new Date('2026-11-25T12:00:00-03:00'));
  const night=argentineSun(new Date('2026-11-25T00:00:00-03:00'));
  assert.equal(noon.daylight,1);
  assert.equal(night.daylight,0);
  assert.ok(noon.direction[1]>0.8);
  assert.ok(night.direction[1]<-0.3);
  assert.deepEqual(noon,argentineSun(new Date('2026-11-25T15:00:00Z')));
});
