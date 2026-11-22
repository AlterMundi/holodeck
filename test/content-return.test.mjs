import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ContentVisitor} from '../src/content-visitor.mjs';

test('return to world is immediate even when viewer readiness never resolves; frame and unfinished work survive',()=>{
 const classes=new Set();let blurred=0,focused=0,requests=0;
 const frame={state:{recording:true,processing:true,dirty:true,playing:true},remove(){throw Error('Returning must not destroy the frame');}};
 const visitor=Object.assign(Object.create(ContentVisitor.prototype),{
  frame,ready:new Promise(()=>{}),pending:new Map([['existing',{state:'unconfirmed'}]]),
  panel:{classList:{add:name=>classes.add(name)},setAttribute(name,value){this[name]=value;},inert:false},
  document:{activeElement:{blur(){blurred++;}}},window:{focus(){focused++;}},say:()=>{},
  request(){requests++;return new Promise(()=>{});}
 });
 visitor.walk();
 assert.equal(classes.has('is-walking'),true);assert.equal(visitor.panel.inert,true);
 assert.equal(visitor.frame,frame);assert.equal(visitor.pending.size,1);assert.equal(requests,0);
 assert.deepEqual(frame.state,{recording:true,processing:true,dirty:true,playing:true});
 assert.equal(blurred,1);assert.equal(focused,1);
});
