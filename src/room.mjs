import {Houses, houseAction} from './houses.mjs';
import {MAX_WORLD_ELEMENTS,DEFAULT_OBSERVATION_BYTES,MAX_OBSERVATION_BYTES,OBSERVATION_CACHE_BYTES} from './world-limits.mjs';
import {creationContains} from './world-layout.mjs';
import {validEntityEditors} from './playable-creations.mjs';
import {MAX_CONTENT_NODES,contentNodeId,validNodeData,validStoredNode,nodeState} from './content-nodes.mjs';
import { randomUUID, createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { WORKSHOP, workshopColour } from './workshop.mjs';
import { avatarForActor } from './avatar-registry.mjs';
import {fitSituation} from './situation-budget.mjs';
import {MAX_FOCUS,focusState,validFocusEntry} from './focus.mjs';
import {validateContentNodes} from './content-visits.mjs';

export const LIMITS = Object.freeze({ events: 256, commands: 256, observations: 128,
  sessions: 8, elements: MAX_WORLD_ELEMENTS, retryMs: 300000 });
const clone = value => structuredClone(value);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export class RoomError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

// Semantic activity authority. Presence ticks never advance entity revisions.
// Actors and rights come from a receiving adapter, never from command arguments.
export class Room extends EventEmitter {
  constructor({ clock = Date.now, edition = 'island-workshop@draft-1', persist = null, state = null, presence = ()=>[], contentNodes, houses = new Houses() } = {}) {
    super();
    this.clock = clock;
    this.edition = edition;
    this.run = randomUUID();
    this.sequence = 0;
    this.events = [];
    this.outcomes = new Map();
    this.observations = new Map();
    this.entities = { bridge: { id: 'bridge', revision: 0, raised: false } };
    this.projections = new Map();this.focuses=new Map();this.nodes={};this.entityEditors={};
    this.persist = persist;
    this.presence = presence;
    this.contentNodes = validateContentNodes(contentNodes);
    this.houses = houses;
    if(state)this.restore(state);
  }

  snapshot() {
    return clone({schema:'holodeck.room-save/v1',edition:this.edition,run:this.run,
      sequence:this.sequence,events:this.events,entities:this.entities,
      outcomes:[...this.outcomes],observations:[...this.observations],projections:[...this.projections],focuses:[...this.focuses],nodes:this.nodes,entityEditors:this.entityEditors});
  }

  restore(state,{trimObservations=true}={}) {
    if(state?.schema!=='holodeck.room-save/v1'||typeof state.run!=='string'||typeof state.edition!=='string'
      || !Number.isSafeInteger(state.sequence)||state.sequence<0
      || !Array.isArray(state.events)||state.events.length>LIMITS.events
      || !Array.isArray(state.outcomes)||state.outcomes.length>LIMITS.commands
      || !Array.isArray(state.observations)
      || !Array.isArray(state.projections)||state.projections.length>LIMITS.sessions
      || (state.focuses!==undefined&&(!Array.isArray(state.focuses)||state.focuses.length>MAX_FOCUS||state.focuses.some(entry=>!Array.isArray(entry)||entry.length!==2||!validFocusEntry(entry)||entry[1].sequence>state.sequence)))
      || (state.nodes!==undefined&&(!state.nodes||typeof state.nodes!=='object'||Array.isArray(state.nodes)||Object.keys(state.nodes).length>MAX_CONTENT_NODES||Object.entries(state.nodes).some(([id,node])=>!validStoredNode(node,id))))
      || (state.entityEditors!==undefined&&!validEntityEditors(state.entityEditors,state.entities))
      || !state.entities?.bridge || Object.keys(state.entities).length>LIMITS.elements)
      throw new RoomError('save','Room checkpoint is invalid; preserve it for recovery');
    const copy=clone(state);
    this.edition=copy.edition;this.run=copy.run;this.sequence=copy.sequence;
    this.events=copy.events;this.entities=copy.entities;
    this.outcomes=new Map(copy.outcomes);this.observations=new Map(copy.observations);this.projections=new Map(copy.projections);this.focuses=new Map(copy.focuses||[]);this.nodes=copy.nodes||{};this.entityEditors=copy.entityEditors||{};
    if(trimObservations)this.trimObservations();
  }

  // Read captures are disposable command evidence, never action outcomes. Keep
  // their independent byte/count/age bounds on both legacy load and new reads.
  trimObservations() {
    const now=this.clock();
    for(const [id,item] of this.observations){
      if(!item||!Number.isFinite(item.capturedAt)||now-item.capturedAt>LIMITS.retryMs
        ||Buffer.byteLength(JSON.stringify(item))>MAX_OBSERVATION_BYTES)this.observations.delete(id);
    }
    const oldest=[...this.observations].sort((a,b)=>a[1].capturedAt-b[1].capturedAt);
    while(this.observations.size>LIMITS.observations
      ||Buffer.byteLength(JSON.stringify([...this.observations]))>OBSERVATION_CACHE_BYTES){
      this.observations.delete(oldest.shift()[0]);
    }
  }

  atomic(operation) {
    if(this.commitUncertain)throw new RoomError('recovery-required','The last checkpoint needs reconciliation before continuing');
    if(this.pendingChanges)return operation();
    const before=this.snapshot();this.pendingChanges=[];
    let result,changes;
    try {
      result=operation();
      this.persist?.(this.snapshot());
      changes=this.pendingChanges;
    } catch(error) {
      if(error.commitUncertain)this.commitUncertain=true;
      else this.restore(before,{trimObservations:false});
      throw error;
    }
    finally {this.pendingChanges=null;}
    // Persistent state/outcomes precede every projected update and acknowledgment.
    for(const event of changes)this.emit('change',event);
    return result;
  }

  changed(event) {
    if(this.pendingChanges)this.pendingChanges.push(clone(event));
    else this.emit('change',clone(event));
  }

  event(actor, type, detail) {
    const event = { sequence: ++this.sequence, time: this.clock(), actor: actor.id, type, detail: clone(detail) };
    this.events.push(event);
    if (this.events.length > LIMITS.events) this.events.shift();
    this.changed(event);
    return event;
  }

  observe(actor, query = {}) { return this.atomic(()=>this.capture(actor,query)); }

  capture(actor, { after = 0, displayedSequence = null, maxBytes = DEFAULT_OBSERVATION_BYTES, preserveActors = [] } = {}) {
    if (!actor?.rights?.includes('observe')) throw new RoomError('forbidden', 'Room access required');
    if (!Number.isSafeInteger(after) || after < 0 || after > this.sequence)
      throw new RoomError('cursor', 'Invalid semantic cursor');
    if (displayedSequence !== null && (!Number.isSafeInteger(displayedSequence) || displayedSequence < 0 || displayedSequence > this.sequence))
      throw new RoomError('cursor', 'Invalid displayed cursor');
    const now = this.clock();
    const observation = { schema: 'holodeck.situation/v1', id: randomUUID(),
      run: this.run, edition: this.edition, capturedAt: now,
      observer: actor.id, scope: 'structured-room-overview',
      place:{...clone(WORKSHOP),contents:clone(this.contentNodes),housing:this.houses.overview(actor.id)},
      source: { after, through: this.sequence, displayedSequence,
        gap: after < (this.events[0]?.sequence ?? 1) - 1 },
      activity: { title: 'Connect the workshop islands', intention: null, evidence:'authored-scenario; participants intentions are not inferred' },
      focus:this.focusState(),nodes:this.nodeState(actor),
      entities: clone(this.entities), participants: clone([...this.presence(),...this.projections.values()]),
      events: clone(this.events.filter(event => event.sequence > after)),
      uncertainty: ['Displayed state does not establish attention or understanding.'] };
    if(!Array.isArray(preserveActors)||preserveActors.length>1||preserveActors.some(ref=>typeof ref!=='string'||ref.length>200))throw new RoomError('cursor','Invalid capture preservation');
    if(!fitSituation(observation,maxBytes??DEFAULT_OBSERVATION_BYTES,{preserveActors}))throw new RoomError('capacity','The canonical situation exceeds this capture bound');
    this.observations.set(observation.id, observation);
    this.trimObservations();
    return clone(observation);
  }

  // First-class daimon projection; no emulated human input or assumed eyesight.
  // These explicit primitives are public expression, not evidence of model thought.
  project(actor, projection) { return this.atomic(()=>this.projectNow(actor,projection)); }

  projectNow(actor, { position, form }) {
    if (!actor?.rights?.includes('project')) throw new RoomError('forbidden', 'Projection access required');
    if (!position || !['x','y','z'].every(key => Number.isFinite(position[key]) && Math.abs(position[key]) <= 30)
      || !['orb', 'beacon','avatar'].includes(form)) throw new RoomError('projection', 'Choose a supported bounded projection');
    if(form==='avatar'&&!avatarForActor(actor))throw new RoomError('projection','No selected appearance is available for this being');
    if (!this.projections.has(actor.id) && this.projections.size >= LIMITS.sessions)
      throw new RoomError('capacity', 'Room projection capacity reached');
    const projection = { actor: actor.id, kind: actor.kind, position: clone(position), form };
    if(form==='avatar')projection.appearance=avatarForActor(actor);
    this.projections.set(actor.id, projection);
    return this.event(actor, 'projection.changed', projection);
  }

  nodeState(actor=null){return nodeState(this.nodes,actor,{entities:this.entities,editors:this.entityEditors,sequence:this.sequence});}

  focusState(){return focusState(this.focuses,this.entities,this.nodes);}

  command(actor, command) {
    if (!houseAction(command?.type)) return this.atomic(() => this.execute(actor, command));
    if (this.commitUncertain) throw new RoomError('recovery-required','The last checkpoint needs reconciliation before continuing');
    // House data has its own bounded checkpoint and is never included in resettable Room saves.
    try {
      return this.execute(actor, command);
    } catch (error) {
      if (error.commitUncertain) this.commitUncertain = true;
      throw error;
    }
  }

  execute(actor, command) {
    if (!actor?.rights?.includes('edit')) throw new RoomError('forbidden', 'Editing access required');
    if (!command || Object.keys(command).some(key => !['id','issuedAt','run','edition','observation','nativeRequest','type','target','expectedRevision','args'].includes(key))
      || typeof command.id !== 'string' || !/^[\w-]{8,80}$/.test(command.id)
      || !Number.isSafeInteger(command.issuedAt) || command.issuedAt > this.clock() + 1000)
      throw new RoomError('command', 'Invalid command envelope');
    if(actor.kind!=='daimon'&&command.nativeRequest!==undefined)
      throw new RoomError('command','Native source references come from the receiving world port');
    const key = actor.id + ':' + command.id;
    const fingerprint = hash(command);
    const durable = this.houses.receipt(actor.id, command.id);
    const old = durable ?? this.outcomes.get(key);
    if (old) {
      if (old.fingerprint !== fingerprint) throw new RoomError('id-reuse', 'Command ID already has different contents');
      return clone(old.result);
    }
    if (this.clock() - command.issuedAt > LIMITS.retryMs)
      throw new RoomError('expired', 'Command expired; inspect state before making a new decision');
    for (const [id, outcome] of this.outcomes) if (this.clock() - outcome.at > LIMITS.retryMs) this.outcomes.delete(id);
    if (this.outcomes.size >= LIMITS.commands) throw new RoomError('capacity', 'Command history capacity reached');
    const housing = houseAction(command.type);
    const finish = (status, reason, event = null) => {
      const result = { command: command.id, status, reason, event: event?.sequence ?? null, run: this.run };
      if (!housing) this.outcomes.set(key, { fingerprint, result, at: this.clock() });
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
    if (housing) {
      const result = this.houses.publish(actor, command, observation, fingerprint, this.clock());
      if (result.status === 'completed') this.changed({type:command.type, house:result.house});
      return result;
    }
    if(['node.place','node.update','node.remove'].includes(command.type)){
      const previous=this.nodes[command.target],seen=observation.nodes?.[command.target],placing=command.type==='node.place';
      if(actor.kind!=='daimon'||typeof actor.id!=='string'||actor.id.length>200||!contentNodeId(command.target))return finish('rejected','A native creator and canonical node identity are required');
      if(placing){
        if(previous||command.expectedRevision!==null||Object.keys(this.nodes).length>=MAX_CONTENT_NODES)return finish('rejected','Choose a new node within this world capacity');
      }else if(!previous||previous.deleted||previous.owner!==actor.id||command.expectedRevision!==previous.revision||seen?.revision!==previous.revision)
        return finish('rejected','Inspect your current node before changing it');
      if(command.type==='node.remove'){
        if(!command.args||typeof command.args!=='object'||Array.isArray(command.args)||Object.keys(command.args).length)return finish('rejected','Choose an explicit node removal');
        previous.deleted=true;previous.revision++;
      }else{
        if(!validNodeData(command.args))return finish('rejected','Choose bounded creation data and an existing Nexus result pin');
        for(const link of command.args.links){
          const linked=this.nodes[link.id],observed=observation.nodes?.[link.id];
          if(link.id===command.target||!linked||linked.deleted||linked.revision!==link.revision||observed?.revision!==link.revision)return finish('rejected','A linked node changed; inspect its current revision');
        }
        this.nodes[command.target]={id:command.target,owner:actor.id,revision:placing?1:previous.revision+1,deleted:false,...clone(command.args)};
      }
      const node=this.nodeState()[command.target];if(node.progress)node.progress.through=this.sequence+1;
      const event=this.event(actor,command.type,{target:command.target,node,nativeRequest:command.nativeRequest});
      return finish('completed','World node updated',event);
    }
    if(command.type==='focus.set'||command.type==='focus.clear'){
      if(typeof actor.id!=='string'||actor.id.length>200||!['human','daimon'].includes(actor.kind)
        ||!command.args||typeof command.args!=='object'||Array.isArray(command.args)||Object.keys(command.args).length)return finish('rejected','Choose an explicit indication');
      if(command.type==='focus.clear'){
        const previous=this.focuses.get(actor.id),seen=observation.focus?.find(signal=>signal.actor===actor.id);
        if(command.target!==null||!previous||command.expectedRevision!==previous.sequence||seen?.sequence!==command.expectedRevision)
          return finish('rejected','Your indication changed; inspect it before clearing');
        this.focuses.delete(actor.id);
        return finish('completed','Indication cleared',this.event(actor,'focus.clear',{target:previous.target,revision:previous.revision,clearedSequence:previous.sequence,nativeRequest:command.nativeRequest??null}));
      }
      const entity=this.entities[command.target]||this.nodes[command.target],seen=observation.entities[command.target]||observation.nodes?.[command.target];
      if(typeof command.target!=='string'||!(command.target==='bridge'||/^(?:garden|node)-[a-z0-9-]{1,40}$/.test(command.target))
        ||!entity||entity.deleted||!seen||seen.deleted||command.expectedRevision!==entity.revision||seen.revision!==command.expectedRevision)
        return finish('rejected','This object changed; choose its current version');
      if(!this.focuses.has(actor.id)&&this.focuses.size>=MAX_FOCUS)return finish('rejected','Indication capacity reached');
      const signal={actor:actor.id,kind:actor.kind,name:typeof actor.name==='string'?actor.name.slice(0,40):null,
        target:command.target,revision:entity.revision,sequence:this.sequence+1,time:this.clock()};
      this.focuses.set(actor.id,signal);
      return finish('completed','Object indicated',this.event(actor,'focus.set',{target:signal.target,revision:signal.revision,nativeRequest:command.nativeRequest??null}));
    }
    const entity = this.entities[command.target];
    if (command.type === 'bridge.set') {
      if (command.target !== 'bridge' || !command.args || Object.keys(command.args).length !== 1 || typeof command.args.raised !== 'boolean')
        return finish('rejected', 'Choose the bridge state');
      if (command.expectedRevision !== entity.revision) return finish('rejected', 'The bridge changed while you were deciding');
      entity.raised = command.args.raised;
      entity.revision++;
    } else if (command.type === 'garden.place' || command.type === 'garden.update') {
      const updating=command.type==='garden.update';
      if(updating){
        if(typeof command.target!=='string'||!command.target.startsWith('garden-')||!entity||entity.deleted||command.expectedRevision!==entity.revision)
          return finish('rejected','The garden element changed; inspect it before editing');
      }else{
        if (Object.keys(this.entities).length >= LIMITS.elements) return finish('rejected', 'This garden is full');
        if (typeof command.target !== 'string' || !/^garden-[a-z0-9-]{1,40}$/.test(command.target) || entity || command.expectedRevision !== null)
          return finish('rejected', 'Choose a new garden element');
      }
      const a = command.args;
      if (!a || Object.keys(a).sort().join(',') !== 'color,x,z' || !Number.isFinite(a.x) || !Number.isFinite(a.z)
        || !creationContains(a.x,a.z) || !workshopColour(a.color))
        return finish('rejected', 'Choose a valid garden placement');
      if(updating)Object.assign(entity,clone(a),{revision:entity.revision+1});
      else this.entities[command.target] = { id: command.target, revision: 1, ...clone(a) };
    } else if(command.type==='garden.remove') {
      if(!entity || !command.target.startsWith('garden-') || entity.deleted
        || command.expectedRevision!==entity.revision || !command.args || Object.keys(command.args).length)
        return finish('rejected','The garden element changed; inspect it before undoing');
      entity.deleted=true;entity.revision++;
    } else return finish('rejected', 'Unsupported activity operation');
    const actorRef=actor.ref??actor.id;
    if(typeof actorRef==='string'&&actorRef.length>0&&actorRef.length<=200)this.entityEditors[command.target]={actorRef,revision:this.entities[command.target].revision};
    else delete this.entityEditors[command.target];
    const event = this.event(actor, command.type, { target: command.target, entity: this.entities[command.target], nativeRequest: command.nativeRequest ?? null });
    return finish('completed', 'World updated', event);
  }

  result(actor, id) {
    if(this.commitUncertain)throw new RoomError('recovery-required','The last checkpoint needs reconciliation before continuing');
    if (!actor?.rights?.includes('observe')) throw new RoomError('forbidden', 'Room access required');
    return this.houses.result(actor.id, id) ?? clone(this.outcomes.get(actor.id + ':' + id)?.result ?? null);
  }

  reset() {
    return this.atomic(()=>this.resetNow());
  }

  resetNow() {
    this.run = randomUUID(); this.sequence = 0; this.events = []; this.observations.clear();
    this.entities = { bridge: { id: 'bridge', revision: 0, raised: false } };
    this.nodes={};this.entityEditors={};this.focuses.clear();this.projections.clear(); // Retain outcomes: old IDs must not mutate a new run.
    this.changed({ type:'run.reset', run:this.run });
  }
}
