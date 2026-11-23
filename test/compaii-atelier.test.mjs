import {once} from 'node:events';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ATELIER_PROFILE,ATELIER_ROOMS,selectAtelier} from '../src/compaii-atelier.mjs';
import {COMPAII_HOUSE,interiorArt} from '../src/interior-art.mjs';
import {Room} from '../src/room.mjs';
import {Houses,HOUSE_GROUND,HOUSE_PLOTS} from '../src/houses.mjs';
import {TERRACES,CREATION_AREAS} from '../src/world-layout.mjs';
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
  const exterior=new Room({houses:new Houses({state:{schema:'holodeck.houses/v1',houses:[house],receipts:[]}})});
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
  assert.match(authored,/<m-model id="authored-garden" src="\/holodeck\/assets\/compaii-atelier-garden\.glb\?v=[a-f0-9]{12}" x="0" y="0" z="0" sx="1" sy="1" sz="1" collide="false">/);
  const east=authored.match(/<m-group id="authored-garden-colliders">([^]*?)<\/m-group>/)[1];
  const fixtures=[...east.matchAll(/<m-cube x="([^"]+)" y="[^"]+" z="([^"]+)" width="([^"]+)" height="[^"]+" depth="([^"]+)"/g)];
  const eastTerrace=TERRACES.find(item=>item.id==='garden'),eastField=CREATION_AREAS.find(item=>item.id==='garden');
  assert.equal(fixtures.length,13);
  for(const [, ...bounds] of fixtures){
    const [x,z,w,d]=bounds.map(Number);
    assert.ok(z-d/2>eastField.maxZ||z+d/2<eastField.minZ);
    assert.ok(Math.hypot(Math.abs(x-eastTerrace.x)+w/2,Math.abs(z-eastTerrace.z)+d/2)<eastTerrace.radius);
  }
  assert.match(authored,/<m-model id="mirador" src="\/holodeck\/assets\/mirador\.glb\?v=[a-f0-9]{12}" collide="false">/);
  assert.doesNotMatch(fallback,/mirador\.glb|mirador-colliders/);
  assert.doesNotMatch(authored,/north-bridge-finish/);
  const visitor={id:'human:bridge-art',kind:'human',rights:['observe','edit']};
  const observation=exterior.observe(visitor);
  const action=exterior.command(visitor,{id:crypto.randomUUID(),issuedAt:exterior.clock(),run:exterior.run,
    edition:exterior.edition,observation:observation.id,type:'bridge.set',target:'bridge',
    expectedRevision:observation.entities.bridge.revision,args:{raised:true}});
  assert.equal(action.status,'completed');
  const raised=worldDocument(exterior,{basePath:'/holodeck/',...profile});
  assert.match(raised,/<m-model id="north-bridge-finish" src="\/holodeck\/assets\/north-bridge\.glb\?v=[a-f0-9]{12}" collide="false">/);
  assert.doesNotMatch(worldDocument(exterior),/north-bridge-finish/);
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
  const station=profile.interiorArtwork(source.get(lab)).station;
  assert.equal(station.id,interiorArt(source.get(lab)).station.id);
  assert.deepEqual(station.pin,interiorArt(source.get(lab)).station.pin);
  assert.deepEqual(station.position,{x:-.44,y:.1,z:.59});
  assert.equal(station.revision,2);
});

