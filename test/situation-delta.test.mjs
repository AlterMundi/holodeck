import test from 'node:test';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {applySituationDelta, planSituationDelta, situationLane} from '../src/situation-delta.mjs';

const observation = {
  observer: 'human:one', run: 'demo', edition: 'one', scope: 'structured-interior-room',
  place: {id: 'matter', objects: [{id: 'table', revision: 1}]},
  referredWorktable: {project: 'guitar', part: 'neck', revision: 4},
  clientReportedView: {value: {local: {position: {x: 1.1, y: .1, z: -1.1}}}},
};
const authority = {generation: 'writer-a', binding: 'conversation', actorRef: 'human:one', beingRef: 'being:one'};
const lane = situationLane({...authority, observation});
const plan = (order, value, base) => planSituationDelta({...authority, order}, value, base).packet;
const original = plan(1, observation);
const installed = applySituationDelta(lane, original).baseline;

test('unchanged references the acknowledged projection and excludes capture and transport noise', () => {
  assert.equal(original.kind, 'full');
  const next = structuredClone(observation);
  Object.assign(next, {id: 'another', capturedAt: 42, inputAssociation: {humanInputId: 'another'}});
  Object.assign(next.clientReportedView.value, {capturedAt: 42, transport: {id: 9}});
  Object.assign(next.clientReportedView.value.local, {connectionId: 17});
  next.clientReportedView.value.local.position.x = .99;
  const packet = plan(3, next, installed);
  assert.equal(packet.kind, 'unchanged');
  assert.ok(!Object.hasOwn(packet, 'state') && !Object.hasOwn(packet, 'changes'));
  assert.deepEqual(applySituationDelta(lane, JSON.parse(JSON.stringify(packet)), {baseline: installed}).baseline, {...installed, order: 3});
});

test('changes are cumulative from the last installed state and clear old selection', () => {
  const next = structuredClone(observation);
  const pending = plan(2, {...next, place: {...next.place, exhibitRevision: 2}}, installed);
  assert.deepEqual(Object.keys(pending.changes), ['place']);
  delete next.referredWorktable;
  next.place.objects[0].revision++;
  next.clientReportedView.value.local.position.z = -2;
  const packet = plan(3, next, installed);
  assert.equal(packet.base, original.revision);
  assert.deepEqual(Object.keys(packet.changes), ['selection', 'pose', 'work']);
  const resolved = applySituationDelta(lane, packet, {baseline: installed});
  assert.equal(resolved.baseline.state.selection.worktable, null);
  assert.deepEqual(resolved.baseline, applySituationDelta(lane, plan(3, next)).baseline);
  const advanced = applySituationDelta(lane, pending, {baseline: installed}).baseline;
  assert.deepEqual(applySituationDelta(lane, packet, {baseline: advanced}), {kind: 'needs-full'});
  assert.deepEqual(applySituationDelta(lane, original, {baseline: advanced}), {kind: 'stale'});
  assert.equal(applySituationDelta(lane, plan(3, next), {baseline: advanced}).kind, 'ready');
  assert.throws(() => applySituationDelta(lane, {...packet, revision: original.revision}, {baseline: installed}), /mismatch/);
});

test('the same Character selection is unchanged and an exact frame change is carried in the delta', () => {
  const selected={...observation,referredCharacterPose:{rig:'humanoid',clip:'estudio-vuelo',edition:'test-edition',frame:36}};
  const ready=applySituationDelta(lane,plan(1,selected)).baseline;
  assert.equal(plan(2,selected,ready).kind,'unchanged');
  const next={...selected,referredCharacterPose:{...selected.referredCharacterPose,frame:37}};
  const packet=plan(2,next,ready);
  assert.deepEqual(Object.keys(packet.changes),['selection']);
  assert.equal(applySituationDelta(lane,packet,{baseline:ready}).baseline.state.selection.characterPose.frame,37);
});

