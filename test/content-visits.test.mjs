import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateContentVisits,visitsForActor,visitResponseMatches,knownVisitState} from '../src/content-visits.mjs';
import {Room} from '../src/room.mjs';
import {worldDocument} from '../src/world.mjs';
const pin={tableId:'fixture-table',reportId:'fixture-report',revision:'fixture-v1'};
const entry={id:'fixture',node:'reading-room',entry:'/nexus/?table=fixture-table&report_revision=fixture-v1',descriptor:'/nexus/api/fixture-visit',pin,discoverActors:['human:fixture']};
test('selected visit discovery is separate from media access and excludes other actors/private selection lists',()=>{
 const entries=validateContentVisits([entry]);
 assert.deepEqual(visitsForActor(entries,{id:'human:other'}),[]);
 const selected=visitsForActor(entries,{id:'human:fixture'});
 assert.equal(selected[0].pin.revision,'fixture-v1');assert.equal('discoverActors' in selected[0],false);
 selected[0].pin.revision='changed';assert.equal(entries[0].pin.revision,'fixture-v1');
 for(const path of ['https://foreign.test/nexus/','//foreign.test/nexus/','/nexus/../private','/nexus/%2e%2e/private','/nexus/\\evil','/nexus/?token=x#fragment']){
  assert.throws(()=>validateContentVisits([{...entry,entry:path}]));
 }
 assert.throws(()=>validateContentVisits([entry,{...entry,id:'second'}]));
 assert.throws(()=>validateContentVisits([entry,{...entry}]));
 assert.equal(knownVisitState({dirty:false,recording:false,processing:false,playing:false}),true);
 for(const value of [null,{}, {dirty:false,recording:false,playing:true},{dirty:false,recording:'false',processing:false,playing:true}])assert.equal(knownVisitState(value),false);
});
test('viewer acknowledgment binds exact frame, origin, request, visit and pinned edition',()=>{
 const source={},origin='https://world.test',id='request',visitId='visit';
 const bound={source,origin,id,visitId,pin};
 const event={source,origin,data:{schema:'dm.holodeck-visit/response-v1',id,visitId,pin,ok:true,result:{}}};
 assert.equal(visitResponseMatches(event,bound),true);
 for(const change of [{source:{}},{origin:'https://foreign.test'},{data:{...event.data,id:'other'}},{data:{...event.data,visitId:'other'}},{data:{...event.data,pin:{...pin,revision:'new'}}}]){
  assert.equal(visitResponseMatches({...event,...change},bound),false);
 }
});
test('spatial content entrance is shared authored context but never leaks a private content identity into creation geometry',()=>{
 const room=new Room(),observation=room.observe({id:'fixture',rights:['observe']});
 assert.equal(observation.place.contents[0].id,'reading-room');
 assert.equal('pin' in observation.place.contents[0],false);
 assert.match(worldDocument(room),/data-content-node="reading-room"/);
 assert.doesNotMatch(worldDocument(room,{includeVisits:false}),/data-content-node/);
});