test('packaged profile keeps exact gallery and lab bytes behind current room rights',async t=>{
  const stateDir=mkdtempSync(join(tmpdir(),'holodeck-atelier-'));
  t.after(()=>rmSync(stateDir,{recursive:true,force:true}));
  const store=new RoomStore(join(stateDir,'houses'));
  const expected={schema:'holodeck.houses/v1',receipts:[],houses:[house]};
  store.save(expected);
  let prototypeAccess=true;
  let galleryAccess=true,towerAccess=true,towerReturnAccess=true;
  const runtime=await createHolodeck({stateDir,basePath:'/holodeck/',artProfile:ATELIER_PROFILE,
    interiorSpaces:definitions,
    interiorGuestAccess:(actor,room)=>actor.id==='human:lab'?room!==gallery||galleryAccess:
      (room!==tower||towerAccess)&&(room!==gallery||towerReturnAccess),
    galleryAuthorization:async (cookie,pin)=>prototypeAccess&&cookie.includes('fixture=lab')&&
      pin.revision==='published-935e6262-organic-head',
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
    const postMove=(from,to)=>fetch(base+'api/space',{headers,method:'POST',body:JSON.stringify({from,to,live:1})});
    return {read:path=>fetch(origin+path,{headers}),postMove,
      move:async(from,to)=>{
        const result=await postMove(from,to);
        assert.equal(result.status,200);
        return result.json();
      }};
  }
  const [authorized,visitor]=await Promise.all([actor('lab'),actor('gallery')]);
  const liveLocation=actor=>actor.read('/holodeck/api/space?live=1').then(response=>response.json());
  const exteriorSky=(await liveLocation(visitor)).outdoorSky;
  assert.equal(exteriorSky.asset,'coastal-sky.jpg');
  assert.match(exteriorSky.revision,/^[a-f0-9]{64}$/);
  const entered=await authorized.move('outside',foyer);
  assert.equal(entered.outdoorSky,undefined);
  assert.match(entered.scene.markup,/vestibule-practical/);
  assert.match(entered.scene.markup,/<m-cube x="-5\.13" y="0\.341" z="1\.18" width="0\.88" height="0\.482" depth="2\.91" opacity="0" cast-shadows="false">/);
  assert.match(entered.scene.markup,/<m-group id="passage-0" x="-3" z="-5\.86" ry="0"><\/m-group>/);
  assert.deepEqual(entered.exits[0].door,{x:-3,y:.11,z:-4.81,yaw:180});
  const foyerResponse=await authorized.read(roomArt(entered));
  assert.equal(foyerResponse.status,200);
  const foyerBytes=Buffer.from(await foyerResponse.arrayBuffer());
  const document=JSON.parse(foyerBytes.toString('utf8',20,20+foyerBytes.readUInt32LE(12)));
  const lamp=document.materials.find(material=>material.name==='Honey lamp glass');
  assert.ok(lamp.extensions.KHR_materials_emissive_strength.emissiveStrength>2);
  assert.equal(lamp.emissiveTexture,undefined);
  const galleryEntrySign=document.materials.find(material=>material.name==='Gallery entry sign ivory');
  assert.ok(galleryEntrySign?.emissiveFactor.every(channel=>channel>0));
  assert.equal(galleryEntrySign.pbrMetallicRoughness.baseColorTexture,undefined);
  const baked=document.materials.filter(material=>material!==lamp&&material!==galleryEntrySign);
  const atlases=new Set(baked.map(material=>{
    const {index,texCoord=0}=material.emissiveTexture;
    assert.equal(texCoord,material.pbrMetallicRoughness.baseColorTexture.texCoord??0);
    return document.textures[index].source;
  }));
  assert.equal(atlases.size,1);
  assert.equal(document.images[atlases.values().next().value].mimeType,'image/jpeg');
  galleryAccess=false;
  const foyerWithoutGallery=await liveLocation(authorized);
  assert.equal(foyerWithoutGallery.id,foyer);
  assert.deepEqual(foyerWithoutGallery.exitDoor,entered.exitDoor);
  assert.deepEqual(foyerWithoutGallery.exits,[]);
  assert.doesNotMatch(foyerWithoutGallery.scene.markup,/id="passage-0"|Galería/);
  assert.notEqual(roomArt(foyerWithoutGallery),roomArt(entered));
  assert.equal((await authorized.read(roomArt(entered))).status,404);
  const baseFoyer=await authorized.read(roomArt(foyerWithoutGallery));
  assert.equal(baseFoyer.status,200);
  const baseBytes=Buffer.from(await baseFoyer.arrayBuffer());
  const baseDocument=JSON.parse(baseBytes.toString('utf8',20,20+baseBytes.readUInt32LE(12)));
  assert.ok(!baseDocument.materials.some(material=>material.name==='Gallery entry sign ivory'));
  galleryAccess=true;
  const open=await authorized.move(foyer,gallery);
  assert.equal((await authorized.read(roomArt(entered))).status,404);
  await visitor.move('outside',foyer);
  const sealed=await visitor.move(foyer,gallery);
  const openPath=roomArt(open),sealedPath=roomArt(sealed);
  assert.deepEqual(entered.keyLight,{position:[4.87,3.15,1.75],target:[-2.30,.80,-2.3],color:'#ffe3bf',intensity:87});
  assert.deepEqual(open.keyLight,{position:[-4.82,3.62,.5],target:[2.45,1.05,.5],color:'#cde3ff'});
  assert.deepEqual(sealed.keyLight,open.keyLight);
  assert.deepEqual(sealed.objects,open.objects);
  assert.deepEqual(sealed.objects.map(object=>object.id),['gallery-finished-plinth','gallery-work-plinth','gallery-archive-plinth']);
  assert.ok(sealed.objects.every(object=>object.kind==='fixture'&&Number.isSafeInteger(object.revision)));
  assert.doesNotMatch(JSON.stringify(sealed.objects),/reviewId|tableId|publicationVersion|pin/);
  assert.notEqual(openPath,sealedPath);
  assert.ok(open.exits.some(exit=>exit.to===lab));
  assert.ok(!sealed.exits.some(exit=>exit.to===lab));
  for(const galleryView of [open,sealed]){
    assert.deepEqual(galleryView.exits.find(exit=>exit.to===foyer)?.door,{x:-3,y:.11,z:-4.81,yaw:180});
    assert.match(galleryView.scene.markup,/<m-group id="passage-0" x="-3" z="-5\.86" ry="0"><\/m-group>/);
    assert.deepEqual(galleryView.exits.find(exit=>exit.to===tower)?.door,{x:4.81,y:.11,z:-3,yaw:90});
    const portal=galleryView.scene.markup.match(/<m-group id="passage-2"[^>]*>(.*?)<\/m-group>/s)?.[1];
    assert.match(portal,/<m-label[^>]*z="0.438"[^>]*content="Torre"/);
    assert.match(portal,/<m-light[^>]*type="point"/);
    assert.doesNotMatch(portal,/<m-cube/);
  }
  const stairMarkup=open.scene.markup.match(/<m-group id="passage-1"[^>]*>(.*?)<\/m-group>/s)?.[1];
  assert.equal(stairMarkup?.match(/opacity="0" cast-shadows="false"/g)?.length,8);
  assert.doesNotMatch(stairMarkup,/<m-label|collide="false"/);
  assert.doesNotMatch(sealed.scene.markup,/id="passage-1"|Laboratorio/);
  const readRoomModel=async (actor,path)=>{
    const result=await actor.read(path);
    assert.equal(result.status,200);
    const bytes=Buffer.from(await result.arrayBuffer());
    return JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  };
  const openModel=await readRoomModel(authorized,openPath);
  const lettering=openModel.materials.find(material=>material.name==='Laboratory sign ivory');
  assert.ok(lettering);
  assert.equal(lettering.pbrMetallicRoughness.baseColorTexture,undefined);
  const [red,,blue]=lettering.pbrMetallicRoughness.baseColorFactor;
  assert.ok(red>blue&&blue>0);
  assert.equal((await authorized.read(sealedPath)).status,404);
  assert.equal((await visitor.read(openPath)).status,404);
  const sealedModel=await readRoomModel(visitor,sealedPath);
  assert.ok(!sealedModel.materials.some(material=>material.name==='Laboratory sign ivory'));
  for(const model of [openModel,sealedModel]){
    const sign=model.materials.find(material=>material.name==='Foyer sign ivory');
    assert.ok(sign);
    assert.equal(sign.pbrMetallicRoughness.baseColorTexture,undefined);
    assert.ok(sign.emissiveFactor.every(channel=>channel>0));
  }
  const chamber=await authorized.move(gallery,lab);
  assert.deepEqual(chamber.exits[0].door,{x:-3,y:.95,z:-5.52,yaw:180});
  const returnMarkup=chamber.scene.markup.match(/<m-group id="passage-0"[^>]*>(.*?)<\/m-group>/s)?.[1];
  assert.equal(returnMarkup?.match(/opacity="0" cast-shadows="false"/g)?.length,8);
  assert.doesNotMatch(returnMarkup,/<m-label|collide="false"/);
  const chamberPath=roomArt(chamber);
  const returnModel=await readRoomModel(authorized,chamberPath);
  const returnSign=returnModel.materials.find(material=>material.name==='Gallery return sign ivory');
  assert.ok(returnSign?.emissiveFactor.every(channel=>channel>0));
  assert.equal(returnSign.pbrMetallicRoughness.baseColorTexture,undefined);
  galleryAccess=false;
  const emergency=await liveLocation(authorized);
  assert.equal(emergency.id,lab);
  assert.equal(emergency.emergencyExit,true);
  assert.deepEqual(emergency.exits,[]);
  assert.doesNotMatch(emergency.scene.markup,/id="passage-0"|Galería/);
  assert.notEqual(roomArt(emergency),chamberPath);
  const emergencyModel=await readRoomModel(authorized,roomArt(emergency));
  assert.ok(!emergencyModel.materials.some(material=>material.name==='Gallery return sign ivory'));
  assert.equal((await authorized.read(chamberPath)).status,404);
  galleryAccess=true;
  assert.deepEqual(chamber.keyLight,{position:[-.44,4.35,1.9],target:[-.44,1.07,1.9],color:'#ffe0b6',intensity:68});
  assert.match(chamber.scene.markup,/id="spatializer-practical"/);
  assert.match(chamber.scene.markup,/id="weaver-practical"/);
  assert.deepEqual(chamber.objects.map(object=>object.id),['beacon-prototypes','beacon-spatializer','beacon-weaver']);
  assert.match(chamber.scene.markup,/id="beacon-spatializer"/);
  assert.match(chamber.scene.markup,/id="beacon-weaver"/);
  const prototype=chamber.objects.find(object=>object.id==='beacon-prototypes');
  assert.deepEqual(prototype,{id:'beacon-prototypes',kind:'workstation',title:'Banco de prototipos',
    position:{x:-.44,y:.1,z:.59},revision:2});
  assert.match(chamber.scene.markup,/<m-group id="beacon-prototypes" x="-0\.44" z="0\.59">\s*<\/m-group>/);
  assert.doesNotMatch(chamber.scene.markup,/guitar-review|Banco de prototipos/);
  const catalogPath='/holodeck/api/space/content-visits';
  const [visit]=(await (await authorized.read(catalogPath)).json()).visits;
  assert.deepEqual(visit.position,prototype.position);
  assert.equal(visit.nodeRevision,prototype.revision);
  assert.deepEqual(visit.pin,interiorArt(definitions.find(room=>room.id===lab)).station.pin);
  prototypeAccess=false;
  assert.deepEqual((await (await authorized.read(catalogPath)).json()).visits,[]);
  assert.ok(!sealed.objects.some(object=>object.id.startsWith('beacon-')));
  const interior={id:'capture-atelier',run:runtime.room.run,edition:runtime.room.edition,
    sequence:runtime.room.sequence,capturedAt:123,place:{...chamber,participants:[]}};
  const capture=(revision,id='beacon-weaver')=>captureNativeSituation(runtime.room,{id:'human:lab'},
    {id:'message-lab',view:{spaceId:lab,roomObject:{id,revision}}},{interior});
  assert.equal(capture(1).referredWorkstation.title,'Weaver');
  assert.equal(capture(2).referredWorkstation,undefined);
  assert.deepEqual(capture(2,prototype.id).referredRoomObject,{...prototype,
    evidence:'client-reported reference matched the current authorized room object'});
  assert.equal(capture(1,prototype.id).referredWorkstation,undefined);
  assert.doesNotMatch(JSON.stringify(capture(1)),/localhost|harmonic_lab|csrf/i);
  const bytes=await authorized.read(roomArt(chamber));
  assert.equal(bytes.status,200);
  assert.match(bytes.headers.get('Cache-Control'),/no-store/);
  assert.equal((await visitor.read(roomArt(chamber))).status,404);
  assert.equal((await visitor.read('/holodeck/assets/compaii-atelier/beacon.glb')).status,404);
  towerAccess=false;
  const withoutTower=await liveLocation(visitor);
  assert.equal(roomArt(withoutTower),sealedPath);
  assert.ok(!withoutTower.exits.some(exit=>exit.to===tower));
  assert.doesNotMatch(withoutTower.scene.markup,/id="passage-2"|content="Torre"/);
  assert.equal((await visitor.postMove(gallery,tower)).status,409);
  assert.equal((await visitor.read('/holodeck/api/space/scene?room='+tower)).status,404);
  towerAccess=true;
  const upper=await visitor.move(gallery,tower);
  assert.deepEqual(upper.outdoorSky,exteriorSky);
  assert.deepEqual((await liveLocation(visitor)).outdoorSky,exteriorSky);
  assert.equal((await liveLocation(authorized)).outdoorSky,undefined);
  assert.match(upper.scene.markup,/tower-resonator/);
  assert.match(upper.scene.markup,/<m-cube x="0.54" y="0.65" z="5.6" width="5.63" height="0.2" depth="0.31" opacity="0" cast-shadows="false">/);
  assert.match(upper.scene.markup,/<m-group id="passage-0"[^>]*>\s*<m-label[^>]*z="0.181"[^>]*content="Galería"/);
  assert.deepEqual(upper.exits[0].door,{x:-3,y:.11,z:-4.81,yaw:180});
  const towerPath=roomArt(upper);
  assert.equal((await visitor.read(towerPath)).status,200);
  assert.equal((await authorized.read(towerPath)).status,404);
  towerReturnAccess=false;
  const closedReturn=await liveLocation(visitor);
  assert.equal(roomArt(closedReturn),towerPath);
  assert.equal(closedReturn.emergencyExit,true);
  assert.deepEqual(closedReturn.exits,[]);
  assert.doesNotMatch(closedReturn.scene.markup,/id="passage-0"|content="Galería"/);
  const reconnected=await actor('gallery');
  assert.equal((await liveLocation(reconnected)).id,tower);
  assert.equal((await reconnected.postMove(tower,gallery)).status,409);
  towerReturnAccess=true;
  assert.equal((await reconnected.move(tower,gallery)).outdoorSky,undefined);
  assert.equal((await liveLocation(reconnected)).outdoorSky,undefined);
  assert.equal((await reconnected.read(towerPath)).status,404);
  assert.deepEqual(new RoomStore(join(stateDir,'houses')).load(),expected);
});
