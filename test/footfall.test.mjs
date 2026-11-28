import test from 'node:test';
import assert from 'node:assert/strict';
import {Bone,Group,Scene,Vector3} from 'three';
import {FootfallDetector} from '../src/footfall.mjs';
import {footSurface,footDustColour} from '../src/footfall-surface.mjs';
import {SmokePuffs} from '../src/hero-effects.mjs';
import {FlightWake} from '../src/flight-wake.mjs';
import {TOROIDAL_TERRAIN,terrainElevation} from '../src/toroidal-terrain.mjs';

test('a foot that comes down and stops is one step',()=>{
  const root=new Group(),left=new Bone(),right=new Bone();
  left.name='foot_l';right.name='foot_r';root.add(left,right);
  const detector=new FootfallDetector(root);
  assert.ok(detector.available);
  const up=new Vector3(0,1,0),origin=new Vector3();
  let steps=0;
  // Two strides: each foot lifts .15 m and comes down, out of phase.
  for(let frame=0;frame<240;frame++){
    const t=frame/60;
    left.position.y=.08+Math.max(0,Math.sin(t*Math.PI*2))*.15;
    right.position.y=.08+Math.max(0,-Math.sin(t*Math.PI*2))*.15;
    root.updateMatrixWorld(true);
    steps+=detector.sample(origin,up,1,1/60).length;
  }
  assert.ok(steps>=7&&steps<=8,`expected about eight steps in four seconds, got ${steps}`);
});

test('steps know what they land on',()=>{
  const u=.37,v=.61,ground=terrainElevation(u,v);
  const water=TOROIDAL_TERRAIN.waterLevel;
  assert.equal(footSurface({u,v,ground:water-.3,feet:water-.3,waterLevel:water}),'water');
  assert.equal(footSurface({u,v,ground:water-3,feet:water-3,waterLevel:water}),null,'deep water is swimming, not stepping');
  assert.equal(footSurface({u,v,ground:Math.max(ground,water+1),feet:Math.max(ground,water+1)+.5,waterLevel:water}),'stone');
  const dry=footSurface({u,v:.25,ground:water+2,feet:water+2,waterLevel:water});
  assert.equal(dry,'dirt','the main trail is bare earth');
  const colour=footDustColour('dirt',{u,v:.25,ground:water+2});
  assert.equal(colour.length,3);
  for(const c of colour)assert.ok(c>=0&&c<=1.5);
});

test('dust puffs settle and fade at the ground; boost smoke stays lit',()=>{
  const scene=new Scene(),smoke=new SmokePuffs(scene,{count:4});
  smoke.puff(new Vector3(),new Vector3(1,0,0),0,.3,{r:.5,g:.4,b:.3},.2,{glow:0,life:.9,gravity:.8,up:new Vector3(0,1,0),height:.06});
  assert.deepEqual([...smoke.shape.array.slice(0,4)].map(x=>+x.toFixed(2)),[.9,0,.55,.8]);
  assert.deepEqual([...smoke.ground.array.slice(0,4)].map(x=>+x.toFixed(2)),[0,1,0,.06]);
  smoke.update(.5,true);assert.ok(smoke.mesh.visible);
  smoke.update(1,true);assert.ok(!smoke.mesh.visible,'a short dust puff is gone after its own life');
  smoke.dispose();
});

test('footfalls emit at most two puffs and only on grass add green bits',()=>{
  const scene=new Scene(),wake=new FlightWake(scene);
  const before=wake.smoke.next;
  wake.footfall(new Vector3(),new Vector3(0,1,0),new Vector3(0,0,1),1,'grass',{colour:[.3,.5,.2]});
  assert.equal(wake.smoke.next-before,2);
  wake.footfall(new Vector3(),new Vector3(0,1,0),new Vector3(0,0,1),1,'stone',{colour:[.7,.7,.7]});
  assert.equal(wake.smoke.next-before,3);
  wake.dispose();
});
