import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { Room } from '../src/room.mjs';
import { createNativeConversation } from '../src/native-conversation.mjs';

const actor={id:'human:test:one',ref:'human:test:one',kind:'human',rights:['observe','edit','project']};
const frozen={actorRef:actor.ref,beingRef:'dm:being:v1:test-fixture',homeRef:'home:test-fixture',
  pairingRevision:'fixture-revision',binding:'a'.repeat(64),entry:[1,{chat_id:1,thread_id:1},1,'fixture-native']};
function fixture(){let calls=[],lost=false,current=frozen,completed=false;const originals=new Map();return {
  calls,get lost(){return lost;},set lost(v){lost=v;},set current(v){current=v;},
  set completed(value){completed=value;},
  async inspect(ref){assert.equal(ref,actor.ref);return structuredClone(current);},
  async lookup({id,textSha256}){const original=originals.get(id);if(!original)return {state:'absent',frozen:structuredClone(current)};
    const hash=createHash('sha256').update(original.input.text).digest('hex');
    if(textSha256&&textSha256!==hash)throw Error('ID mismatch fixture');
    return {state:'retained',frozen:structuredClone(current),observation:structuredClone(original.observation),textSha256:hash,native:await this.status()};},
  async submit(value){calls.push(value);originals.set(value.input.id,structuredClone(value));if(lost)throw Error('Lost acknowledgment fixture');return {phase:completed?'completed':'queued',tracking:!completed,retainedOriginal:true,nativeAcceptance:'observed'};},
  async status(){return {phase:completed?'completed':'working',tracking:!completed,retainedOriginal:true,nativeAcceptance:'observed',updates:[{kind:'progress',text:'actual fixture source'}]};}
};}
async function setup(t){const dir=await fs.mkdtemp(join(tmpdir(),'holodeck-native-test-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const room=new Room(),transport=fixture();return {dir,room,transport,native:await createNativeConversation({room,stateDir:dir,transport})};}

test('exact original and utterance-time situation survive later world changes',async t=>{
  const {native,transport,room}=await setup(t);
  const id=crypto.randomUUID(),text='  Mirá esta isla.\n¿La conectamos?  ';
  const result=await native.submit(actor,{id,text,displayedSequence:null,view:{local:{position:{x:1,y:2,z:3}}}});
  room.event(actor,'test-public-change',{later:true});
  assert.equal(result.phase,'queued');assert.equal(transport.calls[0].input.text,text);
  assert.equal(transport.calls[0].observation.source.through,0);
  assert.equal(transport.calls[0].observation.clientReportedView.evidence,'client-reported-at-interaction-capture');
  await native.submit(actor,{id,text});assert.equal(transport.calls.length,1);
  await assert.rejects(native.submit(actor,{id,text:text.trim()}),/different contents/);
});
test('lost native write acknowledgment and process reload use status without replay',async t=>{
  const {dir,room,native,transport}=await setup(t);transport.lost=true;
  const id=crypto.randomUUID();assert.equal((await native.submit(actor,{id,text:'test fixture original'})).phase,'unknown');
  const reopened=await createNativeConversation({room,stateDir:dir,transport});
  assert.equal((await reopened.availability(actor)).active.id,id);
  assert.equal((await reopened.status(actor,id)).phase,'working');assert.equal(transport.calls.length,1);
});
test('native world access requires same run, actual admission and current pairing',async t=>{
  const {native,transport,room}=await setup(t),id=crypto.randomUUID();
  await native.submit(actor,{id,text:'test fixture original'});
  const authority=await native.authorizeWorldRequest(id);
  assert.equal(authority.actor.kind,'daimon');assert.equal(authority.actor.id,frozen.beingRef);
  assert.equal(authority.nativeRequest,id);assert.equal(authority.actor.rights,undefined);
  transport.current={...frozen,binding:'b'.repeat(64)};
  await assert.rejects(native.authorizeWorldRequest(id),/changed/);
  transport.current=frozen;room.reset();await assert.rejects(native.authorizeWorldRequest(id),/room run/);
});
test('another participant cannot inspect an interaction or select native identity',async t=>{
  const {native}=await setup(t),id=crypto.randomUUID();await native.submit(actor,{id,text:'test fixture original'});
  await assert.rejects(native.status({...actor,ref:'human:test:two'},id),/belongs/);
  await assert.rejects(native.submit(actor,{id:crypto.randomUUID(),text:'fixture',beingRef:frozen.beingRef}),/bounded original/);
});
test('the 33rd completed turn retires metadata and old IDs recover without new work',async t=>{
  const {native,transport,dir}=await setup(t);transport.completed=true;
  const first={id:crypto.randomUUID(),text:'  original retained fixture  '};
  const initial=await native.submit(actor,first);
  for(let index=0;index<32;index++)await native.submit(actor,{id:crypto.randomUUID(),text:'fixture '+index});
  const journal=JSON.parse(await fs.readFile(join(dir,'native-turns.json'),'utf8'));
  assert.equal(Object.keys(journal.records).length,32);assert.equal(Object.keys(journal.tombstones).length,1);
  assert.equal((await native.submit(actor,first)).observation,initial.observation);
  assert.equal(transport.calls.length,33);
  // Canonical dedup still protects an ID beyond bounded local tombstones.
  delete journal.tombstones[first.id];await fs.writeFile(join(dir,'native-turns.json'),JSON.stringify(journal));
  const reopened=await createNativeConversation({room:new Room(),stateDir:dir,transport});
  assert.equal((await reopened.submit(actor,first)).observation,initial.observation);
  assert.equal(transport.calls.length,33);
});
test('unknown intents are never evicted and capacity is a known pre-admission rejection',async t=>{
  const {native,transport}=await setup(t);transport.lost=true;
  for(let index=0;index<32;index++)await native.submit(actor,{id:crypto.randomUUID(),text:'uncertain fixture '+index});
  await assert.rejects(native.submit(actor,{id:crypto.randomUUID(),text:'new fixture'}),error=>
    error.code==='capacity'&&error.retained===false&&error.knownNotSubmitted===true);
  assert.equal(transport.calls.length,32);
});
test('terminal retention also frees byte capacity before the record-count ceiling',async t=>{
  const {native,transport,dir}=await setup(t);transport.completed=true;
  for(let index=0;index<33;index++)await native.submit(actor,{id:crypto.randomUUID(),text:'\\'.repeat(32768)});
  const journal=JSON.parse(await fs.readFile(join(dir,'native-turns.json'),'utf8'));
  assert.ok(Object.keys(journal.records).length<32);assert.ok(Object.keys(journal.tombstones).length>0);
  assert.equal(transport.calls.length,33);
});
test('missing initial receipt is read-only until explicit same-original submission',async t=>{
  const {native,transport}=await setup(t),id=crypto.randomUUID();
  await assert.rejects(native.status(actor,id),error=>error.code==='not-retained'&&error.knownNotSubmitted===true&&error.retained===false);
  assert.equal(transport.calls.length,0);
  await native.submit(actor,{id,text:'  exact original fixture  ',view:{capturedAt:100,local:{position:{x:1,y:2,z:3}}}});
  assert.equal(transport.calls.length,1);assert.equal(transport.calls[0].input.text,'  exact original fixture  ');
  assert.equal(transport.calls[0].observation.inputAssociation.clientReportedCaptureTime,100);
});
test('crash during preparation exposes explicit retry with the original captured situation',async t=>{
  const {dir,room,transport}=await setup(t),id=crypto.randomUUID(),observation=room.observe(actor);
  await fs.writeFile(join(dir,'native-turns.json'),JSON.stringify({schema:'holodeck.native-intents/v1',records:{[id]:{
    id,actorRef:actor.ref,text:'  retained original fixture  ',observation,phase:'preparing',frozen:null,writeStarted:false}},tombstones:{}}),{mode:0o600});
  const reopened=await createNativeConversation({room,stateDir:dir,transport});
  const status=await reopened.status(actor,id);assert.equal(status.phase,'problem');assert.equal(status.retryable,true);assert.equal(status.knownNotSubmitted,true);
  room.event(actor,'later-world-change',{fixture:true});await reopened.retry(actor,id);
  assert.equal(transport.calls[0].observation.id,observation.id);assert.equal(transport.calls[0].input.text,'  retained original fixture  ');
});
test('post-replacement directory sync failure fences writes and preserves the new intent',async t=>{
  const {dir,room,transport}=await setup(t);let fail=true;
  const fileSystem={...fs,async open(path,...args){const handle=await fs.open(path,...args);
    if(path===dir)return {close:()=>handle.close(),async sync(){if(fail)throw Error('Directory sync fixture failure');return handle.sync();}};
    return handle;}};
  const native=await createNativeConversation({room,stateDir:dir,transport,fileSystem}),id=crypto.randomUUID();
  await assert.rejects(native.submit(actor,{id,text:'retained fixture'}),error=>error.code==='journal-recovery'&&error.retained===true&&error.knownNotSubmitted===false);
  const bytes=await fs.readFile(join(dir,'native-turns.json'),'utf8');assert.ok(JSON.parse(bytes).records[id]);assert.equal(transport.calls.length,0);
  await assert.rejects(native.submit(actor,{id:crypto.randomUUID(),text:'later fixture'}),/receiving recovery/);
  assert.equal(await fs.readFile(join(dir,'native-turns.json'),'utf8'),bytes);
  assert.equal((await native.status(actor,id)).knownNotSubmitted,false);
  fail=false;const reopened=await createNativeConversation({room,stateDir:dir,transport});
  assert.equal((await reopened.status(actor,id)).retryable,true);
});
