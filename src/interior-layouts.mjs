import {createHash} from 'node:crypto';
import {HOUSE_PLOTS,houseId} from './houses.mjs';

export const LAYOUT_SAVE_BYTES = 64 * 1024;
const MAX_RECEIPTS = 32;
const MAX_ROOMS = 24;
const SCHEMA = 'holodeck.interior-layouts/v1';
const BEING = /^dm:being:v1:[A-Za-z0-9_-]{43}$/;
const COMMAND = /^[A-Za-z0-9_-]{8,80}$/;
const FINGERPRINT = /^[a-f0-9]{64}$/;

const exact = (value, fields) => value && typeof value === 'object' &&
  !Array.isArray(value) && Object.keys(value).sort().join(',') === fields;
const revision = value => Number.isSafeInteger(value) && value > 0;
const roomList = (rooms, house) => Array.isArray(rooms) && rooms.length > 0 &&
  rooms.length <= MAX_ROOMS && rooms.every(room => room?.house === house);
const fits = json => Buffer.byteLength(json) <= LAYOUT_SAVE_BYTES;
const digest = json => createHash('sha256').update(json).digest('hex');
const nativeEditor = actor => actor?.kind === 'daimon' && typeof actor.id === 'string' &&
  BEING.test(actor.id) && ['observe','edit'].every(right => actor.rights?.includes(right));

// Link indices are physical door slots. Keep old links at their exact indices,
// along with room labels, levels, exterior entry and original guest audiences.
function extendsLayout(previous, rooms) {
  const byId = new Map(rooms.map(room => [room.id,room]));
  return previous.every(room => {
    const next = byId.get(room.id);
    return next && room.title === next.title && room.level === next.level &&
      room.entry === next.entry && room.guests.length === next.guests.length &&
      room.guests.every((actor,index) => actor === next.guests[index]) &&
      room.links.every((link,index) => link.to === next.links[index]?.to &&
        link.kind === next.links[index]?.kind);
  });
}

export class InteriorLayouts {
  constructor({state,houses,baseDefinitions = [],persist,validate}) {
    if (!Array.isArray(baseDefinitions) || typeof validate !== 'function')
      throw Error('Select the maintained interior graph validator');
    this.houses = houses;
    this.persist = persist;
    this.validate = validate;
    this.baseDefinitions = structuredClone(baseDefinitions);
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
    return structuredClone(this.state.layouts.find(layout => layout.house === house) ?? null);
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

  publish(actor, input) {
    if (!this.accepts(actor,input)) return null;
    const json = JSON.stringify(input);
    if (!fits(json)) return null;
    const fingerprint = digest(json);
    const prior = this.state.receipts.find(receipt => receipt.owner === actor.id && receipt.id === input.id);
    if (prior) return prior.fingerprint === fingerprint ? structuredClone(prior.result) : null;
    const prepared = this.prepare(actor,input,fingerprint);
    if (!prepared) return null;
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
