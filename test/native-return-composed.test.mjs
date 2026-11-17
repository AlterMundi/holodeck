import {test} from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {promises as fs} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {Room} from '../src/room.mjs';
import {createNativeConversation} from '../src/native-conversation.mjs';
import {createNativeTransportMux} from '../src/native-mux.mjs';
import {createWorldPort} from '../src/world-port.mjs';

// These are controlled writer/admission fixtures. The Room, intent journal, mux,
// DaimonPort and both Unix return listeners below are the real implementation.
// This test submits no real human original and establishes no model acceptance.
function receivingFixture(route,index){
  const calls=[],originals=new Map();
  const frozen={actorRef:route.actorRef,beingRef:route.beingRef,homeRef:route.homeRef,
    pairingRevision:'controlled-fixture',binding:String(index).repeat(64),
    entry:[index,{chat_id:index,thread_id:1},index,'fixture-native-'+index]};
  return {calls,
    async inspect(actorRef){calls.push('inspect');assert.equal(actorRef,route.actorRef);return structuredClone(frozen);},
    async lookup(request){
      calls.push('lookup');assert.equal(request.actorRef,route.actorRef);
      assert.equal(originals.has(request.id),false);
      return {state:'absent',frozen:structuredClone(frozen)};
    },
    async submit(request){
      calls.push('submit');assert.equal(request.actorRef,route.actorRef);
      originals.set(request.input.id,structuredClone(request));
      return {phase:'queued',tracking:true,retainedOriginal:true,nativeAcceptance:'observed'};
    },
    async status(request){
      calls.push('status');assert.equal(request.actorRef,route.actorRef);
      const original=originals.get(request.id);assert.ok(original);
      assert.equal(request.textSha256,createHash('sha256').update(original.input.text).digest('hex'));
      assert.equal(request.observationId,original.observation.id);
      return {phase:'working',tracking:true,retainedOriginal:true,nativeAcceptance:'observed'};
    }
  };
}

function callWorld(socketPath,interactionId,operation,args){
  return new Promise((resolve,reject)=>{
    const socket=net.createConnection(socketPath);let bytes='',settled=false;
    function finish(error,result){if(settled)return;settled=true;socket.destroy();error?reject(error):resolve(result);}
    socket.setTimeout(5000,()=>finish(Error('Controlled world-port call timed out')));
    socket.on('error',error=>finish(error));
    socket.on('connect',()=>socket.write(JSON.stringify({interactionId,operation,args})+'\n'));
    socket.on('data',block=>{
      bytes+=block;
      if(Buffer.byteLength(bytes)>131072)return finish(Error('World reply exceeded its bound'));
      const end=bytes.indexOf('\n');if(end<0)return;
      try{finish(null,JSON.parse(bytes.slice(0,end)));}catch(error){finish(error);}
    });
    socket.on('end',()=>{if(!settled)finish(Error('World reply was not confirmed'));});
  });
}

test('two pinned native return sockets share one Room and reject cross-being references before bridge I/O',async t=>{
  const dir=await fs.mkdtemp(join(tmpdir(),'holodeck-native-return-composed-')),ports=[];
  t.after(async()=>{await Promise.all(ports.map(port=>port.close()));await fs.rm(dir,{recursive:true,force:true});});
  const routeA={actorRef:'human:telegram:1',beingRef:'dm:being:v1:'+'A'.repeat(43),homeRef:'home:'+'a'.repeat(32),socket:'/run/fixture/native-a.sock'};
  const routeB={actorRef:'human:local:10000000-0000-4000-8000-000000000002',beingRef:'dm:being:v1:'+'B'.repeat(43),homeRef:'home:'+'b'.repeat(32),socket:'/run/fixture/native-b.sock'};
  const receiverA=receivingFixture(routeA,1),receiverB=receivingFixture(routeB,2);
  const transports=new Map([[routeA.socket,receiverA],[routeB.socket,receiverB]]);
  const mux=createNativeTransportMux({routes:[routeA,routeB],createTransport:path=>transports.get(path)});
  const room=new Room(),native=await createNativeConversation({room,stateDir:join(dir,'intents'),transport:mux});
  const human=route=>({id:route.actorRef,ref:route.actorRef,kind:'human',rights:['observe','edit','project']});
  const inputA=crypto.randomUUID(),inputB=crypto.randomUUID();
  await native.submit(human(routeA),{id:inputA,text:'Controlled fixture A original'});
  await native.submit(human(routeB),{id:inputB,text:'Controlled fixture B original'});
  let rightsCalls=0;
  async function resolveRights(verified){
    rightsCalls++;
    const expected=verified.humanRef===routeA.actorRef?routeA:routeB;
    assert.equal(verified.actor.ref,expected.beingRef);
    return ['observe','edit','project'];
  }
  const socketA=join(dir,'a.sock'),socketB=join(dir,'b.sock');
  ports.push(await createWorldPort({socketPath:socketA,room,native,resolveRights,expectedBeingRef:routeA.beingRef}));
  ports.push(await createWorldPort({socketPath:socketB,room,native,resolveRights,expectedBeingRef:routeB.beingRef}));
  const a=await callWorld(socketA,inputA,'observe',{}),b=await callWorld(socketB,inputB,'observe',{});
  assert.equal(a.ok,true);assert.equal(b.ok,true);
  assert.equal(a.result.observer,routeA.beingRef);assert.equal(b.result.observer,routeB.beingRef);
  assert.equal(a.result.run,b.result.run);assert.equal(a.result.run,room.run);
  assert.equal(a.result.edition,b.result.edition);
  assert.deepEqual(a.result.entities.bridge,b.result.entities.bridge);
  assert.equal(a.result.entities.bridge.revision,0);
  const command={id:crypto.randomUUID(),issuedAt:Date.now(),run:a.result.run,edition:a.result.edition,
    observation:a.result.id,type:'bridge.set',target:'bridge',expectedRevision:0,args:{raised:true}};
  const applied=await callWorld(socketA,inputA,'act',command);
  assert.equal(applied.ok,true);assert.equal(applied.result.status,'completed');
  const seenByB=await callWorld(socketB,inputB,'observe',{after:b.result.source.through});
  assert.equal(seenByB.ok,true);assert.equal(seenByB.result.run,a.result.run);
  assert.deepEqual(seenByB.result.entities.bridge,{id:'bridge',revision:1,raised:true});
  const event=seenByB.result.events.find(item=>item.sequence===applied.result.event);
  assert.ok(event);assert.equal(event.actor,routeA.beingRef);
  assert.equal(event.detail.nativeRequest,inputA);assert.equal(event.detail.entity.revision,1);
  const before={room:room.snapshot(),aCalls:receiverA.calls.length,bCalls:receiverB.calls.length,rightsCalls};
  const forged=await callWorld(socketB,inputA,'act',{...command,id:crypto.randomUUID(),expectedRevision:1,args:{raised:false}});
  assert.equal(forged.ok,false);
  assert.deepEqual(room.snapshot(),before.room);
  assert.equal(receiverA.calls.length,before.aCalls);assert.equal(receiverB.calls.length,before.bCalls);
  assert.equal(rightsCalls,before.rightsCalls);
  const stillOwnB=await callWorld(socketB,inputB,'observe',{});
  assert.equal(stillOwnB.ok,true);assert.equal(stillOwnB.result.observer,routeB.beingRef);
  assert.equal(stillOwnB.result.entities.bridge.revision,1);
});
