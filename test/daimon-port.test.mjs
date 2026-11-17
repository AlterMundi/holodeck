import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room } from '../src/room.mjs';
import { DaimonPort } from '../src/daimon-port.mjs';
test('native port uses direct perception/actions and checks current rights at execution',async()=>{
  const room=new Room();let rights=['observe','project','edit'];
  const projected=[];room.on('change',event=>projected.push(event));
  const context={testAuthority:'fixture'};
  const port=new DaimonPort(room,async supplied=>{
    assert.equal(supplied,context);
    return {id:'test-daimon',kind:'daimon',rights};
  });
  await port.project(context,{position:{x:0,y:2,z:0},form:'orb'});
  const observed=await port.observe(context);
  const command={id:crypto.randomUUID(),issuedAt:Date.now(),run:observed.run,edition:observed.edition,
    observation:observed.id,nativeRequest:'test-fixture-request',type:'bridge.set',target:'bridge',expectedRevision:0,args:{raised:true}};
  rights=['observe'];
  await assert.rejects(port.act(context,command),/Editing access/);
  rights=['observe','edit'];
  assert.equal((await port.act(context,command)).status,'completed');
  assert.equal((await port.result(context,command.id)).event,2);
  assert.deepEqual(projected.map(event=>event.type),['projection.changed','bridge.set']);
});
test('a human-shaped actor or client identity claim cannot instantiate native participation',async()=>{
  const room=new Room();const port=new DaimonPort(room,async()=>({id:'fixture',kind:'human',rights:['observe']}));
  await assert.rejects(port.observe({kind:'daimon'}),/verified daimon/);
});
