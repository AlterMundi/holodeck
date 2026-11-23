import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {Room} from '../src/room.mjs';import {worldDocument} from '../src/world.mjs';
import {createHolodeck} from '../src/server.mjs';
import {nodeVisits} from '../src/content-nodes.mjs';
import {validSignalGarden,signalGardenProgress,signalColourName} from '../src/playable-creations.mjs';
const native={id:'dm:being:v1:'+'d'.repeat(43),ref:'dm:being:v1:'+'d'.repeat(43),kind:'daimon',rights:['observe','edit']};
const human={id:'human:actual-fixture',kind:'human',rights:['observe','edit']};
const recipe={schema:'signal-garden/v1',targets:[{x:-2,z:1,radius:.8,color:'mint'},{x:2,z:1,radius:.8,color:'amber'}],minContributors:2};
const nodeData=play=>({title:'Jardín de señales',shape:'pedestal',position:{x:0,z:4},links:[],play});
function proposal(room,actor,type,target,args,expectedRevision){const o=room.observe(actor);return {id:crypto.randomUUID(),issuedAt:Date.now(),run:o.run,edition:o.edition,observation:o.id,type,target,args,expectedRevision,...(actor.kind==='daimon'?{nativeRequest:'controlled-play-original'}:{})};}
const act=(room,actor,...args)=>room.command(actor,proposal(room,actor,...args));
const progress=room=>room.observe(human).nodes['node-play'].progress;

test('browser recipe author can create, revise and remove only their own node at its observed revision',()=>{
 const room=new Room(),visitor={...human,id:'human:visitor'},reader={...visitor,rights:['observe']};
 const target='node-human-garden',data=nodeData(recipe),next={...data,title:'Jardín ampliado'};
 assert.throws(()=>act(room,reader,'node.place',target,data,null),/Editing access required/);
 const create=proposal(room,human,'node.place',target,data,null),beforeCreate=room.observe(human);
 const receipt=room.command(human,create);
 assert.equal(receipt.status,'completed');assert.deepEqual(room.command(human,create),receipt);
 assert.equal(room.nodeState()[target].owner,human.id);
 assert.equal(room.nodeState()[target].revision,1);
 assert.equal(new Room({state:room.snapshot()}).nodes[target].owner,human.id);
 assert.equal(act(room,visitor,'node.update',target,next,1).status,'rejected');
 assert.equal(act(room,native,'node.remove',target,{},1).status,'rejected');
 const stale={...proposal(room,human,'node.update',target,next,1),observation:beforeCreate.id};
 assert.equal(room.command(human,stale).status,'rejected');
 assert.equal(act(room,human,'node.update',target,next,1).status,'completed');
 assert.equal(act(room,human,'node.remove',target,{},1).status,'rejected');
 assert.equal(act(room,human,'node.remove',target,{},2).status,'completed');
 assert.equal(room.nodes[target].owner,human.id);assert.equal(room.nodes[target].revision,3);
 assert.equal(room.nodes[target].deleted,true);assert.deepEqual(nodeVisits(room.nodes,visitor),[]);
});

test('browser recipe edits cannot spoof authorship, publish result pins or replace result nodes',()=>{
 const room=new Room(),data=nodeData(recipe),{play,...base}=data;
 const result={...base,result:{pin:{kind:'context',tableId:'study',contextId:'mapping',revision:'first'}}};
 const target='node-browser-garden',nativeTarget='node-native-result';
 const forged={...proposal(room,human,'node.place',target,data,null),nativeRequest:'forged-original'};
 assert.throws(()=>room.command(human,forged),/Native source/);
 assert.equal(act(room,human,'node.place',target,{...data,owner:native.id},null).status,'rejected');
 assert.equal(act(room,human,'node.place',target,result,null).status,'rejected');
 assert.equal(act(room,human,'node.place',target,{...result,play},null).status,'rejected');
 assert.equal(act(room,human,'node.place',target,data,null).status,'completed');
 assert.equal(act(room,human,'node.update',target,result,1).status,'rejected');
 assert.equal(act(room,native,'node.place',nativeTarget,result,null).status,'completed');
 assert.equal(room.nodes[target].revision,1);
 assert.equal(room.nodes[nativeTarget].owner,native.id);
 assert.equal(nodeVisits(room.nodes,human).length,1);
 // Older checkpoints can carry a result under a human owner string.
 const state=room.snapshot();state.nodes[nativeTarget].owner=human.id;
 const restored=new Room({state});
 assert.equal(act(restored,human,'node.update',nativeTarget,data,1).status,'rejected');
 assert.equal(act(restored,human,'node.remove',nativeTarget,{},1).status,'rejected');
 assert.deepEqual(restored.nodes[nativeTarget],state.nodes[nativeTarget]);
});

