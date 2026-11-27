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
  assert.equal(Math.round(Math.asin(-celestialPole[1])*180/Math.PI*10),318);
  assert.deepEqual(cloudWind(instant),cloudWind(new Date(instant)));
  const lowCycle=cloudWind(instant+73*60000),wind=cloudWind(instant);
  assert.ok(Math.hypot(lowCycle[0]-wind[0],lowCycle[1]-wind[1])<1e-9);
  assert.ok(Math.hypot(lowCycle[2]-wind[2],lowCycle[3]-wind[3])>1);
});

test('the Sun and Moon overlap above Quintana during a known eclipse',async()=>{
  const {quintanaCelestial,solarObscuration}=await import('../src/quintana-celestial.mjs');
  const eclipse=quintanaCelestial(new Date('2020-12-14T16:05Z'));
  assert.ok(eclipse.sun.altitude>78&&eclipse.moon.altitude>78);
  assert.ok(solarObscuration(eclipse)>.45);
  assert.equal(solarObscuration(quintanaCelestial(new Date('2020-12-18T16:05Z'))),0);
});

test('travel changes the local day while the neighborhood keeps Quintana and the Moon follows its phase',async()=>{
  const {ringEarthLocation,toroidalSky}=await import('../src/quintana-celestial.mjs');
  const {terrainPosition}=await import('../src/toroidal-terrain.mjs');
  const {SearchMoonPhase}=await import('astronomy-engine');
  const sky=(u,date,v=.25)=>{const [x,y,z]=terrainPosition(u,v,20);return toroidalSky(date,{x,y,z});};
  const date=new Date('2026-11-27T16:00:00Z');
  const atHome=sky(0,date);
  assert.ok(Math.abs(atHome.latitude+31.80349305)<1e-8);
  assert.ok(Math.abs(atHome.longitude+64.41885653)<1e-8);
  assert.equal(atHome.daylight,1);
  assert.equal(sky(.5,date).daylight,0);
  assert.deepEqual(ringEarthLocation(0,.25),ringEarthLocation(1,.25));
  const pole=.25+(90+31.80349305)/360;
  const before=sky(.1,date,pole-1e-6),after=sky(.1,date,pole+1e-6);
  assert.ok(Math.hypot(...before.sun.map((value,i)=>value-after.sun[i]))<1e-4);
  const event=degrees=>SearchMoonPhase(degrees,new Date('2026-11-01T00:00Z'),35).date;
  assert.ok(sky(0,event(0)).illuminated<.01);
  assert.ok(sky(0,event(180)).illuminated>.99);
});
