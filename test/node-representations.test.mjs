import test from 'node:test';import assert from 'node:assert/strict';
import {Room} from '../src/room.mjs';import {worldDocument} from '../src/world.mjs';
import {readActivity} from '../src/activity.mjs';
import {nodeVisits} from '../src/content-nodes.mjs';
import {pickedRepresentationVisit} from '../src/node-representations.mjs';
const creator={id:'dm:being:v1:'+'a'.repeat(43),kind:'daimon',rights:['observe','edit']};
const pin={tableId:'fixture-table',reportId:'fixture-report',revision:'fixture-edition'};
const args=changes=>({title:'Research figure',shape:'pedestal',position:{x:3,z:2},result:{pin},links:[],representation:'footballer-10',...changes});
function act(room,type,data,revision=null){const seen=room.observe(creator);return room.command(creator,{id:crypto.randomUUID(),issuedAt:Date.now(),run:seen.run,edition:seen.edition,observation:seen.id,nativeRequest:'controlled-representation',type,target:'node-figure',expectedRevision:revision,args:data});}
test('catalogued representation persists through save and content-only changes while preserving one node',()=>{
 const room=new Room();assert.equal(act(room,'node.place',args()).status,'completed');
 const restored=new Room({state:room.snapshot()});assert.equal(restored.observe(creator).nodes['node-figure'].representation,'footballer-10');
 assert.equal(restored.observe(creator).place.contentCreation.representations['footballer-10'].height,1.65);
 assert.equal(readActivity(restored,creator).items[0].recorded.representation,'footballer-10');
 const next=args({result:{pin:{...pin,revision:'new-evidence'}}});assert.equal(act(restored,'node.update',next,1).status,'completed');
 assert.equal(restored.nodes['node-figure'].representation,'footballer-10');assert.equal(Object.keys(restored.nodes).length,1);
 const markup=worldDocument(restored,{basePath:'/holodeck/'});assert.match(markup,/assets\/footballer-10\.glb/);assert.match(markup,/data-content-node="node-figure"/);
 assert.ok(!markup.includes('fixture-table'));assert.ok(!worldDocument(restored,{includeVisits:false}).includes('footballer-10'));
});
test('representation cannot become a creator URL, path traversal, unregistered model or arbitrary declaration',()=>{
 for(const representation of ['https://example.org/mesh.glb','../private.glb','unknown-model',{asset:'footballer-10.glb'}]){
  const room=new Room();assert.equal(act(room,'node.place',args({representation})).status,'rejected');assert.equal(Object.keys(room.nodes).length,0);
 }
});
test('legacy unrepresented nodes remain valid and keep their previous scenery',()=>{
 const room=new Room(),data=args();delete data.representation;
 assert.equal(act(room,'node.place',data).status,'completed');assert.ok(!worldDocument(new Room({state:room.snapshot()})).includes('footballer-10.glb'));
});
test('a represented figure opens only its exact picked edition/revision, without sharing an indication or following a changed node',()=>{
 const record={target:'node-figure',run:'one',edition:'workshop',revision:1},state={run:'one',edition:'workshop',nodes:{'node-figure':{representation:'footballer-10',revision:1,deleted:false}}};
 assert.deepEqual(pickedRepresentationVisit(record,state),{id:'node-figure',revision:1});
 for(const change of [{run:'another'},{edition:'later'},{revision:2}])assert.equal(pickedRepresentationVisit({...record,...change},state),null);
 state.nodes['node-figure'].deleted=true;assert.equal(pickedRepresentationVisit(record,state),null);
});

test('represented context nodes preserve Field edition routes after reopen and revision-safe writes',()=>{
 const context={kind:'context',tableId:'field-development',contextId:'field-nexus-native',revision:'capture-fixture-v1'};
 const room=new Room();assert.equal(act(room,'node.place',args({result:{pin:context}})).status,'completed');
 const restored=new Room({state:room.snapshot()}),human={id:'human:representation-fixture',kind:'human',rights:['observe']};
 assert.equal(restored.observe(creator).nodes['node-figure'].result.kind,'context');
 assert.deepEqual(nodeVisits(restored.nodes,human)[0].pin,context);
 assert.match(nodeVisits(restored.nodes,human)[0].descriptor,/contexts\/field-nexus-native\/capture-fixture-v1\/visit$/);
 assert.equal(act(restored,'node.update',args({title:'Same selected context',result:{pin:context}}),1).status,'completed');
 const again=new Room({state:restored.snapshot()});assert.equal(again.nodes['node-figure'].representation,'footballer-10');
 assert.deepEqual(nodeVisits(again.nodes,human)[0].pin,context);
});
