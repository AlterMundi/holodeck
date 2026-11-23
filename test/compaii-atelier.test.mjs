import {once} from 'node:events';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ATELIER_PROFILE,ATELIER_ROOMS,selectAtelier} from '../src/compaii-atelier.mjs';
import {COMPAII_HOUSE,interiorArt} from '../src/interior-art.mjs';
import {Room} from '../src/room.mjs';
import {HOUSE_GROUND,HOUSE_PLOTS} from '../src/houses.mjs';
import {worldDocument} from '../src/world.mjs';
import {RoomStore} from '../src/room-store.mjs';
import {createHolodeck} from '../src/server.mjs';
import {captureNativeSituation} from '../src/native-conversation.mjs';

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
  const exterior=new Room({houses:{directory:()=>[house]}});
  const authored=worldDocument(exterior,{basePath:'/holodeck/',...profile});
  const fallback=worldDocument(exterior);
  assert.match(authored,/<m-model id="house-walk" src="\/holodeck\/assets\/house-walk\.glb\?v=[a-f0-9]{12}" collide="false" cast-shadows="false">/);
  assert.doesNotMatch(fallback,/house-walk\.glb/);
  assert.match(authored,/<m-model id="parcel-terrain" src="\/holodeck\/assets\/parcel-terrace\.glb\?v=[a-f0-9]{12}" collide="false" cast-shadows="false">/);
  assert.doesNotMatch(fallback,/parcel-terrace\.glb/);
  const proxies=markup=>markup.match(/<m-cube id="house-(?:approach|commons)"[^>]+>/g);
  assert.equal(proxies(authored).length,2);
  assert.ok(proxies(authored).every(cube=>cube.endsWith(' opacity="0" cast-shadows="false">')));
  assert.deepEqual(proxies(authored).map(cube=>cube.replace(' opacity="0" cast-shadows="false"','')),
    proxies(fallback));
  const plots=markup=>markup.match(/<m-group id="parcel-(?:west|east)-[1-4]"[^>]+>/g);
  assert.equal(plots(authored).length,8);
  assert.deepEqual(plots(authored),plots(fallback));
  assert.match(authored,/<m-model id="parcel-garden" src="\/holodeck\/assets\/parcel-garden\.glb\?v=[a-f0-9]{12}" collide="false">/);
  assert.doesNotMatch(fallback,/parcel-garden\.glb/);
  assert.match(authored,/<m-model id="mirador" src="\/holodeck\/assets\/mirador\.glb\?v=[a-f0-9]{12}" collide="false">/);
  assert.doesNotMatch(fallback,/mirador\.glb|mirador-colliders/);
  const mirador=authored.match(/<m-group id="mirador-colliders">([^]*?)<\/m-group>/)[1];
  const seating=[...mirador.matchAll(/<m-cube x="([^"]+)" y="[^"]+" z="([^"]+)" width="([^"]+)"/g)];
  assert.equal(seating.length,4);
  assert.ok(seating.every(([,x,z,width])=>Math.abs(Number(x))-Number(width)/2>1.4&&Number(z)<-16.9));
  assert.match(authored,/<m-model id="gallery-island" src="\/holodeck\/assets\/gallery-island\.glb\?v=[a-f0-9]{12}" collide="false">/);
  const visit=markup=>markup.match(/<m-group id="content-reading-room"[^>]+>[\s\S]+?<\/m-group>/)[0];
  assert.equal(visit(authored).match(/opacity="0" cast-shadows="false"/g).length,5);
  assert.match(visit(authored),/x="-22" y="0.1" z="3" data-content-node="reading-room"/);
  assert.doesNotMatch(fallback,/gallery-island\.glb/);
  assert.doesNotMatch(worldDocument(exterior,{...profile,includeVisits:false}),/gallery-island\.glb|content-reading-room/);
  const garden=authored.match(/<m-group id="parcel-garden-colliders">([^]*?)<\/m-group>/)[1];
  const obstacles=[...garden.matchAll(/<m-cube x="([^"]+)" y="[^"]+" z="([^"]+)" width="([^"]+)" height="[^"]+" depth="([^"]+)"/g)];
  assert.equal(obstacles.length,3);
  const terrace=HOUSE_GROUND.find(ground=>ground.id==='house-commons');
  for(const [, ...bounds] of obstacles){
    const [x,z,w,d]=bounds.map(Number),minX=x-w/2,maxX=x+w/2,minZ=z-d/2,maxZ=z+d/2;
    assert.ok(terrace.minX<=minX&&maxX<=terrace.maxX&&terrace.minZ<=minZ&&maxZ<=terrace.maxZ);
    assert.ok(HOUSE_PLOTS.every(plot=>maxX<=plot.x-plot.width/2||minX>=plot.x+plot.width/2||
      maxZ<=plot.z-plot.depth/2||minZ>=plot.z+plot.depth/2));
  }
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
  assert.match(entered.scene.markup,/id="passage-0" x="-3" z="-5.86"[^>]*>\s*<m-label[^>]*content="Galería"/);
  assert.deepEqual(entered.exits[0].door,{x:-3,y:.11,z:-4.81,yaw:180});
  const foyerResponse=await authorized.read(roomArt(entered));
  assert.equal(foyerResponse.status,200);
  const foyerBytes=Buffer.from(await foyerResponse.arrayBuffer());
  const document=JSON.parse(foyerBytes.toString('utf8',20,20+foyerBytes.readUInt32LE(12)));
  const lamp=document.materials.find(material=>material.name==='Honey lamp glass');
  assert.ok(lamp.extensions.KHR_materials_emissive_strength.emissiveStrength>2);
  assert.equal(lamp.emissiveTexture,undefined);
  const baked=document.materials.filter(material=>material!==lamp);
  const atlases=new Set(baked.map(material=>{
    const {index,texCoord=0}=material.emissiveTexture;
    assert.equal(texCoord,material.pbrMetallicRoughness.baseColorTexture.texCoord??0);
    return document.textures[index].source;
  }));
  assert.equal(atlases.size,1);
  assert.equal(document.images[atlases.values().next().value].mimeType,'image/jpeg');
  const open=await authorized.move(foyer,gallery);
  await visitor.move('outside',foyer);
  const sealed=await visitor.move(foyer,gallery);
  const openPath=roomArt(open),sealedPath=roomArt(sealed);
  assert.deepEqual(entered.keyLight,{position:[4.87,3.15,1.75],target:[-2.30,.80,-2.3],color:'#ffe3bf',intensity:87});
  assert.deepEqual(open.keyLight,{position:[-4.82,3.62,.5],target:[2.45,1.05,.5],color:'#cde3ff'});
  assert.deepEqual(sealed.keyLight,open.keyLight);
  assert.notEqual(openPath,sealedPath);
  assert.ok(open.exits.some(exit=>exit.to===lab));
  assert.ok(!sealed.exits.some(exit=>exit.to===lab));
  assert.equal((await authorized.read(openPath)).status,200);
  assert.equal((await authorized.read(sealedPath)).status,404);
  assert.equal((await visitor.read(openPath)).status,404);
  assert.equal((await visitor.read(sealedPath)).status,200);
  const chamber=await authorized.move(gallery,lab);
  assert.deepEqual(chamber.keyLight,{position:[-.44,4.35,1.9],target:[-.44,1.07,1.9],color:'#ffe0b6',intensity:68});
  assert.match(chamber.scene.markup,/id="spatializer-practical"/);
  assert.match(chamber.scene.markup,/id="weaver-practical"/);
  assert.deepEqual(chamber.objects.map(object=>object.id),['beacon-prototypes','beacon-spatializer','beacon-weaver']);
  assert.match(chamber.scene.markup,/id="beacon-spatializer"/);
  assert.match(chamber.scene.markup,/id="beacon-weaver"/);
  assert.ok(!sealed.objects.some(object=>object.id.startsWith('beacon-')));
  const interior={id:'capture-atelier',run:runtime.room.run,edition:runtime.room.edition,
    sequence:runtime.room.sequence,capturedAt:123,place:{...chamber,participants:[]}};
  const capture=revision=>captureNativeSituation(runtime.room,{id:'human:lab'},
    {id:'message-lab',view:{spaceId:lab,workstation:{id:'beacon-weaver',revision}}},{interior});
  assert.equal(capture(1).referredWorkstation.title,'Weaver');
  assert.equal(capture(2).referredWorkstation,undefined);
  assert.doesNotMatch(JSON.stringify(capture(1)),/localhost|harmonic_lab|csrf/i);
  const bytes=await authorized.read(roomArt(chamber));
  assert.equal(bytes.status,200);
  assert.match(bytes.headers.get('Cache-Control'),/no-store/);
  assert.equal((await visitor.read(roomArt(chamber))).status,404);
  assert.equal((await visitor.read('/holodeck/assets/compaii-atelier/beacon.glb')).status,404);
  const upper=await visitor.move(gallery,tower);
  assert.match(upper.scene.markup,/tower-resonator/);
  assert.match(upper.scene.markup,/id="passage-0"[^>]*><\/m-group>/);
  assert.deepEqual(upper.exits[0].door,{x:-3,y:.11,z:-4.81,yaw:180});
  const towerPath=roomArt(upper);
  assert.equal((await visitor.read(towerPath)).status,200);
  assert.equal((await authorized.read(towerPath)).status,404);
  await visitor.move(tower,gallery);
  assert.equal((await visitor.read(towerPath)).status,404);
  assert.deepEqual(new RoomStore(join(stateDir,'houses')).load(),expected);
});
