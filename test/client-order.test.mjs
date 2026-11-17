import {test} from 'node:test';
import assert from 'node:assert/strict';
import {snapshotMayApply,sameRequest} from '../src/client-order.mjs';
const state=(sequence,extra={})=>({actorRef:'human-a',run:'run-a',edition:'edition-a',sequence,...extra});
test('only the latest issued state read applies, including late old-epoch responses',()=>{
 const current=state(3);
 assert.equal(snapshotMayApply(current,state(2),1,2),false);
 assert.equal(snapshotMayApply(current,state(4,{run:'old-run'}),1,2),false);
 assert.equal(snapshotMayApply(current,state(3),2,2),true);
 assert.equal(snapshotMayApply(current,state(4),2,2),true);
});
test('latest reads cannot regress a same-actor room cursor, but new epochs may start at zero',()=>{
 assert.equal(snapshotMayApply(state(3),state(2),2,2),false);
 for(const extra of [{run:'run-b'},{edition:'edition-b'},{actorRef:'human-b'}])assert.equal(snapshotMayApply(state(3),state(0,extra),2,2),true);
 assert.equal(snapshotMayApply(null,state(0),1,1),true);
 assert.equal(snapshotMayApply(state(3),state(-1),2,2),false);
});
test('a delayed operation result belongs only to the frozen current intent',()=>{
 assert.equal(sameRequest({id:'B'},'A'),false);
 assert.equal(sameRequest(null,'A'),false);
 assert.equal(sameRequest({id:'A'},'A'),true);
});
