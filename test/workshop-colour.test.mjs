import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Room} from '../src/room.mjs';
import {workshopColour} from '../src/workshop.mjs';
import {workshopProjection} from '../src/workshop-projection.mjs';
import {exportWorldSnapshot} from '../tools/export-world-snapshot.mjs';
import {exportReviewScene} from '../tools/export-review-scene.mjs';
const actor={id:'colour-fixture',kind:'human',rights:['observe','edit']};
const scenery=readFileSync(new URL('../public/assets/island-scenery.glb',import.meta.url));
function command(room,type,color,expectedRevision){
 const observation=room.observe(actor);
 return room.command(actor,{id:crypto.randomUUID(),issuedAt:Date.now(),run:room.run,edition:room.edition,observation:observation.id,type,target:'garden-colour',expectedRevision,args:{x:1,z:1,color}});
}
test('violet and strict RGB updates retain identity/revision through shared geometry and review exports',async()=>{
 const room=new Room();assert.equal(command(room,'garden.place','mint',null).status,'completed');
 let revision=1;
 for(const [value,hex,label]of [['violet','#a77bea','violeta'],['#7F22CC','#7f22cc','personalizado']]){
  assert.equal(command(room,'garden.update',value,revision).status,'completed');revision++;
  const observation=room.observe(actor),entity=observation.entities['garden-colour'];
  assert.equal(entity.id,'garden-colour');assert.equal(entity.revision,revision);assert.equal(entity.color,value);
  assert.equal(JSON.parse(JSON.stringify(observation)).entities['garden-colour'].color,value);
  const projected=workshopProjection(observation.entities).find(e=>e.id==='garden-colour');
  assert.equal(projected.nodes.find(n=>n.id==='garden-colour-light').color,hex);
  assert.ok(exportWorldSnapshot(observation,scenery).length>0);
  const review=await exportReviewScene(observation,scenery);
  const light=review.scene.parts.find(p=>p.id==='garden-colour-light');
  assert.equal(light.color,hex);assert.match(light.label,new RegExp(label));
 }
});
test('only existing palette, violet and exactly six RGB hex digits are accepted',()=>{
 for(const value of ['mint','amber','rose','violet','#000000','#ABCdef'])assert.ok(workshopColour(value));
 const room=new Room();assert.equal(command(room,'garden.place','violet',null).status,'completed');
 for(const value of ['purple','red','var(--colour)','rgb(1,2,3)','#abc','#12345678','#123456"/><m-script>','__proto__','constructor',null,123]){
  assert.equal(workshopColour(value),null);
  assert.equal(command(room,'garden.update',value,1).status,'rejected');
  const observation=room.observe(actor);assert.equal(observation.entities['garden-colour'].revision,1);
  observation.entities['garden-colour'].color=value;
  assert.throws(()=>exportWorldSnapshot(observation,scenery),/Unsupported creation/);
 }
});
