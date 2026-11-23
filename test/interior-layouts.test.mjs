import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Houses,houseId} from '../src/houses.mjs';
import {InteriorSpaces,OUTSIDE} from '../src/interior-spaces.mjs';
import {InteriorLayouts,LAYOUT_SAVE_BYTES} from '../src/interior-layouts.mjs';
import {RoomStore} from '../src/room-store.mjs';

const being = letter => ({kind:'daimon',id:'dm:being:v1:'+letter.repeat(43),rights:['observe','edit']});
const owner = being('a');
const other = being('b');
const seeded = being('c');
const visitor = {id:'human:admitted-guest',kind:'human',rights:['observe']};
const selectedHouse = houseId(owner.id);
const legacyHouse = houseId(seeded.id);
const room = (id,house,fields={}) => ({id,house,title:id,entry:false,level:0,links:[],guests:[],...fields});
const baseDefinitions = [room('seeded-vestibule',legacyHouse,{entry:true})];
const foyer = room('author-foyer',selectedHouse,{entry:true,guests:[visitor.id]});
const gallery = room('author-gallery',selectedHouse,{guests:[visitor.id]});
const lab = room('author-lab',selectedHouse,{level:-1});
const link = (kind,to) => ({kind,to});
const firstRooms = [
  {...foyer,links:[link('door',gallery.id)]},
  {...gallery,links:[link('door',foyer.id)]},
];
const extendedRooms = [
  {...firstRooms[0],links:[...firstRooms[0].links,link('stair',lab.id)]},
  firstRooms[1],
  {...lab,links:[link('stair',foyer.id)]},
];
const proposal = (expectedRevision,rooms,fields={}) => ({
  id:crypto.randomUUID(),type:'layout.publish',house:selectedHouse,expectedRevision,rooms,...fields,
});

function housing() {
  const houses = new Houses();
  for (const [index,actor] of [owner,other,seeded].entries()) {
    const result = houses.publish(actor,{
      id:crypto.randomUUID(),type:'house.claim',target:houseId(actor.id),run:'layout-test',
      expectedRevision:null,args:{parcel:'parcel-west-'+(index+1),
        facade:{title:'Fixture home',color:'#193331',width:2,depth:1,height:2}},
    },{},'1'.repeat(64),Date.now());
    assert.equal(result.status,'completed');
  }
  return houses;
}

function setup(options={}) {
  const houses = housing();
  const config = {houses,baseDefinitions,validate:definitions=>new InteriorSpaces({houses,definitions}),...options};
  return {houses,config,store:new InteriorLayouts(config)};
}

test('owner previews a bounded plan without writing and publishes an exact recoverable receipt',()=>{
  let checkpoint, saves=0;
  const {config,store} = setup({persist:state=>{saves++;checkpoint=JSON.parse(JSON.stringify(state));}});
  const input = proposal(null,firstRooms);
  assert.equal(store.current(owner),null);
  const preview = store.preview(owner,input);
  assert.deepEqual(preview,{house:selectedHouse,revision:1,rooms:firstRooms});
  preview.rooms[0].links.pop();
  assert.deepEqual(store.definitions(),baseDefinitions);
  assert.equal(saves,0);
  assert.deepEqual(store.publish(owner,input),{house:selectedHouse,revision:1});
  const current=store.current(owner);
  assert.deepEqual(current,{house:selectedHouse,revision:1,rooms:firstRooms});
  current.rooms[0].guests.pop();
  assert.deepEqual(store.current(owner).rooms,firstRooms);
  assert.equal(store.current(visitor),null);
  assert.equal(store.current(other),null);
  assert.deepEqual(store.definitions(),[...baseDefinitions,...firstRooms]);
  const detached = store.definitions();
  detached[0].title = 'Untrusted local mutation';
  assert.equal(store.definitions()[0].title,baseDefinitions[0].title);
  assert.deepEqual(store.publish(owner,input),{house:selectedHouse,revision:1});
  assert.equal(store.publish(owner,{...input,rooms:[foyer]}),null);
  assert.equal(store.result(other,input.id),null);
  assert.equal(store.result({...owner,rights:['observe']},input.id),null);
  assert.deepEqual(new InteriorLayouts({...config,state:checkpoint}).result(owner,input.id),
    {house:selectedHouse,revision:1});
  assert.equal(saves,1);
});

