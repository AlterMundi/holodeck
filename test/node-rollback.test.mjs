import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Room} from '../src/room.mjs';
const actor={id:'human:fixture',kind:'human',rights:['observe','edit']};
test('legacy rollback retains future node graph and focus while supported old world operations continue',()=>{
 const source=new Room(),state=source.snapshot();
 state.nodes={'node-retained':{id:'node-retained',revision:2,owner:'dm:being:v1:'+'a'.repeat(43),deleted:false,title:'Retained result',shape:'portal',position:{x:1,z:2},result:{pin:{tableId:'fixture-table',reportId:'fixture-report',revision:'r1'}},links:[]}};
 state.sequence=1;state.focuses=[['human:fixture',{actor:'human:fixture',kind:'human',name:null,target:'node-retained',revision:2,sequence:1,time:Date.now()}]];
 let saved;const room=new Room({state,persist:value=>saved=value}),observation=room.observe(actor);
 assert.equal(observation.focus[0].status,'unavailable','legacy renderer does not pretend the retained node was deleted');
 const c={id:crypto.randomUUID(),issuedAt:Date.now(),run:room.run,edition:room.edition,observation:observation.id,type:'bridge.set',target:'bridge',expectedRevision:0,args:{raised:true}};
 assert.equal(room.command(actor,c).status,'completed');assert.equal(room.entities.bridge.raised,true);assert.deepEqual(saved.nodes,state.nodes);assert.deepEqual(new Room({state:saved}).snapshot().nodes,state.nodes);
 assert.deepEqual(saved.focuses,state.focuses);
 const plain=new Room();assert.equal('nodes' in plain.snapshot(),false,'old state remains unchanged when no future nodes exist');
 assert.throws(()=>new Room({state:{...state,nodes:[]}}),/invalid/);
 assert.throws(()=>new Room({state:{...state,nodes:{large:'x'.repeat(65537)}}}),/invalid/);
});
