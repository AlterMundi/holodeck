import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Room,LIMITS} from '../src/room.mjs';
import {MAX_WORLD_ELEMENTS,DEFAULT_OBSERVATION_BYTES,OBSERVATION_CACHE_BYTES} from '../src/world-limits.mjs';
import {captureNativeSituation} from '../src/native-conversation.mjs';
import {validStoredNode} from '../src/content-nodes.mjs';
import {workshopProjection} from '../src/workshop-projection.mjs';
import {worldDocument} from '../src/world.mjs';
const bytes=value=>Buffer.byteLength(JSON.stringify(value));
const speaker={id:'human:'+'s'.repeat(194),kind:'human',name:'界'.repeat(40),rights:['observe','edit','project']};
const paired={id:'dm:being:v1:'+'p'.repeat(43),kind:'daimon',name:'界'.repeat(40),rights:['observe','edit','project']};
function fullRoom({nodes=8,history=256,persist=null}={}){
 let now=1000000;const actors=[speaker,paired,...Array.from({length:14},(_,i)=>({id:'fixture:'+i+'a'.repeat(180),kind:i%2?'human':'daimon',name:'界'.repeat(40)}))];
 const room=new Room({clock:()=>now,persist,presence:()=>actors.slice(0,8).map(a=>({actor:a.id,kind:a.kind,name:a.name,scope:'authenticated-network-presence'}))});
 room.run='fixture-capacity-run';room.sequence=256;
 for(let i=0;i<MAX_WORLD_ELEMENTS-1;i++){const id='garden-'+String(i).padStart(40,'0');room.entities[id]={id,revision:Number.MAX_SAFE_INTEGER,x:19.123456789012345,z:-3.123456789012345,color:'#a77bea',deleted:false};room.entityEditors[id]={actorRef:actors[i%actors.length].id,revision:Number.MAX_SAFE_INTEGER};}
 const ids=Array.from({length:nodes},(_,i)=>'node-'+String(i).padStart(40,'0'));
 for(const [i,id]of ids.entries()){
  const node={id,owner:'fixture-owner-'+i+'o'.repeat(180),revision:Number.MAX_SAFE_INTEGER,deleted:false,title:'界'.repeat(40),shape:'pedestal',position:{x:22.123456789012345,z:-1.123456789012345},play:{schema:'signal-garden/v1',targets:Array.from({length:4},(_,n)=>({x:18.123456789012345+n,z:-3.123456789012345,radius:1.123456789012345,color:'#a77bea'})),minContributors:8,requiredBridgeRaised:true},links:ids.filter(v=>v!==id).slice(0,4).map(id=>({id,revision:Number.MAX_SAFE_INTEGER}))};
  assert(validStoredNode(node,id));room.nodes[id]=node;
 }
 actors.forEach((a,i)=>room.focuses.set(a.id,{actor:a.id,kind:a.kind,name:a.name,target:Object.keys(room.entities)[i+1],revision:Number.MAX_SAFE_INTEGER,sequence:256,time:now}));
 actors.slice(0,8).forEach(a=>room.projections.set(a.id,{actor:a.id,kind:a.kind,position:{x:1.123456789012345,y:1.123456789012345,z:1.123456789012345},form:'beacon'}));
 room.events=Array.from({length:history},(_,i)=>({sequence:i+1,time:now,actor:paired.id,type:'node.update',detail:{target:ids[0],node:room.nodeState()[ids[0]],nativeRequest:'fixture-'+i}}));
 return {room,advance:ms=>{now+=ms}};
}

test('32 long canonical records share the capacity ceiling and fit the unchanged16KiB geometry manifest',()=>{
 const {room}=fullRoom();assert.equal(LIMITS.elements,32);assert.equal(MAX_WORLD_ELEMENTS,32);
 const state=room.snapshot(),restored=new Room({state,clock:room.clock});assert.deepEqual(restored.entities,room.entities);assert.deepEqual(restored.nodes,room.nodes);assert.deepEqual(restored.entityEditors,room.entityEditors);
 assert.equal(workshopProjection(room.entities).length,32);assert(bytes(room.entities)<=16384);
 assert.match(worldDocument(room,{includeVisits:false,includeCues:false}),/data-geometry-state/);
});

test('32 entities and8 maximum game definitions fit native32KiB plus4KiB view and exact speaker/paired indications',t=>{
 const {room}=fullRoom();const view={capturedAt:1000000,padding:''};view.padding='x'.repeat(4096-bytes(view));
 const value=captureNativeSituation(room,speaker,{id:crypto.randomUUID(),view},{pairedBeing:paired.id});
 t.diagnostic(JSON.stringify({bytes:bytes(value),omissions:value.source.omissions,manifestBytes:bytes(room.entities)}));
 assert(bytes(value)<=32768);if(value.clientReportedView.value)assert.equal(value.clientReportedView.value.padding,view.padding);else assert.equal(value.source.omissions.clientReportedViewBytes,4096);assert.deepEqual(value.entities,room.entities);
 assert.equal(Object.keys(value.nodes).length,8);for(const[id,node]of Object.entries(value.nodes)){assert.deepEqual(node.play,room.nodes[id].play);assert.deepEqual(node.position,room.nodes[id].position);assert.equal(node.revision,room.nodes[id].revision);assert.equal(node.owner,room.nodes[id].owner);}
 for(const a of [speaker,paired])assert.deepEqual(value.focus.find(s=>s.actor===a.id),room.focusState().find(s=>s.actor===a.id));
 assert(value.source.omissions.events>0);assert(value.source.omissions.nodeSummaries>0);assert.equal(value.source.partial,true);
});