test('browser recipe commands use the current authenticated HTTP actor and edit grant',async t=>{
 const stateDir=mkdtempSync(join(tmpdir(),'holodeck-playable-http-')),publicOrigin='https://world.test';
 t.after(()=>rmSync(stateDir,{recursive:true,force:true}));
 let rights=['observe','edit'];
 const runtime=await createHolodeck({stateDir,publicOrigin,production:true,
  identityResolver:async req=>req.headers.cookie?.includes('home=fixture')?{...human,rights}:null});
 const listener=runtime.app.listen(0,'127.0.0.1');
 await new Promise(resolve=>listener.once('listening',resolve));
 t.after(()=>{runtime.close();listener.closeAllConnections();return new Promise(resolve=>listener.close(resolve));});
 const base=`http://127.0.0.1:${listener.address().port}`;
 const index=await fetch(base+'/',{headers:{cookie:'home=fixture'}});
 assert.equal(index.status,200);await index.text();
 const cookie='home=fixture; '+index.headers.get('set-cookie').split(';')[0];
 const current=async()=>await (await fetch(base+'/api/state',{headers:{cookie}})).json();
 const post=(path,body,headers={})=>fetch(base+'/api/'+path,{method:'POST',
  headers:{cookie,origin:publicOrigin,'content-type':'application/json',...headers},body:JSON.stringify(body)});
 assert.equal((await current()).canEdit,true);
 const captured=await post('observe',{});assert.equal(captured.status,200);
 const {run,edition,id:observation}=await captured.json();
 const place={id:crypto.randomUUID(),issuedAt:Date.now(),run,edition,observation,
  type:'node.place',target:'node-http-garden',expectedRevision:null,args:nodeData(recipe)};
 assert.equal((await post('commands',place,{origin:'https://other.test'})).status,403);
 const placed=await post('commands',place);assert.equal(placed.status,200);
 assert.equal((await placed.json()).status,'completed');
 assert.equal((await current()).nodes[place.target].owner,human.id);
 rights=['observe'];
 assert.equal((await current()).canEdit,false);
 const denied=await post('commands',{...place,id:crypto.randomUUID(),target:'node-other-garden'});
 assert.equal(denied.status,409);
 assert.equal((await current()).nodes['node-other-garden'],undefined);
});

