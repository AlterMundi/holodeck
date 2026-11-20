import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {createHolodeck} from '../src/server.mjs';
import {createConversationContexts} from '../src/conversation-context.mjs';

test('shared context HTTP uses current Home actor/origin and exposes only owned source references',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'holodeck-context-http-'));let uploads=0;
 const binding='b'.repeat(64),being='dm:being:v1:'+'a'.repeat(43),home='home:'+'c'.repeat(32);
 const frozen=actorRef=>({actorRef,beingRef:being,homeRef:home,binding,entry:[1,{},2,'fixture-native']});
 const runtime=await createHolodeck({production:true,basePath:'/holodeck/',publicOrigin:'https://world.test',stateDir:dir,conversationOrigins:['https://conversation.test'],
  identityResolver:async req=>{const who=req.headers.cookie?.match(/(?:^|; )home=([ab])(?:;|$)/)?.[1];
   return who?{id:'human:'+who,ref:'human:'+who,kind:'human',rights:['observe','edit']}:null;},
  nativeFactory:async({room,stateDir})=>{
   const transport={inspect:async actor=>frozen(actor),lookup:async()=>({state:'absent'}),
    prepareContext:async req=>{uploads++;return {schema:'holodeck.prepared-conversation-context/v1',id:req.id,binding,entry_binding:req.frozen.entry,
     observation_id:req.observation.id,file:{file_id:randomUUID(),sha256:'d'.repeat(64),name:'holodeck-situation.json',mime:'application/json',size:2000},work_admitted:false};},
    status:async()=>({phase:'working',retainedOriginal:true,tracking:true,nativeAcceptance:'observed'})};
   return {contexts:await createConversationContexts({room,stateDir:join(stateDir,'context'),transport}),
    conversationSurface:async actor=>({schema:'holodeck.conversation-surface/v1',actorRef:actor.ref,beingRef:being,homeRef:home,binding,url:'https://conversation.test/interaction/'}),
    availability:async()=>({available:true})};
  }});
 const listener=runtime.app.listen(0,'127.0.0.1');await new Promise(resolve=>listener.once('listening',resolve));
 const base=`http://127.0.0.1:${listener.address().port}/holodeck/`;
 const enter=async who=>{const r=await fetch(base,{headers:{Cookie:'home='+who}});return 'home='+who+'; '+r.headers.get('set-cookie').split(';')[0];};
 try{
  assert.equal((await fetch(base+'api/conversation-surface')).status,401);
  const cookie=await enter('a'),headers={Cookie:cookie,Origin:'https://world.test','Content-Type':'application/json'};
  const surface=await(await fetch(base+'api/conversation-surface',{headers})).json();assert.equal(surface.url,'https://conversation.test/interaction/');assert.equal(surface.actorRef,'human:a');assert.equal('entry' in surface,false);
  const input={id:randomUUID(),binding,view:{capturedAt:1234}};
  assert.equal((await fetch(base+'api/conversation-contexts',{method:'POST',headers:{...headers,Origin:'https://foreign.test'},body:JSON.stringify(input)})).status,403);assert.equal(uploads,0);
  const bad=await fetch(base+'api/conversation-contexts',{method:'POST',headers,body:JSON.stringify({...input,binding:'e'.repeat(64)})});assert.equal(bad.status,409);const denied=await bad.json();assert.equal(denied.scope,'machine-context');assert.equal('knownNotSubmitted' in denied,false);
  const response=await fetch(base+'api/conversation-contexts',{method:'POST',headers,body:JSON.stringify(input)});assert.equal(response.status,200);const prepared=await response.json();assert.equal(prepared.work_admitted,false);assert.equal(prepared.files.length,1);
  const recovered=await(await fetch(base+'api/conversation-contexts/'+input.id+'?binding='+binding,{headers})).json();assert.deepEqual(recovered.files,prepared.files);
  assert.doesNotMatch(JSON.stringify(recovered),/argv_prefix|native_world_interface|entry_binding|"text"|"observation"/);
  const other=await enter('b');const foreign=await fetch(base+'api/conversation-contexts/'+input.id+'?binding='+binding,{headers:{Cookie:other}});assert.equal(foreign.status,404);assert.equal('files' in await foreign.json(),false);
  const release=await(await fetch(base+'api/conversation-contexts/'+input.id+'/release',{method:'POST',headers,body:'{}'})).json();assert.equal(release.released,false,'unfinished canonical work retains its source');assert.equal(uploads,1);
 }finally{runtime.close();listener.closeAllConnections();await new Promise(resolve=>listener.close(resolve));rmSync(dir,{recursive:true,force:true});}
});
