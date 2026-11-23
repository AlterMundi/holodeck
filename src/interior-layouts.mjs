import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {HOUSE_PLOTS,houseId} from './houses.mjs';
import {MAX_WORLD_REQUEST_BYTES} from './world-limits.mjs';

export const LAYOUT_SAVE_BYTES = 64 * 1024;
const MAX_RECEIPTS = 32;
const MAX_ROOMS = 24;
const SCHEMA = 'holodeck.interior-layouts/v1';
const BEING = /^dm:being:v1:[A-Za-z0-9_-]{43}$/;
const COMMAND = /^[A-Za-z0-9_-]{8,80}$/;
const FINGERPRINT = /^[a-f0-9]{64}$/;
const ROOM_SLUG = /^[a-z][a-z0-9-]{0,24}$/;
const STARTERS = new Map([
  ['atelier',[
    {slug:'foyer',title:'Vestíbulo',level:0,links:[['door','gallery'],['stair','workshop']]},
    {slug:'gallery',title:'Galería',level:0,links:[['door','foyer']]},
    {slug:'workshop',title:'Taller',level:-1,links:[['stair','foyer']]},
  ]],
  ['signal-house',[
    {slug:'foyer',title:'Vestíbulo',level:0,links:[['door','playroom']]},
    {slug:'playroom',title:'Sala de juegos',level:0,links:[['door','foyer'],['portal','observatory']]},
    {slug:'observatory',title:'Observatorio',level:1,links:[['portal','playroom']]},
  ]],
]);

const exact = (value, fields) => value && typeof value === 'object' &&
  !Array.isArray(value) && Object.keys(value).sort().join(',') === fields;
const revision = value => Number.isSafeInteger(value) && value > 0;
const roomList = (rooms, house) => Array.isArray(rooms) && rooms.length > 0 &&
  rooms.length <= MAX_ROOMS && rooms.every(room => room?.house === house);
const fits = json => Buffer.byteLength(json) <= LAYOUT_SAVE_BYTES;
const digest = json => createHash('sha256').update(json).digest('hex');
const nativeEditor = actor => actor?.kind === 'daimon' && typeof actor.id === 'string' &&
  BEING.test(actor.id) && ['observe','edit'].every(right => actor.rights?.includes(right));

// Link indices are physical door slots. Keep old links at their exact indices
// along with their room labels, levels and exterior entry.
function extendsLayout(previous, rooms) {
  const byId = new Map(rooms.map(room => [room.id,room]));
  return previous.every(room => {
    const next = byId.get(room.id);
    return next && room.title === next.title && room.level === next.level &&
      room.entry === next.entry &&
      room.links.every((link,index) => link.to === next.links[index]?.to &&
        link.kind === next.links[index]?.kind);
  });
}

export class InteriorLayouts {
  constructor({state,houses,baseDefinitions = [],persist,validate,draftBaseline = []}) {
    if (!Array.isArray(baseDefinitions) || typeof validate !== 'function')
      throw Error('Select the maintained interior graph validator');
    this.houses = houses;
    this.persist = persist;
    this.validate = validate;
    this.baseDefinitions = structuredClone(baseDefinitions);
    this.draftBaseline = structuredClone(draftBaseline);
    this.legacyHouses = new Set(this.baseDefinitions.map(room => room.house));
    this.fenced = false;

    const checkpoint = state ?? {schema:SCHEMA,layouts:[],receipts:[]};
    if (!exact(checkpoint,'layouts,receipts,schema') || checkpoint.schema !== SCHEMA)
      throw Error('Invalid interior layout checkpoint');
    const {layouts,receipts} = checkpoint;
    if (!Array.isArray(layouts) || layouts.length > HOUSE_PLOTS.length ||
        !layouts.every(layout => exact(layout,'house,revision,rooms') &&
          revision(layout.revision) && roomList(layout.rooms,layout.house) &&
          !this.legacyHouses.has(layout.house) &&
          this.houses.directory().some(house => house.id === layout.house)) ||
        new Set(layouts.map(layout => layout.house)).size !== layouts.length ||
        !Array.isArray(receipts) || receipts.length > MAX_RECEIPTS ||
        !receipts.every(receipt => this.validReceipt(receipt,layouts)) ||
        new Set(receipts.map(receipt => receipt.owner + ':' + receipt.id)).size !== receipts.length ||
        !fits(JSON.stringify(checkpoint)) || !this.validDefinitions(layouts))
      throw Error('Invalid interior layout checkpoint');
    this.state = structuredClone(checkpoint);
  }

  validReceipt(receipt, layouts) {
    return exact(receipt,'fingerprint,id,owner,result') &&
      typeof receipt.id === 'string' && COMMAND.test(receipt.id) &&
      typeof receipt.owner === 'string' && BEING.test(receipt.owner) &&
      typeof receipt.fingerprint === 'string' && FINGERPRINT.test(receipt.fingerprint) &&
      exact(receipt.result,'house,revision') && receipt.result.house === houseId(receipt.owner) &&
      revision(receipt.result.revision) && layouts.some(layout =>
        layout.house === receipt.result.house && layout.revision >= receipt.result.revision);
  }

  merged(layouts) {
    return [...this.baseDefinitions,...layouts.flatMap(layout => layout.rooms)];
  }

  validDefinitions(layouts) {
    try {
      return this.validate(structuredClone(this.merged(layouts))) !== false;
    } catch {
      return false;
    }
  }

  definitions() {
    if (this.draftBaseline.length && this.state.layouts.length)
      return structuredClone(this.draftBaseline);
    return structuredClone(this.merged(this.state.layouts));
  }

