import {createHash} from 'node:crypto';

const SCHEMA = 'holodeck.situation-delta/v1';
const FIELDS = ['place', 'selection', 'pose', 'work', 'recentWork'];
const HEADER = ['schema', 'lane', 'order', 'revision', 'kind'];
const PAYLOAD = new Map([
  ['full', ['state']], ['unchanged', ['base', 'baseOrder']], ['delta', ['base', 'baseOrder', 'changes']],
]);
const WORK_TYPES = new Set(['garden.place', 'garden.update', 'garden.remove',
  'node.place', 'node.update', 'node.remove', 'bridge.set']);
const revision = /^[a-f0-9]{64}$/;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}
const encode = value => JSON.stringify(stable(value));
const identify = value => createHash('sha256').update(encode(value)).digest('hex');

function select(value, keys) {
  return Object.fromEntries(keys.filter(key => Object.hasOwn(value ?? {}, key)).map(key => [key, value[key]]));
}

function scenePosition(view, previous) {
  const position = view?.local?.position;
  if (!position || !['x', 'y', 'z'].every(axis => Number.isFinite(position[axis]) && Math.abs(position[axis]) <= 1e9)) return null;
  // Preserve a coarse client-reported location, not a claim of observed attention.
  const cellMeters = 0.5;
  const priorCell = previous?.kind === 'client-reported-position' && previous.cellMeters === cellMeters
    ? previous.cell : null;
  return {
    kind: 'client-reported-position',
    cellMeters,
    cell: ['x', 'y', 'z'].map((axis, index) => {
      const coordinate = position[axis] / cellMeters;
      const old = priorCell?.[index];
      const margin = 0.15;
      return Number.isInteger(old) && coordinate >= old - margin && coordinate < old + 1 + margin
        ? old : Math.floor(coordinate);
    }),
  };
}

function recentWork(events, previous) {
  const results = new Map((previous ?? []).map(event => [event.sequence, event]));
  for (const event of events ?? []) {
    const target = event.detail?.target;
    if (!WORK_TYPES.has(event.type) || !Number.isSafeInteger(event.sequence) || event.sequence < 1 ||
        typeof target !== 'string' || !/^(?:bridge|(?:garden|node)-[a-z0-9-]{1,40})$/.test(target)) continue;
    const version = (event.detail.node ?? event.detail.entity)?.revision;
    results.set(event.sequence, {sequence: event.sequence, type: event.type, target,
      ...(Number.isSafeInteger(version) ? {revision: version} : {})});
  }
  return [...results.values()].sort((left, right) => left.sequence - right.sequence).slice(-8);
}

// The canonical observation is still retained per original. This projection
// deliberately excludes input, capture and connection identifiers.
function projectSituation(observation, previous) {
  const view = observation.clientReportedView?.value;
  const place = select(observation.place, ['id', 'title', 'level', 'house', 'exhibitRevision']);
  const selection = {
    object: observation.referredRoomObject ?? null,
    workstation: observation.referredWorkstation ?? null,
    visit: observation.referredRoomVisit ?? null,
    worktable: observation.referredWorktable ?? null,
    history: observation.selectedActivity ?? null,
  };
  const work = {
    activity: observation.place?.activity ?? observation.activity ?? null,
    objects: observation.place?.objects ?? null,
    contents: observation.place?.contents ?? null,
    focus: observation.focus?.map(signal =>
      select(signal, ['actor', 'kind', 'name', 'target', 'revision', 'currentRevision', 'status'])) ?? null,
    focusPartial: (observation.source?.omissions?.focus ?? 0) > 0,
    nodes: observation.nodes ? Object.fromEntries(Object.entries(observation.nodes).map(([id, node]) => {
      if (!node.progress) return [id, node];
      const {through, ...progress} = node.progress;
      return [id, {...node, progress}];
    })) : null,
    entities: observation.entities ?? null,
  };
  return stable({place, selection, pose: scenePosition(view, previous?.pose), work,
    recentWork: recentWork(observation.events, previous?.recentWork)});
}

// This lane is assigned by the receiving service after its current access
// check. Generation belongs to the baseline store, not to a browser session.
export function situationLane({generation, binding, actorRef, beingRef, observation}) {
  const room = observation.scope === 'structured-interior-room' ? observation.place?.id : 'world';
  const values = [generation, binding, actorRef, beingRef, observation.run, observation.edition, observation.scope, room];
  if (values.some(value => typeof value !== 'string' || !value.length) ||
      observation.observer !== actorRef) throw new Error('A current situation lane is required');
  return identify(values);
}

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function validState(state) {
  return record(state) && Object.keys(state).length === FIELDS.length &&
    FIELDS.every(key => Object.hasOwn(state, key)) &&
    record(state.place) && record(state.selection) && record(state.work) &&
    (state.pose === null || record(state.pose)) &&
    Array.isArray(state.recentWork) && state.recentWork.length <= 8 &&
    state.recentWork.every(event => record(event) && Number.isSafeInteger(event.sequence) && event.sequence > 0);
}

