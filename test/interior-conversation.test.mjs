import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import net from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createConversationContexts} from '../src/conversation-context.mjs';
import {houseId} from '../src/houses.mjs';
import {RoomStore} from '../src/room-store.mjs';
import {createHolodeck} from '../src/server.mjs';

test('a canonical interior source freezes its authorized place before awaits and limits native observation',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'holodeck-room-conversation-'));
  const being='dm:being:v1:'+'a'.repeat(43),house=houseId(being),user='human:test';
  const binding='b'.repeat(64),socket=join(dir,'world.sock');
  const frozen={actorRef:user,beingRef:being,binding,entry:[1,{},2,'fixture']};
  const pin={kind:'context',tableId:'private-table',contextId:'private-context',revision:'private-edition'};
  let sourceAllowed=true;
  let grant=true,canEdit=true,admitted=true,phase='working',uploads=[],openContexts,inspectEntered,releaseInspect,runtime,listener;
  const statusTrace=[];
  const entered=new Promise(resolve=>{inspectEntered=resolve;});
  const parked=new Promise(resolve=>{releaseInspect=resolve;});
  new RoomStore(join(dir,'houses')).save({schema:'holodeck.houses/v1',houses:[{
    id:house,owner:being,revision:1,parcel:'parcel-west-1',facade:{color:'#226655',title:'House',width:2,depth:1,height:2},
  }],receipts:[]});
  new RoomStore(join(dir,'exhibits')).save({schema:'holodeck.exhibits/v1',receipts:[],exhibits:[
    {owner:being,room:'foyer',source:'node-private',sourceRevision:2,revision:7,pin},
  ]});
  try{
    runtime=await createHolodeck({basePath:'/holodeck/',publicOrigin:'https://world.test',stateDir:dir,
      ownNative:true,
      galleryAuthorization:async(cookie,selected)=>sourceAllowed&&cookie.includes('fixture=user')&&
        JSON.stringify(selected)===JSON.stringify(pin),
      identityResolver:async req=>req.headers.cookie?.includes('fixture=user')?{id:user,ref:user,kind:'human',rights:['observe','edit']}:null,
      nativeRoomAuthority:async()=>grant?(canEdit?['observe','edit','project']:['observe']):[],
      worldPorts:[{socket,beingRef:being}],
      nativeFactory:async({room,stateDir,allowInteriorSource})=>{
        const transport={
          inspect:async()=>{inspectEntered();await parked;return frozen;},
          lookup:async()=>({state:'absent'}),
          prepareContext:async req=>{
            uploads.push(req.observation);
            return {schema:'holodeck.prepared-conversation-context/v1',id:req.id,binding,
              entry_binding:req.frozen.entry,observation_id:req.observation.id,work_admitted:false,
              file:{file_id:randomUUID(),sha256:'d'.repeat(64),name:'holodeck-situation.json',mime:'application/json',size:2000}};
          },
          status:async()=>({phase,retainedOriginal:true,tracking:phase==='working',
            nativeAcceptance:admitted?'observed':'unavailable',...statusTrace.shift()}),
        };
        openContexts=()=>createConversationContexts({room,stateDir:join(stateDir,'context'),transport,allowInteriorSource});
        let contexts=await openContexts();
        return {contexts,reopen:async()=>{contexts=await openContexts();},conversationSurface:async()=>({schema:'holodeck.conversation-surface/v1',
          actorRef:user,beingRef:being,homeRef:'home:'+'c'.repeat(32),binding,url:'https://world.test/conversation/'}),
          authorizeWorldRequest:(...args)=>contexts.authorizeWorldRequest(...args)};
      }});
    listener=runtime.app.listen(0,'127.0.0.1');await once(listener,'listening');
    const id=randomUUID();
    async function port(operation,args={},own=false,interactionId=id){
      const conn=net.createConnection(socket);
      await once(conn,'connect');
      conn.write(JSON.stringify({...(own?{ownNative:true}:{interactionId}),operation,args})+'\n');
      let value='';for await (const block of conn)value+=block;
      return JSON.parse(value);
    }
    const layout={type:'layout.publish',id:'fixture-layout-1',house,expectedRevision:null,
      rooms:[
        {id:'foyer',house,title:'Vestíbulo',level:0,entry:true,guests:[user],links:[{kind:'door',to:'side-room'}]},
        {id:'side-room',house,title:'Otro cuarto',level:0,entry:false,guests:[user],links:[{kind:'door',to:'foyer'}]},
      ]};
    const game={type:'garden.put',id:'fixture-garden-1',room:'foyer',title:'Jardín situado',expectedRevision:null,
      play:{schema:'signal-garden/v1',minContributors:2,targets:[
        {x:0,z:2,radius:.45,color:'mint'},{x:0,z:.8,radius:.45,color:'amber'}]}};
    assert.equal((await port('act',layout,true)).ok,true);
    const design={type:'design.put',id:'fixture-design-1',room:'foyer',kit:'listening-workshop',expectedRevision:null};
    assert.equal((await port('act',design,true)).ok,true);
    assert.equal((await port('act',game,true)).ok,true);
    const base='http://127.0.0.1:'+listener.address().port+'/holodeck/';
    async function browserHeaders(){
      const response=await fetch(base,{headers:{Cookie:'fixture=user',Accept:'application/json'}});
      return {Cookie:'fixture=user; '+response.headers.get('set-cookie').split(';')[0],
        Origin:'https://world.test','Content-Type':'application/json'};
    }
    let headers=await browserHeaders();
    const post=(path,body)=>fetch(base+'api/'+path,{headers,method:'POST',body:JSON.stringify(body)});
    const move=(from,to)=>post('space',{from,to,live:1});
    assert.equal((await move('outside','foyer')).status,200);
    assert.equal((await fetch(base+'api/conversation-surface',{headers})).status,200);
    assert.equal((await fetch(base+'api/state',{headers})).status,409,'inside API stays scoped');
    const body={id,binding,view:{spaceId:'foyer',capturedAt:123,historyReference:{unverified:true},
      others:[{private:'forged'}],local:{position:{x:1,y:.1,z:2,private:'forged'}},
      roomVisit:{id:'house-exhibit',revision:7,pin:{revision:'private forged edition'}},
      roomObject:{id:'left-bench',revision:1,title:'private forged title',pin:{revision:'private forged pin'}}}};
    const pending=post('conversation-contexts',body);
    await entered;
    assert.equal((await move('foyer','outside')).status,200);
    assert.equal((await port('act',{...game,id:'fixture-garden-2',title:'Nuevo jardín',expectedRevision:1},true)).ok,true);
    assert.equal((await port('act',{...design,id:'fixture-design-2',kit:'project-archive',expectedRevision:1},true)).ok,true);
    releaseInspect();
    const prepared=await pending;
    assert.equal(prepared.status,200,await prepared.clone().text());
    const attachment=await prepared.json();
    assert.equal(attachment.work_admitted,false);
    assert.equal(uploads.length,1);
    assert.equal(uploads[0].place.id,'foyer');
    assert.equal(uploads[0].scope,'structured-interior-room');
    assert.equal(uploads[0].place.activity.title,'Jardín situado');
    assert.equal(uploads[0].place.activity.revision,1);
    assert.equal(uploads[0].place.activity.progress.filledTargets,0);
    assert.equal(uploads[0].inputAssociation.humanInputId,id);
    assert.deepEqual(uploads[0].referredRoomObject,{id:'left-bench',kind:'fixture',title:'Mesa de escucha',revision:1,
      position:{x:-1.55,y:.64,z:.25},evidence:'client-reported reference matched the current authorized room object'});
    assert.deepEqual(uploads[0].referredRoomVisit,{id:'house-exhibit',revision:7,
      evidence:'client-reported reference matched the room placement and the speaker had source access'});
    assert.deepEqual(uploads[0].clientReportedView.value.local,{position:{x:1,y:.1,z:2}});
    assert.deepEqual(uploads[0].entities,{});
    assert.deepEqual(uploads[0].events,[]);
    assert.doesNotMatch(JSON.stringify(uploads[0]),/private|historyReference|Connect the workshop islands/);
    const retained=await fetch(base+'api/conversation-contexts/'+id+'?binding='+binding,{headers});
    assert.deepEqual((await retained.json()).files,attachment.files);
    const changed=await post('conversation-contexts',{...body,id:randomUUID()});
    assert.equal(changed.status,409);
    assert.equal(uploads.length,1);
    const observed=await port('observe');
    assert.equal(observed.ok,true);
    assert.equal(observed.result.space.id,'foyer');
    assert.equal(observed.result.space.activity.revision,2);
    assert.equal(observed.result.space.activity.title,'Nuevo jardín');
    assert.ok(observed.result.space.objects.some(object=>object.id==='left-bench'&&object.title==='Mesa de consulta'&&object.revision===2));
    assert.equal(observed.result.space.activity.canPlay,false);
    assert.deepEqual(observed.result.approach,{from:'outside',to:'foyer'});
    assert.deepEqual(observed.result.actions,[{operation:'act',args:{type:'space.move',from:'outside',to:'foyer'}}]);
    assert.equal((await port('observe',{},true)).result.space.id,'outside');
    assert.equal((await port('act',{type:'garden.signal',room:'foyer',expectedRevision:2,
      id:'fixture-outside-signal',index:0,color:'mint'},true)).ok,false);
    assert.equal(uploads[0].place.activity.revision,1);
    assert.equal((await port('project')).ok,false);
    const step={type:'space.move',...observed.result.approach};
    assert.equal((await port('act',{...step,to:'lab'})).ok,false);
    const signal={type:'garden.signal',room:'foyer',expectedRevision:2,
      id:'fixture-native-signal',index:0,color:'mint'};
    assert.equal((await port('act',signal)).ok,false,'room reference does not move the daimon');
    headers=await browserHeaders();
    assert.equal((await move('outside','foyer')).status,200);
    const otherId=randomUUID();
    sourceAllowed=false;
    assert.equal((await post('conversation-contexts',{...body,id:otherId})).status,200);
    assert.equal(uploads.at(-1).referredRoomVisit,undefined);
    assert.equal(uploads[1].referredRoomObject,undefined,'stale topic must not be silently retargeted');
    const humanSignal=await post('space/garden',{...signal,id:'fixture-human-signal',index:1,color:'amber'});
    assert.equal(humanSignal.status,200);
    canEdit=false;
    assert.equal((await port('observe')).result.approach,undefined);
    assert.equal((await port('act',step)).ok,false);
    canEdit=true;
    phase='completed';
    const completedObservation=(await port('observe')).result;
    assert.equal(completedObservation.approach,undefined);
    assert.deepEqual(completedObservation.actions,[]);
    assert.equal((await port('act',step)).ok,false);
    phase='working';
    assert.equal((await port('act',{...step,nativeRequest:otherId})).ok,false);
    assert.deepEqual(await port('act',step),{ok:true,result:{from:'outside',to:'foyer'}});
    assert.equal((await port('act',step)).ok,false,'an advanced place refuses the old passage');
    const arrivedObservation=(await port('observe')).result;
    assert.equal(arrivedObservation.approach,undefined);
    const signalArgs={type:signal.type,room:signal.room,expectedRevision:signal.expectedRevision,index:signal.index,color:signal.color};
    assert.deepEqual(arrivedObservation.actions,[{operation:'act',args:signalArgs,required:['id']}]);
    const extraHumanSignal=await post('space/garden',{...signal,id:'fixture-one-contributor'});
    assert.equal(extraHumanSignal.status,200);
    const needsContributor=(await port('observe')).result;
    assert.equal(needsContributor.space.activity.progress.filledTargets,2);
    assert.equal(needsContributor.space.activity.progress.complete,false);
    assert.deepEqual(needsContributor.actions.map(action=>action.args.index),[0,1]);
    assert.equal((await port('act',{type:'space.move',from:'foyer',to:'side-room'})).ok,false,
      'the turn cannot use an unrelated passage, even with permission to enter that room');
    assert.equal((await port('act',{...signal,room:'outside'})).ok,false);
    assert.equal((await port('act',{...signal,expectedRevision:1})).ok,false);
    canEdit=false;
    assert.equal((await port('act',signal)).ok,false);
    canEdit=true;
    admitted=false;
    assert.equal((await port('act',signal)).ok,false);
    admitted=true;
    assert.equal((await port('act',{...signal,nativeRequest:otherId})).ok,false);
    const execution={status:'running',instruction:randomUUID(),local_turn:9};
    statusTrace.push({phase:'queued',tracking:true});
    assert.equal((await port('act',signal)).ok,false,'admitted without a running turn cannot write');
    statusTrace.push({activeExecution:{...execution,local_turn:0}});
    assert.equal((await port('act',signal)).ok,false,'an invalid route proof cannot use direct authority');
    statusTrace.push({activeExecution:execution},{phase:'queued',tracking:true});
    assert.equal((await port('act',signal)).ok,false,'routed execution ended before the write');
    statusTrace.push({activeExecution:execution},{activeExecution:{...execution,local_turn:10}});
    assert.equal((await port('act',signal)).ok,false,'a newer execution cannot replace the selected turn');
    assert.equal((await port('result',{id:signal.id})).ok,false,'refused attempts left no result to replay');
    statusTrace.push({activeExecution:execution},{activeExecution:execution});
    const acted=await port('act',{...signal,nativeRequest:id});
    assert.equal(acted.ok,true);
    assert.deepEqual(acted,await port('act',signal),'exact retry preserves the first result');
    assert.equal((await port('act',{...signal,color:'amber'})).ok,false,'command ID cannot be reused');
    assert.equal((await port('result',{id:signal.id},false,otherId)).ok,false,'a sibling turn cannot use the receipt');
    assert.deepEqual(await port('result',{id:signal.id}),acted);
    const latest=(await port('observe')).result.space.activity;
    assert.equal(latest.sequence,acted.result.sequence);
    assert.equal(latest.progress.contributors,2);
    assert.equal(latest.progress.complete,true);
    assert.deepEqual((await port('observe')).result.actions,[]);
    assert.equal((await port('act',{type:'space.move',from:'foyer',to:'outside'},true)).ok,true);
    assert.deepEqual(await port('result',{id:signal.id}),acted,'receipt survives leaving the room');
    phase='completed';
    assert.equal((await port('act',signal)).ok,false,'completed commands use the receipt reader');
    headers=await browserHeaders();
    const release=await post('conversation-contexts/'+id+'/release',{});
    assert.deepEqual(await release.json(),{released:true,canonicalOriginalPreserved:true});
    const ledger=JSON.parse(readFileSync(join(dir,'context','conversation-contexts.json'),'utf8'));
    assert.equal(ledger.records[id],undefined);
    assert.deepEqual(Object.keys(ledger.receipts[id]).sort(),['actorRef','file','frozen','observationId','run','space']);
    await runtime.native.reopen();
    assert.deepEqual(await port('result',{id:signal.id}),acted,'the exact receipt survives ledger restart');
    assert.equal((await port('result',{id:signal.id},false,otherId)).ok,false);
    assert.equal((await port('act',signal)).ok,false);
    assert.equal((await port('observe')).ok,false);
    await assert.rejects((await openContexts()).prepare({id:user,ref:user,kind:'human'},body),/existing canonical/);
    admitted=false;
    assert.equal((await port('result',{id:signal.id})).ok,false);
    admitted=true;
    grant=false;
    assert.equal((await port('observe')).ok,false);
    assert.equal((await port('result',{id:signal.id})).ok,false);
    const readback=await fetch(base+'api/conversation-contexts/'+otherId+'?binding='+binding,{headers});
    assert.equal(readback.status,409);
  }finally{
    releaseInspect();
    runtime?.close();
    if(listener){listener.closeAllConnections();await new Promise(resolve=>listener.close(resolve));}
    rmSync(dir,{recursive:true,force:true});
  }
});

