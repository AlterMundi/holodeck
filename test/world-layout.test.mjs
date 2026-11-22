import {test} from 'node:test';import assert from 'node:assert/strict';
import {Room} from '../src/room.mjs';import {creationContains,nearestCreationPosition,TERRACES,PROMENADES} from '../src/world-layout.mjs';
import {readFileSync} from 'node:fs';import {exportWorldSnapshot} from '../tools/export-world-snapshot.mjs';
const native={id:'dm:being:v1:'+'e'.repeat(43),kind:'daimon',rights:['observe','edit']},human={id:'human:layout',kind:'human',rights:['observe','edit']};
function act(room,type,target,args,expectedRevision=null){const o=room.observe(native);return room.command(native,{id:crypto.randomUUID(),issuedAt:Date.now(),run:o.run,edition:o.edition,observation:o.id,type,target,args,expectedRevision,nativeRequest:'controlled-layout-fixture'});}
test('the same expanded regions admit shared creation while gaps and water refuse; existing plaza saves remain valid',()=>{
 const room=new Room();assert.equal(act(room,'garden.place','garden-east',{x:19,z:-1,color:'violet'}).status,'completed');
 assert.equal(act(room,'garden.place','garden-water',{x:12,z:4,color:'mint'}).status,'rejected');
 const data={title:'Separated activity',shape:'pedestal',position:{x:22,z:4},links:[],play:{schema:'signal-garden/v1',targets:[{x:19,z:-1,radius:1,color:'violet'},{x:25,z:-1,radius:1,color:'amber'}],minContributors:2}};
 assert.equal(act(room,'node.place','node-east',data).status,'completed');assert.deepEqual(room.observe(native).nodes,room.observe(human).nodes);
 assert.deepEqual(new Room({state:room.snapshot()}).entities,room.entities);assert.equal(creationContains(-7,-6),true);
 const observation=room.observe(native),snapshot=exportWorldSnapshot(observation,readFileSync(new URL('../public/assets/island-scenery.glb',import.meta.url)));assert.ok(snapshot.length>0);
 assert.equal(observation.place.layoutVersion,'island-archipelago@2');assert.deepEqual(nearestCreationPosition(22,-1),{x:22,z:-1});assert.equal(creationContains(12,4),false);
});
test('wide promenade ends overlap their terrace surfaces across their full width',()=>{
 for(const p of PROMENADES)for(const x of [p.minX,p.maxX])for(const z of [p.minZ,p.maxZ])assert.ok(TERRACES.some(t=>Math.hypot(x-t.x,z-t.z)<=t.radius),`${p.id} must not have an unsupported edge at ${x},${z}`);
});
