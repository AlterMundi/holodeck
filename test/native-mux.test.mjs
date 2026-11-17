import {test} from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createNativeTransportMux} from '../src/native-mux.mjs';
import {createNativeConversation} from '../src/native-conversation.mjs';
import {Room} from '../src/room.mjs';

const routeA={actorRef:'human:telegram:1',beingRef:'dm:being:v1:'+'A'.repeat(43),homeRef:'home:'+'a'.repeat(32),socket:'/run/fixture/a.sock'};
const routeB={actorRef:'human:local:10000000-0000-4000-8000-000000000002',beingRef:'dm:being:v1:'+'B'.repeat(43),homeRef:'home:'+'b'.repeat(32),socket:'/run/fixture/b.sock'};
function fixture(route){
  const calls=[],originals=new Map();let lose=false;
  const frozen={actorRef:route.actorRef,beingRef:route.beingRef,homeRef:route.homeRef,pairingRevision:'fixture-revision',
    binding:route===routeA?'a'.repeat(64):'b'.repeat(64),entry:[route===routeA?1:2,{chat_id:1,thread_id:2},3,'fixture-native']};
  return {calls,frozen,set lose(value){lose=value;},
    async inspect(ref){calls.push(['inspect',ref]);assert.equal(ref,route.actorRef);return structuredClone(frozen);},
    async lookup(request){calls.push(['lookup',request.actorRef]);const item=originals.get(request.id);
      return item?{state:'retained',frozen:structuredClone(frozen),observation:item.observation,
        textSha256:createHash('sha256').update(item.input.text).digest('hex'),native:await this.status(request)}:
        {state:'absent',frozen:structuredClone(frozen)};},
    async submit(request){calls.push(['submit',request.actorRef]);originals.set(request.input.id,structuredClone(request));
      if(lose)throw Error('Lost fixture acknowledgment');return {phase:'queued',nativeAcceptance:'observed',retainedOriginal:true};},
    async status(request){calls.push(['status',request.actorRef]);return {phase:'working',nativeAcceptance:'observed',retainedOriginal:true,tracking:true};}
  };
}
function setup(){const a=fixture(routeA),b=fixture(routeB),sources=new Map([[routeA.socket,a],[routeB.socket,b]]);
  return {a,b,mux:createNativeTransportMux({routes:[routeA,routeB],createTransport:path=>sources.get(path)})};}

test('registered Telegram and local/application humans select only their own paired lane',async()=>{
  const {a,b,mux}=setup();
  assert.deepEqual(await mux.inspect(routeA.actorRef),a.frozen);assert.deepEqual(await mux.inspect(routeB.actorRef),b.frozen);
  await mux.submit({actorRef:routeB.actorRef,frozen:b.frozen,input:{id:'fixture'},observation:{}});
  assert.equal(a.calls.filter(([op])=>op==='submit').length,0);assert.equal(b.calls.filter(([op])=>op==='submit').length,1);
});
test('unknown humans and cross-pair frozen claims have no fallback or receiving effect',async()=>{
  const {a,b,mux}=setup();
  await assert.rejects(mux.inspect('human:local:unconfigured'),error=>error.code==='native-route-unavailable');
  await assert.rejects(mux.submit({actorRef:routeA.actorRef,frozen:b.frozen}),error=>error.code==='native-route-mismatch');
  assert.equal(a.calls.length,0);assert.equal(b.calls.length,0);
});
test('a miswired socket or changed Home owner fails the selected pairing check',async()=>{
  const wrong=fixture(routeB),mux=createNativeTransportMux({routes:[routeA],createTransport:()=>({
    inspect:()=>structuredClone(wrong.frozen),lookup:()=>({state:'absent',frozen:structuredClone(wrong.frozen)})})});
  await assert.rejects(mux.inspect(routeA.actorRef),error=>error.code==='native-route-mismatch');
  await assert.rejects(mux.lookup({actorRef:routeA.actorRef,id:'fixture'}),error=>error.code==='native-route-mismatch');
  assert.throws(()=>createNativeTransportMux({routes:[routeA,routeA],createTransport:()=>wrong}),/one explicit paired/);
});
test('a pre-mux unknown original resumes its same journal/binding without replay or new identity fields',async t=>{
  const dir=await fs.mkdtemp(join(tmpdir(),'holodeck-native-mux-test-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const {a,b,mux}=setup(),room=new Room(),actor={id:routeA.actorRef,ref:routeA.actorRef,kind:'human',rights:['observe','edit','project']};
  const id=crypto.randomUUID();a.lose=true;
  const legacy=await createNativeConversation({room,stateDir:dir,transport:a});
  assert.equal((await legacy.submit(actor,{id,text:'exact fixture original'})).phase,'unknown');
  const before=JSON.parse(await fs.readFile(join(dir,'native-turns.json'),'utf8'));
  const adopted=await createNativeConversation({room,stateDir:dir,transport:mux});
  assert.equal((await adopted.status(actor,id)).phase,'working');
  const after=JSON.parse(await fs.readFile(join(dir,'native-turns.json'),'utf8'));
  assert.deepEqual(after.records[id].frozen,before.records[id].frozen);
  assert.equal(a.calls.filter(([op])=>op==='submit').length,1);assert.equal(b.calls.length,0);
  const beforeRejectedReturn=a.calls.length;
  await assert.rejects(adopted.authorizeWorldRequest(id,routeB.beingRef),error=>error.code==='native-scope');
  assert.equal(a.calls.length,beforeRejectedReturn);assert.equal(b.calls.length,0);
});
