import {test} from 'node:test';import assert from 'node:assert/strict';
import {Room} from '../src/room.mjs';import {DaimonPort} from '../src/daimon-port.mjs';
import {nodeVisits,contentSelection,MAX_CONTENT_NODES} from '../src/content-nodes.mjs';
import {worldDocument} from '../src/world.mjs';
const creator={id:'dm:being:v1:'+'a'.repeat(43),kind:'daimon',rights:['observe','edit']},other={...creator,id:'dm:being:v1:'+'b'.repeat(43)};
const human={id:'human:fixture-node-reader',kind:'human',rights:['observe','edit']};
const pin={kind:'artifact_review',tableId:'private-table',reviewId:'private-review',revision:'private-edition',adapter:'interactive_3d'};
const data=(changes={})=>({title:'A shared result',shape:'portal',position:{x:3,z:2},result:{pin},links:[],...changes});
function command(room,actor,type,target,args,expectedRevision,observation=room.observe(actor)){
 return {id:crypto.randomUUID(),issuedAt:Date.now(),run:observation.run,edition:observation.edition,observation:observation.id,nativeRequest:'controlled-node-original',type,target,args,expectedRevision};
}
const act=(room,actor,...args)=>room.command(actor,command(room,actor,...args));
test('native creator shares a declared result pointer without source/config mutation; observers share references without receiving content grants',async()=>{
 let saved;const room=new Room({persist:s=>{saved=s;}}),port=new DaimonPort(room,async()=>creator);
 const c=command(room,creator,'node.place','node-first',data(),null);const original=await port.act(null,c);
 assert.equal(original.status,'completed');assert.deepEqual(await port.act(null,c),original);
 assert.deepEqual((await port.observe(null)).nodes['node-first'].declaredResultPin,pin);
 const a=room.observe(human),b=room.observe(other);assert.deepEqual(a.nodes,b.nodes);assert.equal(a.nodes['node-first'].revision,1);
 assert.equal(a.nodes['node-first'].result.verification,'creator-declared');assert.equal(a.nodes['node-first'].result.selection,contentSelection(pin));
 assert.deepEqual(a.nodes['node-first'].declaredResultPin,pin,'world-observer declaration parity does not depend on human/daimon kind or node ownership');
 for(const bytes of [JSON.stringify(room.nodeState()),worldDocument(room)])for(const secret of ['private-table','private-review','private-edition'])assert.ok(!bytes.includes(secret));
 assert.match(worldDocument(room),/data-content-node="node-first"/);assert.ok(!worldDocument(room,{includeVisits:false}).includes('content-node-first'));
 assert.deepEqual(new Room({state:saved}).nodes,room.nodes);assert.equal(room.entities.bridge.revision,0);
 const visits=nodeVisits(room.nodes,human);assert.equal(visits.length,1);assert.equal(visits[0].descriptor,'/nexus/api/tables/private-table/artifact-review/private-review/private-edition/visit');assert.deepEqual(visits[0].pin,pin);assert.equal(visits[0].node,'node-first');assert.equal(visits[0].resultVerification,'creator-declared');
 assert.deepEqual(nodeVisits(room.nodes,{...human,rights:[]}),[]);assert.deepEqual(nodeVisits(room.nodes,creator),[]);
});
test('node revisions, owner checks and revision-bound links reject stale/forged input and retain historical relation meaning',()=>{
 const room=new Room();assert.equal(act(room,creator,'node.place','node-a',data(),null).status,'completed');
 const stale=room.observe(creator);assert.equal(act(room,creator,'node.place','node-b',data({position:{x:-3,z:2},links:[{id:'node-a',revision:1}]}),null).status,'completed');
 assert.match(worldDocument(room),/data-content-link="node-b:node-a"/);
 assert.equal(act(room,other,'node.update','node-a',data(),1).status,'rejected');
 assert.equal(act(room,creator,'node.update','node-a',data({title:'Next edition',result:{pin:{...pin,revision:'second'}}}),1).status,'completed');
 assert.ok(!worldDocument(room).includes('data-content-link="node-b:node-a"'));
 assert.equal(room.nodeState()['node-b'].links[0].status,'revised');assert.equal(room.nodeState()['node-b'].links[0].revision,1);
 assert.equal(room.command(creator,command(room,creator,'node.update','node-a',data(),2,stale)).status,'rejected');
 assert.equal(act(room,creator,'node.place','node-c',data({links:[{id:'node-a',revision:1}]}),null).status,'rejected');
 assert.equal(act(room,creator,'node.place','node-c',data({links:[{id:'node-c',revision:1}]}),null).status,'rejected');
 assert.equal(act(room,creator,'node.remove','node-a',{},2).status,'completed');assert.equal(room.nodeState()['node-b'].links[0].status,'deleted');
 assert.equal(act(room,creator,'node.place','node-a',data(),null).status,'rejected');assert.equal(nodeVisits(room.nodes,human).length,1);
});
test('closed declaration accepts report pins but refuses executable routes, unbounded fields and human native-source spoofing',()=>{
 const room=new Room(),report={tableId:'report-table',reportId:'report-1',revision:'edition-1'};
 assert.equal(act(room,creator,'node.place','node-report',data({result:{pin:report},shape:'pedestal'}),null).status,'completed');
 const visit=nodeVisits(room.nodes,human)[0];assert.match(visit.entry,/report_revision=edition-1/);assert.match(visit.descriptor,/reports\/report-1\/edition-1\/visit$/);
 for(const args of [data({code:'alert(1)'}),data({result:{pin:{...pin,url:'https://private.invalid'}}}),data({position:{x:30,z:0}}),data({title:'x'.repeat(41)}),data({links:[{id:'node-report',revision:1,secret:'x'}]})])assert.equal(act(room,creator,'node.place','node-bad',args,null).status,'rejected');
 assert.throws(()=>act(room,human,'node.place','node-human',data(),null),/Native source/);
});
test('eight slots include tombstones; removal cannot silently reuse identity, and persistence failure restores node graph',()=>{
 const room=new Room();for(let i=0;i<MAX_CONTENT_NODES;i++)assert.equal(act(room,creator,'node.place','node-'+i,data(),null).status,'completed');
 assert.equal(act(room,creator,'node.remove','node-0',{},1).status,'completed');assert.equal(act(room,creator,'node.place','node-extra',data(),null).status,'rejected');
 const pending=command(room,creator,'node.update','node-1',data({title:'Not committed'}),1),snapshot=room.snapshot();room.persist=()=>{throw Error('Fixture storage failure');};
 assert.throws(()=>room.command(creator,pending),/storage failure/);assert.deepEqual(room.snapshot(),snapshot);
});