test('baseline loss, stale references and lane changes recover a full state', () => {
  const next = {...observation, place: {...observation.place, exhibitRevision: 2}};
  const packet = plan(3, next, installed);
  for (const base of [null, {...installed, revision: '0'.repeat(64)}])
    assert.deepEqual(applySituationDelta(lane, packet, {baseline: base}), {kind: 'needs-full'});
  assert.notEqual(situationLane({...authority, observation: {...next, place: {id: 'foyer'}}}), lane);
  const replacement = situationLane({...authority, generation: 'writer-b', observation: next});
  assert.notEqual(replacement, lane);
  const recovery = planSituationDelta({...authority, generation: 'writer-b', order: 1}, next, installed).packet;
  assert.equal(recovery.kind, 'full');
  assert.equal(applySituationDelta(replacement, recovery).kind, 'ready');
  assert.throws(() => applySituationDelta(replacement, packet, {baseline: installed}), /envelope/);
  assert.throws(() => situationLane({...authority, actorRef: 'human:two', observation}), /current situation lane/);
});

test('world event churn and query cursors do not hide real work state changes', () => {
  const exterior = {...observation, scope: 'structured-room-overview',
    focus: [{actor: 'being:one', target: 'node-fixture', revision: 2, sequence: 2, time: 12}],
    nodes: {'node-fixture': {revision: 2, progress: {through: 2, complete: false}}},
  };
  const exteriorLane = situationLane({...authority, observation: exterior});
  const base = applySituationDelta(exteriorLane, plan(1, exterior)).baseline;
  const next = structuredClone(exterior);
  next.focus[0].time++;
  next.focus[0].sequence++;
  next.nodes['node-fixture'].progress.through++;
  assert.equal(plan(2, next, base).kind, 'unchanged');
  next.nodes['node-fixture'].progress.complete = true;
  assert.equal(plan(2, next, base).kind, 'delta');
});

test('canonical work events survive capture windows without copying private event payloads', () => {
  const exterior = {...observation, scope: 'structured-room-overview',
    events: [{type: 'node.update', time: 42, sequence: 9,
      detail: {target: 'node-fixture', node: {revision: 3}, nativeRequest: 'private'}}]};
  const exteriorLane = situationLane({...authority, observation: exterior});
  const empty = applySituationDelta(exteriorLane, plan(1, {...exterior, events: []})).baseline;
  const delta = plan(2, exterior, empty);
  assert.deepEqual(delta.changes.recentWork, [
    {type: 'node.update', sequence: 9, target: 'node-fixture', revision: 3},
  ]);
  const current = applySituationDelta(exteriorLane, delta, {baseline: empty}).baseline;
  const next = {...exterior, events: [{type: 'participant.left', sequence: 31}]};
  assert.equal(plan(3, next, current).kind, 'unchanged');
});

test('baseline recovery reuses frozen content and respects a surviving order floor', () => {
  const next = structuredClone(observation);
  next.clientReportedView.value.local.position.x = .99;
  next.referredWorkstation = {id: 'station'};
  const {packet, full} = planSituationDelta({...authority, order: 4}, next, installed);
  assert.equal(packet.revision, full.revision);
  assert.deepEqual(applySituationDelta(lane, packet), {kind: 'needs-full'});
  assert.deepEqual(applySituationDelta(lane, original, {floor: 1}), {kind: 'stale'});
  const recovered = applySituationDelta(lane, full, {floor: 1}).baseline;
  assert.deepEqual(recovered, applySituationDelta(lane, packet, {baseline: installed}).baseline);
  assert.equal(recovered.state.pose.cell[0], 2);
  assert.equal(recovered.state.selection.workstation.id, 'station');
  assert.equal(recovered.state.work.contents, null);
});

