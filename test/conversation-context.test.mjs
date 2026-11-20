import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {Room} from '../src/room.mjs';
import {createConversationContexts} from '../src/conversation-context.mjs';

const actor={id:'human:fixture',ref:'human:fixture',kind:'human',rights:['observe','edit']};
const being='dm:being:v1:'+'a'.repeat(43);
const binding='b'.repeat(64);
const initial={actorRef:actor.ref,beingRef:being,homeRef:'home:'+'c'.repeat(32),binding,entry:[1,{chat_id:1,thread_id:2},3,'fixture-native']};
async function fixture(t){
 const dir=mkdtempSync(join(tmpdir(),'holodeck-conversation-context-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const room=new Room(),prepared=new Map(),statuses=new Map();let current=structuredClone(initial),uploads=0,writes=0;
 const transport={inspect:async()=>structuredClone(current),lookup:async()=>({state:'absent',frozen:structuredClone(current)}),
  submit:async()=>{writes++;throw Error('Context preparation must not submit an original');},
  prepareContext:async request=>{
   const saved=JSON.parse(readFileSync(join(dir,'conversation-contexts.json'),'utf8'));assert.equal(saved.records[request.id].phase,'frozen','source is durable before upload');
   assert.equal('text' in request,false);assert.equal('files' in request,false);
   uploads++;const data=Buffer.from(JSON.stringify(request.observation));
   const value={schema:'holodeck.prepared-conversation-context/v1',id:request.id,binding,entry_binding:initial.entry,
    observation_id:request.observation.id,file:{file_id:randomUUID(),sha256:createHash('sha256').update(data).digest('hex'),name:'holodeck-situation.json',mime:'application/json',size:data.length},work_admitted:false};
   prepared.set(request.id,structuredClone(value));return value;
  },
  status:async request=>{
   assert.deepEqual(request.contextFile,prepared.get(request.id).file,'world authority pins exact prepared file');
   assert.equal(request.textSha256,null,'no duplicate human text is retained by the world');
   return statuses.get(request.id)||{nativeAcceptance:'unconfirmed',phase:'unknown',retainedOriginal:false,tracking:true};
  }};
 return {dir,room,transport,prepared,statuses,get uploads(){return uploads;},get writes(){return writes;},setCurrent:value=>{current=value;},open:()=>createConversationContexts({room,stateDir:dir,transport})};
}
const request=()=>({id:randomUUID(),binding,view:{capturedAt:1234,local:{position:{x:1,y:.1,z:2}}}});

test('shared original gets one durable machine source and restart/retry never recaptures or sends',async t=>{
 const f=await fixture(t),context=await f.open(),input=request(),result=await context.prepare(actor,input);
 assert.equal(result.id,input.id);assert.equal(result.binding,binding);assert.equal(result.files.length,1);assert.equal(result.work_admitted,false);
 const persisted=JSON.parse(readFileSync(join(f.dir,'conversation-contexts.json'),'utf8'));const original=structuredClone(persisted.records[input.id].observation);
 assert.equal(original.inputAssociation.serverCapture,'at-machine-context-preparation');
 assert.equal(original.inputAssociation.clientReportedCaptureTime,1234);assert.equal('text' in persisted.records[input.id],false);
 assert.equal(statSync(join(f.dir,'conversation-contexts.json')).mode&0o777,0o600);
 f.room.event(actor,'fixture.changed',{});
 const resumed=await f.open();assert.deepEqual(await resumed.prepare(actor,input),result);
 assert.deepEqual(JSON.parse(readFileSync(join(f.dir,'conversation-contexts.json'),'utf8')).records[input.id].observation,original);
 assert.equal(f.uploads,1);assert.equal(f.writes,0);
});
test('context alone cannot authorize native actions; real matching canonical admission is required',async t=>{
 const f=await fixture(t),context=await f.open(),input=request();await context.prepare(actor,input);
 await assert.rejects(context.authorizeWorldRequest(input.id,being),/admission/);
 f.statuses.set(input.id,{nativeAcceptance:'observed',phase:'working',retainedOriginal:true,tracking:true});
 assert.equal((await context.authorizeWorldRequest(input.id,being)).nativeRequest,input.id);
 await assert.rejects(context.authorizeWorldRequest(input.id,'dm:being:v1:'+'d'.repeat(43)),/lane/);
 f.setCurrent({...initial,binding:'f'.repeat(64)});await assert.rejects(context.authorizeWorldRequest(input.id,being),/changed/);
 assert.equal(f.writes,0);
});
test('a rebind during canonical status cannot authorize the old world source',async t=>{
 const f=await fixture(t),context=await f.open(),input=request();await context.prepare(actor,input);
 f.transport.status=async()=>{f.setCurrent({...initial,binding:'e'.repeat(64)});return {nativeAcceptance:'observed',phase:'working',retainedOriginal:true,tracking:true};};
 await assert.rejects(context.authorizeWorldRequest(input.id,being),/changed/);
});
test('different actor, binding, source, unknown original and human payloads fail before new source retention',async t=>{
 const f=await fixture(t),context=await f.open(),input=request();await context.prepare(actor,input);
 await assert.rejects(context.prepare({...actor,id:'human:other',ref:'human:other'},input),/originally/);
 await assert.rejects(context.prepare(actor,{...input,view:{capturedAt:999}}),/originally/);
 for(const extra of [{text:'Private human message must stay in Conversation'},{files:[]},{audio:'private'}])await assert.rejects(context.prepare(actor,{...request(),...extra}));
 await assert.rejects(context.prepare(actor,{...request(),binding:'e'.repeat(64)}),/changed/);
 f.transport.lookup=async()=>({state:'retained'});await assert.rejects(context.prepare(actor,request()),/existing canonical/);
 assert.equal(f.uploads,1);assert.equal(f.writes,0);
});
test('lost source acknowledgement retries the same frozen situation after room changes',async t=>{
 const f=await fixture(t),context=await f.open(),input=request();const upload=f.transport.prepareContext;let first=true;
 f.transport.prepareContext=async value=>{const result=await upload(value);if(first){first=false;throw Error('Lost source response');}return result;};
 await assert.rejects(context.prepare(actor,input),/Lost source/);
 const original=JSON.parse(readFileSync(join(f.dir,'conversation-contexts.json'),'utf8')).records[input.id].observation;
 f.room.event(actor,'fixture.changed',{});await(await f.open()).prepare(actor,input);
 assert.deepEqual(JSON.parse(readFileSync(join(f.dir,'conversation-contexts.json'),'utf8')).records[input.id].observation,original);
 assert.equal(f.writes,0);
});
test('only confirmed canonical terminal sources release capacity; originals are never cancelled',async t=>{
 const f=await fixture(t),context=await f.open(),input=request();await context.prepare(actor,input);
 assert.deepEqual(await context.release(actor,input.id),{released:false});assert.equal(context.has(input.id),true);
 await assert.rejects(context.release({...actor,id:'human:other',ref:'human:other'},input.id));
 f.statuses.set(input.id,{phase:'completed',tracking:false,retainedOriginal:true,nativeAcceptance:'observed'});
 assert.deepEqual(await context.release(actor,input.id),{released:true,canonicalOriginalPreserved:true});assert.equal(context.has(input.id),false);assert.equal(f.writes,0);
});
test('unconfirmed preparation is bounded at32 records, without evicting or fabricating an original',async t=>{
 const f=await fixture(t),context=await f.open();
 for(let i=0;i<32;i++)await context.prepare(actor,request());
 await assert.rejects(context.prepare(actor,request()),/retained results/);
 assert.equal(Object.keys(JSON.parse(readFileSync(join(f.dir,'conversation-contexts.json'),'utf8')).records).length,32);
 assert.equal(f.uploads,32);assert.equal(f.writes,0);
});

test('cancelled capture releases only machine source after canonical absence, never retained originals',async t=>{
 const f=await fixture(t),context=await f.open(),input=request();await context.prepare(actor,input);
 f.transport.lookup=async()=>({state:'retained'});
 assert.equal((await context.discard(actor,input.id,binding,'capture-cancelled')).released,false);
 assert.equal((await context.inspect(actor,input.id)).prepared,true);
 f.transport.lookup=async()=>({state:'unknown'});
 assert.equal((await context.discard(actor,input.id,binding,'capture-cancelled')).released,false);
 await assert.rejects(context.discard(actor,input.id,'e'.repeat(64),'capture-cancelled'),/binding/);
 f.transport.lookup=async()=>({state:'absent'});
 const result=await context.discard(actor,input.id,binding,'capture-cancelled');assert.equal(result.released,true);
 assert.equal(result.canonicalFilesPreserved,true);assert.equal(result.canonicalOriginalAltered,false);
 await assert.rejects(context.inspect(actor,input.id),/source/i);assert.equal(f.writes,0);
});
