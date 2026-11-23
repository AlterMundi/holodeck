import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import net from 'node:net';
import WebSocket from 'ws';
import {UserNetworkingClient} from '@mml-io/3d-web-user-networking';
import {experienceClientSubProtocols,experienceProtocolToDeltaNetSubProtocol} from '@mml-io/3d-web-experience-protocol';
import {createHolodeck} from '../src/server.mjs';
import {exteriorDoor,houseId} from '../src/houses.mjs';
import {RoomStore, RoomCommitUncertain} from '../src/room-store.mjs';
import {InteriorSpaces} from '../src/interior-spaces.mjs';

const owner='dm:being:v1:'+'x'.repeat(43);
const guest={id:'human:guest',kind:'human',rights:['observe']};
const house={id:houseId(owner),owner,revision:1,parcel:'parcel-west-1',
  facade:{color:'#226655',title:'House',width:2,depth:1,height:2}};
const room=(id,title,level,entry,links,guests=[guest.id])=>({id,title,level,entry,links,guests,house:house.id});
const definitions=[
  room('foyer','Foyer',0,true,[{kind:'door',to:'gallery'},{kind:'stair',to:'lab'}]),
  room('gallery','Gallery',0,false,[{kind:'door',to:'foyer'},{kind:'portal',to:'lab'}]),
  room('lab','Secret Laboratory',-1,false,[{kind:'stair',to:'foyer'},{kind:'portal',to:'gallery'}],[]),
];

test('room links, scoped discovery, durable moves and uncertain saves',()=>{
  const houses={directory:()=>[house]};
  assert.throws(()=>new InteriorSpaces({houses,definitions:definitions.slice(0,1)}),/reciprocal/);
  let saved,clock=123,fail=false,allowed=true;
  const spaces=new InteriorSpaces({houses,definitions,clock:()=>clock,guestAccess:()=>allowed,
    persist:state=>{saved=state;if(fail)throw new RoomCommitUncertain(Error('sync'));}});
  assert.equal(spaces.move(guest,{from:'outside',to:'lab'}),null);
  const entrance=spaces.view(guest).entrances[0];
  assert.deepEqual(entrance,{id:'foyer',title:house.facade.title,door:exteriorDoor(house)});
  assert.deepEqual(entrance.door,{x:-2.65,y:.11,z:15.5,facing:-1});
  assert.equal(spaces.move(guest,{from:'outside',to:'foyer'}).id,'foyer');
  assert.equal(spaces.view(guest).exitDoor.z,4.9);
  assert.deepEqual(spaces.view(guest).exteriorDoor,entrance.door);
  assert.deepEqual(spaces.view(guest).exits.map(edge=>edge.to),['gallery']);
  assert.equal(new InteriorSpaces({houses,definitions,state:saved,clock:()=>clock}).current(guest),'foyer');
  fail=true;
  assert.throws(()=>spaces.move(guest,{from:'foyer',to:'gallery'}),RoomCommitUncertain);
  assert.equal(spaces.current(guest),'foyer');
  assert.equal(spaces.move(guest,{from:'foyer',to:'outside'}),null);
  assert.equal(new InteriorSpaces({houses,definitions,state:saved,clock:()=>clock}).current(guest),'gallery');
  allowed=false;
  assert.deepEqual(spaces.view(guest),{id:'outside',entrances:[]});
  allowed=true;clock+=30*60*1000;
  assert.equal(spaces.current(guest),'outside');
  const disconnected = new InteriorSpaces({houses,definitions,state:saved,
    clock:()=>123,guestAccess:(_actor,room)=>room!=='foyer'});
  assert.equal(disconnected.view(guest).id,'gallery');
  assert.equal(disconnected.view(guest).emergencyExit,true);
  assert.equal(disconnected.move(guest,{from:'gallery',to:'outside'}).id,'outside');
});

