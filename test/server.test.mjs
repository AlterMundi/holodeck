import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHolodeck} from '../src/server.mjs';
import WebSocket from 'ws';
import {CONTENT_NODE} from '../src/content-visits.mjs';

test('research entrance discovery uses the authenticated actor and its exact selected pin',async()=>{
 const node={id:'research-fixture',title:'Shared object',position:{x:5,y:.1,z:3}};
 const pin={tableId:'private-table',reportId:'private-report',revision:'selected-v1'};
 const runtime=await createHolodeck({contentNodes:[CONTENT_NODE,node],
  contentVisits:[{id:'selected',node:node.id,entry:'/nexus/?table=private-table&report_revision=selected-v1',descriptor:'/nexus/descriptor',pin,discoverActors:['human:selected']}],
  identityResolver:async req=>({id:req.headers.cookie?.includes('selected=yes')?'human:selected':'human:other',kind:'human',rights:['observe']})});
 const listener=runtime.app.listen(0,'127.0.0.1');await new Promise(resolve=>listener.once('listening',resolve));
 const base=`http://127.0.0.1:${listener.address().port}/`;
 try{
  assert.equal((await fetch(base+'api/content-visits')).status,401);
  const read=async selected=>{
   const root=await fetch(base,{headers:selected?{Cookie:'selected=yes'}:{}});
   const headers={Cookie:(selected?'selected=yes; ':'')+root.headers.get('set-cookie').split(';')[0]};
   return (await fetch(base+'api/content-visits',{headers})).json();
  };
  const other=await read(false);assert.equal(other.nodes.length,2);assert.deepEqual(other.visits,[]);
  assert.doesNotMatch(JSON.stringify(other),/private-table|private-report|selected-v1|discoverActors/);
  const selected=await read(true);assert.equal(selected.visits[0].node,node.id);assert.deepEqual(selected.visits[0].pin,pin);
  assert.equal('discoverActors' in selected.visits[0],false);
 }finally{runtime.close();listener.closeAllConnections();await new Promise(resolve=>listener.close(resolve));}
});

test('protected prefixed runtime binds sessions to current actors and rejects forged or revoked authority',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'holodeck-server-'));
 let allowed=true;
 const runtime=await createHolodeck({production:true,basePath:'/holodeck/',publicOrigin:'https://world.test',stateDir:directory,
  contentVisits:[{id:'fixture',node:'reading-room',entry:'/nexus/?table=fixture&report_revision=v1',descriptor:'/nexus/api/fixture',pin:{tableId:'fixture',reportId:'fixture-report',revision:'v1'},discoverActors:['human:fixture-a']}],
  identityResolver:async req=>allowed&&req.headers.cookie?.includes('home=fixture-a')?{id:'human:fixture-a',ref:'human:fixture-a',kind:'human',name:'Fixture',rights:['observe','edit','project']}:null});
 const listener=runtime.app.listen(0,'127.0.0.1');
 await new Promise(resolve=>listener.once('listening',resolve));
 const base=`http://127.0.0.1:${listener.address().port}/holodeck/`;
 try{
  assert.equal((await fetch(base)).status,403);
  const root=await fetch(base,{headers:{Cookie:'home=fixture-a'}});
  assert.equal(root.status,200);assert.match(await root.text(),/<base href="\/holodeck\/">/);
  const cookie=root.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/Path=\/holodeck\//);
  const localCookie=cookie.split(';')[0],headers={Cookie:`home=fixture-a; ${localCookie}`};
  assert.equal((await fetch(base+'api/state',{headers})).status,200);
  const visits=await(await fetch(base+'api/content-visits',{headers})).json();assert.equal(visits.visits.length,1);
  assert.equal('discoverActors' in visits.visits[0],false);
  assert.equal((await fetch(base+'api/state',{headers:{Cookie:`home=fixture-b; ${localCookie}`,'X-Daimon-Actor':'human:fixture-a'}})).status,401);
  assert.equal((await fetch(base+'api/observe',{method:'POST',headers:{...headers,Origin:'https://foreign.test','Content-Type':'application/json'},body:'{}'})).status,403);
  const observation=await(await fetch(base+'api/observe',{method:'POST',headers:{...headers,Origin:'https://world.test','Content-Type':'application/json'},body:'{}'})).json();
  const command={id:crypto.randomUUID(),issuedAt:Date.now(),run:observation.run,edition:observation.edition,
    observation:observation.id,type:'bridge.set',target:'bridge',expectedRevision:0,args:{raised:true}};
  allowed=false;
  assert.equal((await fetch(base+'api/content-visits',{headers})).status,401);
  assert.equal((await fetch(base+'api/commands',{method:'POST',headers:{...headers,Origin:'https://world.test','Content-Type':'application/json'},body:JSON.stringify(command)})).status,401);
  assert.equal(runtime.room.entities.bridge.raised,false);
 }finally{await new Promise(resolve=>listener.close(resolve));runtime.close();rmSync(directory,{recursive:true,force:true});}
});

test('established geometry and presence sockets close on access revocation; foreign-origin upgrades are refused',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'holodeck-socket-'));let allowed=true;
 const runtime=await createHolodeck({production:true,basePath:'/holodeck/',publicOrigin:'https://world.test',stateDir:directory,
  identityResolver:async req=>allowed&&req.headers.cookie?.includes('home=fixture')?{id:'human:fixture',ref:'human:fixture',kind:'human',rights:['observe','edit','project']}:null});
 const listener=runtime.app.listen(0,'127.0.0.1');await new Promise(resolve=>listener.once('listening',resolve));
 const base=`http://127.0.0.1:${listener.address().port}/holodeck/`,clients=[];
 const waitClose=socket=>new Promise((resolve,reject)=>{
  const deadline=setTimeout(()=>reject(Error('Socket remained authorized after revocation')),3500);
  socket.once('close',code=>{clearTimeout(deadline);resolve(code);});socket.on('error',()=>{});
 });
 try{
  const root=await fetch(base,{headers:{Cookie:'home=fixture'}}),cookie='home=fixture; '+root.headers.get('set-cookie').split(';')[0];
  const open=(path,protocol,origin)=>{const socket=new WebSocket(base.replace('http:','ws:')+path,protocol,{headers:{Cookie:cookie,Origin:origin}});clients.push(socket);return socket;};
  const denied=open('world','networked-dom-v0.2.1','https://foreign.test');
  assert.equal(await waitClose(denied),1008);
  const geometry=open('world','networked-dom-v0.2.1','https://world.test');
  const presence=open('network','3d-web-experience-v0.1','https://world.test');
  await Promise.all([geometry,presence].map(socket=>new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);})));
  // Wait for guards to complete before changing the current authority.
  await new Promise(resolve=>setTimeout(resolve,100));
  const closed=[waitClose(geometry),waitClose(presence)];allowed=false;
  assert.deepEqual(await Promise.all(closed),[1008,1008]);
 }finally{for(const socket of clients)socket.terminate();runtime.close();await new Promise(resolve=>listener.close(resolve));rmSync(directory,{recursive:true,force:true});}
});
