import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {mkdtempSync,rmSync} from 'node:fs';
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
  let grant=true,canEdit=true,admitted=true,phase='working',uploads=[],inspectEntered,releaseInspect,runtime,listener;
  const entered=new Promise(resolve=>{inspectEntered=resolve;});
  const parked=new Promise(resolve=>{releaseInspect=resolve;});
  new RoomStore(join(dir,'houses')).save({schema:'holodeck.houses/v1',houses:[{
    id:house,owner:being,revision:1,parcel:'parcel-west-1',facade:{color:'#226655',title:'House',width:2,depth:1,height:2},
  }],receipts:[]});
  try{
    runtime=await createHolodeck({basePath:'/holodeck/',publicOrigin:'https://world.test',stateDir:dir,
      ownNative:true,
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
          status:async()=>({phase,retainedOriginal:true,tracking:true,nativeAcceptance:admitted?'observed':'unavailable'}),
        };
        const contexts=await createConversationContexts({room,stateDir:join(stateDir,'context'),transport,allowInteriorSource});
        return {contexts,conversationSurface:async()=>({schema:'holodeck.conversation-surface/v1',
          actorRef:user,beingRef:being,homeRef:'home:'+'c'.repeat(32),binding,url:'https://world.test/conversation/'}),
          authorizeWorldRequest:contexts.authorizeWorldRequest};
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
    assert.equal((await post('conversation-contexts',{...body,id:otherId})).status,200);
    assert.equal(uploads[1].referredRoomObject,undefined,'stale topic must not be silently retargeted');
    const humanSignal=await post('space/garden',{...signal,id:'fixture-human-signal',index:1,color:'amber'});
    assert.equal(humanSignal.status,200);
    canEdit=false;
    assert.equal((await port('observe')).result.approach,undefined);
    assert.equal((await port('act',step)).ok,false);
    canEdit=true;
    phase='completed';
    assert.equal((await port('observe')).result.approach,undefined);
    assert.equal((await port('act',step)).ok,false);
    phase='working';
    assert.equal((await port('act',{...step,nativeRequest:otherId})).ok,false);
    assert.deepEqual(await port('act',step),{ok:true,result:{from:'outside',to:'foyer'}});
    assert.equal((await port('act',step)).ok,false,'an advanced place refuses the old passage');
    assert.equal((await port('observe')).result.approach,undefined);
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
    assert.equal((await port('act',{type:'space.move',from:'foyer',to:'outside'},true)).ok,true);
    assert.deepEqual(await port('result',{id:signal.id}),acted,'receipt survives leaving the room');
    grant=false;
    assert.equal((await port('observe')).ok,false);
    assert.equal((await port('result',{id:signal.id})).ok,false);
    const readback=await fetch(base+'api/conversation-contexts/'+id+'?binding='+binding,{headers});
    assert.equal(readback.status,409);
  }finally{
    releaseInspect();
    runtime?.close();
    if(listener){listener.closeAllConnections();await new Promise(resolve=>listener.close(resolve));}
    rmSync(dir,{recursive:true,force:true});
  }
});