test('default and explicit-null observations fit32KiB and byte/count eviction permits repeated reads',()=>{
 const {room}=fullRoom();for(let i=0;i<70;i++){const value=room.observe(speaker,i%2?{}:{maxBytes:null});assert(bytes(value)<=DEFAULT_OBSERVATION_BYTES);assert(room.observations.size<=LIMITS.observations);assert(bytes([...room.observations])<=OBSERVATION_CACHE_BYTES);}
 assert(bytes(room.snapshot())<5*1024*1024);assert.equal(Object.keys(room.entities).length,32);assert.equal(room.events.length,256);
});

test('legacy oversized/expired read-cache is trimmed on load without changing canonical state or outcomes',()=>{
 const {room}=fullRoom({history:0}),state=room.snapshot();state.outcomes=[['kept',{result:{status:'completed'},at:1000000}]];
 const ordinary=room.observe(speaker,{maxBytes:65536});state.observations=Array.from({length:70},(_,i)=>['legacy-'+i,{...ordinary,id:'legacy-'+i,capturedAt:1000000+i}]);state.observations.push(['oversized',{...ordinary,id:'oversized',padding:'x'.repeat(70000)}],['expired',{...ordinary,id:'expired',capturedAt:0}]);
 const loaded=new Room({state,clock:()=>1000000});assert(loaded.observations.size<=128);assert(bytes([...loaded.observations])<=OBSERVATION_CACHE_BYTES);assert(!loaded.observations.has('oversized'));assert(!loaded.observations.has('expired'));
 assert.deepEqual(loaded.entities,state.entities);assert.deepEqual(loaded.nodes,state.nodes);assert.deepEqual([...loaded.outcomes],state.outcomes);assert.deepEqual(loaded.events,state.events);
});

function bridgeCommand(room,observation,id='fixture-bridge-command'){return{id,issuedAt:room.clock(),run:room.run,edition:room.edition,observation:observation.id,type:'bridge.set',target:'bridge',expectedRevision:room.entities.bridge.revision,args:{raised:!room.entities.bridge.raised}};}

test('evicted reads require fresh capture for new commands; completed exact command IDs retain their outcomes',()=>{
 const room=new Room(),old=room.observe(speaker),cmd=bridgeCommand(room,old),result=room.command(speaker,cmd);
 for(let i=0;i<130;i++)room.observe(speaker);assert(!room.observations.has(old.id));assert.deepEqual(room.command(speaker,cmd),result);
 assert.equal(room.command(speaker,{...cmd,id:'fixture-new-command',expectedRevision:1,args:{raised:false}}).status,'rejected');
 assert.equal(room.command(speaker,bridgeCommand(room,room.observe(speaker),'fixture-fresh-command')).status,'completed');
});

test('failed cache persistence restores its exact preimage including eviction/expiry; later fresh capture succeeds',()=>{
 let reject=false,now=1000000;const room=new Room({clock:()=>now,persist:()=>{if(reject)throw Error('fixture-save-failed')}}),advance=ms=>{now+=ms};
 for(let i=0;i<128;i++)room.observe(speaker);const before=room.snapshot();reject=true;advance(LIMITS.retryMs+1);
 assert.throws(()=>room.observe(speaker),/fixture-save-failed/);assert.deepEqual(room.snapshot(),before);
 reject=false;room.observe(speaker);assert.equal(room.observations.size,1);assert.deepEqual(room.entities,before.entities);assert.deepEqual(room.nodes,before.nodes);
});


test('selected retained activity stays outside optional4KiB view and inside32KiB with the full canonical world',()=>{
 const {room}=fullRoom();const reference={schema:'holodeck.history-reference/v1',run:room.run,edition:room.edition,sequence:room.sequence,panelVisible:true,explicit:false};
 const view={capturedAt:1000000,historyReference:reference,padding:''};view.padding='x'.repeat(4096-bytes(view));
 const before=room.snapshot(),value=captureNativeSituation(room,speaker,{id:crypto.randomUUID(),view},{pairedBeing:paired.id});
 assert(bytes(value)<=32768);assert.equal(value.selectedActivity.status,'retained');assert.equal(value.selectedActivity.event.sequence,reference.sequence);assert.equal('current' in value.selectedActivity.event,false);assert(bytes(value.selectedActivity)<=2048);
 assert.deepEqual(value.entities,before.entities);for(const a of [speaker,paired])assert.deepEqual(value.focus.find(s=>s.actor===a.id),room.focusState().find(s=>s.actor===a.id));
 assert(value.source.omissions.clientReportedViewBytes>0);assert.equal(value.clientReportedView.value,null);
 const invalid=captureNativeSituation(room,speaker,{id:crypto.randomUUID(),view:{historyReference:{...reference,sequence:'not-a-sequence',eventText:'PRIVATE-FORGED-EVENT'}}},{pairedBeing:paired.id});assert.equal(invalid.selectedActivity.status,'invalid');assert.doesNotMatch(JSON.stringify(invalid),/PRIVATE-FORGED-EVENT/);
});
