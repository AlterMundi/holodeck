import assert from 'node:assert/strict';
import test from 'node:test';
import {Group} from 'three';
import {sampleWaterCrossing,WaterSplash} from '../src/water-splash.mjs';

const sample=(previous,draft,{seconds=.05,planar=0,continuous=true,depth=5}={})=>
  sampleWaterCrossing(previous,{draft,depth,seconds,planar,continuous});

test('splash scales with crossing speed and fires once when entering or leaving',()=>{
  const dry=sample(null,-.25).state;
  const mild=sample(dry,.27,{seconds:.18});
  const fast=sample(dry,.27,{planar:17});
  assert.ok(fast.strength>mild.strength&&mild.strength>0);
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
    assert.equal(scene.children.length,1);
    assert.equal(effect.mesh.visible,true);
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