test('HTTP, real geometry upgrades and native observation share active room and current grants',async()=>{
  const stateDir=mkdtempSync(join(tmpdir(),'holodeck-spaces-')),socketPath=join(stateDir,'native.sock'),foreignSocket=join(stateDir,'foreign.sock');
  const foreignBeing='dm:being:v1:'+'z'.repeat(43);
  new RoomStore(join(stateDir,'houses')).save({schema:'holodeck.houses/v1',houses:[house],receipts:[]});
  let allowed=true,nativeAllowed=true,foyerAccess=true,runtime,listener;
  const clients=[],peers=[];
  async function start(){
    runtime=await createHolodeck({production:true,basePath:'/holodeck/',publicOrigin:'https://world.test',stateDir,
      interiorSpaces:definitions.map(room=>room.id==='foyer'?{...room,guests:[...room.guests,'human:viewer',foreignBeing]}:
        room.id==='gallery'?{...room,guests:[...room.guests,foreignBeing]}:room),
      interiorGuestAccess:(actor,room)=>actor.id==='human:viewer'||(allowed&&(room!=='foyer'||foyerAccess)),
      worldPorts:[{socket:socketPath,beingRef:owner},{socket:foreignSocket,beingRef:foreignBeing}],nativeFactory:()=>({availability:async()=>({available:false}),authorizeWorldRequest(){throw Error('test');}}),
      ownNative:true,nativeRoomAuthority:async()=>nativeAllowed?['observe','edit','project']:[],
      identityResolver:async req=>{
        const id=req.headers.cookie?.match(/(?:^|; )home=(guest|viewer|foreign|owner)/)?.[1];
        return id?{id:id==='owner'?owner:'human:'+id,kind:id==='owner'?'daimon':'human',rights:['observe'],name:id}:null;
      }});
    listener=runtime.app.listen(0,'127.0.0.1');await once(listener,'listening');
    return `http://127.0.0.1:${listener.address().port}/holodeck/`;
  }
  async function stop(){
    for(const peer of peers.splice(0))peer.stop();
    for(const client of clients)client.terminate();
    runtime.close();listener.closeAllConnections();await new Promise(resolve=>listener.close(resolve));
  }
  async function native(operation,args,path=socketPath){
    const socket=net.createConnection(path);
    await once(socket,'connect');socket.write(JSON.stringify({ownNative:true,operation,args})+'\n');
    let response='';for await(const chunk of socket)response+=chunk;
    return JSON.parse(response);
  }
  let base=await start();
  try{
    async function auth(name){
      const cookie='home='+name;
      const response=await fetch(base,{headers:{Cookie:cookie,Accept:'application/json'}});
      return {cookie:cookie+'; '+response.headers.get('set-cookie').split(';')[0],
        token:(await response.json()).sessionToken};
    }
    const headers=Cookie=>({Cookie,Origin:'https://world.test','Content-Type':'application/json'});
    const personAuth=await auth('guest'),viewerAuth=await auth('viewer');
    const person=personAuth.cookie,viewer=viewerAuth.cookie,foreign=(await auth('foreign')).cookie;
    const read=(cookie,path='space')=>fetch(base+'api/'+path,{headers:headers(cookie)});
    const move=(cookie,from,to)=>fetch(base+'api/space',{method:'POST',headers:headers(cookie),body:JSON.stringify({from,to})});
    const connect=(path,cookie,protocol='networked-dom-v0.2.1')=>{
      const ws=new WebSocket(base.replace('http:','ws:')+path,protocol,{headers:headers(cookie)});
      clients.push(ws);return ws;
    };
    const denied=async(path,cookie,protocol)=>assert.equal((await once(connect(path,cookie,protocol),'close'))[0],1008);
    function presence(scope,{cookie,token}){
      const path='spaces/'+scope+'/network',users=new Set(),record={users,identity:null};
      const peer=new UserNetworkingClient({url:base.replace('http:','ws:')+path,sessionToken:token,
        websocketFactory:()=>connect(path,cookie,[...experienceClientSubProtocols]),statusUpdateCallback:()=>{},
        assignedIdentity:id=>{record.identity=id;},onServerError:error=>{record.error=error;},
        resolveProtocol:experienceProtocolToDeltaNetSubProtocol,onUpdate:update=>{
          for(const id of update.addedConnectionIds.keys())users.add(id);
          for(const id of update.removedConnectionIds)users.delete(id);
        }},undefined,{position:{x:0,y:1,z:4},rotation:{eulerY:0},state:0});
      peers.push(peer);return record;
    }
    async function until(condition,description){
      for(let attempt=0;attempt<100;++attempt){
        if(condition())return;
        await new Promise(resolve=>setTimeout(resolve,25));
      }
      assert.fail(description);
    }

    assert.deepEqual(await (await read(foreign)).json(),{id:'outside',entrances:[]});
    assert.equal((await read(person)).status,200);
    assert.equal((await move(foreign,'outside','foyer')).status,409);
    await denied('spaces/foyer/world',person);
    await denied('spaces/foyer/network',foreign,'3d-web-experience-v0.1');
    assert.equal((await move(person,'outside','foyer')).status,200);
    await denied('world',person);
    await denied('spaces/gallery/world',person);
    const foyer=connect('spaces/foyer/world',person);
    const [snapshot]=await once(foyer,'message');
    assert.match(String(snapshot),/Foyer/);
    assert.match(String(snapshot),/house-exit/);
    assert.match(String(snapshot),/Gallery/);
    assert.doesNotMatch(String(snapshot),/Secret Laboratory/);
    const foyerClose=once(foyer,'close');
    assert.equal((await move(viewer,'outside','foyer')).status,200);
    const first=presence('foyer',personAuth),second=presence('foyer',viewerAuth);
    await until(()=>first.identity&&second.identity&&first.users.has(second.identity)&&second.users.has(first.identity),
      'both real MML clients should see the same-room peer');
    assert.equal(first.error||second.error,undefined);
    assert.equal((await read(person,'state')).status,409);
    assert.equal((await read(foreign,'state')).status,200);
    const prepared=await (await fetch(base+'api/space/scene?room=gallery',{headers:headers(person)})).json();
    assert.equal(prepared.actor,'human:guest');
    assert.match(prepared.markup,/id="gallery"/);
    assert.doesNotMatch(prepared.markup,/Secret Laboratory/);
    assert.equal((await fetch(base+'api/space/scene?room=lab',{headers:headers(person)})).status,404);
    assert.equal((await fetch(base+'api/space/scene?room=gallery',{headers:headers(foreign)})).status,404);
    const liveMove=await fetch(base+'api/space',{method:'POST',headers:headers(person),
      body:JSON.stringify({from:'foyer',to:'gallery',live:1,cachedRevision:prepared.revision})});
    assert.equal(liveMove.status,200);
    assert.deepEqual((await liveMove.json()).scene,{id:'gallery',actor:'human:guest',revision:prepared.revision});
    assert.equal((await foyerClose)[0],1008);
    await until(()=>!second.users.has(first.identity),'the other foyer client should see the peer depart');
    assert.equal((await (await read(viewer)).json()).participants.length,1);
    const gallery=connect('spaces/gallery/world',person);
    const gallerySnapshot=String((await once(gallery,'message'))[0]);
    assert.match(gallerySnapshot,/Gallery/);
    assert.doesNotMatch(gallerySnapshot,/house-exit|Secret Laboratory|passage-1/);
    assert.match(gallerySnapshot,/Foyer/);
    assert.match(gallerySnapshot,/passage-0/);
    const staleGallery=once(gallery,'close');
    foyerAccess=false;
    assert.equal((await (await read(person)).json()).id,'gallery');
    assert.equal((await staleGallery)[0],1008);
    const afterGrant=await (await fetch(base+'api/space?live=1',{headers:headers(person)})).json();
    assert.notEqual(afterGrant.scene.revision,prepared.revision);
    assert.doesNotMatch(afterGrant.scene.markup,/Foyer|Secret Laboratory/);
    const isolatedGallery=connect('spaces/gallery/world',person);
    const isolatedSnapshot=String((await once(isolatedGallery,'message'))[0]);
    assert.doesNotMatch(isolatedSnapshot,/Foyer|Secret Laboratory|passage-/);
    foyerAccess=true;
    assert.equal((await native('act',{type:'space.move',from:'outside',to:'foyer'})).ok,true);
    assert.equal((await native('act',{type:'space.move',from:'foyer',to:'gallery'})).ok,true);
    const holder=await auth('owner');
    const sourceId='node-qualified-project';
    const firstPin={kind:'artifact_review',tableId:'published-fixture',reviewId:'work',revision:'version-1',adapter:'interactive_3d'};
    runtime.room.nodes[sourceId]={id:sourceId,owner,revision:1,deleted:false,title:'Test project',
      shape:'portal',position:{x:0,z:0},result:{pin:firstPin},links:[]};
    const place={type:'exhibit.put',id:'receipt-fixture-one',room:'gallery',source:sourceId,sourceRevision:1,expectedRevision:null};
    assert.equal((await native('act',{type:'space.move',from:'outside',to:'foyer'},foreignSocket)).ok,true);
    assert.equal((await native('act',{type:'space.move',from:'foyer',to:'gallery'},foreignSocket)).ok,true);
    assert.equal((await native('act',place,foreignSocket)).ok,false);
    const firstExhibit=(await native('act',place)).result;
    assert.deepEqual(firstExhibit.pin,firstPin);
    assert.deepEqual((await native('result',{id:place.id})).result,firstExhibit);
    assert.equal((await native('result',{id:place.id},foreignSocket)).ok,false);
    const visit=async()=>await (await fetch(base+'api/space/content-visits',{headers:headers(person)})).json();
    assert.deepEqual((await visit()).visits[0].pin,firstPin);
    assert.equal((await fetch(base+'api/space/content-visits',{headers:headers(foreign)})).status,404);
    const secondPin={...firstPin,revision:'version-2'};
    runtime.room.nodes[sourceId]={...runtime.room.nodes[sourceId],revision:2,result:{pin:secondPin}};
    assert.deepEqual((await visit()).visits[0].pin,firstPin);
    const update={...place,id:'receipt-fixture-two',sourceRevision:2,expectedRevision:1};
    const secondExhibit=(await native('act',update)).result;
    assert.equal(secondExhibit.revision,2);
    assert.deepEqual(secondExhibit.pin,secondPin);
    assert.equal((await native('act',{...update,id:'receipt-stale-command'})).ok,false);
    assert.deepEqual((await native('result',{id:place.id})).result,firstExhibit);
    assert.deepEqual((await visit()).visits[0].pin,secondPin);
    const ownerGeometry=connect('spaces/gallery/world',holder.cookie);
    const ownerSnapshot=String((await once(ownerGeometry,'message'))[0]);
    assert.match(ownerSnapshot,/Secret Laboratory|house-exhibit/);
    assert.match(ownerSnapshot,/house-exhibit/);
    assert.doesNotMatch(ownerSnapshot,/published-fixture|version-2/);
    assert.match(ownerSnapshot,/passage-1/);
    assert.equal((await native('act',{type:'space.move',from:'gallery',to:'lab'})).ok,true);
    const observation=await native('observe',{});
    assert.equal(observation.result.schema,'holodeck.space-observation/v1');
    assert.equal(observation.result.observer,owner);
    assert.equal(observation.result.space.level,-1);
    assert.equal(observation.result.space.title,'Secret Laboratory');
    assert.equal(observation.result.space.objects[0].id,'room-marker');
    assert.equal((await native('activity',{})).ok,false);
    nativeAllowed=false;
    assert.equal((await native('observe',{})).ok,false);
    await stop();
    base=await start();
    assert.equal((await (await read(person)).json()).id,'gallery');
    assert.deepEqual((await visit()).visits[0].pin,secondPin);
    const rejoined=connect('spaces/gallery/world',person);
    assert.match(String((await once(rejoined,'message'))[0]),/Gallery/);
    const rejoinedClose=once(rejoined,'close');
    allowed=false;
    assert.deepEqual(await (await read(person)).json(),{id:'outside',entrances:[]});
    assert.equal((await rejoinedClose)[0],1008);
    await denied('spaces/gallery/world',person);
  }finally{
    await stop();rmSync(stateDir,{recursive:true,force:true});
  }
});

