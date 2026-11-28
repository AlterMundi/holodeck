import assert from 'node:assert/strict';
import test from 'node:test';
import {Group,Vector3} from 'three';
import {sampleWaterCrossing,WaterSplash} from '../src/water-splash.mjs';
import {terrainFrame,terrainPosition} from '../src/toroidal-terrain.mjs';

const sample=(previous,draft,{seconds=.05,planar=0,continuous=true,depth=5}={})=>
  sampleWaterCrossing(previous,{draft,depth,seconds,planar,continuous});

test('splash scales with crossing speed and fires once when entering or leaving',()=>{
  const dry=sample(null,-.25).state;
  const mild=sample(dry,.27,{seconds:.18});
  const fast=sample(dry,.27,{planar:17});
  assert.ok(fast.strength>mild.strength&&mild.strength>0);
  assert.ok(sample(dry,.27,{seconds:.24}).strength>0);
  let state=fast.state;
  for(const draft of [.35,.13,.31,.29,.5,.7,.5,.3,.10]){
    const next=sample(state,draft);
    assert.equal(next.strength,0);
    state=next.state;
  }
  assert.ok(sample(state,-.08).strength>0);
});

test('arrival, a relocation, a slow turn and a dry bank cannot make a burst',()=>{
  assert.equal(sample(null,.9).strength,0);
  const dry=sample(null,-.2).state;
  assert.equal(sample(dry,.5,{continuous:false}).strength,0);
  assert.equal(sample(dry,.5,{depth:0}).strength,0);
  const margin=sample(dry,.249).state;
  assert.equal(sample(margin,.254).strength,0);
});

test('splash geometry is pooled and Livianos reduce the droplet count',()=>{
  function run(lightweight){
    const scene=new Group();
    let time=1000;
    const effect=new WaterSplash(scene,{lightweight:()=>lightweight,clock:()=>time});
    const body={u:.0155,v:.26,waterLevel:-9,ground:-15,feet:-8.7};
    effect.observe(1,body,.05,0,true,true);
    time+=50;
    effect.observe(1,{...body,feet:-9.32},.05,0,true,true);
    // Droplets and foam, plus the rings spreading on the surface.
    assert.equal(scene.children.length,2);
    assert.equal(effect.mesh.visible,true);
    assert.equal(effect.ripples.mesh.visible,true);
    const emitted=effect.cursor;
    time+=800;
    effect.update(true);
    assert.equal(effect.mesh.visible,false);
    effect.dispose();
    assert.equal(scene.children.length,0);
    return emitted;
  }
  assert.ok(run(false)>run(true));
});


test('the delayed high-speed splash remembers the zero crossing across the torus seam',()=>{
  const scene=new Group();
  let time=1000;
  const splash=new WaterSplash(scene,{clock:()=>time,pixelRatio:()=>.75});
  const initial={u:.99998,v:.25,waterLevel:-9,ground:-15,feet:-8.7};
  const impactU=.00001;
  const heading=new Vector3().fromArray(terrainFrame(impactU,initial.v).alongRing);
  const observe=(u,feet)=>{
    time+=50;
    splash.observe('pilot',{...initial,u,feet},.05,17,true,true);
  };
  try{
    observe(initial.u,initial.feet);
    observe(.00002,-9.10);
    assert.equal(splash.cursor,0);
    observe(.00012,-9.32);
    assert.ok(splash.cursor>20);
    const up=new Vector3().fromArray(terrainFrame(impactU,initial.v).up);
    const surface=new Vector3().fromArray(terrainPosition(impactU,initial.v,-9));
    const center=surface.clone().addScaledVector(up,.047);
    let foam=0,air=0,forward=0;
    for(let i=0;i<splash.cursor;i++){
      const launch=new Vector3().fromBufferAttribute(splash.velocity,i);
      const origin=new Vector3().fromBufferAttribute(splash.origins,i);
      if(splash.timing.getW(i)){
        foam++;
        assert.ok(splash.timing.getZ(i)<=.36);
        assert.ok(Math.abs(up.dot(launch))<1e-5);
        assert.ok(origin.distanceTo(surface)<.6);
      }else{
        air++;
        if(heading.dot(launch)>1)forward++;
        assert.ok(up.dot(launch)>0);
        assert.ok(origin.distanceTo(center)<.001);
      }
    }
    assert.ok(foam>0&&forward>air*.70);
    assert.equal(splash.mesh.material.uniforms.pixelRatio.value,.75);
    const bursts=splash.cursor;
    observe(.00018,-9.4);
    assert.equal(splash.cursor,bursts);
  }finally{splash.dispose();}
});
