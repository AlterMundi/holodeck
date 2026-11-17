import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Room } from '../src/room.mjs';
import { createNativeConversation } from '../src/native-conversation.mjs';

const actor={id:'human:test:one',ref:'human:test:one',kind:'human',rights:['observe','edit','project']};
const frozen={actorRef:actor.ref,beingRef:'dm:being:v1:test-fixture',homeRef:'home:test-fixture',
  pairingRevision:'fixture-revision',binding:'a'.repeat(64),entry:[1,{chat_id:1,thread_id:1},1,'fixture-native']};
function fixture(){let calls=[],lost=false,current=frozen;return {
  calls,get lost(){return lost;},set lost(v){lost=v;},set current(v){current=v;},
  async inspect(ref){assert.equal(ref,actor.ref);return structuredClone(current);},
  async submit(value){calls.push(value);if(lost)throw Error('Lost acknowledgment fixture');return {phase:'queued',nativeAcceptance:'observed'};},
  async status(){return {phase:'working',nativeAcceptance:'observed',updates:[{kind:'progress',text:'actual fixture source'}]};}
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
