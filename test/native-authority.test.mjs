import {test} from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createNativeRoomAuthority} from '../src/native-authority.mjs';
import {createHolodeck} from '../src/server.mjs';

const being='dm:being:v1:'+'a'.repeat(43),other='dm:being:v1:'+'b'.repeat(43);
const verified={actor:{id:being,ref:being,kind:'daimon'},humanRef:'human:fixture',nativeRequest:'fixture-original'};
async function fixture(answer){
 const directory=mkdtempSync(join(tmpdir(),'holodeck-authority-')),path=join(directory,'authority.sock'),requests=[];
 const server=net.createServer(socket=>{
  let raw='';socket.on('error',()=>{});socket.on('data',data=>{raw+=data;if(!raw.includes('\n'))return;
   const request=JSON.parse(raw.split('\n')[0]);requests.push(request);const response=answer(request);
   if(response!==undefined)socket.end(JSON.stringify(response)+'\n');
  });
 });
 await new Promise(resolve=>server.listen(path,resolve));
 return {path,requests,async close(){await new Promise(resolve=>server.close(resolve));rmSync(directory,{recursive:true,force:true});}};
}
test('native room authority queries the being itself on every operation, with no human session or cached grant',async()=>{
 let allowed=true;
 const f=await fixture(request=>({ok:true,result:{schema:'holodeck.world-access/v1',beingRef:request.beingRef,allowed}}));
 try{
  const authorize=createNativeRoomAuthority(f.path);
  assert.deepEqual(await authorize(verified),['observe','edit','project']);
  allowed=false;assert.deepEqual(await authorize(verified),[]);
  assert.deepEqual(f.requests,[{operation:'world-access',beingRef:being},{operation:'world-access',beingRef:being}]);
  for(const actor of [{...verified.actor,kind:'human'},{...verified.actor,id:other},{id:being,kind:'daimon'}])await assert.rejects(authorize({...verified,actor}),/verified native being/);
  assert.equal(f.requests.length,2);
 }finally{await f.close();}
});
test('wrong actor, malformed policy response and missing owner bridge deny without a browser fallback',async()=>{
 for(const timeoutMs of [0,-1,Infinity,10001])assert.throws(()=>createNativeRoomAuthority('/fixture/socket',{timeoutMs}),/bounded authority deadline/);
 for(const response of [{ok:false},{ok:true,result:{schema:'holodeck.world-access/v1',beingRef:other,allowed:true}},
  {ok:true,result:{schema:'other',beingRef:being,allowed:true}},
  {ok:true,result:{schema:'holodeck.world-access/v1',beingRef:being,allowed:'true'}},
  {ok:true,result:{padding:'x'.repeat(9000)}}]){
  const f=await fixture(()=>response);
  try{await assert.rejects(createNativeRoomAuthority(f.path)(verified));assert.equal(f.requests.length,1);}finally{await f.close();}
 }
 await assert.rejects(createNativeRoomAuthority('/nonexistent/holodeck-authority.sock')(verified));
});
test('an unresponsive current authority is bounded and never retried automatically',async()=>{
 const f=await fixture(()=>undefined);
 try{await assert.rejects(createNativeRoomAuthority(f.path,{timeoutMs:50})(verified),/unavailable/);assert.equal(f.requests.length,1);}
 finally{await f.close();}
});

test('a fresh production world accepts its authorized native participant before any human browser session exists',async()=>{
 let allowed=true,humanReads=0;
 const f=await fixture(request=>({ok:true,result:{schema:'holodeck.world-access/v1',beingRef:request.beingRef,allowed}}));
 const directory=mkdtempSync(join(tmpdir(),'holodeck-native-standing-')),worldSocket=join(directory,'world.sock'),interactionId=crypto.randomUUID();
 const runtime=await createHolodeck({production:true,stateDir:directory,publicOrigin:'https://fixture.test',
  identityResolver:async()=>{humanReads++;return null;},
  nativeRoomAuthority:createNativeRoomAuthority(f.path),worldSocket,worldSocketBeingRef:being,
  nativeFactory:async()=>({async authorizeWorldRequest(id,pin){assert.equal(pin,being);if(id!==interactionId)throw Error('Unknown fixture original');return {...verified,nativeRequest:id};}})});
 const call=(operation,args={},id=interactionId)=>new Promise((resolve,reject)=>{
  const socket=net.createConnection(worldSocket);let bytes='';socket.on('error',reject);
  socket.on('connect',()=>socket.write(JSON.stringify({interactionId:id,operation,args})+'\n'));
  socket.on('data',chunk=>{bytes+=chunk;if(bytes.includes('\n')){resolve(JSON.parse(bytes.split('\n')[0]));socket.end();}});
 });
 try{
  const first=await call('observe');assert.equal(first.ok,true);assert.equal(first.result.observer,being);assert.equal(humanReads,0);
  const projected=await call('project',{form:'orb',position:{x:1,y:1,z:2}});assert.equal(projected.ok,true);
  const moved=await call('project',{form:'orb',position:{x:2,y:1,z:3}});assert.equal(moved.ok,true);
  assert.equal(runtime.room.projections.get(being).position.x,2);
  assert.equal(humanReads,0,'native standing never asks for a human identity or cookie');
  const queryCount=f.requests.length;
  assert.equal((await call('observe',{},crypto.randomUUID())).ok,false);assert.equal(f.requests.length,queryCount);
  const sequence=runtime.room.sequence;allowed=false;
  assert.equal((await call('project',{form:'orb',position:{x:3,y:1,z:3}})).ok,false);
  assert.equal(runtime.room.sequence,sequence);assert.equal(humanReads,0);
 }finally{runtime.close();await f.close();rmSync(directory,{recursive:true,force:true});}
});
