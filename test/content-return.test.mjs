import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ContentVisitor} from '../src/content-visitor.mjs';

test('return to world is immediate even when viewer readiness never resolves; frame and unfinished work survive',()=>{
 const classes=new Set();let blurred=0,focused=0,requests=0,feedback;
 const frame={state:{recording:true,processing:true,dirty:true,playing:true},remove(){throw Error('Returning must not destroy the frame');}};
 const visitor=Object.assign(Object.create(ContentVisitor.prototype),{
  frame,ready:new Promise(()=>{}),pending:new Map([['existing',{state:'unconfirmed'}]]),
  panel:{classList:{add:name=>classes.add(name)},setAttribute(name,value){this[name]=value;},inert:false},
  document:{activeElement:{blur(){blurred++;}}},window:{focus(){focused++;}},say:(text,options)=>{feedback={text,options};},
  request(){requests++;return new Promise(()=>{});}
 });
 visitor.walk();
 assert.equal(classes.has('is-walking'),true);assert.equal(visitor.panel.inert,true);
 assert.equal(visitor.frame,frame);assert.equal(visitor.pending.size,1);assert.equal(requests,0);
 assert.deepEqual(frame.state,{recording:true,processing:true,dirty:true,playing:true});
 assert.equal(blurred,1);assert.equal(focused,1);
 assert.match(feedback.text,/contenido sigue abierto/);assert.deepEqual(feedback.options,{transient:true});
});

test('an unready retained visit cannot stall a new situated Conversation original',async()=>{
 const visitor=Object.assign(Object.create(ContentVisitor.prototype),{frame:{},entry:{node:'node-result',nodeRevision:3,pin:{tableId:'table',reportId:'report',revision:'r1'}},visitId:'retained',ready:new Promise(()=>{}),readyAcknowledged:false,panel:{classList:{contains:()=>true}},request:()=>{throw Error('Do not request an unready viewer');}});
 const result=await visitor.context();assert.equal(result.contextUnavailable,true);assert.equal(result.node,'node-result');assert.equal(result.nodeRevision,3);
 assert.equal(result.pin.revision,'r1');
});

test('the world can draw while a retained visit loads offscreen, completes or fails',()=>{
 const visitor=Object.assign(Object.create(ContentVisitor.prototype),{
  opening:true,frame:{inert:true},panel:{classList:new Set()},
 });
 visitor.panel.classList.contains=visitor.panel.classList.has;
 assert.equal(visitor.isOpeningOverWorld(),true);
 visitor.panel.classList.add('is-walking');
 assert.equal(visitor.isOpeningOverWorld(),false);
 visitor.panel.classList.clear();
 visitor.frame.inert=false;
 assert.equal(visitor.isOpeningOverWorld(),false);
 visitor.frame.inert=true;
 visitor.opening=false;
 assert.equal(visitor.isOpeningOverWorld(),false);
});
