import {test} from 'node:test';import assert from 'node:assert/strict';
import {createHolodeck} from '../src/server.mjs';import {DaimonPort} from '../src/daimon-port.mjs';
const pin={kind:'artifact_review',tableId:'controlled-private-table',reviewId:'controlled-private-review',revision:'edition-1',adapter:'interactive_3d'};
test('running world dynamically discovers declared node entrances for current human actors while retaining configured discovery and safe fixed routes',async()=>{
 const creator={id:'dm:being:v1:'+'c'.repeat(43),kind:'daimon',rights:['observe','edit']};
 const runtime=await createHolodeck({identityResolver:async req=>{
  const who=req.headers.cookie?.match(/fixture=(a|b)/)?.[1];return who?{id:'human:fixture-'+who,kind:'human',rights:['observe','edit']}:null;
 },contentVisits:[{id:'configured',node:'reading-room',entry:'/nexus/?table=old&report_revision=v1',descriptor:'/nexus/api/tables/old/reports/report/v1/visit',pin:{tableId:'old',reportId:'report',revision:'v1'},discoverActors:['human:fixture-a']}]});
 const listener=runtime.app.listen(0,'127.0.0.1');await new Promise(r=>listener.once('listening',r));const base='http://127.0.0.1:'+listener.address().port;
 const port=new DaimonPort(runtime.room,async()=>creator);
 const create=async(type,expectedRevision,title,pin)=>{const o=await port.observe(null);return port.act(null,{id:crypto.randomUUID(),issuedAt:Date.now(),run:o.run,edition:o.edition,observation:o.id,nativeRequest:'controlled-fixture-input',type,target:'node-new',expectedRevision,args:{title,shape:'portal',position:{x:4,z:1},result:{pin},links:[]}});};
 try{
  const cookie=async actor=>{const response=await fetch(base+'/',{headers:{Cookie:'fixture='+actor}});assert.equal(response.status,200);return 'fixture='+actor+'; '+response.headers.get('set-cookie').split(';')[0];};
  const a=await cookie('a'),b=await cookie('b');assert.equal((await fetch(base+'/api/content-visits')).status,401);
  assert.equal((await create('node.place',null,'Actual declared pointer',pin)).status,'completed');
  const catalog=async Cookie=>(await(await fetch(base+'/api/content-visits',{headers:{Cookie}})).json()).visits;
  const ca=await catalog(a),cb=await catalog(b);assert.equal(ca.length,2);assert.equal(cb.length,1);assert.deepEqual(ca[1],cb[0]);
  assert.equal(cb[0].node,'node-new');assert.equal(cb[0].position.x,4);assert.deepEqual(cb[0].pin,pin);assert.match(cb[0].descriptor,/^\/nexus\/api\/tables\//);
  const state=await(await fetch(base+'/api/state',{headers:{Cookie:b}})).json();assert.equal(state.nodes['node-new'].result.verification,'creator-declared');assert.ok(!JSON.stringify(state).includes('controlled-private-table'));
  assert.equal((await create('node.update',1,'Next deliberate pin',{...pin,revision:'edition-2'})).status,'completed');
  const next=await catalog(b);assert.equal(next[0].nodeRevision,2);assert.equal(next[0].pin.revision,'edition-2');assert.equal(ca[1].pin.revision,'edition-1');
 }finally{runtime.close();listener.closeAllConnections();await new Promise(r=>listener.close(r));}
});
