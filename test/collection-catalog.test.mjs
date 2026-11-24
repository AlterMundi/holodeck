import {once} from 'node:events';
import {createConnection} from 'node:net';
import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readMatterWorkshopArt} from '../src/matter-workshop-art.mjs';
import {collectionSelection,selectMatterAppearance} from '../src/collection-catalog.mjs';
import {createConversationContexts} from '../src/conversation-context.mjs';
import {houseId} from '../src/houses.mjs';
import {RoomStore} from '../src/room-store.mjs';
import {createHolodeck} from '../src/server.mjs';
import {interiorDocument} from '../src/interior-spaces.mjs';

const main='1'.repeat(32),component='2'.repeat(32),lenses='3'.repeat(32),foreign='4'.repeat(32);
const version='a'.repeat(64),oldVersion='f'.repeat(64);
const selected={room:'matter',projects:[
  {id:'guitar',resources:[main,component]},
  {id:'lenses',resources:[lenses]},
]};

test('receiving appearance selection preserves the preceding package fallback',()=>{
  const base={...selected,art:'matter-workshop-v1'};
  const overlay={room:'matter',profile:'matter-workshop-orbital-focused-v1'};
  assert.equal(selectMatterAppearance({matterCollection:base}),base);
  assert.deepEqual(selectMatterAppearance({matterCollection:base,matterAppearance:overlay}),
    {...base,art:overlay.profile});
  assert.equal(base.art,'matter-workshop-v1');
  assert.throws(()=>selectMatterAppearance({matterCollection:base,
    matterAppearance:{...overlay,room:'outside'}}),/existing Matter room/);
});

test('collection positions reject missing rooms and ambiguous resource placements',()=>{
  const rooms=new Map([['matter',{}]]);
  assert.deepEqual(collectionSelection(selected,rooms),selected);
  const original=readMatterWorkshopArt();
  const hybrid=readMatterWorkshopArt('matter-workshop-floor-splat-v1');
  const orbital=readMatterWorkshopArt('matter-workshop-orbital-v1');
  const baked=readMatterWorkshopArt('matter-workshop-orbital-baked-v1');
  const focused=readMatterWorkshopArt('matter-workshop-orbital-focused-v1');
  assert.equal(hybrid.revision,original.revision);
  assert.equal(original.floorSplat,null);
  assert.equal(hybrid.floorSplat.bytes.length/12,70224);
  assert.ok(JSON.parse(original.bytes.toString('utf8',20,20+original.bytes.readUInt32LE(12)))
    .nodes.some(node=>node.name===hybrid.floorSplat.target));
  assert.equal(new Set([original,orbital,baked,focused].map(art=>art.revision)).size,4);
  for(const field of ['archive','shelves','fixtures','colliders']){
    assert.deepEqual(hybrid[field],original[field]);
    assert.deepEqual(orbital[field],original[field]);
    assert.deepEqual(baked[field],original[field]);
    assert.deepEqual(focused[field],original[field]);
  }
  const room={id:'matter',entry:false,level:0,title:'Manipulación de Materia'};
  const returnLink={slot:0,kind:'door',rise:0,title:'Vestíbulo'};
  const markup=art=>interiorDocument(room,[returnLink],null,{...art,src:'/art.glb'});
  assert.match(markup(focused),/<m-cube id="bulkhead-panel"[^>]*collide="false"/);
  assert.doesNotMatch(markup(original),/id="bulkhead-panel"/);
  assert.match(markup(focused),/id="passage-0" x="-3" z="-5.86"/);
  const jsonBytes=baked.bytes.readUInt32LE(12);
  const gltf=JSON.parse(baked.bytes.toString('utf8',20,20+jsonBytes));
  assert.ok(gltf.nodes.some(node=>node.name==='archive_turntable_platform'));
  assert.ok(gltf.materials.some(material=>material.name==='Orbital static diffuse'&&
    material.extensions.KHR_materials_unlit&&material.pbrMetallicRoughness.baseColorTexture));
  const focusedGLTF=JSON.parse(focused.bytes.toString('utf8',20,20+focused.bytes.readUInt32LE(12)));
  assert.ok(focusedGLTF.nodes.some(node=>node.name==='archive_turntable_platform'));
  assert.ok(focusedGLTF.materials.some(material=>material.name==='Orbital static diffuse'&&
    material.extensions.KHR_materials_unlit&&material.pbrMetallicRoughness.baseColorTexture));
  assert.ok(focusedGLTF.materials.some(material=>material.name==='Orbital focused material response'&&
    material.emissiveTexture&&material.pbrMetallicRoughness.metallicRoughnessTexture&&
    material.extensions.KHR_materials_specular));
  assert.throws(()=>collectionSelection({...selected,art:'matter-workshop-v1'},
    new Map([['matter',{links:[{kind:'stair'}]}]])),/without stairs/);
  assert.throws(()=>collectionSelection({...selected,room:'other'},rooms),/existing Collection room/);
  assert.throws(()=>collectionSelection({...selected,projects:[
    {id:'guitar',resources:[main]},
    {id:'lenses',resources:[main]},
  ]},rooms),/distinct Home resources/);
});

