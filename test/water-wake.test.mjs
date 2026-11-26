import assert from 'node:assert/strict';
import test from 'node:test';
import {Group,Vector3} from 'three';
import {sampleWetFlight,WaterWake} from '../src/water-wake.mjs';

const water={u:.016,v:.266,waterLevel:-9,ground:-15,feet:-9.5};

test('flight trail follows real water, drains and restarts after another pass',()=>{
  const skim=sampleWetFlight(null,{...water,feet:-8.3},0);
  assert.equal(skim.near,true);
  assert.equal(skim.amount,1);
  const fringe=sampleWetFlight(skim,{...water,feet:-8.02},.12);
  assert.equal(fringe.near,true);
  const departure=sampleWetFlight(fringe,{...water,feet:-7.8},.2);
  assert.equal(departure.near,false);
  assert.equal(departure.amount,1);
  const fading=sampleWetFlight(departure,{...water,feet:-7.8},1.05);
  assert.ok(fading.amount>0&&fading.amount<.7);
  const dry=sampleWetFlight(fading,{...water,feet:-7.8},1.78);
  assert.equal(dry.amount,0);
  assert.equal(sampleWetFlight(dry,{...water,ground:-8,feet:-8.8},2).amount,0);
  assert.equal(sampleWetFlight(dry,water,2.1).amount,1);
});

test('the bounded blue trail sheds across frames and cannot bridge a reposition',()=>{
  const scene=new Group();
  let time=0;
  const wake=new WaterWake(scene,{clock:()=>time});
  const up=new Vector3(0,1,0),position=new Vector3(0,0,0);
  const tick=(sample,continuous=true,emit=true)=>{
    time+=50;
    position.x+=.4;
    wake.observe(1,position,up,sample,{flying:true,seconds:.05,continuous,emit});
    wake.update(true);
  };
  tick(water);
  for(let i=0;i<20;i++)tick(water);
  assert.ok(wake.cursor>25&&wake.mesh.visible);
  const count=wake.cursor;
  tick({...water,feet:-7},false);
  assert.equal(wake.cursor,count);
  for(let i=0;i<18;i++)tick({...water,feet:-6});
  assert.equal(wake.cursor,count);
  assert.equal(wake.mesh.visible,false);
  for(let i=0;i<10;i++)tick(water,true,false);
  assert.equal(wake.cursor,count);
  wake.update(false);
  assert.equal(wake.tracks.size,0);
  wake.dispose();
  assert.equal(scene.children.length,0);
});
