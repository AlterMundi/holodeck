import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CONTENT_NODE,validateContentNodes,validateContentVisits,visitsForActor,nearestContentNode} from '../src/content-visits.mjs';
import {Room} from '../src/room.mjs';
import {worldDocument} from '../src/world.mjs';

const landmark={id:'research-fixture',title:'Selected research object',position:{x:5,y:.1,z:3}};
const pin={tableId:'fixture-table',reportId:'fixture-report',revision:'fixture-v1'};
const visit={id:'fixture',node:landmark.id,entry:'/nexus/?table=fixture-table&report_revision=fixture-v1',descriptor:'/nexus/descriptor',pin,discoverActors:['human:fixture']};

test('authored research entrances preserve the workshop entrance and reject unsafe or unbounded placements',()=>{
 const input=[structuredClone(CONTENT_NODE),structuredClone(landmark)];
 const nodes=validateContentNodes(input);input[1].position.x=20;
 assert.equal(nodes[1].position.x,5);
 assert.throws(()=>{nodes[1].position.x=20;});
 assert.throws(()=>validateContentNodes([]));
 assert.throws(()=>validateContentNodes([landmark]));
 assert.throws(()=>validateContentNodes([CONTENT_NODE,{...CONTENT_NODE}]));
 assert.throws(()=>validateContentNodes([{...CONTENT_NODE,position:{x:2,y:.1,z:3}}]));
 assert.throws(()=>validateContentNodes([CONTENT_NODE,...Array.from({length:8},(_,i)=>({...landmark,id:'research-'+i}))]));
 assert.throws(()=>validateContentNodes([CONTENT_NODE,...Array.from({length:7},(_,i)=>({...landmark,id:'research-'+i,title:'🌊'.repeat(40),model:'m'.repeat(80)+'.glb'}))]));
 for(const change of [{id:'garden-invented'},{id:'bridge'},{title:' '},{title:'x'.repeat(81)},{title:'hidden\nline'},
  {position:{x:Infinity,y:0,z:0}},{position:{x:0,y:0,z:31}},{position:{x:0,z:0}},{url:'https://private.test/secret'},
  ...['https://remote.test/model.glb','../secret.glb','/private.glb','nested/model.glb','file.glb?token=x'].map(model=>({model}))]){
  assert.throws(()=>validateContentNodes([CONTENT_NODE,{...landmark,...change}]));
 }
 assert.equal(validateContentNodes([CONTENT_NODE,{...landmark,model:'selected-figure.glb'}])[1].model,'selected-figure.glb');
});

test('a landmark resolves only selected visits and proximity offers only the current actor discovery',()=>{
 const nodes=validateContentNodes([CONTENT_NODE,landmark]);
 assert.throws(()=>validateContentVisits([visit]));
 const entries=validateContentVisits([visit],nodes);
 assert.equal(nearestContentNode(nodes,visitsForActor(entries,{id:'human:other'}),landmark.position),null);
 const allowed=visitsForActor(entries,{id:'human:fixture'});
 assert.equal(nearestContentNode(nodes,allowed,{x:4,y:1,z:3}).id,landmark.id);
 assert.equal(nearestContentNode(nodes,allowed,{x:5,y:20,z:3}),null);
 assert.equal(nearestContentNode(nodes,allowed,{x:15,z:3}),null);
 assert.equal(nearestContentNode(nodes,allowed,{x:NaN,z:3}),null);
 assert.throws(()=>validateContentVisits([{...visit,node:'research-unselected'}],nodes));
 const both=[...allowed,{...visit,id:'reading',node:CONTENT_NODE.id}];
 assert.equal(nearestContentNode(nodes,both,{x:CONTENT_NODE.position.x+1,y:.1,z:CONTENT_NODE.position.z}).id,CONTENT_NODE.id);
});

test('the same public entrances appear in situated context and MML while source pins stay outside scenery and exports',()=>{
 const nodes=[CONTENT_NODE,{...landmark,title:'A "quoted" <object>',model:'selected-figure.glb'}];
 const room=new Room({contentNodes:nodes});
 const observation=room.observe({id:'fixture',rights:['observe']});
 assert.deepEqual(observation.place.contents[1],nodes[1]);
 assert.equal('pin' in observation.place.contents[1],false);
 const markup=worldDocument(room,{basePath:'/holodeck/'});
 assert.match(markup,/data-content-node="research-fixture"/);
 assert.match(markup,/src="\/holodeck\/assets\/selected-figure.glb"/);
 assert.match(markup,/content="A &quot;quoted&quot; &lt;object&gt;"/);
 assert.doesNotMatch(markup,/<object>|fixture-report|fixture-v1/);
 assert.doesNotMatch(worldDocument(room,{includeVisits:false}),/data-content-node|selected-figure.glb/);
 // A selected entrance changes no garden IDs, command outcomes or save schema.
 const restored=new Room({state:room.snapshot(),contentNodes:nodes});
 assert.deepEqual(restored.entities,room.entities);
 assert.equal(restored.run,room.run);
 assert.equal(restored.snapshot().schema,'holodeck.room-save/v1');
});
