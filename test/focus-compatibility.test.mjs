import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Room} from '../src/room.mjs';
const actor={id:'human:compat-fixture',kind:'human',rights:['observe','edit']};
export function exerciseCompatibility(){
 const initial=new Room().snapshot();initial.sequence=1;
 const signals=[[actor.id,{actor:actor.id,kind:'human',name:'Fixture',target:'bridge',revision:0,sequence:1,time:1000}]];
 initial.focuses=structuredClone(signals);let persisted;
 const predecessor=new Room({state:initial,persist:value=>{persisted=value;}});
 initial.focuses[0][1].name='Changed caller copy';
 const observation=predecessor.observe(actor);
 const result=predecessor.command(actor,{id:crypto.randomUUID(),issuedAt:Date.now(),run:observation.run,edition:observation.edition,observation:observation.id,type:'bridge.set',target:'bridge',expectedRevision:0,args:{raised:true}});
 assert.equal(result.status,'completed');assert.equal(persisted.entities.bridge.revision,1);
 assert.deepEqual(persisted.focuses,signals);assert.equal(persisted.run,initial.run);
 const copy=predecessor.snapshot();copy.focuses[0][1].name='Changed snapshot copy';assert.deepEqual(predecessor.snapshot().focuses,signals);
 return {persisted,signals};
}
test('predecessor ordinary observe/mutation persists successor indications without interpreting or mutating them',()=>{
 const {persisted,signals}=exerciseCompatibility();assert.deepEqual(new Room({state:persisted}).snapshot().focuses,signals);
 const legacy=new Room();assert.equal(Object.hasOwn(legacy.snapshot(),'focuses'),false);
 const recovered=new Room({state:persisted});recovered.reset();assert.equal(Object.hasOwn(recovered.snapshot(),'focuses'),false);
 assert.throws(()=>new Room({state:{...persisted,focuses:Array(17).fill(null)}}),/checkpoint/);
});
