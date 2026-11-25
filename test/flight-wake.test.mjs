import assert from 'node:assert/strict';
import test from 'node:test';
import {Group,Vector3} from 'three';
import {boostWakeDistance,FlightWake} from '../src/flight-wake.mjs';

test('only continuous boosted motion emits a wake into the single bounded draw',()=>{
  const origin=new Vector3(),end=new Vector3(),up=new Vector3(0,1,0);
  assert.equal(boostWakeDistance(origin,end.set(.6,0,0),.03),.6);
  assert.equal(boostWakeDistance(origin,end.set(.10,0,0),.03),0);
  assert.equal(boostWakeDistance(origin,end.set(6,0,0),.03),0);
  assert.equal(boostWakeDistance(origin,end.set(.6,0,0),.5),0);

  const scene=new Group();
  const wake=new FlightWake(scene);
  wake.observe(1,origin,up,true,.04);
  wake.observe(1,end.set(1,0,0),up,true,.04);
  wake.observe('companion',origin,up,true,.04);
  wake.observe('companion',end,up,true,.04);
  wake.update(true);
  assert.equal(wake.index,2);
  assert.equal(wake.position.count,384);
  assert.notDeepEqual(Array.from(wake.tint.array.slice(0,3)),Array.from(wake.tint.array.slice(3,6)));
  assert.equal(wake.mesh.visible,true);
  wake.update(false);
  assert.equal(wake.mesh.visible,false);
  assert.equal(wake.tracks.size,0);
  wake.dispose();
  assert.equal(scene.children.length,0);
});
