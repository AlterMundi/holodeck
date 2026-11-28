import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room, LIMITS } from '../src/room.mjs';

const human = { id: 'human-a', kind: 'human', rights: ['observe','edit','project'] };
const other = { ...human, id: 'human-b' };
const daimon = { ...human, id: 'daimon-a', kind: 'daimon' };
function command(room, actor, args = {}) {
  const observation = room.observe(actor);
  return { id: crypto.randomUUID(), issuedAt: room.clock(), run: room.run,
    edition: room.edition, observation: observation.id, type: 'bridge.set',
    target: 'bridge', expectedRevision: observation.entities.bridge.revision,
    args: { raised: true }, ...args };
}
test('two actors see one mutation; unrelated projection does not invalidate it', () => {
  const room = new Room(); const proposal = command(room, human);
  room.project(other, { position: { x: 4,y: 1,z: 0 }, form: 'orb' });
  assert.equal(room.command(human, proposal).status, 'completed');
  assert.deepEqual(room.observe(human).entities, room.observe(other).entities);
  assert.equal(room.observe(other).events.at(-1).actor, human.id);
});
test('conflicting change rejects; uncertain retry returns exact original outcome', () => {
  const room = new Room(); const a = command(room,human); const b = command(room,other);
  const result = room.command(human,a);
  assert.equal(room.command(other,b).status, 'rejected');
  assert.deepEqual(room.command(human,a), result);
  assert.equal(room.entities.bridge.revision,1);
  assert.throws(() => room.command(human,{ ...a, args: { raised:false } }), /different contents/);
});
test('a quest reads the original room outcome without repeating its command', () => {
  let checkpoint;
  const room = new Room({ persist: state => { checkpoint = state; } });
  const raised = { place: 'island-workshop', event: { type: 'bridge_state', raised: true } };
  const proposal = command(room, human);
  assert.equal(room.objectiveReceipt(human, proposal.id, raised), null);
  const result = room.command(human, proposal);
  const proof = room.objectiveReceipt(human, proposal.id, raised);
  assert.equal(proof.sequence, result.event);
  assert.equal(proof.command, proposal.id);
  assert.equal(proof.actor, human.id);
  assert.equal(room.objectiveReceipt(other, proposal.id, raised), null);
  assert.equal(room.objectiveReceipt(human, proposal.id, {
    ...raised, event: { type: 'bridge_state', raised: false },
  }), null);
  const restored = new Room({ state: checkpoint });
  assert.deepEqual(restored.objectiveReceipt(human, proposal.id, raised), proof);
  assert.equal(restored.entities.bridge.revision, 1);
  const rejected = command(restored, human, { expectedRevision: 0 });
  assert.equal(restored.command(human, rejected).status, 'rejected');
  assert.equal(restored.objectiveReceipt(human, rejected.id, raised), null);
  restored.reset();
  assert.equal(restored.objectiveReceipt(human, proposal.id, raised), null);
});

test('rights and speaker-owned observations cannot be supplied in the command', () => {
  const room = new Room(); const a = command(room,human);
  assert.equal(room.command(other,a).status,'rejected');
  assert.throws(() => room.command({ ...human, rights:[] },a), /Editing access/);
  assert.throws(() => room.command(human,{ ...a, actor:human }), /Invalid command/);
  assert.throws(() => room.command(human,{ ...a, nativeRequest:'forged-source-reference' }), /receiving world port/);
});
test('run reset invalidates new actions from historical situation', () => {
  const room = new Room(); const a = command(room,human); room.reset();
  assert.equal(room.command(human,a).status,'rejected');
  assert.equal(room.entities.bridge.revision,0);
});
test('native actor has direct observation, projection and typed world actions', () => {
  const room = new Room();
  room.project(daimon,{ position: { x:1,y:2,z:3 },form:'beacon' });
  const a = command(room,daimon,{ nativeRequest:'test-only-native-request' });
  assert.equal(room.command(daimon,a).status,'completed');
  assert.equal(room.observe(human).participants[0].kind,'daimon');
  assert.equal(room.events.at(-1).detail.nativeRequest,'test-only-native-request');
});
test('bounded event history exposes gaps; expired command cannot be replayed', () => {
  let now = 1000; const room = new Room({ clock:() => now });
  const a = command(room,human);
  for(let i=0;i<LIMITS.events+5;i++) room.event(human,'test.public-event',{ i });
  assert.equal(room.events.length,LIMITS.events);
  assert.equal(room.observe(human).source.gap,true);
  now += LIMITS.retryMs + 1;
  assert.throws(() => room.command(human,a), /expired/);
});
test('a genuine new garden element is shared, not a fixed mechanism toggle', () => {
  const room = new Room();
  const a = command(room,human,{ type:'garden.place', target:'garden-first', expectedRevision:null, args:{ x:2,z:1,color:'mint' } });
  assert.equal(room.command(human,a).status,'completed');
  assert.equal(room.observe(other).entities['garden-first'].color,'mint');
});

test('a companion edits the same light at full capacity without replacing its identity or replaying work',()=>{
 const room=new Room();
 for(let index=0;index<LIMITS.elements-1;index++){
  const placement=command(room,human,{type:'garden.place',target:`garden-edit-${index}`,expectedRevision:null,args:{x:0,z:0,color:'mint'}});
  assert.equal(room.command(human,placement).status,'completed');
 }
 const edit=command(room,daimon,{type:'garden.update',target:'garden-edit-0',expectedRevision:1,
  nativeRequest:'controlled-edit-fixture',args:{x:2,z:-1,color:'rose'}});
 const stale=command(room,other,{type:'garden.update',target:edit.target,expectedRevision:1,args:edit.args});
 const result=room.command(daimon,edit);assert.equal(result.status,'completed');
 assert.deepEqual(room.command(daimon,edit),result);
 assert.equal(Object.keys(room.entities).length,LIMITS.elements);
 assert.deepEqual(room.observe(other).entities['garden-edit-0'],{id:'garden-edit-0',revision:2,x:2,z:-1,color:'rose'});
 assert.equal(room.events.at(-1).detail.nativeRequest,'controlled-edit-fixture');
 assert.equal(room.command(other,stale).status,'rejected');
 const invalid=command(room,human,{type:'garden.update',target:'garden-edit-0',expectedRevision:2,args:{x:100,z:0,color:'mint'}});
 assert.equal(room.command(human,invalid).status,'rejected');assert.equal(room.entities['garden-edit-0'].revision,2);
 const remove=command(room,human,{type:'garden.remove',target:'garden-edit-0',expectedRevision:2,args:{}});
 assert.equal(room.command(human,remove).status,'completed');
 const deleted=command(room,daimon,{type:'garden.update',target:edit.target,expectedRevision:3,nativeRequest:'controlled-edit-fixture',args:edit.args});
 assert.equal(room.command(daimon,deleted).status,'rejected');assert.equal(room.entities['garden-edit-0'].deleted,true);
});
