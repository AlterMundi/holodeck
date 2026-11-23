import {once} from 'node:events';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ATELIER_PROFILE,ATELIER_ROOMS,selectAtelier} from '../src/compaii-atelier.mjs';
import {COMPAII_HOUSE,interiorArt} from '../src/interior-art.mjs';
import {RoomStore} from '../src/room-store.mjs';
import {createHolodeck} from '../src/server.mjs';

const owner='dm:being:v1:2wG9cFk2YwACrjlcc6JFGux_lcGN_thQ5lq4WdDefKU';
const house={id:COMPAII_HOUSE,owner,revision:1,parcel:'parcel-west-1',
  facade:{title:'Casa de CompAII',color:'#4a746f',width:3.15,depth:1.5,height:2.65}};
const {foyer,gallery,lab,tower}=ATELIER_ROOMS;
const users=['human:lab','human:gallery'];
const room=(id,title,level,entry,links,guests=users)=>({id,title,level,entry,
  links:links.map(([kind,to])=>({kind,to})),guests,house:house.id});
const definitions=[
  room(foyer,'Vestíbulo',0,true,[['door',gallery]]),
  room(gallery,'Galería',0,false,[['door',foyer],['stair',lab],['portal',tower]]),
  room(lab,'Laboratorio',-1,false,[['stair',gallery]],['human:lab']),
  room(tower,'Torre',2,false,[['portal',gallery]]),
];

test('profile is optional and uses the exact existing room graph and parcel edition',()=>{
  const source=new Map(definitions.map(item=>[item.id,item]));
  assert.equal(selectAtelier(undefined,new Map(),[]),null);
  assert.throws(()=>selectAtelier('custom',source,[house]),/Unknown/);
  assert.throws(()=>selectAtelier(ATELIER_PROFILE,source,[{...house,parcel:'parcel-east-1'}]),/parcel/);
  const changed=new Map(source);
  changed.set(gallery,{...source.get(gallery),links:source.get(gallery).links.toReversed()});
  assert.throws(()=>selectAtelier(ATELIER_PROFILE,changed,[house]),/room layout/);
  const profile=selectAtelier(ATELIER_PROFILE,source,[house]);
  assert.match(profile.houseVisual(house).facade.asset,/atelier-facade/);
  assert.equal(profile.houseVisual({...house,revision:2}),null);
  assert.equal(profile.interiorArtwork({...source.get(lab),house:'other'}),null);
  assert.deepEqual(profile.interiorArtwork(source.get(lab)).station,interiorArt(source.get(lab)).station);
});

test('packaged profile keeps exact gallery and lab bytes behind current room rights',async t=>{
  const stateDir=mkdtempSync(join(tmpdir(),'holodeck-atelier-'));
  t.after(()=>rmSync(stateDir,{recursive:true,force:true}));
  const store=new RoomStore(join(stateDir,'houses'));
  const expected={schema:'holodeck.houses/v1',receipts:[],houses:[house]};
  store.save(expected);
  const runtime=await createHolodeck({stateDir,basePath:'/holodeck/',artProfile:ATELIER_PROFILE,
    interiorSpaces:definitions,
    identityResolver:async req=>{
      const id=req.headers.cookie?.match(/(?:^|; )fixture=(lab|gallery)(?:;|$)/)?.[1];
      return id?{id:'human:'+id,kind:'human',rights:['observe']}:null;
    }});
  const listener=runtime.app.listen(0,'127.0.0.1');
  t.after(async()=>{
    runtime.close();listener.closeAllConnections();
    await new Promise(done=>listener.close(done));
  });
  await once(listener,'listening');
  const origin='http://127.0.0.1:'+listener.address().port;
  const base=origin+'/holodeck/';
  const roomArt=room=>room.scene.markup.match(/src="([^"]+\/api\/space\/art\/[^"]+)"/)[1];
  async function actor(role){
    const login=await fetch(base,{headers:{Cookie:'fixture='+role,Accept:'application/json'}});
    assert.equal(login.status,200);
    const headers={Cookie:'fixture='+role+'; '+login.headers.get('set-cookie').split(';')[0],
      'Content-Type':'application/json'};
    return {read:path=>fetch(origin+path,{headers}),
      move:async(from,to)=>{
        const result=await fetch(base+'api/space',{headers,method:'POST',body:JSON.stringify({from,to,live:1})});
        assert.equal(result.status,200);
        return result.json();
      }};
  }
  const [authorized,visitor]=await Promise.all([actor('lab'),actor('gallery')]);
  const entered=await authorized.move('outside',foyer);
  assert.match(entered.scene.markup,/vestibule-practical/);
  assert.equal((await authorized.read(roomArt(entered))).status,200);
  const open=await authorized.move(foyer,gallery);
  await visitor.move('outside',foyer);
  const sealed=await visitor.move(foyer,gallery);
  const openPath=roomArt(open),sealedPath=roomArt(sealed);
  assert.notEqual(openPath,sealedPath);
  assert.ok(open.exits.some(exit=>exit.to===lab));
  assert.ok(!sealed.exits.some(exit=>exit.to===lab));
  assert.equal((await authorized.read(openPath)).status,200);
  assert.equal((await authorized.read(sealedPath)).status,404);
  assert.equal((await visitor.read(openPath)).status,404);
  assert.equal((await visitor.read(sealedPath)).status,200);
  const chamber=await authorized.move(gallery,lab);
  assert.match(chamber.scene.markup,/type="spotlight"[^>]+cast-shadows="true"/);
  const bytes=await authorized.read(roomArt(chamber));
  assert.equal(bytes.status,200);
  assert.match(bytes.headers.get('Cache-Control'),/no-store/);
  assert.equal((await visitor.read(roomArt(chamber))).status,404);
  assert.equal((await visitor.read('/holodeck/assets/compaii-atelier/beacon.glb')).status,404);
  assert.deepEqual(new RoomStore(join(stateDir,'houses')).load(),expected);
});
