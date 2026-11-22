import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ContentVisitor} from '../src/content-visitor.mjs';

const pin={tableId:'old-table',reportId:'old-report',revision:'old-edition'};
const nextPin={tableId:'next-table',reportId:'next-report',revision:'next-edition'};
const context={state:{dirty:false,recording:false,processing:false,playing:false},chapterId:'old-chapter'};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
function visitor(ready,request){return {frame:{},entry:{pin,node:'research-original'},visitId:'old-visit',ready,request,
 panel:{classList:{contains:()=>false}},disposed:false,lastContext:null};}
function replace(value){value.frame={};value.entry={pin:nextPin,node:'research-replacement'};value.visitId='next-visit';}

test('a question waiting for viewer readiness never captures its replacement content',async()=>{
 const ready=deferred();let queries=0;
 const value=visitor(ready.promise,async()=>{queries++;return context;});
 const captured=ContentVisitor.prototype.context.call(value);replace(value);ready.resolve();
 const result=await captured;
 assert.deepEqual(result.pin,pin,'unavailable context must retain the originally indicated content');
 assert.equal(result.node,'research-original');
 assert.equal(result.contextUnavailable,true);assert.equal(queries,0,'do not query the new viewer for the old question');
 assert.equal(value.lastContext,null);
});
test('an old viewer answer cannot be relabeled with a new pin after its visit changes',async()=>{
 const reply=deferred(),requested=deferred();
 const value=visitor(Promise.resolve(),()=>{requested.resolve();return reply.promise;});
 const captured=ContentVisitor.prototype.context.call(value);await requested.promise;replace(value);reply.resolve(context);
 const result=await captured;
 assert.deepEqual(result.pin,pin);assert.equal(result.contextUnavailable,true);assert.equal('context' in result,false);
 assert.equal(result.node,'research-original');
 assert.equal(value.lastContext,null);
});

test('acknowledged content retains the selected spatial research entrance',async()=>{
 const value=visitor(Promise.resolve(),async()=>context);
 const captured=await ContentVisitor.prototype.context.call(value);
 assert.equal(captured.node,'research-original');
 assert.deepEqual(captured.pin,pin);
 assert.equal(captured.context.chapterId,'old-chapter');
});