test('a generated topic freezes the authorized room in the general Conversation original',async t=>{
  const root=mkdtempSync(join(tmpdir(),'holodeck-topic-conversation-'));
  const actorRef='human:topic-visitor',beingRef='dm:being:v1:'+'a'.repeat(43);
  const topic='9'.repeat(64),other='8'.repeat(64),binding='b'.repeat(64);
  const frozen={actorRef,beingRef,binding,entry:[1,{},2,'general-conversation-fixture']};
  let signalInspect,releaseInspect,mayRead=true,recipient=beingRef;
  const inspected=new Promise(resolve=>{signalInspect=resolve;});
  const waiting=new Promise(resolve=>{releaseInspect=resolve;});
  const uploads=[];
  const transport={
    async inspect(actor){assert.equal(actor,actorRef);signalInspect();await waiting;return frozen;},
    async lookup(){return {state:'absent'};},
    async prepareContext(input){
      uploads.push(input);
      return {schema:'holodeck.prepared-conversation-context/v1',id:input.id,binding,
        entry_binding:frozen.entry,observation_id:input.observation.id,work_admitted:false,
        file:{file_id:randomUUID(),sha256:'c'.repeat(64),name:'holodeck-situation.json',mime:'application/json',size:2048}};
    },
  };
  const runtime=await createHolodeck({stateDir:root,publicOrigin:'https://world.test',
    identityResolver:async request=>request.headers.cookie?.includes('fixture=human')
      ? {id:actorRef,ref:actorRef,kind:'human',rights:['observe']}:null,
    nativeRoomAuthority:async ({actor})=>actor.ref===beingRef?['observe']:[],
    nativeFactory:async ({room,stateDir,allowInteriorSource})=>({
      contexts:await createConversationContexts({room,stateDir:join(stateDir,'context'),transport,allowInteriorSource}),
      conversationSurface:async()=>({schema:'holodeck.conversation-surface/v1',actorRef,beingRef,
        homeRef:'home:'+'c'.repeat(32),binding,url:'https://world.test/conversation/'}),
      topicRoom:async (actor,ref)=>{
        assert.equal(actor.ref,actorRef);
        if(!mayRead)throw Object.assign(Error('Topic unavailable'),{code:'topic-room-unavailable'});
        return {schema:'holodeck.topic-room/v1',actorRef,beingRef:recipient,
          room:ref,title:ref===topic?'Original topic':'Another topic',general:false};
      },
    }),
  });
  const listener=runtime.app.listen(0,'127.0.0.1');
  await once(listener,'listening');
  t.after(async()=>{runtime.close();listener.closeAllConnections();
    await new Promise(resolve=>listener.close(resolve));rmSync(root,{recursive:true,force:true});});
  const base='http://127.0.0.1:'+listener.address().port+'/';
  const entry=await fetch(base,{headers:{Cookie:'fixture=human'}});
  const headers={Cookie:'fixture=human; '+entry.headers.get('set-cookie').split(';')[0],
    Origin:'https://world.test','Content-Type':'application/json'};
  await entry.text();
  const post=(path,body)=>fetch(base+'api/'+path,{headers,method:'POST',body:JSON.stringify(body)});
  const response=await post('topic-space',{from:'outside',topic});
  assert.equal(response.status,200);
  const space=await response.json();
  assert.equal(space.sharedConversation,true);
  const id=randomUUID();
  const body={id,binding,view:{spaceId:space.id,topic:other,title:'Forged',capturedAt:17}};
  const pending=post('conversation-contexts',body);
  await inspected;
  assert.equal((await post('topic-space',{from:space.id,topic:other})).status,200);
  releaseInspect();
  const prepared=await pending;
  assert.equal(prepared.status,200,await prepared.clone().text());
  const attachment=await prepared.json();
  assert.equal(attachment.work_admitted,false);
  assert.equal(uploads.length,1);
  assert.deepEqual(uploads[0].frozen.entry,frozen.entry);
  const {observation}=uploads[0];
  assert.equal(observation.inputAssociation.humanInputId,id);
  assert.equal(observation.scope,'structured-topic-room');
  assert.equal(observation.place.topic,topic);
  assert.equal(observation.place.id,space.id);
  assert.equal(observation.place.title,'Original topic');
  assert.doesNotMatch(JSON.stringify(observation),/Forged|Another topic/);
  const recovery=()=>fetch(base+'api/conversation-contexts/'+id+'?binding='+binding,{headers});
  assert.deepEqual((await (await recovery()).json()).files,attachment.files);
  assert.deepEqual((await (await post('conversation-contexts',body)).json()).files,attachment.files);
  assert.equal(uploads.length,1);
  await assert.rejects(runtime.native.contexts.authorizeWorldRequest(id,beingRef),/does not select a physical world action scope/);
  recipient='dm:being:v1:'+'b'.repeat(43);
  assert.equal((await recovery()).status,409);
  recipient=beingRef;
  mayRead=false;
  assert.equal((await recovery()).status,409);
  assert.equal(uploads.length,1);
});
