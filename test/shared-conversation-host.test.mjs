import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {SharedConversationHost} from '../src/shared-conversation-host.mjs';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({mode,avatarMicrophone}={}){
 const sent=[],calls=[],frames=[],statuses=[],speech=[];let actor='human:fixture',position=1,unblock,now=0;const dom={};
 const binding='b'.repeat(64),file={file_id:randomUUID(),sha256:'c'.repeat(64),name:'holodeck-situation.json',mime:'application/json',size:2000};
 const window={location:{origin:'https://world.test'},crypto:{randomUUID},performance:{now:()=>now},addEventListener(){},removeEventListener(){}};
 const document={hidden:false,addEventListener:(name,handler)=>dom[name]=handler,removeEventListener:name=>delete dom[name],createElement:()=>({contentWindow:{postMessage:(d,o)=>sent.push({d,o})},remove(){this.removed=true;}})};
 const host=new SharedConversationHost({window,document,avatarMicrophone,container:{append:f=>frames.push(f)},currentActor:()=>actor,
  api:async(path,body)=>{calls.push({path,body});if(path==='conversation-surface')return {schema:'holodeck.conversation-surface/v1',actorRef:actor,binding,url:'https://conversation.test/interaction/',machineSource:mode};
   if(path==='conversation-contexts')return body.mode
     ?{id:body.id,binding,files:[],machine_source:file.file_id,work_admitted:false}
     :{id:body.id,binding,files:[file],work_admitted:false};return {released:false};},
  capture:async()=>{const view={local:{position:{x:position}}};await new Promise(resolve=>unblock=resolve);return view;},onStatus:value=>statuses.push(value),onSpeechLevel:value=>speech.push(value)});
 const envelope=(type,rest={})=>({schema:'conversation.surface/v1',visit:host.visit,channel:randomUUID(),actor:'human:fixture',binding,type,...rest});
 const receive=d=>host.receive({source:host.frame.contentWindow,origin:host.origin,data:d});
 return {host,sent,calls,frames,statuses,speech,envelope,receive,advance:ms=>now+=ms,visible:value=>{document.hidden=!value;dom.visibilitychange?.();},move:x=>position=x,unblock:()=>unblock(),rebind:()=>actor='human:other'};
}
test('actual frame origin actor visit binding and channel bound the handshake and all context work',async()=>{
 const f=fixture();await f.host.mount();assert.equal(f.frames.length,1);await f.host.mount();assert.equal(f.frames.length,1);
 assert.equal(new URL(f.host.frame.src).searchParams.get('surface'),'holodeck');assert.equal(f.host.frame.allow,'microphone https://conversation.test; autoplay https://conversation.test');
 const ready=f.envelope('ready');
 for(const change of [{origin:'https://foreign.test'},{source:{}},{data:{...ready,actor:'human:other'}},{data:{...ready,binding:'a'.repeat(64)}},{data:{...ready,visit:randomUUID()}}])f.host.receive({origin:f.host.origin,source:f.host.frame.contentWindow,data:ready,...change});
 assert.equal(f.sent.length,0);f.receive(ready);assert.equal(f.sent[0].d.type,'connect');assert.equal(f.sent[0].o,'https://conversation.test');
 const d={...ready,type:'prepare',request:randomUUID(),id:randomUUID(),modality:'text',capacity:{files:8,bytes:40*1024*1024,context_bytes:65536}};
 f.receive({...d,channel:randomUUID()});assert.equal(f.host.records.size,0);
 f.receive(d);f.move(5);f.unblock();await tick();
 const captured=f.calls.find(x=>x.path==='conversation-contexts');assert.equal(captured.body.view.local.position.x,1,'walking during content preparation does not relabel the original');
 assert.equal('text' in captured.body,false);assert.equal(f.sent.at(-1).d.type,'prepared');assert.equal('files' in f.sent.at(-1).d,false);
 f.receive({...ready,type:'status',id:d.id,phase:'working',busy:true,text:'private body ignored'});assert.deepEqual(f.statuses,[{phase:'working',busy:true}]);
 f.rebind();f.receive({...d,id:randomUUID()});assert.equal(f.host.records.size,1);f.host.dispose();assert.equal(f.frames[0].removed,true);
});
test('discard during a delayed view prevents source upload without touching human originals',async()=>{
 const f=fixture();await f.host.mount();const ready=f.envelope('ready');f.receive(ready);
 const d={...ready,type:'prepare',request:randomUUID(),id:randomUUID(),modality:'audio',capacity:{files:8,bytes:40*1024*1024,context_bytes:65536}};
 f.receive(d);f.receive({...ready,type:'discard',id:d.id,reason:'capture-cancelled'});f.unblock();await tick();
 assert.equal(f.calls.filter(x=>x.path==='conversation-contexts').length,0);assert.equal(f.sent.filter(x=>x.d.type==='prepared').length,0);
 assert.equal(f.calls.some(x=>/interactions/.test(x.path)),false);
});

