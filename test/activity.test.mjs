import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Room} from '../src/room.mjs';
import {readActivity,ActivityError,ACTIVITY_BYTES} from '../src/activity.mjs';
import {createHolodeck} from '../src/server.mjs';
const author={id:'fixture:author',kind:'daimon',rights:['observe','edit']};
const reader={id:'fixture:reader',kind:'human',rights:['observe']};
const bytes=value=>Buffer.byteLength(JSON.stringify(value));
function act(room,type,target,args,revision){
 const observation=room.observe(author);
 return room.command(author,{id:crypto.randomUUID(),issuedAt:room.clock(),run:room.run,edition:room.edition,
  observation:observation.id,nativeRequest:'PRIVATE-ORIGINAL-REFERENCE',type,target,expectedRevision:revision,args});
}
function query(page,before){return{run:page.run,through:String(page.through),before:String(before),limit:'20'};}

test('read-only projection retains actual authors and known post-state, compares current revisions without inventing preimages',()=>{
 const room=new Room();act(room,'garden.place','garden-first',{x:1,z:1,color:'mint'},null);
 act(room,'garden.update','garden-first',{x:2,z:1,color:'violet'},1);
 const boundary=room.sequence;act(room,'garden.update','garden-first',{x:3,z:2,color:'amber'},2);
 const before=room.snapshot(),page=readActivity(room,author,{run:room.run,through:String(boundary),before:String(boundary+1)});
 assert.deepEqual(room.snapshot(),before);assert.equal(page.observer,author.id);assert.equal(page.items[0].author.ref,author.id);assert.equal(page.items[0].author.isSelf,true);assert.equal(page.items[0].author.name,null);
 assert.deepEqual(page.items[0].recorded,{kind:'light',id:'garden-first',revision:2,x:2,z:1,color:'violet',deleted:false});
 assert.equal(page.items[0].current.revision,3);assert.equal(page.items[0].current.status,'revised');assert.equal(page.items[0].current.actionable,true);
 assert.equal(page.currentThrough,3);assert.equal(page.through,2);assert.equal('beforeState' in page.items[0],false);assert.doesNotMatch(JSON.stringify(page),/nativeRequest/);
 act(room,'garden.remove','garden-first',{},3);const deleted=readActivity(room,reader).items[0];assert.equal(deleted.current.status,'deleted');assert.equal(deleted.current.actionable,false);
});

test('20-item exclusive pages are bounded and frozen through; ring eviction and reset are explicit',()=>{
 const room=new Room();for(let i=0;i<256;i++)room.event(author,'participant.joined',{name:'NOT-A-TRUSTED-NAME'});
 const first=readActivity(room,reader);assert.equal(first.items.length,20);assert.equal(first.items[0].sequence,256);assert.equal(first.items.at(-1).sequence,237);assert.equal(first.nextBefore,237);assert.equal(first.retention.earlierUnavailable,false);
 room.event(author,'participant.left',{});const second=readActivity(room,reader,query(first,first.nextBefore));assert.equal(second.through,256);assert.equal(second.items[0].sequence,236);assert.equal(second.retention.firstSequence,2);assert.equal(second.gaps.earlierUnavailable,true);
 let cursor=first.nextBefore,all=first.items.map(x=>x.sequence),page;
 do{page=readActivity(room,reader,query(first,cursor));all.push(...page.items.map(x=>x.sequence));cursor=page.nextBefore;}while(cursor!==null);
 assert.equal(new Set(all).size,255);assert.equal(all.at(-1),2);assert.equal(page.gaps.earlierUnavailable,true);
 for(let i=0;i<256;i++)room.event(author,'participant.left',{});
 const lost=readActivity(room,reader,query(first,first.nextBefore));assert.deepEqual(lost.items,[]);assert.equal(lost.gaps.cursorEvicted,true);assert.equal(lost.nextBefore,null);
 room.reset();assert.throws(()=>readActivity(room,reader,{run:first.run}),e=>e instanceof ActivityError&&e.status===409&&e.code==='stale-run');
 assert.deepEqual(readActivity(room,reader).items,[]);
});