  owns(actor, house) {
    return nativeEditor(actor) && house === houseId(actor.id) &&
      !this.legacyHouses.has(house) &&
      this.houses.directory().some(current => current.id === house && current.owner === actor.id);
  }

  current(actor) {
    if (this.fenced || !nativeEditor(actor)) return null;
    const house = houseId(actor.id);
    if (!this.owns(actor,house)) return null;
    const current = this.state.layouts.find(layout => layout.house === house);
    return current ? structuredClone(this.draftBaseline.length ?
      {...current,rooms:this.draftBaseline} : current) : null;
  }

  draft(actor, input) {
    if (this.fenced || !nativeEditor(actor) || input?.type !== 'layout.draft' ||
        typeof input.id !== 'string' || !COMMAND.test(input.id))
      return null;
    const house = houseId(actor.id);
    if (!this.owns(actor,house)) return null;

    const current = this.current(actor);
    const roomId = slug => `home-${house.slice(6,22)}-${slug}`;
    let rooms;
    if (!current && exact(input,'id,template,type') && input.template === 'adopt' &&
        this.draftBaseline[0]?.house === house) {
      rooms = this.draftBaseline;
    } else if (!current && exact(input,'guests,id,template,type') && Array.isArray(input.guests)) {
      const plan = STARTERS.get(input.template);
      if (!plan) return null;
      rooms = plan.map(({slug,title,level,links},index)=>({
        id:roomId(slug),house,title,level,entry:index===0,guests:[...input.guests],
        links:links.map(([kind,to])=>({kind,to:roomId(to)})),
      }));
    } else if (current && exact(input,'from,guests,id,kind,level,room,title,type') && Array.isArray(input.guests)) {
      if (typeof input.room !== 'string' || !ROOM_SLUG.test(input.room)) return null;
      rooms = current.rooms;
      const from = rooms.find(room=>room.id===input.from);
      const id = roomId(input.room);
      if (!from || rooms.some(room=>room.id===id)) return null;
      from.links.push({kind:input.kind,to:id});
      rooms.push({id,house,title:input.title,level:input.level,entry:false,
        guests:[...input.guests],links:[{kind:input.kind,to:from.id}]});
    } else {
      return null;
    }
    const command = {type:'layout.publish',id:input.id,house,
      expectedRevision:current?.revision ?? null,rooms};
    const wire = JSON.stringify({operation:'act',args:command,ownNative:true});
    // The installed Python client can encode each non-ASCII code unit as \uXXXX.
    const wireBytes = wire.replace(/[^\x00-\x7f]/g,'\\u0000').length+1;
    if (wireBytes > MAX_WORLD_REQUEST_BYTES) return null;
    const checked = this.preview(actor,command);
    return checked ? {command,revision:checked.revision} : null;
  }

  accepts(actor, input) {
    return !this.fenced && exact(input,'expectedRevision,house,id,rooms,type') &&
      input.type === 'layout.publish' && typeof input.id === 'string' && COMMAND.test(input.id) &&
      (input.expectedRevision === null || revision(input.expectedRevision)) &&
      this.owns(actor,input.house) && roomList(input.rooms,input.house);
  }

  prepare(actor, input, fingerprint) {
    const previous = this.state.layouts.find(layout => layout.house === input.house);
    if ((previous?.revision ?? null) !== input.expectedRevision) return null;
    if (this.draftBaseline.length && (previous || !isDeepStrictEqual(input.rooms,this.draftBaseline)))
      return null;
    const layout = {house:input.house,revision:(previous?.revision ?? 0)+1,
      rooms:structuredClone(input.rooms)};
    if (!revision(layout.revision)) return null;
    const layouts = previous ? this.state.layouts.map(current => current === previous ? layout : current) :
      [...this.state.layouts,layout];
    if (!this.validDefinitions(layouts) || (previous && !extendsLayout(previous.rooms,layout.rooms)))
      return null;
    const result = {house:layout.house,revision:layout.revision};
    const receipts = [...this.state.receipts.slice(1-MAX_RECEIPTS),
      {owner:actor.id,id:input.id,fingerprint,result}];
    const next = {schema:SCHEMA,layouts,receipts};
    return fits(JSON.stringify(next)) ? {layout,result,next} : null;
  }

  preview(actor, input) {
    if (!this.accepts(actor,input)) return null;
    const json = JSON.stringify(input);
    if (!fits(json)) return null;
    const prior = this.state.receipts.find(receipt => receipt.owner === actor.id && receipt.id === input.id);
    if (prior) return null;
    return this.prepare(actor,input,digest(json))?.layout ?? null;
  }

  publish(actor, input, beforeSave) {
    if (!this.accepts(actor,input)) return null;
    const json = JSON.stringify(input);
    if (!fits(json)) return null;
    const fingerprint = digest(json);
    const prior = this.state.receipts.find(receipt => receipt.owner === actor.id && receipt.id === input.id);
    if (prior) return prior.fingerprint === fingerprint ? structuredClone(prior.result) : null;
    const prepared = this.prepare(actor,input,fingerprint);
    if (!prepared) return null;
    beforeSave?.(prepared.layout.rooms);
    try {
      this.persist?.(prepared.next);
    } catch (error) {
      if (error.commitUncertain) this.fenced = true;
      throw error;
    }
    this.state = prepared.next;
    return structuredClone(prepared.result);
  }

  result(actor, id) {
    if (this.fenced || typeof id !== 'string' || !COMMAND.test(id) ||
        !nativeEditor(actor) || !this.owns(actor,houseId(actor.id))) return null;
    const receipt = this.state.receipts.find(entry => entry.owner === actor.id && entry.id === id);
    return structuredClone(receipt?.result ?? null);
  }
}
