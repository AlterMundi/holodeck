import {createHash} from 'node:crypto';

const SCHEMA = 'holodeck.situation-delta/v1';
const FIELDS = ['place', 'selection', 'pose', 'work', 'recentWork'];
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
  return {
    kind: 'client-reported-position',
    cellMeters,
    cell: ['x', 'y', 'z'].map((axis, index) => {
      const coordinate = position[axis] / cellMeters;
      const old = previous?.cell?.[index];
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
      const {instruction, status, ...definition} = node;
      return [id, {...definition, progress}];
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

function validState(state) {
  return state && !Array.isArray(state) && Object.keys(state).length === FIELDS.length &&
    FIELDS.every(key => Object.hasOwn(state, key));
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
  const hasBase = matchesBase(acknowledged, lane);
  if (hasBase && order <= acknowledged.order) throw new Error('The original preceded the installed situation');
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

// Pure receiver operation. The caller is responsible for atomically retaining
// the native original and its association before acknowledging installation.
// A semantic digest mismatch signals corruption. A missing or stale base
// requests a new full packet for the same still-unadmitted original.
export function applySituationDelta(lane, packet, {baseline = null, floor = 0} = {}) {
  if (typeof lane !== 'string' || !revision.test(lane) || packet?.schema !== SCHEMA ||
      packet.lane !== lane || !Number.isSafeInteger(packet.order) || packet.order < 1 ||
      typeof packet.revision !== 'string' || !revision.test(packet.revision))
    throw new Error('Invalid situation envelope');
  if (!Number.isSafeInteger(floor) || floor < 0) throw new Error('A valid order floor is required');
  const hasBase = matchesBase(baseline, lane);
  if (packet.order <= Math.max(floor, hasBase ? baseline.order : 0)) return {kind: 'stale'};
  let state;
  switch (packet.kind) {
    case 'full':
      if (!validState(packet.state)) throw new Error('Invalid full situation');
      state = packet.state;
      break;
    case 'unchanged':
    case 'delta':
      if (!hasBase || baseline.revision !== packet.base || baseline.order !== packet.baseOrder)
        return {kind: 'needs-full'};
      state = baseline.state;
      if (packet.kind === 'delta') {
        const keys = Object.keys(packet.changes ?? {});
        if (!keys.length || keys.some(key => !FIELDS.includes(key))) throw new Error('Invalid situation changes');
        state = {...state, ...packet.changes};
      }
      break;
    default:
      throw new Error('Invalid situation packet kind');
  }
  if (identify(state) !== packet.revision) throw new Error('Situation revision mismatch');
  return {kind: 'ready', baseline: {lane, order: packet.order, revision: packet.revision, state: structuredClone(state)}};
}
