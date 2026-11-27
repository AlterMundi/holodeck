import assert from 'node:assert/strict';
import test from 'node:test';
import {argentineSun,nightSkyKey,celestialRotation,celestialPole,cloudWind} from '../src/toroidal-solar-clock.mjs';

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


test('stars move on the sidereal clock and clouds drift on shared UTC in two layers',()=>{
  const instant=Date.parse('2026-11-27T04:00:00Z');
  const a=celestialRotation(instant),b=celestialRotation(instant+3600000);
  const delta=Math.atan2(a[0]*b[1]-a[1]*b[0],a[0]*b[0]+a[1]*b[1]);
  assert.ok(Math.abs(delta*180/Math.PI-15.0411)<.001);
  const cycle=celestialRotation(instant+86164090.5);
  assert.ok(Math.hypot(a[0]-cycle[0],a[1]-cycle[1])<1e-6);
  assert.ok(celestialPole[0]<0&&celestialPole[1]<0);
  assert.equal(Math.round(Math.asin(-celestialPole[1])*180/Math.PI*10),314);
  assert.deepEqual(cloudWind(instant),cloudWind(new Date(instant)));
  const lowCycle=cloudWind(instant+73*60000),wind=cloudWind(instant);
  assert.ok(Math.hypot(lowCycle[0]-wind[0],lowCycle[1]-wind[1])<1e-9);
  assert.ok(Math.hypot(lowCycle[2]-wind[2],lowCycle[3]-wind[3])>1);
});