function matchesBase(base, lane) {
  return base?.lane === lane && Number.isSafeInteger(base.order) && base.order > 0 &&
    validState(base.state) && base.revision === identify(base.state);
}

// Only a baseline confirmed by the receiver is eligible. Freeze the resulting
// packet alongside the original association before transmitting it.
export function planSituationDelta(authority, observation, acknowledged = null) {
  const lane = situationLane({...authority, observation});
  const {order} = authority;
  if (!Number.isSafeInteger(order) || order < 1) throw new Error('A receiving order is required');
  // An earlier original (for example a long voice capture) must not borrow
  // pose or work history from a conversation state installed after it.
  const hasBase = matchesBase(acknowledged, lane) && acknowledged.order < order;
  const state = projectSituation(observation, hasBase ? acknowledged.state : null);
  const current = identify(state);
  const envelope = {schema: SCHEMA, lane, order, revision: current};
  const full = {...envelope, kind: 'full', state};
  if (!hasBase) return {packet: full, full};
  const base = acknowledged.revision, baseOrder = acknowledged.order;
  if (base === current) return {packet: {...envelope, kind: 'unchanged', base, baseOrder}, full};
  const changes = Object.fromEntries(FIELDS.filter(key =>
    encode(state[key]) !== encode(acknowledged.state[key])).map(key => [key, state[key]]));
  return {packet: {...envelope, kind: 'delta', base, baseOrder, changes}, full};
}

// Only the canonical writer can permit an earlier, still-unadmitted original
// to carry historical source. It must check the original ID and current
// authority separately. Historical results never propose installing a base.
export function applySituationDelta(lane, packet, {
  baseline = null, floor = 0, installedPacket = null, allowHistoricalFull = false,
} = {}) {
  if (typeof lane !== 'string' || !revision.test(lane) || packet?.schema !== SCHEMA ||
      packet.lane !== lane || !Number.isSafeInteger(packet.order) || packet.order < 1 ||
      typeof packet.revision !== 'string' || !revision.test(packet.revision))
    throw new Error('Invalid situation envelope');
  if (!Number.isSafeInteger(floor) || floor < 0) throw new Error('A valid order floor is required');

  const payload = PAYLOAD.get(packet.kind);
  if (!payload) throw new Error('Invalid situation packet kind');
  const fields = [...HEADER, ...payload];
  if (!record(packet) || Object.keys(packet).length !== fields.length ||
      !fields.every(key => Object.hasOwn(packet, key)))
    throw new Error('Invalid situation fields');

  const full = packet.kind === 'full';
  if (full) {
    if (!validState(packet.state) || identify(packet.state) !== packet.revision)
      throw new Error('Invalid full situation');
  } else {
    if (typeof packet.base !== 'string' || !revision.test(packet.base) ||
        !Number.isSafeInteger(packet.baseOrder) || packet.baseOrder < 1 || packet.baseOrder >= packet.order ||
        packet.kind === 'unchanged' && packet.revision !== packet.base)
      throw new Error('Invalid situation base');
    if (packet.kind === 'delta') {
      const keys = record(packet.changes) ? Object.keys(packet.changes) : [];
      if (!keys.length || keys.some(key => !FIELDS.includes(key))) throw new Error('Invalid situation changes');
    }
  }

  const hasBase = matchesBase(baseline, lane);
  const latest = Math.max(floor, hasBase ? baseline.order : 0);
  if (packet.order < latest) {
    if (!allowHistoricalFull) return {kind: 'stale'};
    return full ? {kind: 'historical', state: structuredClone(packet.state)} : {kind: 'needs-full'};
  }
  const packetDigest = identify(packet);
  if (packet.order === latest) {
    if (!hasBase || baseline.order !== latest) return {kind: 'stale'};
    if (packet.revision !== baseline.revision || installedPacket && packetDigest !== installedPacket)
      throw new Error('The situation order already contains a different packet');
    return installedPacket ? {kind: 'installed'} : {kind: 'stale'};
  }

  let state = packet.state;
  if (!full) {
    if (!hasBase || baseline.order < floor || baseline.revision !== packet.base || baseline.order !== packet.baseOrder)
      return {kind: 'needs-full'};
    state = packet.kind === 'delta' ? {...baseline.state, ...packet.changes} : baseline.state;
    if (!validState(state)) throw new Error('Invalid situation state');
    if (identify(state) !== packet.revision) throw new Error('Situation revision mismatch');
  }
  return {kind: 'ready', packetDigest, baseline: {
    lane, order: packet.order, revision: packet.revision, state: structuredClone(state),
  }};
}
