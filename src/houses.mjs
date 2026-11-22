import {createHash} from 'node:crypto';

const SIDES = [-1, 1];
const ROWS = [15.5, 18, 20.5, 23];
export const HOUSE_GROUND = Object.freeze([
  Object.freeze({id:'house-approach', minX:-1.6, maxX:1.6, minZ:9.8, maxZ:14}),
  Object.freeze({id:'house-commons', minX:-8, maxX:8, minZ:13.75, maxZ:25}),
]);
export const HOUSE_PLOTS = Object.freeze(ROWS.flatMap((z, index) =>
  SIDES.map(side => Object.freeze({
    id: `parcel-${side < 0 ? 'west' : 'east'}-${index + 1}`,
    x: 4.5 * side, z, side, width:4, depth:2,
  })),
));
// The facade door faces the common aisle. Spawn on the public approach,
// beyond the facade collider and inside the connected walking surface.
export function exteriorDoor(house) {
  const plot = HOUSE_PLOTS.find(candidate => candidate.id === house.parcel);
  return {
    x: plot.x - plot.side * (house.facade.width / 2 + .85),
    y: .11,
    z: plot.z,
    facing: plot.side,
  };
}

const BEING = /^dm:being:v1:[A-Za-z0-9_-]{43}$/;
const COMMAND = /^[\w-]{8,80}$/;
const HASH = /^[a-f0-9]{64}$/;
const SCHEMA = 'holodeck.houses/v1';
export const HOUSE_SAVE_BYTES = 64 * 1024;
const MAX_RECEIPTS = 32;

const digest = value => createHash('sha256').update(value).digest('hex');
const exact = (value, keys) => value && typeof value === 'object' &&
  !Array.isArray(value) && Object.keys(value).sort().join(',') === keys;
const plotFor = id => HOUSE_PLOTS.find(plot => plot.id === id);
const between = (value, low, high) => Number.isFinite(value) && value >= low && value <= high;
export const houseId = owner => 'house-' + digest(owner);
export const houseAction = type => type === 'house.claim' || type === 'house.publish';

function validFacade(value, plot) {
  return plot && exact(value, 'color,depth,height,title,width') &&
    typeof value.title === 'string' && value.title.trim().length > 0 &&
    value.title.length <= 40 && !/[\u0000-\u001f\u007f]/.test(value.title) &&
    typeof value.color === 'string' && /^#[a-fA-F0-9]{6}$/.test(value.color) &&
    between(value.width, 1, plot.width - .4) &&
    between(value.depth, .8, plot.depth - .4) &&
    between(value.height, 1.2, 3);
}
function validHouse(h) {
  return exact(h, 'facade,id,owner,parcel,revision') &&
    typeof h.owner === 'string' && BEING.test(h.owner) && h.id === houseId(h.owner) &&
    Number.isSafeInteger(h.revision) && h.revision >= 1 &&
    validFacade(h.facade, plotFor(h.parcel));
}
function validReceipt(r, houses) {
  if (!exact(r, 'at,fingerprint,owner,result') || typeof r.owner !== 'string' || !BEING.test(r.owner) ||
      !Number.isSafeInteger(r.at) || r.at < 0 || !HASH.test(r.fingerprint) ||
      !exact(r.result, 'command,event,house,reason,revision,run,status')) return false;
  const {command, event, house, reason, revision, run, status} = r.result;
  return typeof command === 'string' && COMMAND.test(command) && event === null && house === houseId(r.owner) &&
    reason === 'House published' && status === 'completed' &&
    Number.isSafeInteger(revision) && revision >= 1 &&
    houses.some(h => h.id === house && h.revision >= revision) &&
    typeof run === 'string' && run.length <= 80;
}

export class Houses {
  constructor({state, persist} = {}) {
    this.state = state ?? {schema:SCHEMA, houses:[], receipts:[]};
    const {houses, receipts} = this.state;
    if (!exact(this.state, 'houses,receipts,schema') || this.state.schema !== SCHEMA ||
        !Array.isArray(houses) || houses.length > HOUSE_PLOTS.length ||
        !houses.every(validHouse) ||
        new Set(houses.map(h => h.parcel)).size !== houses.length ||
        new Set(houses.map(h => h.id)).size !== houses.length ||
        !Array.isArray(receipts) || receipts.length > MAX_RECEIPTS ||
        !receipts.every(r => validReceipt(r, houses)) ||
        new Set(receipts.map(r => r.owner + ':' + r.result.command)).size !== receipts.length) {
      throw Error('Invalid house checkpoint; preserve it for recovery');
    }
    this.persist = persist;
  }

  directory() {
    return structuredClone(this.state.houses);
  }

  receipt(owner, id) {
    return this.state.receipts.find(r => r.owner === owner && r.result.command === id);
  }

  result(owner, id) {
    return structuredClone(this.receipt(owner, id)?.result ?? null);
  }

  overview(owner) {
    return {
      operations:['house.claim','house.publish'],
      ownHouse: typeof owner === 'string' && BEING.test(owner) ? houseId(owner) : null,
      ground: HOUSE_GROUND,
      plots: HOUSE_PLOTS.map(p => ({id:p.id, x:p.x, z:p.z, width:p.width, depth:p.depth,
        occupied:this.state.houses.some(h => h.parcel === p.id)})),
      revisions:this.state.houses.map(({id,parcel,revision}) => ({id,parcel,revision})),
    };
  }

  // Room supplies the authenticated actor, fresh capture and exact command envelope.
  publish(actor, command, observation, fingerprint, now) {
    const refuse = reason => ({
      command: command.id, status:'rejected', reason, event:null, run:command.run,
    });
    if (actor.kind !== 'daimon' || !BEING.test(actor.id) || command.target !== houseId(actor.id))
      return refuse('Only the verified house owner can publish here');

    const old = this.state.houses.find(h => h.id === command.target);
    const claiming = command.type === 'house.claim';
    if (claiming ? old || command.expectedRevision !== null :
        !old || command.expectedRevision !== old.revision ||
        !observation.place?.housing?.revisions.some(h => h.id === old.id && h.revision === old.revision)) {
      return refuse('Observe your current house before publishing');
    }

    const args = command.args;
    if (!exact(args, claiming ? 'facade,parcel' : 'facade'))
      return refuse('Select a supported house publication');
    const parcel = claiming ? args.parcel : old.parcel;
    if (claiming && this.state.houses.some(h => h.parcel === parcel))
      return refuse('This parcel is already occupied');
    if (!validFacade(args.facade, plotFor(parcel)))
      return refuse('Keep the entire facade footprint inside the parcel');

    const revision = (old?.revision ?? 0) + 1;
    if (!Number.isSafeInteger(revision)) return refuse('House revision capacity reached');
    const house = {id:command.target, owner:actor.id, revision, parcel, facade:structuredClone(args.facade)};
    const result = {command:command.id, status:'completed', reason:'House published', event:null,
      run:command.run, house:house.id, revision};
    const next = {schema:SCHEMA, houses:[...this.state.houses.filter(h => h.id !== house.id), house],
      receipts:[...this.state.receipts.slice(1 - MAX_RECEIPTS), {at:now, owner:actor.id, fingerprint, result}]};

    // Save the facade and exact result in one checkpoint before changing any projection.
    this.persist?.(next);
    this.state = next;
    return structuredClone(result);
  }
}
