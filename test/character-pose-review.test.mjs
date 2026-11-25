import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {createCharacterPoseReview} from '../src/character-pose-review.mjs';
import {characterPoseCatalog} from '../tools/character-pose-catalog.mjs';

test('pose feedback belongs to the exact qualified clip and frame and is attributed once',async()=>{
  const catalog=await characterPoseCatalog('f'.repeat(64));
  const {edition,maxFrame}=catalog.humanoid['estudio-vuelo'];
  assert.equal(maxFrame,180);
  let saved;
  const store={load:()=>saved,save:value=>{saved=value;}};
  const review=createCharacterPoseReview(store,catalog);
  const actor={id:'human:one',name:'One'};
  const pose={rig:'humanoid',clip:'estudio-vuelo',edition,frame:78};
  const request={id:randomUUID(),pose,text:'Look at the shoulder'};
  assert.equal(review.add(actor,{...request,pose:{...pose,edition:'a'.repeat(64)+'.'+'b'.repeat(64)}}).status,409);
  assert.equal(review.add(actor,{...request,pose:{...pose,frame:181}}).status,409);
  assert.equal(review.add(actor,{...request,author:'Someone else'}).status,400);
  assert.equal(review.add(actor,request).status,200);
  assert.equal(review.add(actor,request).notes.length,1);
  assert.equal(review.add(actor,{...request,text:'Changed retry'}).status,409);
  assert.deepEqual(review.forPose({...pose,frame:79}).notes,[]);
  const restored=createCharacterPoseReview(store,catalog);
  assert.deepEqual(restored.forPose(pose).notes.map(({author,text})=>({author,text})),
    [{author:'One',text:request.text}]);
});

test('an uncertain durable replacement fences writes without claiming a save',()=>{
  const edition='a'.repeat(64)+'.'+'b'.repeat(64);
  const catalog={companion:{walk:{edition,maxFrame:45}}};
  let writes=0;
  const store={load:()=>null,save(){
    writes++;
    throw Object.assign(new Error('uncertain'),{commitUncertain:true});
  }};
  const review=createCharacterPoseReview(store,catalog);
  const actor={id:'human:one'};
  const pose={rig:'companion',clip:'walk',edition,frame:5};
  for(let i=0;i<2;i++)assert.equal(review.add(actor,{pose,id:randomUUID(),text:'Note'}).status,503);
  assert.equal(writes,1);
  assert.deepEqual(review.forPose(pose).notes,[]);
});