test('strict cursor validation and current observe rights never create an observation',()=>{
 const room=new Room(),before=room.snapshot();
 for(const q of [{limit:'21'},{limit:'0'},{limit:['2','3']},{limit:'01'},{through:'0'},{before:'1'},{run:room.run,through:'1',before:'2'},{run:room.run,through:'0',before:'2'},{unknown:'x'},{run:[]},{limit:'1.5'}])assert.throws(()=>readActivity(room,reader,q),e=>e.status===400);
 assert.throws(()=>readActivity(room,{...reader,rights:[]}),e=>e.status===403);assert.deepEqual(room.snapshot(),before);
 room.commitUncertain=true;assert.throws(()=>readActivity(room,reader),e=>e.status===503);
});

test('closed projection excludes raw native, conversation and private result content for all supported families and unknown types',()=>{
 const room=new Room();room.event(author,'garden.update',{target:'garden-first',entity:{id:'garden-first',revision:1,x:1,z:1,color:'mint',secret:'PRIVATE-ENTITY'},nativeRequest:'PRIVATE-NATIVE'});
 room.entities['garden-first']={id:'garden-first',revision:2,x:2,z:2,color:'violet',private:'PRIVATE-CURRENT'};
 const node={id:'node-game',revision:1,deleted:false,title:'Juego',shape:'pedestal',position:{x:2,z:2},play:{schema:'signal-garden/v1',targets:[{x:2,z:2,radius:1,color:'mint',secret:'PRIVATE-TARGET'}],minContributors:2,private:'PRIVATE-PLAY'},links:[],result:{selection:'PRIVATE-SELECTION',pin:{tableId:'PRIVATE-TABLE'}}};
 room.event(author,'node.place',{target:'node-game',node,nativeRequest:'PRIVATE-NODE-INPUT'});room.nodes['node-game']=node;
 room.event(author,'focus.set',{target:'garden-first',revision:1,nativeRequest:'PRIVATE-FOCUS'});
 room.event(author,'projection.changed',{actor:'PRIVATE-FOREIGN',position:{x:1,y:1,z:1},form:'beacon',appearance:{url:'PRIVATE-APPEARANCE'},nativeRequest:'PRIVATE-PROJECTION'});
 room.projections.set(author.id,{position:{x:1,y:1,z:1},form:'beacon'});
 room.event(author,'participant.joined',{name:'PRIVATE-GUESSED-NAME'});
 room.event(author,'conversation.PRIVATE-TYPE',{text:'PRIVATE-TEXT',files:['PRIVATE-FILE'],provider:'PRIVATE-PROVIDER'});
 const page=readActivity(room,reader),encoded=JSON.stringify(page);assert.doesNotMatch(encoded,/PRIVATE/);assert.equal(page.items[0].type,'unavailable');assert.equal(page.items[0].detailStatus,'unavailable');assert.equal(page.items[0].author.ref,author.id);
 assert.equal(page.items[1].author.name,null);assert.equal(page.items[1].author.nameSource,null);
 const game=page.items.find(item=>item.type==='node.place');assert.equal(game.recorded.content,'game');assert.equal(game.recorded.play.targets[0].color,'mint');assert.equal(game.current.state.title,'Juego');
 assert.equal(page.items.find(item=>item.type==='projection.changed').current.status,'current');
 const focus=page.items.find(item=>item.type==='focus.set');assert.equal(focus.eventRevision,1);assert.equal(focus.current.revision,2);
});

