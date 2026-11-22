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

function fillContextPressure(room,owner){
 const peers=[owner,{id:being,kind:'daimon',name:'界'.repeat(40)},...Array.from({length:14},(_,i)=>({id:'human:fixture-'+i+'h'.repeat(175),kind:'human',name:'界'.repeat(40)}))];
 for(let i=0;i<31;i++){const id='garden-'+String(i).padStart(40,'0');room.entities[id]={id,revision:Number.MAX_SAFE_INTEGER,x:19.123456789012345,z:-3.123456789012345,color:'#a77bea',deleted:false};}
 const ids=Array.from({length:8},(_,i)=>'node-'+String(i).padStart(40,'0'));
 ids.forEach((id,i)=>{room.nodes[id]={id,owner:'fixture-owner-'+i+'o'.repeat(180),revision:Number.MAX_SAFE_INTEGER,deleted:false,title:'界'.repeat(40),shape:'pedestal',position:{x:22.123456789012345,z:-1.123456789012345},play:{schema:'signal-garden/v1',targets:Array.from({length:4},(_,n)=>({x:18.123456789012345+n,z:-3.123456789012345,radius:1.123456789012345,color:'#a77bea'})),minContributors:8,requiredBridgeRaised:true},links:ids.filter(v=>v!==id).slice(0,4).map(id=>({id,revision:Number.MAX_SAFE_INTEGER}))};});
 peers.forEach((peer,i)=>room.focuses.set(peer.id,{actor:peer.id,kind:peer.kind,name:peer.name??'界'.repeat(40),target:Object.keys(room.entities)[i+1],revision:Number.MAX_SAFE_INTEGER,sequence:1,time:Date.now()}));
 peers.slice(0,8).forEach(peer=>room.projections.set(peer.id,{actor:peer.id,kind:peer.kind,position:{x:1.123456789012345,y:1.123456789012345,z:1.123456789012345},form:'beacon'}));
 room.presence=()=>peers.slice(0,8).map(peer=>({actor:peer.id,kind:peer.kind,name:peer.name??'界'.repeat(40),scope:'authenticated-network-presence'}));
}

test('HTTP source retry resumes frozen history-stripped or omitted view after lost ack and ledger reopen',async t=>{
 const {createHolodeck}=await import('../src/server.mjs');
 for(const mode of ['history-stripped','view-omitted'])await t.test(mode,async()=>{
  const dir=mkdtempSync(join(tmpdir(),'holodeck-context-retry-http-')),owner={id:'human:'+'s'.repeat(194),ref:'human:'+'s'.repeat(194),kind:'human',name:'界'.repeat(40),rights:['observe','edit']};
  const frozen={...initial,actorRef:owner.ref},seen=[];let uploads=0;const sourceDir=join(dir,'contexts');
  const transport={inspect:async()=>structuredClone(frozen),lookup:async()=>({state:'absent'}),
   submit:async()=>{throw Error('No human original may be submitted by context recovery');},
   prepareContext:async value=>{uploads++;seen.push(structuredClone(value));const data=Buffer.from(JSON.stringify(value.observation));
    const result={schema:'holodeck.prepared-conversation-context/v1',id:value.id,binding,entry_binding:frozen.entry,observation_id:value.observation.id,work_admitted:false,
     file:{file_id:crypto.randomUUID(),sha256:createHash('sha256').update(data).digest('hex'),name:'holodeck-situation.json',mime:'application/json',size:data.length}};
    if(uploads===1)throw Error('fixture-lost-source-ack');return result;
   }};
  const runtime=await createHolodeck({stateDir:dir,identityResolver:async req=>req.headers.cookie?.includes('fixture=yes')?owner:null,
   nativeFactory:async({room})=>{
    room.event(owner,'participant.joined',{});if(mode==='view-omitted')fillContextPressure(room,owner);
    return{contexts:await createConversationContexts({room,stateDir:sourceDir,transport})};
   }});
  const listener=runtime.app.listen(0,'127.0.0.1');await new Promise(resolve=>listener.once('listening',resolve));const base=`http://127.0.0.1:${listener.address().port}`;
  try{
   const root=await fetch(base+'/',{headers:{Cookie:'fixture=yes'}}),headers={Cookie:'fixture=yes; '+root.headers.get('set-cookie').split(';')[0],Origin:base,'Content-Type':'application/json'};
   const view={capturedAt:1234,...(mode==='history-stripped'?{historyReference:{schema:'holodeck.history-reference/v1',run:runtime.room.run,edition:runtime.room.edition,sequence:1,panelVisible:true,explicit:false}}:{padding:''})};
   if(mode==='view-omitted')view.padding='x'.repeat(4096-Buffer.byteLength(JSON.stringify(view)));
   const input={id:randomUUID(),binding,view};
   const failed=await fetch(base+'/api/conversation-contexts',{method:'POST',headers,body:JSON.stringify(input)});assert.equal(failed.status,409);
   const original=JSON.parse(readFileSync(join(sourceDir,'conversation-contexts.json'),'utf8')).records[input.id];assert.equal(original.phase,'frozen');
   if(mode==='history-stripped'){assert.equal(original.observation.selectedActivity.event.sequence,1);assert.equal(Object.hasOwn(original.observation.clientReportedView.value,'historyReference'),false);}
   else assert.equal(original.observation.clientReportedView.value,null);
   runtime.room.event(owner,'fixture-newer-world',{});
   runtime.native.contexts=await createConversationContexts({room:runtime.room,stateDir:sourceDir,transport});
   const path=base+'/api/conversation-contexts/'+input.id+'/retry';
   const wrong=await fetch(path,{method:'POST',headers,body:JSON.stringify({binding:'f'.repeat(64)})});assert.equal(wrong.status,409);assert.equal(uploads,1);
   const response=await fetch(path,{method:'POST',headers,body:JSON.stringify({binding})});assert.equal(response.status,200);const recovered=await response.json();assert.equal(recovered.id,input.id);assert.equal(recovered.work_admitted,false);
   const after=JSON.parse(readFileSync(join(sourceDir,'conversation-contexts.json'),'utf8')).records[input.id];assert.equal(after.phase,'prepared');assert.equal(after.requestHash,original.requestHash);assert.deepEqual(after.frozen,original.frozen);assert.deepEqual(after.observation,original.observation);assert.deepEqual(seen[1],seen[0]);assert.equal(uploads,2);
   const again=await fetch(path,{method:'POST',headers,body:JSON.stringify({binding})});assert.equal(again.status,200);assert.deepEqual(await again.json(),recovered);assert.equal(uploads,2);
  }finally{runtime.close();listener.closeAllConnections();await new Promise(resolve=>listener.close(resolve));rmSync(dir,{recursive:true,force:true});}
 });
});