test('native-authored game uses actual shared planting, contributors and cursor; recipe revision stays stable while gameplay changes',()=>{
 const room=new Room(),definition=proposal(room,native,'node.place','node-play',nodeData(recipe),null),created=room.command(native,definition);
 assert.equal(created.status,'completed');assert.deepEqual(room.command(native,definition),created);assert.equal(room.nodeState()['node-play'].progress.through,room.sequence);
 assert.equal(room.events.at(-1).detail.node.progress.through,room.sequence);assert.equal(nodeVisits(room.nodes,human).length,0);
 assert.equal(progress(room).complete,false);assert.equal(progress(room).contributors,0);
 assert.equal(act(room,human,'garden.place','garden-human',{x:-2,z:1,color:'#8CE4C2'},null).status,'completed');
 assert.equal(progress(room).filledTargets,1);assert.equal(progress(room).contributors,1);
 assert.equal(act(room,native,'garden.place','garden-native',{x:2,z:1,color:'amber'},null).status,'completed');
 const done=progress(room);assert.equal(done.complete,true);assert.equal(done.contributors,2);assert.equal(done.filledTargets,2);assert.equal(done.through,room.sequence);assert.equal(room.nodes['node-play'].revision,1);
 assert.deepEqual(room.observe(native).nodes['node-play'].progress,done);assert.match(room.nodeState()['node-play'].status,/completado/);
 assert.equal(act(room,human,'garden.remove','garden-human',{},1).status,'completed');assert.equal(progress(room).complete,false);assert.equal(progress(room).contributors,1);
 assert.equal(act(room,native,'node.update','node-play',nodeData({...recipe,minContributors:1}),1).status,'completed');assert.equal(room.nodes['node-play'].revision,2);assert.equal(progress(room).definitionRevision,2);
});
test('same canonical being across bodies counts once; required bridge uses actual current state and authoritative editor',()=>{
 const room=new Room();act(room,native,'node.place','node-play',nodeData({...recipe,requiredBridgeRaised:true}),null);
 act(room,native,'garden.place','garden-one',{x:-2,z:1,color:'mint'},null);
 const anotherBody={...native,id:'controlled-body-alias',ref:native.ref};act(room,anotherBody,'garden.place','garden-two',{x:2,z:1,color:'amber'},null);
 assert.equal(progress(room).contributors,1);assert.equal(progress(room).bridgeReady,false);
 assert.equal(act(room,human,'bridge.set','bridge',{raised:true},0).status,'completed');assert.equal(progress(room).complete,true);assert.equal(progress(room).contributors,2);
 assert.equal(act(room,human,'bridge.set','bridge',{raised:false},1).status,'completed');assert.equal(progress(room).complete,false);assert.equal(progress(room).contributors,1);
});
test('stale or absent editor records from legacy fallback never fabricate another contributor; public projections omit private stamp map',()=>{
 const room=new Room();act(room,native,'node.place','node-play',nodeData(recipe),null);
 act(room,human,'garden.place','garden-one',{x:-2,z:1,color:'mint'},null);act(room,native,'garden.place','garden-two',{x:2,z:1,color:'amber'},null);
 const saved=room.snapshot();assert.equal(new Room({state:saved}).nodeState()['node-play'].progress.complete,true);
 // Model an older writer changing geometry/revision while retaining an opaque
 // old stamp: it does not know the new attribution field or actor.
 saved.entities['garden-one'].revision++;const restored=new Room({state:saved});
 assert.equal(progress(restored).contributors,1);assert.equal(progress(restored).unattributedMatches,1);assert.equal(progress(restored).complete,false);
 const legacy=structuredClone(saved);delete legacy.entityEditors;assert.equal(progress(new Room({state:legacy})).contributors,0);
 const observed=room.observe(human);assert.equal(Object.hasOwn(observed,'entityEditors'),false);assert.ok(!JSON.stringify(observed.entities).includes('actorRef'));assert.ok(!worldDocument(room).includes('actorRef'));assert.ok(!JSON.stringify(room.events).includes('entityEditors'));
 const before=room.snapshot(),command=proposal(room,human,'garden.update','garden-one',{x:-2,z:1,color:'rose'},1),checkpoint=room.snapshot();room.persist=()=>{throw Error('Fixture durable failure');};
 assert.throws(()=>room.command(human,command),/durable failure/);assert.deepEqual(room.snapshot(),checkpoint);assert.deepEqual(room.entityEditors,before.entityEditors);
});
test('target matching uses distinct lights and maximum coverage rather than greedy or overlapping double credit',()=>{
 const play={schema:'signal-garden/v1',minContributors:1,targets:[{x:0,z:0,radius:1.5,color:'mint'},{x:.8,z:0,radius:.4,color:'mint'}]};
 const entities={'garden-a':{revision:1,x:.8,z:0,color:'mint'},'garden-b':{revision:1,x:-1,z:0,color:'mint'}};
 assert.equal(signalGardenProgress(play,{entities}).filledTargets,2);
 delete entities['garden-b'];assert.equal(signalGardenProgress(play,{entities}).filledTargets,1);
 const result=signalGardenProgress({...play,targets:[{x:0,z:0,radius:.8,color:'mint'}]},{entities});assert.equal(result.filledTargets,1,'radius boundary is inclusive');
});
test('recipe is a closed bounded data union; no fake score/player stamps or dummy result viewer accepted',()=>{
 assert.equal(validSignalGarden(recipe),true);
 for(const play of [{...recipe,targets:[]},{...recipe,targets:Array(5).fill(recipe.targets[0])},{...recipe,minContributors:0},{...recipe,minContributors:9},{...recipe,score:100},{...recipe,requiredBridgeRaised:'true'},{...recipe,targets:[{...recipe.targets[0],x:7}]},{...recipe,targets:[{...recipe.targets[0],color:'url(secret)'}]}])assert.equal(validSignalGarden(play),false);
 const room=new Room();assert.equal(act(room,native,'node.place','node-play',{...nodeData(recipe),result:{pin:{tableId:'x',reportId:'x',revision:'x'}}},null).status,'rejected');
 assert.equal(act(room,native,'node.place','node-play',{...nodeData(recipe),entityEditors:{forged:true}},null).status,'rejected');
 assert.equal(act(room,native,'node.place','node-play',nodeData(recipe),null).status,'completed');
 const markup=worldDocument(room);assert.match(markup,/data-play-schema="signal-garden\/v1"/);assert.match(markup,/data-play-target="0"/);assert.match(room.nodeState()['node-play'].instruction,/Plantá luces menta, ámbar/);assert.ok(!markup.includes('undefined'));assert.ok(!worldDocument(room,{includeVisits:false}).includes('data-play-target'));
 const saved=room.snapshot();assert.deepEqual(new Room({state:saved}).nodes,room.nodes);
});


