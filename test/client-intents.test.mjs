import {test} from 'node:test';
import assert from 'node:assert/strict';
import {saveIntent,loadIntent,archiveIntent,sameActor,nativeRetryRoute} from '../src/client-intents.mjs';
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)}};
test('reload retains the exact frozen original, capture time and ID for explicit retry',()=>{
 const storage=memory(),body={id:'same-original-123',text:'  original\n  ',view:{capturedAt:123,local:{position:{x:1}}}};
 const frozen=saveIntent(storage,'turn',{id:body.id,body,actorRef:'alice'});
 body.text='later text';body.view.capturedAt=999;
 assert.equal(frozen.body.text,'  original\n  ');
 assert.deepEqual(loadIntent(storage,'turn'),frozen);
 assert.equal(nativeRetryRoute(frozen,'not-retained'),'interactions');
 assert.equal(nativeRetryRoute(frozen,'unknown'),'interactions/same-original-123/retry');
 assert.equal(sameActor(frozen,'bob'),false);
});
test('explicit close retains uncertain original without cancelling it and bounds growth',()=>{
 const storage=memory();const body={id:'unchanged-original',text:'private own-tab original'};
 archiveIntent(storage,'archive',{kind:'native',id:body.id,body});
 const saved=loadIntent(storage,'archive',131072);
 assert.deepEqual(saved[0].body,body);assert.equal(saved[0].trackingClosed,true);
 assert.equal(saved[0].cancelled,undefined);
 for(let i=1;i<8;i++)archiveIntent(storage,'archive',{id:`original-${i}`,body});
 assert.throws(()=>archiveIntent(storage,'archive',{id:'ninth',body}),/full/);
 assert.equal(loadIntent(storage,'archive',131072).length,8);
});
test('source bounds refuse an oversized recovery copy before storage',()=>{
 const storage=memory();assert.throws(()=>saveIntent(storage,'turn',{text:'x'.repeat(17000)}),/bound/);assert.equal(storage.getItem('turn'),null);
});
