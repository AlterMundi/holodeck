import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {houseId,exteriorDoor} from '../../src/houses.mjs';
import {Room} from '../../src/room.mjs';
import {worldDocument} from '../../src/world.mjs';
import {InteriorSpaces, interiorDocument} from '../../src/interior-spaces.mjs';
import {interiorDecoration} from './projection.mjs';

const dir=process.argv[2];
if(!dir)throw Error('Usage: node art/linterna/verify.mjs MODEL_DIRECTORY');
const dimensions=JSON.parse(await readFile(new URL('./dimensions.json',import.meta.url),'utf8'));
const report=JSON.parse(await readFile(join(dir,'linterna-models.json'),'utf8'));
const names=['facade','atlas','archive','workshop'];
for(const name of names){
  const asset=report.assets[name];
  const bytes=await readFile(join(dir,asset.file));
  assert.equal(bytes.length,asset.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
}

const actor={id:'dm:being:v1:'+'R'.repeat(43),kind:'daimon',rights:['observe','edit']};
const guest={id:'human:fixture-paired',kind:'human',rights:['observe']};
const house=houseId(actor.id);
const fixture=new Room();
const seen=fixture.observe(actor);
const facade={title:'Casa Linterna',color:'#b98f6d',...dimensions.shell};
const result=fixture.command(actor,{
  type:'house.claim',nativeRequest:'local-linterna-qualification',target:house,expectedRevision:null,id:randomUUID(),issuedAt:Date.now(),
  observation:seen.id,run:seen.run,edition:seen.edition,args:{parcel:'parcel-east-1',facade},
});
assert.equal(result.status,'completed');
const block=worldDocument(fixture,{houseVisual:()=>({facade:{asset:report.assets.facade.file,bounds:report.assets.facade.bounds}})});
assert.match(block,/linterna-facade\.glb[^>]+ry="-90"/);
assert.deepEqual(exteriorDoor(fixture.houses.directory()[0]),{x:2.05,y:.11,z:15.5,facing:1});

const rooms=names.slice(1);
const definitions=rooms.map((id,index)=>({
  id,house,title:id,level:0,entry:index===0,guests:[guest.id],
  links:index===0?[{kind:'door',to:'archive'},{kind:'door',to:'workshop'}]:[{kind:'door',to:'atlas'}],
}));
const spaces=new InteriorSpaces({definitions,houses:fixture.houses});
for(const visitor of [actor,guest]){
  for(const id of ['atlas','archive','atlas','workshop','atlas','outside']){
    const moved=spaces.move(visitor,{from:spaces.current(visitor),to:id});
    assert.equal(moved?.id,id);
  }
}
for(const id of rooms){
  const cell=definitions.find(room=>room.id===id);
  const source='/art/'+report.assets[id].file;
  const view=spaces.view(actor,id);
  const decor=interiorDecoration(id,dimensions.rooms[id],source);
  const markup=interiorDocument(cell,view.exits,null,decor);
  assert.ok(markup.includes(source));
  assert.ok(!markup.includes('id="room-marker"'));
  assert.equal(view.exits.length,cell.links.length);
  assert.equal((markup.match(/id="passage-/g)||[]).length,cell.links.length);
  if(id==='workshop')assert.deepEqual(view.objects.find(value=>value.id==='room-marker')?.position,{x:0,y:.45,z:-2});
}
console.log('Verified exact model digests, East 1 facade rotation, both local identities’ entry and return, modeled collider ingredients and retained Atelier anchor.');