test('prepared receipt preserves every attachment slot and stays on the negotiated channel',async()=>{
 const mode='owner-journal/v1',f=fixture({mode});
 await f.host.mount();
 const original=f.envelope('ready',{features:{machineSource:true}});
 f.receive(original);
 assert.equal(f.sent.at(-1).d.features.machineSource,mode);
 f.receive({...original,type:'avatar-playback',level:.75});
 f.receive({...original,features:{}});
 assert.deepEqual(f.speech,[0,.75,0]);
 assert.equal(f.sent.at(-1).d.features.machineSource,mode,'a same-channel handshake silences speech without changing context mode');
 const d={...original,type:'prepare',id:randomUUID(),request:randomUUID(),mode,modality:'audio',
  capacity:{files:0,bytes:0,context_bytes:65536}};
 f.receive(d);f.receive(d);f.unblock();await tick();
 const reservations=f.calls.filter(x=>x.path==='conversation-contexts');
 assert.equal(reservations.length,1);
 assert.equal(reservations[0].body.mode,mode);
 const prepared=f.sent.filter(x=>x.d.type==='prepared');
 assert.equal(prepared.length,2);
 assert.equal(prepared[0].d.machine_source,prepared[1].d.machine_source);
 assert.equal(prepared[0].d.file,undefined);

 const older=f.envelope('ready');
 f.receive(older);
 assert.equal(f.sent.at(-1).d.features.machineSource,undefined);
 f.receive({...d,channel:older.channel,id:randomUUID()});
 assert.equal(f.sent.at(-1).d.type,'error','a new channel cannot force its old negotiated mode');
 assert.equal(f.calls.filter(x=>x.path==='conversation-contexts').length,1);
 f.host.dispose();
});

test('optional microphone levels expire and remain on the negotiated current frame',async()=>{
 const f=fixture({avatarMicrophone:true});
 await f.host.mount();
 const legacy=f.envelope('ready');
 f.receive(legacy);
 assert.equal(f.sent.at(-1).d.features.avatarMicrophone,undefined);
 f.receive({...legacy,type:'avatar-microphone',level:.75});
 assert.equal(f.host.microphoneLevel(),null);
 const ready=f.envelope('ready',{features:{avatarMicrophone:true}});
 f.receive(ready);
 assert.equal(f.sent.at(-1).d.features.avatarMicrophone,true);
 const level=f.envelope('avatar-microphone',{channel:ready.channel,level:.75});
 f.receive({...level,channel:legacy.channel});
 f.receive({...level,level:.7});
 f.receive({...level,source:'remote'});
 f.host.receive({source:{},origin:f.host.origin,data:level});
 assert.equal(f.host.microphoneLevel(),0);
 f.receive(level);
 assert.equal(f.host.microphoneLevel(),.75);
 f.advance(300);
 assert.equal(f.host.microphoneLevel(),0);
 f.receive(level);
 f.visible(false);
 f.receive(level);
 assert.equal(f.host.microphoneLevel(),null);
 f.visible(true);
 assert.equal(f.host.microphoneLevel(),0);
 f.receive(level);
 f.receive({...level,level:0});
 assert.equal(f.host.microphoneLevel(),0);
 f.receive(level);
 f.rebind();
 assert.equal(f.host.microphoneLevel(),null);
 f.host.dispose();
 assert.equal(f.host.microphoneLevel(),null);
 assert.equal(f.calls.length,1,'No level reaches the server');
});
