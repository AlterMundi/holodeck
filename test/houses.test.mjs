import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Room} from '../src/room.mjs';
import {RoomStore} from '../src/room-store.mjs';
import {HOUSE_GROUND, HOUSE_PLOTS, HOUSE_SAVE_BYTES, Houses, houseId} from '../src/houses.mjs';
import {TERRACES, CREATION_AREAS} from '../src/world-layout.mjs';
import {worldDocument} from '../src/world.mjs';

const owner = {id:'dm:being:v1:'+'a'.repeat(43), kind:'daimon', rights:['observe','edit']};
const other = {...owner, id:'dm:being:v1:'+'b'.repeat(43)};
const guest = {...owner, id:'human:guest', kind:'human'};
const facade = {title:'The atlas', color:'#435366', width:3.6, depth:1.6, height:2.4};
const parcel = HOUSE_PLOTS[0].id;
const target = houseId(owner.id);

function command(room, actor, type, {args={}, revision=null, id=target, seen=room.observe(actor)} = {}) {
  return {
    id:crypto.randomUUID(), issuedAt:Date.now(), run:seen.run, edition:seen.edition,
    observation:seen.id, ...(actor.kind==='daimon' ? {nativeRequest:'owned-test'} : {}),
    type, target:id, expectedRevision:revision, args,
  };
}

test('verified owners get one parcel; foreign actors, guests and crossing or stale edits are refused', () => {
  const room = new Room();
  const claim = {facade, parcel};
  for (const actor of [other, guest]) {
    const request = command(room,actor,'house.claim',{args:claim});
    assert.match(room.command(actor,request).reason,/verified house owner/);
  }
  const bad = command(room,owner,'house.claim',{args:{parcel,facade:{...facade,width:3.9}}});
  assert.match(room.command(owner,bad).reason,/footprint/);
  const actual = command(room,owner,'house.claim',{args:claim});
  assert.equal(room.command(owner,actual).status,'completed');
  assert.equal(room.houses.directory()[0].owner,owner.id);
  assert.match(worldDocument(room),new RegExp('id="'+target+'" data-house-revision="1"'));
  assert.equal(room.command(other,command(room,other,'house.claim',{id:houseId(other.id),args:claim})).status,'rejected');
  assert.equal(room.command(owner,command(room,owner,'house.claim',{args:{facade,parcel:HOUSE_PLOTS[1].id}})).status,'rejected');
  const stale = room.observe(owner);
  const publish = command(room,owner,'house.publish',{args:{facade:{...facade,title:'Atlas & garden'}},revision:1,seen:stale});
  assert.equal(room.command(owner,publish).revision,2);
  assert.deepEqual(room.command(owner,publish),room.result(owner,publish.id));
  assert.equal(room.result(other,publish.id),null);
  assert.equal(room.command(owner,command(room,owner,'house.publish',{args:{facade},revision:2,seen:stale})).status,'rejected');
  assert.equal(room.command(other,command(room,other,'house.publish',{args:{facade},revision:2})).status,'rejected');
  assert.equal(room.command(guest,command(room,guest,'garden.place',{id:'garden-invasive',args:{x:HOUSE_PLOTS[0].x,z:HOUSE_PLOTS[0].z,color:'mint'}})).status,'rejected');
  assert.equal(room.houses.directory()[0].revision,2);
  assert.match(worldDocument(room),/Atlas &amp; garden/);
});

test('separate bounded checkpoint reconciles an interrupted publication without losing a house at reset or rollback', t => {
  const dir = mkdtempSync(join(tmpdir(),'holodeck-house-test-'));
  t.after(() => rmSync(dir,{recursive:true,force:true}));
  let failure = 'before';
  const store = new RoomStore(join(dir,'houses'),{maxBytes:HOUSE_SAVE_BYTES,synchronizeDirectory:() => {
    if (failure === 'after') throw Error('injected directory sync loss');
  }});
  const open = state => new Room({state,houses:new Houses({
    state:store.load(),persist:next=>{
      if (failure === 'before') throw Error('injected write failure');
      store.save(next);
    },
  })});
  const room = open();
  const claim = command(room,owner,'house.claim',{args:{parcel,facade}});
  const legacyBefore = room.snapshot();
  assert.throws(()=>room.command(owner,claim),/write failure/);
  assert.equal(store.load(),null);
  assert.deepEqual(room.houses.directory(),[]);
  failure = 'after';
  assert.throws(()=>room.command(owner,claim),e=>e.commitUncertain===true);
  assert.throws(()=>room.result(owner,claim.id),/reconciliation/);
  assert.deepEqual(room.snapshot(),legacyBefore);
  failure = null;
  const recovered = open(legacyBefore);
  const receipt = recovered.result(owner,claim.id);
  assert.equal(receipt.status,'completed');
  assert.deepEqual(recovered.command(owner,claim),receipt);
  recovered.reset();
  assert.notEqual(recovered.run,claim.run);
  // Legacy persists a different run and never receives the house checkpoint.
  const legacy = new Room({state:recovered.snapshot()});
  legacy.reset();
  const restarted = open(legacy.snapshot());
  assert.deepEqual(restarted.result(owner,claim.id),receipt);
  assert.equal(restarted.houses.directory()[0].id,target);
  assert.throws(()=>store.save({oversize:'x'.repeat(HOUSE_SAVE_BYTES)}),/capacity/);
});

test('all eight whole parcels lie off legacy creation, clear of each other and off the connected common route', () => {
  const [arrival] = TERRACES;
  const [approach, commons] = HOUSE_GROUND;
  assert.ok(Math.hypot(approach.maxX,approach.minZ)<arrival.radius);
  assert.ok(approach.maxZ>commons.minZ);
  const overlaps = (a,b) => a.minX<=b.maxX && a.maxX>=b.minX && a.minZ<=b.maxZ && a.maxZ>=b.minZ;
  const plots = HOUSE_PLOTS.map(({x,z,width,depth})=>({minX:x-width/2,maxX:x+width/2,minZ:z-depth/2,maxZ:z+depth/2}));
  assert.equal(plots.length,8);
  const path = {minX:approach.minX,maxX:approach.maxX,minZ:approach.minZ,maxZ:commons.maxZ};
  for (const [i,p] of plots.entries()) {
    assert.ok(p.minX>commons.minX && p.maxX<commons.maxX && p.minZ>commons.minZ && p.maxZ<commons.maxZ);
    assert.ok(!overlaps(p,path));
    assert.ok(!CREATION_AREAS.some(area=>overlaps(area,p)));
    assert.ok(!plots.slice(i+1).some(otherPlot=>overlaps(otherPlot,p)));
  }
});