test('own-native layout publication adds a live guest route and survives process restart', async()=>{
  const stateDir=mkdtempSync(join(tmpdir(),'holodeck-layout-receiving-'));
  const foreign='dm:being:v1:'+'z'.repeat(43);
  new RoomStore(join(stateDir,'houses')).save({schema:'holodeck.houses/v1',houses:[house],receipts:[]});
  let runtime,listener,base,socketPath,foreignPath,boot=0;
  async function start(){
    socketPath=join(stateDir,'owner-'+(++boot)+'.sock');
    foreignPath=join(stateDir,'foreign-'+boot+'.sock');
    runtime=await createHolodeck({production:true,basePath:'/holodeck/',publicOrigin:'https://world.test',stateDir,
      worldPorts:[{socket:socketPath,beingRef:owner},{socket:foreignPath,beingRef:foreign}],ownNative:true,
      nativeRoomAuthority:async()=>['observe','edit'],
      nativeFactory:()=>({availability:async()=>({available:false}),authorizeWorldRequest(){throw Error('test');}}),
      identityResolver:async req=>{
        const id=req.headers.cookie?.match(/(?:^|; )home=(guest|outsider)/)?.[1];
        return id?{id:'human:'+id,kind:'human',rights:['observe'],name:id}:null;
      }});
    listener=runtime.app.listen(0,'127.0.0.1');
    await once(listener,'listening');
    base='http://127.0.0.1:'+listener.address().port+'/holodeck/';
  }
  async function stop(){
    if(!listener)return;
    runtime.close();
    listener.closeAllConnections();
    await new Promise(resolve=>listener.close(resolve));
    listener=null;
  }
  async function act(args,path=socketPath){
    const socket=net.createConnection(path);
    await once(socket,'connect');
    socket.write(JSON.stringify({ownNative:true,operation:'act',args})+'\n');
    let response='';
    for await(const chunk of socket)response+=chunk;
    return JSON.parse(response);
  }
  async function signIn(name){
    const cookie='home='+name;
    const response=await fetch(base,{headers:{Cookie:cookie,Accept:'application/json'}});
    assert.equal(response.status,200);
    return cookie+'; '+response.headers.get('set-cookie').split(';')[0];
  }
  const request=(Cookie,path,body)=>fetch(base+'api/'+path,{
    method:body?'POST':'GET',headers:{Cookie,Origin:'https://world.test','Content-Type':'application/json'},
    body:body&&JSON.stringify(body)});
  async function get(cookie,path){
    const response=await request(cookie,path);
    assert.equal(response.status,200);
    return response.json();
  }

  const publication={type:'layout.publish',id:'receive-layout-01',house:house.id,expectedRevision:null,rooms:definitions};
  try{
    await start();
    const visitor=await signIn('guest'),outsider=await signIn('outsider');
    const initial=await get(visitor,'state');
    assert.deepEqual(initial.entrances,[]);
    assert.equal((await act({type:'layout.current'})).result,null);
    const preview=await act({...publication,type:'layout.preview'});
    assert.deepEqual(preview.result,{house:house.id,revision:1,rooms:definitions});
    assert.deepEqual((await get(visitor,'state')).entrances,[]);
    assert.equal((await act(publication,foreignPath)).ok,false);
    const published=await act(publication);
    assert.deepEqual(published.result,{house:house.id,revision:1});
    assert.deepEqual(await act(publication),published);
    assert.deepEqual((await act({type:'layout.current'})).result,preview.result);
    const state=await get(visitor,'state');
    assert.equal(state.run,initial.run);
    assert.deepEqual(state.entrances.map(entrance=>entrance.id),['foyer']);
    assert.deepEqual((await get(outsider,'state')).entrances,[]);
    assert.equal((await request(outsider,'space',{from:'outside',to:'foyer',live:1})).status,409);
    const entry=await request(visitor,'space',{from:'outside',to:'foyer',live:1});
    assert.equal(entry.status,200);
    const foyer=await entry.json();
    assert.equal(foyer.scene.id,'foyer');
    assert.deepEqual(foyer.exits.map(exit=>exit.to),['gallery']);
    assert.equal((await request(visitor,'space/scene?room=lab')).status,404);

    const expanded=structuredClone(definitions);
    expanded[0].links.push({kind:'portal',to:'tower'});
    expanded.push(room('tower','Tower',2,false,[{kind:'portal',to:'foyer'}]));
    assert.deepEqual((await act({...publication,id:'receive-layout-02',expectedRevision:1,rooms:expanded})).result,
      {house:house.id,revision:2});
    const routes=(await get(visitor,'space')).exits;
    assert.deepEqual(routes.map(exit=>exit.to),['gallery','tower']);
    assert.equal(routes[0].slot,foyer.exits[0].slot);

    await stop();
    await start();
    assert.equal((await get(visitor,'space')).id,'foyer');
    assert.deepEqual((await act({type:'layout.current'})).result,{house:house.id,revision:2,rooms:expanded});
    assert.deepEqual((await act({type:'layout.result',id:publication.id})).result,published.result);
    const exit=await request(visitor,'space',{from:'foyer',to:'outside',live:1});
    assert.equal(exit.status,200);
    assert.equal((await exit.json()).id,'outside');
  }finally{
    await stop();
    rmSync(stateDir,{recursive:true,force:true});
  }
});
