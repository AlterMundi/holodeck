import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ContentVisitor} from '../src/content-visitor.mjs';

const pin={tableId:'old-table',reportId:'old-report',revision:'old-edition'};
const nextPin={tableId:'next-table',reportId:'next-report',revision:'next-edition'};
const context={state:{dirty:false,recording:false,processing:false,playing:false},chapterId:'old-chapter'};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
function visitor(ready,request){return Object.assign(Object.create(ContentVisitor.prototype),
 {frame:{},entry:{pin,node:'research-original'},visitId:'old-visit',ready,request,
  panel:{classList:{contains:()=>false}},disposed:false,lastContext:null});}
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

test('general Field context retains compact exact visit references without copying a graph, draft or fabricated native-ingress acknowledgment',async()=>{
 const pin={kind:'context',tableId:'field',contextId:'knowledge',revision:'v1'};
 const value=visitor(Promise.resolve(),async()=>({pin,context_status:'acknowledged-client-view',visit_id:'personal-visit',view_revision:2,focus:'node-1',selection:{kind:'relation',object_id:'relation-1'},state:context.state,graph:{private:'not for world capture'},draft:'private note'}));
 value.entry={pin,node:'node-field'};
 const result=await ContentVisitor.prototype.context.call(value);assert.equal(result.context.view_revision,2);assert.equal(result.context.focus,'node-1');assert.deepEqual(result.context.selection,{kind:'relation',object_id:'relation-1'});assert.equal('graph'in result.context,false);assert.equal('draft'in result.context,false);assert.match(result.evidence,/not canonical native-ingress/);
 value.request=async()=>({...result.context,pin:{...pin,revision:'v2'}});const wrong=await ContentVisitor.prototype.context.call(value);assert.equal(wrong.contextUnavailable,true);assert.equal('context'in wrong,false);
});
