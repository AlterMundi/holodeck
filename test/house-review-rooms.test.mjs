import test from 'node:test';
import assert from 'node:assert/strict';
import {houseReviewRooms,ATELIER_FOYER,CHARACTER_STUDIO,characterWorktable} from '../src/house-review-rooms.mjs';
import {InteriorSpaces,interiorDocument} from '../src/interior-spaces.mjs';
import {houseId} from '../src/houses.mjs';

const owner='dm:being:v1:'+'Q'.repeat(43), house=houseId(owner);
const guest='human:matter-guest', labGuest='human:lab-guest';
const foyer={id:ATELIER_FOYER,house,level:0,entry:true,title:'Vestíbulo',links:[],guests:[]};
const matter={...foyer,id:'matter',title:'Materia',entry:false,guests:[guest]};
const lab={...foyer,id:'lab',title:'Lab',entry:false,level:-1,guests:[labGuest]};
const actor=id=>({kind:'human',id});

test('the existing house entrance leads to three reciprocal doors without granting access across rooms',()=>{
  const rooms=houseReviewRooms([foyer,matter,lab],house,'matter','lab');
  const spaces=new InteriorSpaces({definitions:rooms,houses:{directory:()=>[{id:house,owner,
    facade:{title:'Casa'},parcel:'parcel-west-1'}]}});
  assert.equal(spaces.view(actor(guest)).entrances[0].id,ATELIER_FOYER);
  assert.equal(spaces.move(actor(guest),{from:'outside',to:'matter'}),null);
  const entry=spaces.move(actor(guest),{from:'outside',to:ATELIER_FOYER});
  assert.deepEqual(entry.exits.map(({kind,to,slot})=>[kind,to,slot]),
    [['door','matter',0],['door',CHARACTER_STUDIO,2]]);
  assert.equal(spaces.move(actor(guest),{from:ATELIER_FOYER,to:'lab'}),null);
  for(const to of ['matter',CHARACTER_STUDIO]){
    assert.equal(spaces.move(actor(guest),{from:ATELIER_FOYER,to}).exits[0].to,ATELIER_FOYER);
    assert.equal(spaces.move(actor(guest),{from:to,to:ATELIER_FOYER}).id,ATELIER_FOYER);
  }
  const labEntry=spaces.move(actor(labGuest),{from:'outside',to:ATELIER_FOYER});
  assert.deepEqual(labEntry.exits.map(({to,slot})=>[to,slot]),[['lab',1]]);
  assert.equal(spaces.move(actor(labGuest),{from:ATELIER_FOYER,to:'lab'}).exits[0].to,ATELIER_FOYER);
  assert.equal(matter.entry,false);
  assert.equal(lab.level,-1);
});

test('a toroidal receiver without the Atelier keeps its direct Matter entrance',()=>{
  assert.deepEqual(houseReviewRooms([matter],house,'matter','lab'),[{...matter,entry:true}]);
});

test('a room serving as both the lab and collection keeps its direct entrance',()=>{
  assert.deepEqual(houseReviewRooms([foyer,lab],house,'lab','lab'),[
    {...lab,entry:true,links:[]},
  ]);
});

test('Char Design has a physical worktable scoped to its room',()=>{
  const rooms=houseReviewRooms([foyer,matter,lab],house,'matter','lab');
  const studio=rooms.find(room=>room.id===CHARACTER_STUDIO);
  const expected=new RegExp('id="'+characterWorktable.id+'"');
  const markup=interiorDocument(studio);
  assert.match(markup,expected);
  assert.match(markup,/<m-cube y="\.81" width="2\.42"/);
  assert.doesNotMatch(markup,/id="room-marker"/);
  for(const room of rooms.filter(room=>room!==studio))assert.doesNotMatch(interiorDocument(room),expected);
});


test('the torus keeps an independently owned house and its visitor permissions',()=>{
  const otherOwner='dm:being:v1:'+'S'.repeat(43), otherHouse=houseId(otherOwner);
  const entry={id:'other-foyer',house:otherHouse,entry:true,title:'Other foyer',level:0,
    guests:[guest],links:[{kind:'door',to:'other-gallery'}]};
  const gallery={...entry,id:'other-gallery',entry:false,title:'Other gallery',
    links:[{kind:'door',to:entry.id}]};
  const rooms=houseReviewRooms([foyer,matter,lab,entry,gallery],house,matter.id,lab.id);
  assert.deepEqual(rooms.slice(-2),[entry,gallery]);
  const spaces=new InteriorSpaces({definitions:rooms,houses:{directory:()=>[
    {id:house,owner,facade:{title:'Casa'},parcel:'parcel-west-1'},
    {id:otherHouse,owner:otherOwner,facade:{title:'Casa Linterna'},parcel:'parcel-east-1'},
  ]}});
  assert.equal(spaces.view({kind:'daimon',id:otherOwner}).entrances[0].id,entry.id);
  assert.equal(spaces.move(actor(labGuest),{from:'outside',to:entry.id}),null);
  const outside=spaces.view(actor(guest)).entrances.find(door=>door.id===entry.id);
  assert.equal(spaces.move(actor(guest),{from:'outside',to:entry.id}).id,entry.id);
  assert.equal(spaces.move(actor(guest),{from:entry.id,to:gallery.id}).id,gallery.id);
  const returned=spaces.move(actor(guest),{from:gallery.id,to:entry.id});
  assert.deepEqual(returned.exteriorDoor,outside.door);
  assert.equal(spaces.move(actor(guest),{from:entry.id,to:'outside'}).id,'outside');
});
