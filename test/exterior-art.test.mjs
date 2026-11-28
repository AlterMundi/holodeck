import {test} from 'node:test';
import assert from 'node:assert/strict';
import {exteriorDoor,houseId,Houses} from '../src/houses.mjs';
import {Room} from '../src/room.mjs';
import {worldDocument} from '../src/world.mjs';

const house = (parcel,letter) => {
  const owner = 'dm:being:v1:' + letter.repeat(43);
  return {id:houseId(owner),owner,parcel,revision:1,
    facade:{title:'Casa del lago',color:'#435366',width:3.15,depth:1.5,height:2.65}};
};
const facade = {asset:'casa-facade.glb',bounds:{min:[-.85,0,-1.7],max:[.85,2.75,1.66]}};
const miniature = {asset:'casa-model.glb',at:[1.8,0,.67],
  bounds:{min:[-.22,0,-.12],max:[.22,.9,.12]}};
const west = house('parcel-west-1','a'),east = house('parcel-east-1','b');
const room = () => new Room({houses:new Houses({state:{
  schema:'holodeck.houses/v1',houses:[west,east],receipts:[],
}})});
const model = (markup,id) => markup.match(new RegExp(`<m-model id="${id}"[^>]+>`))?.[0];

test('the selected facade and miniature face the aisle and keep the legacy physical entrance', () => {
  const world = room();
  const active = worldDocument(world,{basePath:'/holodeck',houseVisual:({id}) =>
    id===west.id ? {facade,miniature} : null});

  assert.equal(model(active,`facade-${west.id}`),
    `<m-model id="facade-${west.id}" src="/holodeck/assets/casa-facade.glb" x="0" y="0.1" z="0" ry="90" collide="false">`);
  assert.equal(model(active,`miniature-${west.id}`),
    `<m-model id="miniature-${west.id}" src="/holodeck/assets/casa-model.glb" x="1.8" y="0.1" z="0.67" ry="90" collide="false">`);
  assert.equal(model(active,`facade-${east.id}`),undefined);
  assert.equal(model(worldDocument(world),`facade-${west.id}`),undefined);

  const proxy = /<m-cube y="[^"]+" width="3.15" height="2.65" depth="1.5" color="#435366" opacity="0" cast-shadows="false">/g;
  assert.equal([...active.matchAll(proxy)].length,1);
  const door = new RegExp(`<m-group id="entrance-${west.id}" x="[^"]+">`);
  assert.equal(active.match(door)[0],worldDocument(world).match(door)[0]);
  assert.deepEqual(exteriorDoor(world.houses.directory()[0]),
    {x:-2.075,y:.11,z:15.5,facing:-1});
});

test('the torus replaces the west miniature with the residence and keeps the east facade on its larger plot', () => {
  const world=room();
  const art={houseVisual:()=>({facade,miniature})};
  const ring=worldDocument(world,{...art,toroidalHouse:west.id});
  const valley=worldDocument(world,{...art,valleyHouse:west.id});
  assert.ok(!ring.includes(west.id));
  assert.match(model(ring,`facade-${east.id}`),/ y="0" z="0" ry="-90" collide="false"/);
  assert.match(ring,/<m-group id="parcel-east-1" x="55" z="15.5">/);
  assert.match(model(valley,`facade-${west.id}`),/ y="0.1" z="0" ry="90" collide="false"/);
  assert.ok(ring.includes(`id="entrance-${east.id}"`));
  assert.ok(!valley.includes(`id="entrance-${east.id}"`));
  assert.doesNotMatch(ring,/id="house-commons"/);
});

test('invalid or out-of-parcel art keeps the legacy facade and omits only an invalid miniature', () => {
  const world = room(), legacy = worldDocument(world);
  const crossing = {...facade,bounds:{...facade.bounds,max:[1.01,2.75,1.66]}};
  assert.equal(worldDocument(world,{houseVisual:()=>({facade:crossing,miniature})}),legacy);
  assert.equal(worldDocument(world,{houseVisual:()=>({facade:{...facade,asset:'../private.glb'}})}),legacy);

  const invalidMiniature = {...miniature,at:[-1.8,0,.8]};
  const active = worldDocument(world,{houseVisual:({id}) =>
    id===east.id ? {facade,miniature:invalidMiniature} : null});
  assert.match(model(active,`facade-${east.id}`),/ry="-90" collide="false"/);
  assert.equal(model(active,`miniature-${east.id}`),undefined);
});

test('garden art layers over the original scene without altering gameplay topology', () => {
  const world = room(), basePath = '/holodeck/';
  const legacy = worldDocument(world,{basePath});
  const gardenVisual = {asset:'garden.glb',x:22,y:.105,z:-2,sx:.8,sy:1,sz:.7};
  const active = worldDocument(world,{basePath,gardenVisual});
  const garden = `<m-model id="authored-garden" src="/holodeck/assets/garden.glb" x="22" y="0.105" z="-2" sx="0.8" sy="1" sz="0.7" collide="false"></m-model>`;
  assert.equal(active.replace(garden,''),legacy);
  assert.notEqual(active,legacy);
  for (const invalid of [{asset:'https://public.invalid/garden.glb'},{sx:0},{sy:-1},{sz:NaN},{z:Infinity}]) {
    assert.equal(worldDocument(world,{basePath,gardenVisual:{...gardenVisual,...invalid}}),legacy);
  }
});

test('cold dressing delays only cosmetic source attributes', () => {
  const world = room();
  const art = {basePath:'/holodeck/',houseVisual:({id})=>id===west.id?{facade,miniature}:null,
    gardenVisual:{asset:'garden.glb',x:22,y:.105,z:-2,sx:.8,sy:1,sz:.7},sceneryAsset:'island.glb',
    commonsVisual:{asset:'commons.glb',colliders:'<m-cube id="commons-step"></m-cube>',
      parcelGarden:{asset:'parcel-garden.glb',revision:'a'.repeat(64),colliders:'<m-cube id="garden-wall"></m-cube>'},
      parcelTerrain:{asset:'parcel-terrain.glb',revision:'b'.repeat(64)}}};
  const eager = worldDocument(world,art);
  const cold = worldDocument(world,{...art,deferDressing:true});
  assert.equal(cold.replaceAll('data-deferred-src=','src='),eager);
  const deferred = [...cold.matchAll(/<m-model id="([^"]+)" data-deferred-src=/g)].map(([,id])=>id);
  assert.deepEqual(deferred,['authored-garden','parcel-garden',`facade-${west.id}`,`miniature-${west.id}`]);
});
