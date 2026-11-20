import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHolodeck} from '../src/server.mjs';
import {SessionBindings,sessionKey,SESSION_MS} from '../src/session-bindings.mjs';
import WebSocket from 'ws';
import {UserNetworkingClient} from '@mml-io/3d-web-user-networking';
import {experienceProtocolToDeltaNetSubProtocol} from '@mml-io/3d-web-experience-protocol';

test('bounded room bindings reject malformed ownership and do not persist Home credentials or rights',()=>{
 const dir=mkdtempSync(join(tmpdir(),'holodeck-session-store-'));
 try{
  const store=new SessionBindings(dir,8),token='a'.repeat(40),created=Date.now();
  store.save(new Map([[sessionKey(token),{actor:{id:'human:fixture',rights:['edit'],name:'Private name'},created,sourceCookie:'home=SECRET'}]]));
  const bytes=readFileSync(store.current,'utf8');assert.doesNotMatch(bytes,/SECRET|Private name|edit|a{40}/);assert.equal(statSync(store.current).mode&0o777,0o600);
  assert.deepEqual(store.load(),[{key:sessionKey(token),actorRef:'human:fixture',created}]);
  const valid={schema:'holodeck.session-bindings/v1',bindings:store.load()};
  for(const broken of [
   {...valid,bindings:[...valid.bindings,...valid.bindings]},
   {...valid,bindings:[{...valid.bindings[0],created:Date.now()+60000}]},
   {...valid,bindings:[{...valid.bindings[0],key:'invalid'}]},
   {...valid,bindings:[{...valid.bindings[0],rights:['edit']}]},
   {...valid,bindings:Array.from({length:9},()=>valid.bindings[0])},
  ]){writeFileSync(store.current,JSON.stringify(broken));assert.throws(()=>store.load());}
  writeFileSync(store.current,' '.repeat(8193));assert.throws(()=>store.load());
  writeFileSync(store.current,JSON.stringify({...valid,bindings:[{...valid.bindings[0],created:Date.now()-SESSION_MS}]}));assert.deepEqual(store.load(),[]);
  assert.equal(sessionKey(undefined),null);assert.equal(sessionKey('forged'),null);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('two protected visitors retain token ownership and shared state through server recreation',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'holodeck-session-recovery-'));let runtime,listener,allowed=true;
 const sockets=[];
 const start=async()=>{
  runtime=await createHolodeck({production:true,basePath:'/holodeck/',publicOrigin:'https://world.test',stateDir:dir,
   identityResolver:async req=>{
    const who=req.headers.cookie?.match(/(?:^|; )home=([ab])(?:;|$)/)?.[1];
    return allowed&&who?{id:'human:fixture-'+who,ref:'human:fixture-'+who,kind:'human',rights:['observe','edit','project']}:null;
   }});
  listener=runtime.app.listen(0,'127.0.0.1');await new Promise(resolve=>listener.once('listening',resolve));
  return `http://127.0.0.1:${listener.address().port}/holodeck/`;
 };
 const stop=async()=>{runtime.close();listener.closeAllConnections();await new Promise(resolve=>listener.close(resolve));};
 const open=async(base,path,cookie,origin='https://world.test')=>{
  const ws=new WebSocket(base.replace('http:','ws:')+path,path==='world'?'networked-dom-v0.2.1':'3d-web-experience-v0.1',{headers:{Cookie:cookie,Origin:origin}});sockets.push(ws);
  return ws;
 };
 const nextMessage=ws=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('No world snapshot')),3000);ws.once('message',value=>{clearTimeout(timer);resolve(value)});ws.once('error',reject);});
 try{
  let base=await start();const cookies=[];
  for(const who of ['a','b']){const r=await fetch(base,{headers:{Cookie:'home='+who}});assert.equal(r.status,200);cookies.push('home='+who+'; '+r.headers.get('set-cookie').split(';')[0]);}
  const headers={Cookie:cookies[0],Origin:'https://world.test','Content-Type':'application/json'};
  const observation=await(await fetch(base+'api/observe',{method:'POST',headers,body:'{}'})).json();
  const command={id:crypto.randomUUID(),issuedAt:Date.now(),run:observation.run,edition:observation.edition,observation:observation.id,type:'bridge.set',target:'bridge',expectedRevision:0,args:{raised:true}};
  const result=await(await fetch(base+'api/commands',{method:'POST',headers,body:JSON.stringify(command)})).json();assert.equal(result.status,'completed');
  const saved=readFileSync(join(dir,'sessions.json'),'utf8');assert.ok(Buffer.byteLength(saved)<8192);assert.doesNotMatch(saved,/home=|rights|connection|sourceCookie/);
  const run=runtime.room.run;await stop();base=await start();
  for(const [index,cookie]of cookies.entries()){
   const r=await fetch(base+'api/state',{headers:{Cookie:cookie}});assert.equal(r.status,200);const state=await r.json();assert.equal(state.actorRef,'human:fixture-'+['a','b'][index]);assert.equal(state.run,run);assert.equal(state.entities.bridge.raised,true);
   const geometry=await open(base,'world',cookie);assert.ok((await nextMessage(geometry)).length>0);
  }
  const read=await(await fetch(base+'api/commands/'+command.id,{headers:{Cookie:cookies[0]}})).json();assert.deepEqual(read,result,'read-only retry lookup recovers exact original');
  const foreignCookie=cookies[0].replace('home=a','home=b');assert.equal((await fetch(base+'api/state',{headers:{Cookie:foreignCookie}})).status,401);
  assert.equal((await fetch(base+'api/state',{headers:{Cookie:cookies[0].split('; ')[1]}})).status,401);
  assert.equal((await fetch(base+'api/state',{headers:{Cookie:'home=a; holodeck_session='+'f'.repeat(40)}})).status,401);
  allowed=false;assert.equal((await fetch(base+'api/state',{headers:{Cookie:cookies[0]}})).status,401);
  const denied=await open(base,'world',cookies[0]);const code=await new Promise(resolve=>denied.once('close',resolve));assert.equal(code,1008);
 }finally{for(const ws of sockets)ws.terminate();if(listener?.listening)await stop();rmSync(dir,{recursive:true,force:true});}
});

