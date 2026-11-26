import assert from 'node:assert/strict';
import test from 'node:test';
import {argentineSun,nightSkyKey} from '../src/toroidal-solar-clock.mjs';

test('the same UTC instant yields daylight and darkness on the Argentine cycle',()=>{
  const noon=argentineSun(new Date('2026-11-25T12:00:00-03:00'));
  const night=argentineSun(new Date('2026-11-25T00:00:00-03:00'));
  assert.equal(noon.daylight,1);
  assert.equal(night.daylight,0);
  assert.ok(noon.direction[1]>0.8);
  assert.ok(night.direction[1]<-0.3);
  assert.deepEqual(noon,argentineSun(new Date('2026-11-25T15:00:00Z')));
});

test('the cool key fades in only after the existing sun reaches zero',()=>{
  assert.equal(nightSkyKey({daylight:.01,direction:[.8,-.149,.5]}),null);
  const atBoundary=nightSkyKey({daylight:0,direction:[.8,-.15,.5]});
  const rising=nightSkyKey({daylight:0,direction:[.8,-.26,.5]});
  const midnight=nightSkyKey(argentineSun(new Date('2026-11-25T00:00:00-03:00')));
  assert.equal(atBoundary.intensity,0);
  assert.ok(rising.intensity>0&&rising.intensity<midnight.intensity);
  assert.deepEqual(atBoundary.direction,midnight.direction);
  assert.ok(Math.abs(Math.hypot(...midnight.direction)-1)<1e-12);
  assert.ok(midnight.direction[1]>.7);
  assert.equal(midnight.intensity,.55);
});
