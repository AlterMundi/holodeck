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

test('fixed return lane rejects another being before room rights or mutation',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'holodeck-pinned-port-')),socketPath=join(directory,'world.sock');
 const room=new Room(),expectedBeingRef='dm:being:v1:'+'a'.repeat(43);let rightsCalls=0;
 const port=await createWorldPort({socketPath,room,expectedBeingRef,
  native:{async authorizeWorldRequest(id,pin){assert.equal(pin,expectedBeingRef);return {actor:{id:'foreign',ref:'foreign',kind:'daimon'},nativeRequest:id};}},
  resolveRights:async()=>{rightsCalls++;return ['observe','edit'];}});
 try{
  const response=await new Promise((resolve,reject)=>{
   const socket=net.createConnection(socketPath);let bytes='';socket.on('error',reject);
   socket.on('connect',()=>socket.write(JSON.stringify({interactionId:crypto.randomUUID(),operation:'observe',args:{}})+'\n'));
   socket.on('data',data=>{bytes+=data;if(bytes.includes('\n'))resolve(JSON.parse(bytes));});
  });
  assert.equal(response.ok,false);assert.equal(rightsCalls,0);assert.equal(room.sequence,0);
 }finally{await port.close();rmSync(directory,{recursive:true,force:true});}
});

test('multi-pair receiving requires a fixed identity on every unique return path',async()=>{
 const {validateWorldPorts}=await import('../src/server.mjs');
 const beingRef='dm:being:v1:'+'a'.repeat(43),other='dm:being:v1:'+'b'.repeat(43);
 assert.deepEqual(validateWorldPorts({worldSocket:'/tmp/legacy.sock'}),[{socket:'/tmp/legacy.sock',beingRef:null}]);
 assert.throws(()=>validateWorldPorts({worldSocket:'/tmp/legacy.sock',nativeRoutes:[{beingRef}]}));
 assert.throws(()=>validateWorldPorts({worldPorts:[{socket:'/tmp/a.sock',beingRef:other}],nativeRoutes:[{beingRef}]}));
 assert.throws(()=>validateWorldPorts({worldPorts:[{socket:'/tmp/a.sock',beingRef},{socket:'/tmp/a.sock',beingRef}]}));
 assert.equal(validateWorldPorts({worldSocket:'/tmp/legacy.sock',worldSocketBeingRef:beingRef,
  worldPorts:[{socket:'/tmp/b.sock',beingRef:other}],nativeRoutes:[{beingRef},{beingRef:other}]}).length,2);
});

async function ownFixture({pin='dm:being:v1:'+'a'.repeat(43),authority=true,room=new Room()}={}){
 const directory=mkdtempSync(join(tmpdir(),'holodeck-own-port-')),socketPath=join(directory,'world.sock');
 let rights=['observe','edit','project'],calls=0,fail=false;
 const port=await createWorldPort({socketPath,room,expectedBeingRef:pin,
  native:{async authorizeWorldRequest(){throw Error('Own native access must not inspect a human original');}},
  resolveRights:async()=>{throw Error('No legacy human authority fallback');},
  resolveOwnNativeRights:authority?async verified=>{calls++;assert.deepEqual(verified,{actor:{id:pin,ref:pin,kind:'daimon'}});if(fail)throw Error('Authority unavailable');return rights;}:null});
 const request=body=>new Promise((resolve,reject)=>{
  const socket=net.createConnection(socketPath);let bytes='';socket.on('error',reject);
  socket.on('connect',()=>socket.write(JSON.stringify(body)+'\n'));
  socket.on('data',chunk=>{bytes+=chunk;if(bytes.includes('\n')){resolve(JSON.parse(bytes.split('\n')[0]));socket.end();}});
 });
 return {room,pin,request,call:(operation,args={})=>request({ownNative:true,operation,args}),
  rights:value=>{rights=value;},fail:()=>{fail=true;},calls:()=>calls,
  async close(){await port.close();rmSync(directory,{recursive:true,force:true});}};
}

test('own native lane acts as its configured being without a human input and retains exact outcomes',async()=>{
 const f=await ownFixture();
 try{
  const first=await f.call('observe');assert.equal(first.ok,true);const observation=first.result;
  assert.equal(observation.observer,f.pin);assert.deepEqual(first.authoritySource,{identity:'receiving-lane',access:'current-being-grant'});
  assert.equal((await f.call('project',{form:'orb',position:{x:1,y:1,z:2}})).ok,true);
  const command={id:crypto.randomUUID(),issuedAt:Date.now(),run:observation.run,edition:observation.edition,
   observation:observation.id,type:'bridge.set',target:'bridge',expectedRevision:0,args:{raised:true}};
  const changed=await f.call('act',command);assert.equal(changed.result.status,'completed');
  assert.equal(f.room.events.at(-1).actor,f.pin);assert.equal(f.room.events.at(-1).detail.nativeRequest,'own-native:'+command.id);
  const sequence=f.room.sequence;
  assert.deepEqual(await f.call('act',command),changed);assert.equal(f.room.sequence,sequence);
  assert.deepEqual((await f.call('result',{id:command.id})).result,changed.result);
  assert.equal((await f.call('act',{...command,args:{raised:false}})).ok,false,'same command ID cannot change content');
  f.rights(['observe']);const denied=await f.call('act',{...command,id:crypto.randomUUID()});assert.equal(denied.ok,false);
  f.rights([]);assert.equal((await f.call('observe')).ok,false);assert.equal(f.room.sequence,sequence);
  f.fail();assert.equal((await f.call('observe')).ok,false);assert.equal(f.calls(),9,'fresh own grant on every valid operation');
 }finally{await f.close();}
});

test('own native mode refuses missing pins, missing authority and caller-selected identities or originals',async()=>{
 for(const options of [{pin:null},{pin:'foreign'},{authority:false}]){
  const f=await ownFixture(options);try{assert.equal((await f.call('observe')).ok,false);assert.equal(f.calls(),0);}finally{await f.close();}
 }
 const f=await ownFixture();
 try{
  const base={ownNative:true,operation:'observe',args:{}};
  for(const body of [{...base,interactionId:crypto.randomUUID()},{...base,beingRef:'dm:being:v1:'+'b'.repeat(43)},
   {...base,humanRef:'human:fixture'},{...base,ownNative:false},{...base,operation:'execute'},
   {...base,args:{nativeRequest:crypto.randomUUID()}},{...base,actor:{id:f.pin}}])assert.equal((await f.request(body)).ok,false);
  assert.equal(f.calls(),0);assert.equal(f.room.sequence,0);
 }finally{await f.close();}
});

test('own native observations and results stay with their being and current room',async()=>{
 const room=new Room(),a=await ownFixture({room}),b=await ownFixture({room,pin:'dm:being:v1:'+'b'.repeat(43)});
 try{
  const seen=(await a.call('observe')).result;
  const command={id:crypto.randomUUID(),issuedAt:Date.now(),run:b.room.run,edition:b.room.edition,
   observation:seen.id,type:'bridge.set',target:'bridge',expectedRevision:0,args:{raised:true}};
  assert.equal((await b.call('act',command)).result.status,'rejected');
  assert.equal((await a.call('result',{id:command.id})).result,null);
  const own=(await a.call('observe')).result;a.room.reset();
  const stale=await a.call('act',{...command,id:crypto.randomUUID(),run:own.run,edition:own.edition,observation:own.id});
  assert.equal(stale.result.status,'rejected');assert.equal(a.room.sequence,0);
 }finally{await a.close();await b.close();}
});