test('worst public node records shorten the page rather than exceed32KiB or skip a cursor',()=>{
 const room=new Room(),id='node-'+ 'a'.repeat(40),node={id,revision:Number.MAX_SAFE_INTEGER,deleted:false,title:'😀'.repeat(20),shape:'portal',position:{x:22.123456789012345,z:-1.123456789012345},play:{schema:'signal-garden/v1',targets:Array.from({length:4},()=>({x:18.123456789012345,z:-1.123456789012345,radius:1.123456789012345,color:'#a77bea'})),minContributors:8,requiredBridgeRaised:true},links:Array.from({length:4},(_,i)=>({id:'node-'+String(i).repeat(40),revision:Number.MAX_SAFE_INTEGER}))};
 room.nodes[id]=node;const long={...author,id:'界'.repeat(200)};
 for(let i=0;i<40;i++)room.event(long,'node.update',{target:id,node,nativeRequest:'x'.repeat(131072)});
 const before=room.snapshot(),first=readActivity(room,reader);assert(bytes(first)<=ACTIVITY_BYTES);assert(first.items.length>0&&first.items.length<20);assert.equal(first.byteLimited,true);assert.equal(first.nextBefore,first.items.at(-1).sequence);
 const next=readActivity(room,reader,query(first,first.nextBefore));assert.equal(next.items[0].sequence,first.nextBefore-1);assert(bytes(next)<=ACTIVITY_BYTES);assert.deepEqual(room.snapshot(),before);
});

test('missing legacy state/name/time is unavailable; a current snapshot is never substituted as historical state',()=>{
 const room=new Room();room.entities['garden-old']={id:'garden-old',revision:4,x:2,z:2,color:'mint'};
 room.events=[{sequence:1,time:null,actor:author.id,type:'garden.update',detail:{target:'garden-old'}},{sequence:3,actor:author.id,type:'unknown',detail:{}}];room.sequence=3;
 const page=readActivity(room,reader),item=page.items[1];assert.equal(item.recorded,null);assert.equal(item.time,null);assert.equal(item.author.name,null);assert.equal(item.current.state.revision,4);assert.equal(item.current.status,'unavailable');assert.equal(page.gaps.missingSequences,true);
});

test('HTTP activity route rechecks authentication and observe permission, with no canonical read-side writes',async()=>{
 let admitted=true,observe=true;
 const runtime=await createHolodeck({identityResolver:async req=>admitted&&req.headers.cookie?.includes('fixture=yes')?{id:reader.id,kind:'human',rights:observe?['observe']:[]}:null});
 const listener=runtime.app.listen(0,'127.0.0.1');await new Promise(resolve=>listener.once('listening',resolve));const base=`http://127.0.0.1:${listener.address().port}/`;
 try{
  assert.equal((await fetch(base+'api/activity')).status,401);
  const root=await fetch(base,{headers:{Cookie:'fixture=yes'}}),cookie='fixture=yes; '+root.headers.get('set-cookie').split(';')[0];
  runtime.room.event(author,'participant.joined',{name:'not-evidence'});const before=runtime.room.snapshot();
  const page=await fetch(base+'api/activity',{headers:{Cookie:cookie}});assert.equal(page.status,200);assert.equal((await page.json()).items.length,1);assert.deepEqual(runtime.room.snapshot(),before);
  assert.equal((await fetch(base+'api/activity?run=old',{headers:{Cookie:cookie}})).status,409);
  assert.equal((await fetch(base+'api/activity?limit=21',{headers:{Cookie:cookie}})).status,400);
  observe=false;assert.equal((await fetch(base+'api/activity',{headers:{Cookie:cookie}})).status,403);
  admitted=false;assert.equal((await fetch(base+'api/activity',{headers:{Cookie:cookie}})).status,401);
 }finally{runtime.close();listener.closeAllConnections();await new Promise(resolve=>listener.close(resolve));}
});

