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
  for(let i=0;i<22;i++)tick({...water,feet:-6});
  assert.equal(wake.cursor,count);
  assert.equal(wake.mesh.visible,false);
  for(let i=0;i<10;i++)tick(water,true,false);
  assert.equal(wake.cursor,count);
  wake.update(false);
  assert.equal(wake.tracks.size,0);
  assert.equal(wake.timing.getX(0),-10);
  wake.dispose();
  assert.equal(scene.children.length,0);
});


test('drops continue to shed after departure, then stop while flight keeps moving',()=>{
  const scene=new Group();
  let time=0;
  const wake=new WaterWake(scene,{clock:()=>time,lightweight:()=>true,pixelRatio:()=>1.5});
  const position=new Vector3(),up=new Vector3(0,1,0);
  const frame=feet=>{
    time+=50;
    position.x+=.5;
    wake.observe(1,position,up,{...water,feet},{flying:true,seconds:.05,continuous:true,emit:true});
    wake.update(true);
  };
  frame(-9);
  for(let i=0;i<10;i++)frame(-9);
  const wetDrops=wake.cursor;
  assert.ok(wetDrops>0);
  assert.equal(wake.mesh.material.uniforms.pixelRatio.value,1.5);
  const kinds=new Set(Array.from({length:wetDrops},(_,i)=>wake.timing.getW(i)));
  assert.deepEqual(kinds,new Set([1,0]),'mist and drops belong to the same geometry');
  assert.ok(wake.launch.getY(0)>0,'skim spray should arc above the plane');
  assert.ok(wake.launch.getY(1)>0,'skim drops should arc above the plane');
  for(let i=0;i<16;i++)frame(-7);
  assert.ok(wake.cursor>wetDrops);
  for(let i=0;i<20;i++)frame(-7);
  const dryDrops=wake.cursor;
  for(let i=0;i<16;i++)frame(-7);
  assert.equal(wake.cursor,dryDrops);
  assert.equal(wake.mesh.visible,false);
  for(let i=0;i<8;i++)frame(-8.4);
  assert.ok(wake.cursor>dryDrops);
  wake.dispose();
});


test('surface spray stays on the waterline and slow peer frames preserve runoff',()=>{
  let time=0;
  const wake=new WaterWake(new Group(),{clock:()=>time});
  const position=new Vector3(),up=new Vector3(0,1,0);
  const frame=(feet,seconds,dx)=>{
    time+=1000*seconds;
    position.x+=dx;
    position.y=feet;
    wake.observe(2,position,up,{...water,feet},{flying:true,seconds,continuous:true,emit:true});
    wake.update(true);
  };
  frame(-8.6,.05,0);
  frame(-8.6,.05,.5);
  assert.equal(wake.timing.getW(0),1);
  assert.ok(Math.abs(wake.timing.getZ(0)-.1)<1e-5);
  assert.ok(Math.abs(wake.positions.getY(0)-(-8.90))<1e-5);
  const skimCount=wake.cursor;
  frame(-7.6,.2,4);
  assert.ok(wake.cursor>skimCount,'a 20 m/s peer still drips after a slow frame');
  assert.ok(wake.cursor-skimCount<=15,'the slow frame respects the bounded rate');
  for(let i=skimCount;i<wake.cursor;i++)assert.equal(wake.timing.getW(i),0);
  frame(-8.6,.05,.5);
  const prior=wake.cursor;
  frame(-8.6,.32,4.9);
  assert.equal(wake.cursor-prior,18);
  assert.ok(wake.positions.getX(wake.cursor-1)>position.x-.25,'the capped frame covers its full path');
  frame(-11,.2,2);
  const submergedCount=wake.cursor;
  frame(-11,.2,2);
  assert.ok(wake.cursor>submergedCount);
  for(let i=submergedCount;i<wake.cursor;i++)assert.equal(wake.timing.getW(i),0);
  wake.dispose();
});