test('editor stamps cover all32 entities, reject invalid restore input and cannot be supplied in garden commands',()=>{
 const room=new Room();for(let i=0;i<31;i++)act(room,human,'garden.place','garden-slot-'+i,{x:0,z:0,color:'mint'},null);
 act(room,native,'bridge.set','bridge',{raised:true},0);assert.equal(Object.keys(room.entityEditors).length,32);
 const saved=room.snapshot();assert.equal(Object.keys(new Room({state:saved}).entityEditors).length,32);
 for(let i=0;i<8;i++)assert.equal(act(room,native,'node.place','node-play-'+i,nodeData({...recipe,targets:[{x:0,z:0,radius:.6,color:'mint'},{x:2,z:0,radius:.6,color:'amber'},{x:-2,z:0,radius:.6,color:'rose'},{x:0,z:2,radius:.6,color:'violet'}]}),null).status,'completed');
 const bounded=room.capture(human,{after:Math.max(0,room.sequence-16),maxBytes:32768-5000});assert.equal(Object.keys(bounded.nodes).length,8);assert.equal(Object.keys(bounded.entities).length,32);assert.ok(Buffer.byteLength(JSON.stringify(bounded))<=32768-5000);for(const n of Object.values(bounded.nodes))assert.ok(!JSON.stringify(n.progress).includes('actorRef'));
 for(const entityEditors of [[],{bridge:{actorRef:'forged',revision:2}},{bridge:{actorRef:'x'.repeat(201),revision:1}},{missing:{actorRef:'x',revision:1}},{bridge:{actorRef:'x',revision:1,player:'forged'}},Object.fromEntries(Array.from({length:33},(_,i)=>['slot'+i,{actorRef:'x',revision:1}]))])assert.throws(()=>new Room({state:{...saved,entityEditors}}),/checkpoint/);
 assert.equal(act(room,human,'garden.update','garden-slot-0',{x:0,z:0,color:'mint',actorRef:native.id},1).status,'rejected');
 const stale=proposal(room,human,'garden.update','garden-slot-0',{x:0,z:0,color:'amber'},1);
 act(room,native,'garden.update','garden-slot-0',{x:0,z:0,color:'rose'},1);assert.equal(room.command(human,stale).status,'rejected');assert.equal(room.entityEditors['garden-slot-0'].actorRef,native.ref);
 room.reset();assert.deepEqual(room.entityEditors,{});
});


test('several canonical actors can collaborate within one target, but off-target or wrong-colour edits earn no credit',()=>{
 const room=new Room(),play={schema:'signal-garden/v1',targets:[{x:0,z:0,radius:1,color:'mint'}],minContributors:2};
 assert.equal(validSignalGarden(play),true);act(room,native,'node.place','node-play',nodeData(play),null);
 act(room,human,'garden.place','garden-a',{x:0,z:0,color:'mint'},null);assert.equal(progress(room).contributors,1);
 act(room,native,'garden.place','garden-outside',{x:4,z:0,color:'mint'},null);assert.equal(progress(room).contributors,1);
 act(room,native,'garden.place','garden-wrong',{x:0,z:0,color:'amber'},null);assert.equal(progress(room).contributors,1);
 act(room,native,'garden.place','garden-b',{x:.5,z:0,color:'mint'},null);assert.equal(progress(room).filledTargets,1);assert.equal(progress(room).contributors,2);assert.equal(progress(room).complete,true);
 assert.equal(signalColourName('mint'),'menta');assert.equal(signalColourName('#8CE4C2'),'menta');assert.equal(signalColourName('#123ABC'),'#123abc');
 assert.match(worldDocument(room),/content="1 · menta · lista"/);
});
