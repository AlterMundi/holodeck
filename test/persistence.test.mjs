import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Room} from '../src/room.mjs';
import {RoomStore} from '../src/room-store.mjs';
const actor={id:'test-human',kind:'human',rights:['observe','edit']};
function proposal(room,overrides={}){
 const o=room.observe(actor);return {id:crypto.randomUUID(),issuedAt:Date.now(),run:o.run,edition:o.edition,observation:o.id,
 type:'bridge.set',target:'bridge',expectedRevision:o.entities.bridge.revision,args:{raised:true},...overrides};
}
test('process restart retains the same run, captured situation and exact command outcome',()=>{
 const dir=mkdtempSync(join(tmpdir(),'holodeck-save-'));
 try{
  const store=new RoomStore(dir);const room=new Room({persist:s=>store.save(s)});
  const command=proposal(room);const result=room.command(actor,command);
  const restored=new Room({state:store.load(),persist:s=>store.save(s)});
  assert.equal(restored.run,room.run);assert.equal(restored.entities.bridge.raised,true);
  assert.deepEqual(restored.command(actor,command),result);assert.equal(restored.sequence,1);
  assert.deepEqual(readdirSync(dir).sort(),['room.json','room.previous.json']);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('failed durable write rolls back mutation and does not project an uncommitted change',()=>{
 let fail=false;const room=new Room({persist:()=>{if(fail)throw Error('disk capacity');}});
 const command=proposal(room);let projected=0;room.on('change',()=>projected++);fail=true;
 assert.throws(()=>room.command(actor,command),/disk capacity/);
 assert.equal(room.entities.bridge.raised,false);assert.equal(room.sequence,0);assert.equal(projected,0);
 fail=false;assert.equal(room.command(actor,command).status,'completed');assert.equal(projected,1);
});
test('garden undo is revision-bound and keeps a tombstone rather than recycling identity',()=>{
 const room=new Room();
 const place=proposal(room,{type:'garden.place',target:'garden-test',expectedRevision:null,args:{x:1,z:2,color:'rose'}});
 assert.equal(room.command(actor,place).status,'completed');
 const remove=proposal(room,{type:'garden.remove',target:'garden-test',expectedRevision:1,args:{}});
 assert.equal(room.command(actor,remove).status,'completed');assert.equal(room.entities['garden-test'].deleted,true);
 assert.equal(room.command(actor,proposal(room,{...place,id:crypto.randomUUID(),observation:room.observe(actor).id})).status,'rejected');
});
test('a corrupt current checkpoint is preserved instead of silently using an older world',()=>{
 const dir=mkdtempSync(join(tmpdir(),'holodeck-save-'));
 try{const store=new RoomStore(dir);writeFileSync(store.current,'corrupt');
 assert.throws(()=>store.load());assert.equal(readFileSync(store.current,'utf8'),'corrupt');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