test('an earlier voice capture can carry only its own full state after a newer text installs', () => {
  const voice = {...observation, referredWorktable: {project: 'first'}};
  const text = {...observation, referredWorktable: {project: 'later'},
    clientReportedView: {value: {local: {position: {x: 90, y: 0, z: 0}}}}};
  const later = applySituationDelta(lane, plan(6, text)).baseline;
  const packet = plan(5, voice, later);
  assert.equal(packet.kind, 'full');
  assert.deepEqual(applySituationDelta(lane, packet, {baseline: later}), {kind: 'stale'});
  const historical = applySituationDelta(lane, packet, {baseline: later, allowHistoricalFull: true});
  const before = structuredClone(later);
  const recording = planSituationDelta({...authority, order: 5}, voice, installed);
  assert.equal(recording.packet.kind, 'delta');
  assert.deepEqual(applySituationDelta(lane, recording.packet, {baseline: later, allowHistoricalFull: true}),
    {kind: 'needs-full'});
  assert.deepEqual(applySituationDelta(lane, recording.full, {baseline: later, allowHistoricalFull: true}), historical);
  assert.equal(historical.kind, 'historical');
  assert.ok(!Object.hasOwn(historical, 'baseline'));
  assert.deepEqual(historical.state, plan(5, voice).state);
  assert.deepEqual(later, before);
  assert.equal(later.state.selection.worktable.project, 'later');
  const damaged = {...packet, state: {...packet.state, selection: null}};
  assert.throws(() => applySituationDelta(lane, damaged, {baseline: later, allowHistoricalFull: true}), /full situation/);
});

test('only an exact installed packet is a recovered acknowledgment', () => {
  const packet = plan(2, observation, installed);
  const result = applySituationDelta(lane, packet, {baseline: installed});
  const options = {baseline: result.baseline, installedPacket: result.packetDigest};
  assert.deepEqual(applySituationDelta(lane, JSON.parse(JSON.stringify(packet)), options), {kind: 'installed'});
  assert.throws(() => applySituationDelta(lane, {...packet, baseOrder: 0}, options), /Invalid situation base/);
  const different = plan(2, {...observation, place: {...observation.place, exhibitRevision: 8}});
  assert.throws(() => applySituationDelta(lane, different, options), /different packet/);
  const alternate = plan(2, observation);
  assert.throws(() => applySituationDelta(lane, alternate, options), /different packet/);
  assert.deepEqual(applySituationDelta(lane, packet, {floor: 2}), {kind: 'stale'});
  assert.throws(() => applySituationDelta(lane, {...original, kind: 'invalid'}, options), /packet kind/);
  const future = plan(4, observation, installed);
  assert.deepEqual(applySituationDelta(lane, future, {baseline: installed, floor: 3}), {kind: 'needs-full'});
});

test('authored node instructions are semantic even when a node has progress', () => {
  const exterior = {...observation, scope: 'structured-room-overview',
    nodes: {'node-fixture': {revision: 2, instruction: 'Place the green light',
      status: 'Pending', progress: {through: 2, complete: false}}}};
  const exteriorLane = situationLane({...authority, observation: exterior});
  const baseline = applySituationDelta(exteriorLane, plan(1, exterior)).baseline;
  const next = structuredClone(exterior);
  next.nodes['node-fixture'].progress.through++;
  assert.equal(plan(2, next, baseline).kind, 'unchanged');
  next.nodes['node-fixture'].instruction = 'Place the violet light';
  assert.equal(plan(2, next, baseline).kind, 'delta');
});

test('contradictory fields fail before a receipt can acknowledge them', () => {
  const unchanged = plan(2, observation, installed);
  assert.throws(() => applySituationDelta(lane, {...unchanged, changes: {selection: null}}, {baseline: installed}),
    /Invalid situation fields/);
  const late = {...original, unrelated: true};
  assert.throws(() => applySituationDelta(lane, late, {floor: 2, allowHistoricalFull: true}),
    /Invalid situation fields/);
});

test('correctly hashed but malformed state cannot establish a baseline', () => {
  const state = {place: {}, pose: null, recentWork: {}, selection: {}, work: {}};
  const revision = createHash('sha256').update(JSON.stringify(state)).digest('hex');
  const packet = {...original, state, revision};
  assert.throws(() => applySituationDelta(lane, packet), /Invalid full situation/);
  const delta = {...plan(2, observation, installed), kind: 'delta', changes: {recentWork: {}}};
  assert.throws(() => applySituationDelta(lane, delta, {baseline: installed}), /Invalid situation state/);
  const invalidBaseline = {lane, order: 1, state, revision};
  assert.equal(plan(2, observation, invalidBaseline).kind, 'full');
});
