import { randomUUID, createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';

export const LIMITS = Object.freeze({ events: 256, commands: 256, observations: 128,
  sessions: 8, elements: 32, retryMs: 300000 });
const clone = value => structuredClone(value);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export class RoomError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

// Semantic activity authority. Presence ticks never advance entity revisions.
// Actors and rights come from a receiving adapter, never from command arguments.
export class Room extends EventEmitter {
  constructor({ clock = Date.now, edition = 'island-workshop@draft-1' } = {}) {
    super();
    this.clock = clock;
    this.edition = edition;
    this.run = randomUUID();
    this.sequence = 0;
    this.events = [];
    this.outcomes = new Map();
    this.observations = new Map();
    this.entities = { bridge: { id: 'bridge', revision: 0, raised: false } };
    this.projections = new Map();
  }

  event(actor, type, detail) {
    const event = { sequence: ++this.sequence, time: this.clock(), actor: actor.id, type, detail: clone(detail) };
    this.events.push(event);
    if (this.events.length > LIMITS.events) this.events.shift();
    this.emit('change', clone(event));
    return event;
  }

  observe(actor, { after = 0, displayedSequence = null } = {}) {
    if (!actor?.rights?.includes('observe')) throw new RoomError('forbidden', 'Room access required');
    if (!Number.isSafeInteger(after) || after < 0 || after > this.sequence)
      throw new RoomError('cursor', 'Invalid semantic cursor');
    if (displayedSequence !== null && (!Number.isSafeInteger(displayedSequence) || displayedSequence < 0 || displayedSequence > this.sequence))
      throw new RoomError('cursor', 'Invalid displayed cursor');
    const now = this.clock();
    for (const [id, item] of this.observations) if (now - item.capturedAt > LIMITS.retryMs) this.observations.delete(id);
    if (this.observations.size >= LIMITS.observations) throw new RoomError('capacity', 'Observation capacity reached');
    const observation = { schema: 'holodeck.situation/v1', id: randomUUID(),
      run: this.run, edition: this.edition, capturedAt: now,
      observer: actor.id, scope: 'structured-room-overview',
      source: { after, through: this.sequence, displayedSequence,
        gap: after < (this.events[0]?.sequence ?? 1) - 1 },
      activity: { title: 'Connect the workshop islands', intention: null },
      entities: clone(this.entities), participants: clone([...this.projections.values()]),
      events: clone(this.events.filter(event => event.sequence > after)),
      uncertainty: ['Displayed state does not establish attention or understanding.'] };
    this.observations.set(observation.id, observation);
    return clone(observation);
  }

  // First-class daimon projection; no emulated human input or assumed eyesight.
  // These explicit primitives are public expression, not evidence of model thought.
  project(actor, { position, form }) {
    if (!actor?.rights?.includes('project')) throw new RoomError('forbidden', 'Projection access required');
    if (!position || !['x','y','z'].every(key => Number.isFinite(position[key]) && Math.abs(position[key]) <= 30)
      || !['orb', 'beacon'].includes(form)) throw new RoomError('projection', 'Choose a supported bounded projection');
    if (!this.projections.has(actor.id) && this.projections.size >= LIMITS.sessions)
      throw new RoomError('capacity', 'Room projection capacity reached');
    const projection = { actor: actor.id, kind: actor.kind, position: clone(position), form };
    this.projections.set(actor.id, projection);
    return this.event(actor, 'projection.changed', projection);
  }

  command(actor, command) {
    if (!actor?.rights?.includes('edit')) throw new RoomError('forbidden', 'Editing access required');
    if (!command || Object.keys(command).some(key => !['id','issuedAt','run','edition','observation','nativeRequest','type','target','expectedRevision','args'].includes(key))
      || typeof command.id !== 'string' || !/^[\w-]{8,80}$/.test(command.id)
      || !Number.isSafeInteger(command.issuedAt) || command.issuedAt > this.clock() + 1000)
      throw new RoomError('command', 'Invalid command envelope');
    const key = actor.id + ':' + command.id;
    const fingerprint = hash(command);
    const old = this.outcomes.get(key);
    if (old) {
      if (old.fingerprint !== fingerprint) throw new RoomError('id-reuse', 'Command ID already has different contents');
      return clone(old.result);
    }
    if (this.clock() - command.issuedAt > LIMITS.retryMs)
      throw new RoomError('expired', 'Command expired; inspect state before making a new decision');
    for (const [id, outcome] of this.outcomes) if (this.clock() - outcome.at > LIMITS.retryMs) this.outcomes.delete(id);
    if (this.outcomes.size >= LIMITS.commands) throw new RoomError('capacity', 'Command history capacity reached');
    const finish = (status, reason, event = null) => {
      const result = { command: command.id, status, reason, event: event?.sequence ?? null, run: this.run };
      this.outcomes.set(key, { fingerprint, result, at: this.clock() });
      return clone(result);
    };
    if (command.run !== this.run || command.edition !== this.edition)
      return finish('rejected', 'The room or edition changed');
    const observation = this.observations.get(command.observation);
    if (!observation || observation.run !== this.run || observation.observer !== actor.id
      || this.clock() - observation.capturedAt > LIMITS.retryMs)
      return finish('rejected', 'Capture a current situation before acting');
    if (actor.kind === 'daimon' && (typeof command.nativeRequest !== 'string' || command.nativeRequest.length > 128))
      return finish('rejected', 'Retain the originating native request');
    const entity = this.entities[command.target];
    if (command.type === 'bridge.set') {
      if (command.target !== 'bridge' || !command.args || Object.keys(command.args).length !== 1 || typeof command.args.raised !== 'boolean')
        return finish('rejected', 'Choose the bridge state');
      if (command.expectedRevision !== entity.revision) return finish('rejected', 'The bridge changed while you were deciding');
      entity.raised = command.args.raised;
      entity.revision++;
    } else if (command.type === 'garden.place') {
      if (Object.keys(this.entities).length >= LIMITS.elements) return finish('rejected', 'This garden is full');
      if (typeof command.target !== 'string' || !/^garden-[a-z0-9-]{1,40}$/.test(command.target) || entity || command.expectedRevision !== null)
        return finish('rejected', 'Choose a new garden element');
      const a = command.args;
      if (!a || Object.keys(a).sort().join(',') !== 'color,x,z' || !Number.isFinite(a.x) || !Number.isFinite(a.z)
        || Math.abs(a.x) > 7 || a.z < -6 || a.z > 6 || !['mint','amber','rose'].includes(a.color))
        return finish('rejected', 'Choose a valid garden placement');
      this.entities[command.target] = { id: command.target, revision: 1, ...clone(a) };
    } else return finish('rejected', 'Unsupported activity operation');
    const event = this.event(actor, command.type, { target: command.target, entity: this.entities[command.target], nativeRequest: command.nativeRequest ?? null });
    return finish('completed', 'World updated', event);
  }

  result(actor, id) {
    if (!actor?.rights?.includes('observe')) throw new RoomError('forbidden', 'Room access required');
    return clone(this.outcomes.get(actor.id + ':' + id)?.result ?? null);
  }

  reset() {
    this.run = randomUUID(); this.sequence = 0; this.events = []; this.observations.clear();
    this.entities = { bridge: { id: 'bridge', revision: 0, raised: false } };
    this.projections.clear(); // Retain outcomes: old IDs must not mutate a new run.
    this.emit('change', { type:'run.reset', run:this.run });
  }
}