test('selected history resolves exact retained reference, bounds optional details, and never falls forward after eviction/reset',async()=>{
 const {resolveHistoryReference,SELECTED_ACTIVITY_BYTES}=await import('../src/activity.mjs');
 const room=new Room();act(room,'garden.place','garden-first',{x:1,z:1,color:'mint'},null);
 const reference={schema:'holodeck.history-reference/v1',run:room.run,edition:room.edition,sequence:1,panelVisible:true,explicit:false};
 const before=room.snapshot(),selected=resolveHistoryReference(room,reader,reference);
 assert.equal(selected.status,'retained');assert.equal(selected.event.sequence,1);assert.equal(selected.event.recorded.revision,1);assert.equal('current' in selected.event,false);assert(bytes(selected)<=SELECTED_ACTIVITY_BYTES);assert.deepEqual(room.snapshot(),before);
 for(const invalid of [{...reference,sequence:'1'},{...reference,panelVisible:false},{...reference,text:'PRIVATE-COPIED-EVENT'},null])assert.equal(resolveHistoryReference(room,reader,invalid).status,'invalid');
 assert.equal(resolveHistoryReference(room,reader,{...reference,sequence:100}).status,'unavailable');
 for(let i=0;i<256;i++)room.event(author,'participant.left',{});
 const expired=resolveHistoryReference(room,reader,reference);assert.equal(expired.status,'unavailable');assert.equal(expired.event,null);
 room.reset();const moved=resolveHistoryReference(room,reader,reference);assert.equal(moved.status,'different-run');assert.equal(moved.event,null);
 assert.throws(()=>resolveHistoryReference(room,{...reader,rights:[]},reference),e=>e.status===403);
});

test('selected activity preserves exact identity/core fields under2KiB without copying private pins or full recipe',async()=>{
 const {resolveHistoryReference}=await import('../src/activity.mjs');const room=new Room();
 const node={id:'node-'+ 'a'.repeat(40),revision:Number.MAX_SAFE_INTEGER,deleted:false,title:'😀'.repeat(20),shape:'portal',position:{x:22.123456789012345,z:-1.123456789012345},play:{schema:'signal-garden/v1',targets:Array.from({length:4},()=>({x:18.123456789012345,z:-1.123456789012345,radius:1.123456789012345,color:'#a77bea'})),minContributors:8,requiredBridgeRaised:true},links:Array.from({length:4},(_,i)=>({id:'node-'+String(i).repeat(40),revision:Number.MAX_SAFE_INTEGER})),result:{pin:'PRIVATE-PIN',selection:'PRIVATE-HASH'}};
 room.event({...author,id:'界'.repeat(200)},'node.update',{target:node.id,node,nativeRequest:'PRIVATE-ORIGINAL'});
 const selected=resolveHistoryReference(room,reader,{schema:'holodeck.history-reference/v1',run:room.run,edition:room.edition,sequence:1,panelVisible:false,explicit:true});
 assert(bytes(selected)<=2048);assert.equal(selected.status,'retained');assert.equal(selected.event.author.ref,'界'.repeat(200));assert.equal(selected.event.target,node.id);assert.equal(selected.event.eventRevision,Number.MAX_SAFE_INTEGER);assert.equal(selected.event.type,'node.update');assert.equal(selected.omissions.recipe,true);assert.doesNotMatch(JSON.stringify(selected),/PRIVATE/);
});

test('an oversized essential legacy event remains unavailable without blocking the original context',async()=>{
 const {captureNativeSituation}=await import('../src/native-conversation.mjs');
 const room=new Room();room.run='r'.repeat(180);room.edition='e'.repeat(180);room.event({id:'\u0001'.repeat(200)},'participant.left',{});
 const reference={schema:'holodeck.history-reference/v1',run:room.run,edition:room.edition,sequence:1,panelVisible:true,explicit:false};
 const context=captureNativeSituation(room,reader,{id:crypto.randomUUID(),view:{historyReference:reference}});
 assert.equal(context.selectedActivity.status,'unavailable');assert.equal(context.selectedActivity.event,null);assert.deepEqual(context.selectedActivity.reference,reference);assert(bytes(context.selectedActivity)<=2048);assert(bytes(context)<=32768);
});