test('only an active native owner may publish; legacy and foreign room definitions are protected',()=>{
  const {store} = setup();
  const original = proposal(null,firstRooms);
  for (const actor of [other,visitor,{...owner,kind:'human'},{...owner,rights:['edit']}]) {
    assert.equal(store.preview(actor,original),null);
    assert.equal(store.publish(actor,original),null);
  }
  assert.equal(store.publish(being('d'),proposal(null,[foyer],{house:houseId(being('d').id)})),null);
  assert.equal(store.publish(seeded,proposal(null,baseDefinitions,{house:legacyHouse})),null);
  assert.equal(store.publish(owner,proposal(null,[...firstRooms,baseDefinitions[0]])),null);
  const colliding = room(baseDefinitions[0].id,selectedHouse,{entry:true});
  assert.equal(store.publish(owner,proposal(null,[colliding])),null);
  const broken = {...foyer,links:[link('portal','seeded-vestibule')]};
  assert.equal(store.publish(owner,proposal(null,[broken])),null);
  assert.equal(store.publish(owner,proposal(null,[{...foyer,guests:['unverified-display-name']}])),null);
  assert.equal(store.publish(owner,proposal(null,[{...foyer,asset:'https://elsewhere.test/model.glb'}])),null);
  assert.deepEqual(store.definitions(),baseDefinitions);
});

test('an extension preserves position and access for existing visitors and guards revisions',()=>{
  const {houses,store} = setup();
  const original = proposal(null,firstRooms);
  assert.deepEqual(store.publish(owner,original),{house:selectedHouse,revision:1});
  assert.equal(store.publish(owner,proposal(null,extendedRooms)),null);
  assert.equal(store.publish(owner,proposal(1,[foyer])),null);
  const reordered = [{...extendedRooms[0],links:extendedRooms[0].links.toReversed()},...extendedRooms.slice(1)];
  assert.equal(store.publish(owner,proposal(1,reordered)),null);
  const duplicateGuests = [{...extendedRooms[0],guests:[...foyer.guests,foyer.guests[0]]},...extendedRooms.slice(1)];
  assert.equal(store.publish(owner,proposal(1,duplicateGuests)),null);
  assert.deepEqual(store.publish(owner,proposal(1,extendedRooms)),{house:selectedHouse,revision:2});
  assert.deepEqual(store.publish(owner,original),{house:selectedHouse,revision:1});

  const admitted = actor => actor.id === visitor.id;
  const before = new InteriorSpaces({houses,definitions:[...baseDefinitions,...firstRooms],guestAccess:admitted});
  assert.ok(before.move(visitor,{from:OUTSIDE,to:foyer.id}));
  const previousDoor = before.view(visitor).exits[0];
  assert.ok(before.move(visitor,{from:foyer.id,to:gallery.id}));
  const state = {schema:'holodeck.spaces/v1',positions:before.positions};
  const after = new InteriorSpaces({houses,definitions:store.definitions(),state,guestAccess:admitted});
  assert.equal(after.current(visitor),gallery.id);
  assert.ok(after.move(visitor,{from:gallery.id,to:foyer.id}));
  assert.deepEqual(after.view(visitor).exits,[previousDoor]);
  assert.equal(after.move(visitor,{from:foyer.id,to:lab.id}),null);
  assert.ok(after.move(owner,{from:OUTSIDE,to:foyer.id}));
  assert.ok(after.move(owner,{from:foyer.id,to:lab.id}));
  assert.equal(after.view(owner).level,-1);
  assert.equal(new InteriorSpaces({houses,definitions:store.definitions(),state,guestAccess:()=>false})
    .current(visitor),OUTSIDE);
});

test('checkpoint failures preserve the last live definition and uncertain replacement is read back once',t=>{
  const directory = mkdtempSync(join(tmpdir(),'holodeck-layouts-'));
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  let fail = false;
  const files = new RoomStore(directory,{maxBytes:LAYOUT_SAVE_BYTES,
    synchronizeDirectory:()=>{if(fail)throw Error('Fixture directory sync failed');}});
  const {config,store} = setup({persist:state=>files.save(state)});
  const rejected = new InteriorLayouts({...config,persist:()=>{throw Error('Precommit rejection');}});
  assert.throws(()=>rejected.publish(owner,proposal(null,firstRooms)),/Precommit rejection/);
  assert.equal(rejected.fenced,false);
  assert.deepEqual(rejected.definitions(),baseDefinitions);

  const original = proposal(null,firstRooms);
  const extension = proposal(1,extendedRooms);
  assert.equal(store.publish(owner,original).revision,1);
  fail = true;
  assert.throws(()=>store.publish(owner,extension),error=>error.commitUncertain === true);
  assert.equal(store.fenced,true);
  assert.equal(store.publish(owner,extension),null);
  assert.equal(store.result(owner,extension.id),null);
  assert.equal(store.current(owner),null);
  assert.deepEqual(store.definitions(),[...baseDefinitions,...firstRooms]);
  const restored = new InteriorLayouts({...config,state:files.load()});
  assert.deepEqual(restored.result(owner,extension.id),{house:selectedHouse,revision:2});
  assert.deepEqual(restored.publish(owner,extension),{house:selectedHouse,revision:2});
  assert.deepEqual(restored.definitions(),[...baseDefinitions,...extendedRooms]);
  const invalid = files.load();
  invalid.layouts[0].rooms[0].house = legacyHouse;
  assert.throws(()=>new InteriorLayouts({...config,state:invalid}),/Invalid interior layout checkpoint/);
});