test('a binding persistence failure exposes no new session cookie',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'holodeck-session-failure-'));
 const runtime=await createHolodeck({production:true,basePath:'/holodeck/',publicOrigin:'https://world.test',stateDir:dir,
  identityResolver:async()=>({id:'human:fixture',kind:'human',rights:['observe']})});
 const listener=runtime.app.listen(0,'127.0.0.1');await new Promise(resolve=>listener.once('listening',resolve));
 try{
  mkdirSync(join(dir,'sessions.stage.json'));const response=await fetch(`http://127.0.0.1:${listener.address().port}/holodeck/`);
  assert.equal(response.status,503);assert.equal(response.headers.get('set-cookie'),null);
 }finally{runtime.close();listener.closeAllConnections();await new Promise(resolve=>listener.close(resolve));rmSync(dir,{recursive:true,force:true});}
});

test('actual MML handshake cannot use another actor token with its own valid Home socket',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'holodeck-handshake-owner-')),clients=[];
 const runtime=await createHolodeck({production:true,basePath:'/holodeck/',publicOrigin:'https://world.test',stateDir:dir,
  identityResolver:async req=>{const who=req.headers.cookie?.match(/(?:^|; )home=([ab])(?:;|$)/)?.[1];return who?{id:'human:'+who,kind:'human',rights:['observe','edit']}:null;}});
 const listener=runtime.app.listen(0,'127.0.0.1');await new Promise(resolve=>listener.once('listening',resolve));
 const base=`http://127.0.0.1:${listener.address().port}/holodeck/`;
 async function joinClient(cookie,token){
  let finish;const result=new Promise(resolve=>finish=resolve);
  const timer=setTimeout(()=>finish({timeout:true}),4000);
  const client=new UserNetworkingClient({url:base.replace('http:','ws:')+'network',sessionToken:token,
   websocketFactory:url=>new WebSocket(url,'3d-web-experience-v0.1',{headers:{Cookie:cookie,Origin:'https://world.test'}}),
   resolveProtocol:experienceProtocolToDeltaNetSubProtocol,statusUpdateCallback(){},onUpdate(){},
   assignedIdentity:id=>finish({id}),onServerError:error=>finish({error})},undefined,undefined,{debug(){},info(){},warn(){},error(){}});
  clients.push(client);try{return await result;}finally{clearTimeout(timer);}
 }
 try{
  const cookies=[],tokens=[];
  for(const who of ['a','b']){const root=await fetch(base,{headers:{Cookie:'home='+who}});const issued=root.headers.get('set-cookie').split(';')[0];cookies.push('home='+who+'; '+issued);tokens.push(issued.split('=')[1]);}
  const denied=await joinClient(cookies[1],tokens[0]);assert.ok(denied.error,'B socket must not authenticate as disconnected A');
  const ownB=await joinClient(cookies[1],tokens[1]);assert.ok(ownB.id,'matching B token and B socket are accepted');
  const ownA=await joinClient(cookies[0],tokens[0]);assert.ok(ownA.id,'A binding remains valid after foreign refusal');
 }finally{for(const client of clients)client.stop();runtime.close();listener.closeAllConnections();await new Promise(resolve=>listener.close(resolve));rmSync(dir,{recursive:true,force:true});}
});