test('full node graph retains canonical references inside bounded native situation instead of failing or silently dropping nodes',()=>{
 const people=Array.from({length:16},(_,i)=>({actor:'human:'+String(i).padEnd(190,'x'),kind:'human',name:'n'.repeat(40)}));
 const room=new Room({presence:()=>people});
 for(let i=0;i<31;i++)act(room,creator,'garden.place','garden-'+i,{x:0,z:0,color:'mint'},null);
 for(let i=0;i<8;i++)act(room,creator,'node.place','node-'+String(i).padEnd(40,'x'),data({title:'t'.repeat(40),links:Array.from({length:Math.min(i,4)},(_,j)=>({id:'node-'+String(j).padEnd(40,'x'),revision:1}))}),null);
 for(let i=0;i<16;i++){
  const person={...people[i],id:people[i].actor,rights:['observe','edit']},observation=room.observe(person);
  const c={id:crypto.randomUUID(),issuedAt:Date.now(),run:room.run,edition:room.edition,observation:observation.id,type:'focus.set',target:'garden-'+i,expectedRevision:1,args:{}};
  assert.equal(room.command(person,c).status,'completed');
 }
 const full=room.capture(creator,{after:Math.max(0,room.sequence-16)}),bounded=room.capture(creator,{after:Math.max(0,room.sequence-16),maxBytes:32768-5000});
 assert.equal(Object.keys(bounded.nodes).length,8);assert.equal(Object.keys(bounded.entities).length,32);assert.deepEqual(bounded.nodes,full.nodes);
 assert.ok(Buffer.byteLength(JSON.stringify(bounded))<=32768-5000);
 if(bounded.source.partial)assert.ok(Object.values(bounded.source.omissions).some(Boolean));
});

test('human indication and native observation refer to the same result node revision, including updates and deletion',()=>{
 const room=new Room();act(room,creator,'node.place','node-shared',data(),null);
 const captured=room.observe(human),focus=command(room,human,'focus.set','node-shared',{},1,captured);delete focus.nativeRequest;
 assert.equal(room.command(human,focus).status,'completed');assert.equal(room.observe(other).focus[0].target,'node-shared');
 assert.match(worldDocument(room),/id="node-shared" data-entity-revision="1"/);assert.match(worldDocument(room),/data-focus-target="node-shared"/);
 act(room,creator,'node.update','node-shared',data({title:'Later revision'}),1);assert.equal(room.observe(other).focus[0].status,'revised');
 const stale=command(room,human,'focus.set','node-shared',{},2,captured);delete stale.nativeRequest;assert.equal(room.command(human,stale).status,'rejected');
 act(room,creator,'node.remove','node-shared',{},2);assert.equal(room.focusState()[0].status,'deleted');
 assert.equal(new Room({state:room.snapshot()}).focusState()[0].status,'deleted');
});
