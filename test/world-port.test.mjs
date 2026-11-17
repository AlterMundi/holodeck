import {test} from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Room} from '../src/room.mjs';
import {createWorldPort} from '../src/world-port.mjs';

test('native Unix world operations derive identity from retained source and recheck room rights',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'holodeck-port-')),socketPath=join(directory,'world.sock');
 const room=new Room();const interactionId=crypto.randomUUID();let rights=['observe','project','edit'];
 const port=await createWorldPort({socketPath,room,
  native:{async authorizeWorldRequest(id){assert.equal(id,interactionId);return {actor:{id:'test-being',kind:'daimon'},humanRef:'test-human',nativeRequest:id};}},
  resolveRights:async()=>rights});
 const call=(operation,args)=>new Promise((resolve,reject)=>{
  const socket=net.createConnection(socketPath);let data='';socket.on('error',reject);
  socket.on('connect',()=>socket.write(JSON.stringify({interactionId,operation,args})+'\n'));
  socket.on('data',block=>{data+=block;const end=data.indexOf('\n');if(end>=0){resolve(JSON.parse(data.slice(0,end)));socket.end();}});
 });
 try{
  const observation=(await call('observe',{})).result;
  assert.equal(observation.observer,'test-being');assert.equal(observation.place.frame.units,'meters');
  const command={id:crypto.randomUUID(),issuedAt:Date.now(),run:observation.run,edition:observation.edition,observation:observation.id,type:'bridge.set',target:'bridge',expectedRevision:0,args:{raised:true}};
  assert.equal((await call('act',command)).result.status,'completed');
  assert.equal(room.events.at(-1).actor,'test-being');assert.equal(room.events.at(-1).detail.nativeRequest,interactionId);
  rights=[];
  assert.equal((await call('act',{...command,id:crypto.randomUUID()})).ok,false);
  assert.equal(room.sequence,1);
 }finally{await port.close();rmSync(directory,{recursive:true,force:true});}
});