test('collection projects stay grouped and editions follow each visitor and their current room',async t=>{
  const owner='dm:being:v1:'+'p'.repeat(43),house=houseId(owner);
  const stateDir=mkdtempSync(join(tmpdir(),'holodeck-collection-'));
  t.after(()=>rmSync(stateDir,{recursive:true,force:true}));
  new RoomStore(join(stateDir,'houses')).save({schema:'holodeck.houses/v1',receipts:[],houses:[{
    id:house,owner,revision:1,parcel:'parcel-west-1',
    facade:{color:'#226655',title:'House',width:2,depth:1,height:2},
  }]});
  const archived=[{resource:main,version:oldVersion,label:'Guitarra · Banco inicial'}];
  const sceneVersion='d'.repeat(64);
  const review=Buffer.from(JSON.stringify({scenes:[{id:'bench-scene',title:'Estudio',version:sceneVersion,units:'mm',
    parts:[{id:'bridge',label:'Puente',color:'#008888'}]}]}));
  const gallerySha256=createHash('sha256').update(review).digest('hex');
  const user='human:guest',binding='b'.repeat(64),entry=[1,{},2,'fixture'],observations=[];
  const json=Buffer.from(JSON.stringify({asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],
    nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0},indices:1}]}],buffers:[{byteLength:44}],
    accessors:[{count:3,type:'VEC3',componentType:5126},{count:3,type:'SCALAR',componentType:5123}]}));
  const length=(json.length+3)&~3,glb=Buffer.alloc(20+length+8+44);
  glb.write('glTF');glb.writeUInt32LE(2,4);glb.writeUInt32LE(glb.length,8);glb.writeUInt32LE(length,12);
  glb.write('JSON',16);glb.fill(32,20,20+length);json.copy(glb,20);
  glb.writeUInt32LE(44,20+length);glb.write('BIN\0',24+length);
  const sha256=createHash('sha256').update(glb).digest('hex'),models=join(stateDir,'collection-representatives');
  mkdirSync(models);
  writeFileSync(join(models,sha256+'.glb'),glb);
  writeFileSync(join(models,'index.json'),JSON.stringify({schema:'holodeck.collection-representatives/v1',
    entries:[version,oldVersion].map(version=>({resource:main,version,scene:sceneVersion,sha256}))}));
  const thumbnail='/api/space/collection-model/'+main+'/'+version;
  const archivedThumbnail='/api/space/collection-model/'+main+'/'+oldVersion;
  let revoked=false,unavailable=false,hold,expiredSession=false,mainVersion=version,historicalDenied=false;
  const requests=[];
  const socket=join(stateDir,'native.sock'),otherPort=join(stateDir,'foreign.sock');
  let admitted=true;
  async function observe(port,id){
    const channel=createConnection(port);
    await once(channel,'connect');
    channel.write(JSON.stringify({interactionId:id,operation:'observe',args:{}})+'\n');
    let reply='';
    for await(const chunk of channel)reply+=chunk;
    return JSON.parse(reply);
  }
  const runtime=await createHolodeck({
    stateDir,publicOrigin:'https://home.test',matterCollection:{...selected,art:'matter-workshop-orbital-focused-v1',archive:archived},
    interiorSpaces:[{id:'matter',house,title:'Manipulación de Materia',entry:true,level:0,guests:['human:guest'],links:[]}],
    identityResolver:async req=>{
      if(expiredSession)return null;
      return req.headers.cookie?.includes('__Host-home=owner')?{id:owner,kind:'daimon',rights:['observe','edit']}:
        req.headers.cookie?.includes('__Host-home=guest')?{id:'human:guest',ref:user,kind:'human',rights:['observe']}:null;
    },
    nativeRoomAuthority:async()=>['observe'],
    worldPorts:[{socket,beingRef:owner},{socket:otherPort,beingRef:'dm:being:v1:'+'k'.repeat(43)}],
    nativeFactory:async({room,stateDir,allowInteriorSource})=>{
      const contexts=await createConversationContexts({
      room,stateDir:join(stateDir,'contexts'),allowInteriorSource,transport:{
        inspect:async()=>({actorRef:user,beingRef:owner,binding,entry}),
        lookup:async()=>({state:'absent'}),
        status:async()=>({phase:'working',nativeAcceptance:admitted?'observed':'unavailable',retainedOriginal:true}),
        prepareContext:async ({id,observation})=>{
          observations.push(observation);
          return {schema:'holodeck.prepared-conversation-context/v1',id,binding,entry_binding:entry,
            observation_id:observation.id,work_admitted:false,
            file:{file_id:randomUUID(),sha256:'0'.repeat(64),name:'holodeck-situation.json',mime:'application/json',size:512}};
        },
      },
      });
      return {contexts,authorizeWorldRequest:(...args)=>contexts.authorizeWorldRequest(...args)};
    },
    collectionSourceRequest:async (url,{headers,redirect,cache,signal})=>{
      assert.equal(url.origin,'https://home.test');
      assert.match(headers.Cookie,/^__Host-home=(owner|guest)$/);
      assert.equal(redirect,'error');
      assert.equal(cache,'no-store');
      assert.equal(signal.aborted,false);
      requests.push(url.pathname);
      if(url.pathname==='/catalog.json'){
        if(unavailable)return new Response('',{status:503});
        const allowed=headers.Cookie.endsWith('owner')?[main,component,lenses,foreign]:[main,foreign];
        return Response.json({entries:allowed.map(resource=>({resource_ref:'dm:resource:v1:'+resource,
          kind:'artifact',model_review:true,title:'Project '+resource[0],version_ref:resource===main?mainVersion:version}))});
      }
      const [, ,resource,requestedVersion,file]=url.pathname.split('/');
      assert.notEqual(resource,foreign);
      if(hold)await hold();
      if(resource===main&&(revoked||requestedVersion===oldVersion&&historicalDenied))return new Response('',{status:404});
      if(file==='gallery.json')return new Response(review,{headers:{'X-Home-Version':requestedVersion}});
      return Response.json({schema:'dm.review-live/v1',gallery:'gallery.json',sha256:gallerySha256},
        {headers:{'X-Home-Version':resource===lenses?'c'.repeat(64):requestedVersion}});
    },
  });
  const listener=runtime.app.listen(0,'127.0.0.1');
  t.after(async()=>{
    runtime.close();
    listener.closeAllConnections();
    await new Promise(resolve=>listener.close(resolve));
  });
  await once(listener,'listening');
  const base='http://127.0.0.1:'+listener.address().port+'/';
  async function session(actor){
    const cookie='__Host-home='+actor+'; unrelated=private';
    const admission=await fetch(base,{headers:{Cookie:cookie,Accept:'application/json'}});
    const headers={Cookie:cookie+'; '+admission.headers.get('set-cookie').split(';')[0],
      Origin:'https://home.test','Content-Type':'application/json'};
    return {
      move:(from,to)=>fetch(base+'api/space',{headers,method:'POST',body:JSON.stringify({from,to,live:1})}),
      restore:(resource,version)=>fetch(base+'api/space/collection/archive',{headers,method:'POST',
        body:JSON.stringify({resource,version})}),
      prepare:(worktable,id=randomUUID())=>fetch(base+'api/conversation-contexts',{headers,method:'POST',
        body:JSON.stringify({id,binding,view:{spaceId:'matter',worktable}})}),
      events:()=>fetch(base+'api/space/collection/events',{headers}),
      catalog:()=>fetch(base+'api/space/collection',{headers}),
      share:(resource,revision,version)=>fetch(base+'api/space/collection',{headers,method:'POST',body:JSON.stringify({resource,revision,version})}),
      art:path=>fetch(new URL(path,base),{headers}),
    };
  }
  const [author,visitor]=await Promise.all([session('owner'),session('guest')]);
  assert.equal((await visitor.catalog()).status,404);
  assert.equal((await visitor.events()).status,404);
  assert.equal((await visitor.art(thumbnail)).status,404);
  assert.equal(requests.length,0);
  const entered=await author.move('outside','matter');
  assert.equal(entered.status,200);
  const scene=await entered.json();
  const asset=scene.scene.markup.match(/src="([^"]+\.glb)"/)?.[1];
  assert.match(asset,/^\/api\/space\/art\/[a-f0-9]{64}\.glb$/);
  assert.deepEqual(scene.objects.map(object=>object.id),['worktable','archive-turntable']);
  assert.equal((await visitor.art(asset)).status,404);
  const delivered=await author.art(asset);
  assert.equal(delivered.status,200);
  assert.deepEqual(Buffer.from(await delivered.arrayBuffer()),readMatterWorkshopArt('matter-workshop-orbital-focused-v1').bytes);
  assert.equal(scene.matterStyles.default,'orbital');
  for(const path of Object.values(scene.matterStyles.assets)){
    assert.match(path,/^\/api\/space\/art\/[a-f0-9]{64}\.(jpg|png)$/);
    assert.equal((await visitor.art(path)).status,404);
    const response=await author.art(path);
    assert.equal(response.status,200);
    assert.equal(response.headers.get('cache-control'),'no-store');
    const bytes=Buffer.from(await response.arrayBuffer());
    assert.equal(createHash('sha256').update(bytes).digest('hex'),path.split('/').at(-1).split('.')[0]);
  }
  assert.equal((await visitor.move('outside','matter')).status,200);

  const response=await author.catalog();
  assert.equal(response.headers.get('cache-control'),'no-store');
  const model=resource=>({resource,version,title:'Project '+resource[0],gallerySha256,
    ...(resource===main?{representative:{scene:sceneVersion,sha256}}:{})});
  const guitar=(...resources)=>({id:'guitar',shelf:0,anchor:{x:-5.25,y:.688,z:-1.36},editions:resources.map(model)});
  const archive={anchor:{x:3.35,y:1.061,z:-3.68},
    editions:[{...model(main),version:oldVersion,label:archived[0].label}]};
  const table=(revision,resource,canShare=false)=>({revision,resource,canShare});
  assert.deepEqual(await response.json(),{room:'matter',projects:[guitar(main,component)],archive:{...archive,canRestore:true},worktable:table(0,null,true)});
  assert.deepEqual(await (await visitor.catalog()).json(),{room:'matter',projects:[guitar(main)],archive,worktable:table(0,null)});
  assert.equal((await visitor.share(main,0)).status,403);
  const events=await visitor.events();
  assert.match(events.headers.get('content-type'),/^text\/event-stream/);
  const stream=events.body.getReader();
  t.after(()=>stream.cancel().catch(()=>{}));
  let eventBuffer='';
  const readEvent=async()=>{
    while(!eventBuffer.includes('\n\n')){
      const {value,done}=await stream.read();
      assert.equal(done,false);
      eventBuffer+=Buffer.from(value).toString();
    }
    const end=eventBuffer.indexOf('\n\n')+2;
    const event=eventBuffer.slice(0,end);
    eventBuffer=eventBuffer.slice(end);
    return event;
  };
  assert.equal(await readEvent(),': ready\n\n');
  assert.equal((await author.share(component,0)).status,204);
  assert.equal(await readEvent(),'event: refresh\ndata: {}\n\n');
  assert.deepEqual((await (await author.catalog()).json()).worktable,table(1,component,true));
  assert.deepEqual((await (await visitor.catalog()).json()).worktable,table(1,null));
  assert.equal((await author.share(main,0)).status,409);
  assert.equal((await author.share(main,1)).status,204);
  assert.deepEqual((await (await visitor.catalog()).json()).worktable,table(2,main));
  assert.deepEqual(new RoomStore(join(stateDir,'collection-worktable')).load(),{room:'matter',revision:2,resource:main});
  assert.equal((await visitor.art(archivedThumbnail)).status,200);
  const speaker=await session('guest');
  const reference={resource:main,version:oldVersion,scene:'bench-scene',sceneVersion,part:'bridge'};
  const original=randomUUID();
  const first=await speaker.prepare(reference,original);
  assert.equal(first.status,200,await first.clone().text());
  assert.equal((await first.json()).work_admitted,false);
  assert.equal(observations.length,1);
  const placed=observations[0].referredWorktable;
  assert.equal(placed.partLabel,'Puente');
  assert.equal(placed.part,'bridge');
  assert.equal(placed.version,oldVersion);
  assert.equal(placed.sceneVersion,sceneVersion);
  assert.equal(placed.viewer,'https://home.test/view/'+main+'?version='+oldVersion+'&display=work');
  assert.equal(observations[0].clientReportedView.value.worktable,undefined);
  const native=await observe(socket,original);
  assert.equal(native.ok,true);
  assert.deepEqual(native.result.referredWorktable,placed);
  assert.equal(native.result.space.id,'matter');
  assert.equal((await observe(otherPort,original)).ok,false);
  assert.equal((await observe(socket,randomUUID())).ok,false);
  admitted=false;
  assert.equal((await observe(socket,original)).ok,false);
  admitted=true;
  assert.equal((await speaker.prepare({...reference,part:'forged'})).status,409);

  historicalDenied=true;
  assert.deepEqual((await (await visitor.catalog()).json()).archive,{...archive,editions:[]});
  assert.equal((await visitor.art(archivedThumbnail)).status,404);
  assert.equal((await speaker.prepare(reference)).status,409);
  assert.equal(observations.length,1);
  assert.equal((await visitor.art(thumbnail)).status,200);
  historicalDenied=false;
  const curator=await session('owner');
  assert.equal((await visitor.restore(main,oldVersion)).status,403);
  assert.equal((await curator.share(main,2,oldVersion)).status,404);
  assert.equal((await curator.restore(main,oldVersion)).status,204);
  assert.equal((await curator.restore(main,oldVersion)).status,204);
  const restored=await (await visitor.catalog()).json();
  assert.deepEqual(restored.archive.editions,[]);
  assert.deepEqual(restored.projects.map(project=>[project.shelf,project.editions[0].version]),[[0,version],[2,oldVersion]]);
  assert.equal(restored.projects[1].restored,true);
  assert.equal((await visitor.art(archivedThumbnail)).status,200);
  assert.deepEqual(new RoomStore(join(stateDir,'collection-placement'),{maxBytes:2048}).load(),
    {room:'matter',placed:[main+':'+oldVersion]});
  assert.equal((await curator.share(main,2,oldVersion)).status,204);
  assert.deepEqual((await (await visitor.catalog()).json()).worktable,{...table(3,main),version:oldVersion});
  assert.deepEqual(new RoomStore(join(stateDir,'collection-worktable')).load(),
    {room:'matter',revision:3,resource:null,edition:{resource:main,version:oldVersion}});
  historicalDenied=true;
  const denied=await (await visitor.catalog()).json();
  assert.equal(denied.projects.length,1);
  assert.deepEqual(denied.worktable,table(3,null));
  assert.equal((await visitor.art(archivedThumbnail)).status,404);
  historicalDenied=false;
  const thumbnailResponse=await visitor.art(thumbnail);
  assert.equal(thumbnailResponse.status,200);
  assert.equal(thumbnailResponse.headers.get('cache-control'),'no-store');
  assert.deepEqual(Buffer.from(await thumbnailResponse.arrayBuffer()),glb);
  mainVersion='e'.repeat(64);
  const updated=(await (await visitor.catalog()).json()).projects[0].editions[0];
  assert.deepEqual((await observe(socket,original)).result.referredWorktable,placed);
  assert.equal(updated.version,mainVersion);
  assert.equal(updated.representative,undefined);
  assert.equal((await visitor.art(thumbnail)).status,404);
  mainVersion=version;
  revoked=true;
  assert.equal((await visitor.art(thumbnail)).status,404);
  assert.deepEqual(await (await visitor.catalog()).json(),{room:'matter',projects:[],archive:{...archive,editions:[]},worktable:table(3,null)});
  revoked=false;
  unavailable=true;
  assert.equal((await visitor.catalog()).status,503);
  unavailable=false;

  let started,release;
  const pending=new Promise(resolve=>{started=resolve;});
  const wait=new Promise(resolve=>{release=resolve;});
  hold=()=>{started();return wait;};
  const racing=visitor.catalog();
  await pending;
  try{assert.equal((await visitor.move('matter','outside')).status,200);}
  finally{release();}
  assert.equal((await racing).status,404);
  assert.equal((await visitor.art(asset)).status,404);
  assert.equal(await readEvent(),'event: refresh\ndata: {}\n\n');
  assert.equal(await readEvent(),'event: refresh\ndata: {}\n\n');
  assert.equal(await readEvent(),'event: refresh\ndata: {}\n\n');
  assert.equal((await stream.read()).done,true);
  assert.equal((await visitor.events()).status,404);

  const authStarted=new Promise(resolve=>{started=resolve;});
  const authWait=new Promise(resolve=>{release=resolve;});
  hold=()=>{started();return authWait;};
  const losingAdmission=author.catalog();
  await authStarted;
  expiredSession=true;
  release();
  assert.equal((await losingAdmission).status,404);
  assert.equal((await author.catalog()).status,401);
});
