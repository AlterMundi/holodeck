import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,randomUUID,verify} from 'node:crypto';
import {createServer} from 'node:http';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {createServer as createSocketServer} from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {houseId} from '../src/houses.mjs';
import {RoomStore} from '../src/room-store.mjs';
import {createHolodeck} from '../src/server.mjs';
import {homeIdentityResolver} from '../src/home-identity.mjs';

// Real HTTP producer + real protected MML consumer. This is a synthetic Home
// authority/actor fixture, not a human session, sign-in or native/model turn.
test('Home virtual-host authentication reaches the actual protected prefixed HTML and actor-bound API',async t=>{
 const origin='https://world.test',cookie='home=fixture-composed',actorRef='human:composed-http-fixture',calls=[];
 let allowed=true;
 const home=createServer((request,response)=>{
  calls.push({path:request.url,host:request.headers.host,cookie:request.headers.cookie,method:request.method});
  const cookies=request.headers.cookie?.split(';').map(value=>value.trim())||[];
  if(request.headers.host!=='world.test'||!cookies.includes(cookie)||!allowed){response.writeHead(403).end();return;}
  if(request.url==='/service-access/holodeck'){response.writeHead(204).end();return;}
  if(request.url!=='/access/identity'){response.writeHead(404).end();return;}
  response.setHeader('Content-Type','application/json');
  response.end(JSON.stringify({contract:'dm.home-session/v1',origin,expires:Date.now()/1000+60,
   actor:{ref:actorRef,kind:'human',revision:'fixture-current',name:'HTTP fixture'}}));
 });
 await new Promise(resolve=>home.listen(0,'127.0.0.1',resolve));
 t.after(()=>{home.closeAllConnections();return new Promise(resolve=>home.close(resolve));});
 const homeBase=`http://127.0.0.1:${home.address().port}`;
 const directory=mkdtempSync(join(tmpdir(),'holodeck-home-http-'));
 t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const runtime=await createHolodeck({production:true,basePath:'/holodeck/',publicOrigin:origin,stateDir:directory,
  identityResolver:homeIdentityResolver({publicOrigin:origin,authHost:'world.test',
   authorizeEndpoint:homeBase+'/service-access/holodeck',identityEndpoint:homeBase+'/access/identity'})});
 const listener=runtime.app.listen(0,'127.0.0.1');
 await new Promise(resolve=>listener.once('listening',resolve));
 t.after(()=>{runtime.close();listener.closeAllConnections();return new Promise(resolve=>listener.close(resolve));});
 const base=`http://127.0.0.1:${listener.address().port}/holodeck/`;
 assert.equal((await fetch(base)).status,403,'anonymous MML index remains denied');
 const root=await fetch(base,{headers:{Cookie:cookie}}),html=await root.text();
 assert.equal(root.status,200,'real Home transport must admit the actual MML index');
 assert.match(root.headers.get('content-type'),/text\/html/);
 assert.match(html,/<base href="\/holodeck\/">/);assert.match(html,/<title>Holodeck/);
 assert.doesNotMatch(html,/Access denied: authentication required/);
 const issued=root.headers.get('set-cookie');
 assert.match(issued,/holodeck_session=[a-f0-9]{40}/);assert.match(issued,/HttpOnly/);assert.match(issued,/Secure/);assert.match(issued,/Path=\/holodeck\//);
 const headers={Cookie:cookie+'; '+issued.split(';')[0]};
 const state=await fetch(base+'api/state',{headers});
 assert.equal(state.status,200);assert.equal((await state.json()).actorRef,actorRef);
 assert.deepEqual(calls.map(call=>call.path),['/service-access/holodeck','/access/identity','/service-access/holodeck','/access/identity']);
 assert.ok(calls.every(call=>call.host==='world.test'&&call.method==='GET'&&call.cookie.includes(cookie)));
 allowed=false;
 assert.equal((await fetch(base+'api/state',{headers})).status,401,'an issued application cookie cannot bypass revoked Home access');
});

test('the prefixed production Atelier routes sign only the current paired Home actor in the selected room',async t=>{
 const origin='https://world.test',paired='human:telegram:7001',guest='human:telegram:7002';
 const pairedCookie='home=fixture-paired',guestCookie='home=fixture-guest';
 let homeAdmission=true,alterAsset=false,revokeWhenReading=false;
 const forwarded=[];
 const home=createServer((request,response)=>{
  const cookies=request.headers.cookie?.split(';').map(part=>part.trim())??[];
  const ref=cookies.includes(pairedCookie)?paired:cookies.includes(guestCookie)?guest:null;
  if(!ref||request.headers.host!=='world.test'||ref===paired&&!homeAdmission){response.writeHead(403).end();return;}
  if(request.url==='/service-access/holodeck'){
   assert.ok(['GET','POST'].includes(request.headers['x-forwarded-method']));
   if(request.headers['x-forwarded-method']==='POST')assert.equal(request.headers.origin,origin);
   response.writeHead(204).end();return;
  }
  assert.equal(request.url,'/access/identity');
  response.end(JSON.stringify({contract:'dm.home-session/v1',origin,expires:Date.now()/1000+60,
   actor:{kind:'human',ref,revision:'fixture',name:'HTTP fixture'}}));
 });
 await new Promise(resolve=>home.listen(0,'127.0.0.1',resolve));
 t.after(()=>{home.closeAllConnections();return new Promise(resolve=>home.close(resolve));});

 const directory=mkdtempSync(join(tmpdir(),'holodeck-home-atelier-'));
 const {publicKey,privateKey}=generateKeyPairSync('ed25519');
 const signingKey=join(directory,'issuer.pem'),socket=join(directory,'atelier.sock');
 writeFileSync(signingKey,privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600});
 const workspace=randomUUID(),revision=randomUUID(),child=randomUUID(),room='home-atelier-fixture';
 const owner='dm:being:v1:'+'A'.repeat(43),house=houseId(owner);
 new RoomStore(join(directory,'houses')).save({schema:'holodeck.houses/v1',receipts:[],houses:[
  {id:house,owner,revision:1,parcel:'parcel-east-1',facade:{title:'Fixture',color:'#369963',width:3,depth:1,height:2}},
 ]});
 const markup=Buffer.from('<!doctype html><!-- atelier-home-context --><script type="module" src="./workshop.js"></script>');
 const script=Buffer.from('export {};');
 const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
 const receiver=createSocketServer(stream=>{
  let input='';
  stream.setEncoding('utf8');
  stream.on('data',chunk=>{
   input+=chunk;
   if(!input.endsWith('\n'))return;
   const proof=JSON.parse(input),payload=Buffer.from(proof.payload,'base64url');
   assert.equal(verify(null,Buffer.concat([Buffer.from('daimon/atelier/native-request/v1\0'),payload]),publicKey,
    Buffer.from(proof.signature,'base64url')),true);
   const request=JSON.parse(payload);
   assert.equal(request.actorRef,paired);
   assert.equal(request.workspace,workspace);
   forwarded.push(request);
   const result={workspace};
   if(request.operation==='projection'){
    const asset=request.args.asset;
    Object.assign(result,{asset,content:(asset==='html'?markup:alterAsset?Buffer.from('changed'):script).toString('base64')});
   }else if(request.operation==='view'){
    result.revision={id:revision,sha256:'b'.repeat(64)};
    if(revokeWhenReading)homeAdmission=false;
   }
   else if(request.operation==='smooth')Object.assign(result,{actor:paired,operationId:request.args.operationId,revisionId:child,changedVertices:1});
   else assert.fail('Unexpected Atelier request');
   stream.end(JSON.stringify({ok:true,result})+'\n');
  });
 });
 await new Promise(resolve=>receiver.listen(socket,resolve));
 t.after(async()=>{await new Promise(resolve=>receiver.close(resolve));rmSync(directory,{recursive:true,force:true});});

 const homeBase=`http://127.0.0.1:${home.address().port}`;
 const runtime=await createHolodeck({production:true,basePath:'/holodeck/',publicOrigin:origin,stateDir:directory,
  identityResolver:homeIdentityResolver({publicOrigin:origin,authHost:'world.test',
   authorizeEndpoint:homeBase+'/service-access/holodeck',identityEndpoint:homeBase+'/access/identity'}),
  ownNative:true,nativeRoomAuthority:async()=>[],
  interiorSpaces:[{id:room,house,title:'Fixture atelier',level:0,entry:true,links:[],guests:[paired,guest]}],
  atelierWorkshop:{room,workspace,socket,signingKey,projection:{humanRef:paired,anchor:'room-marker',
   htmlSha256:digest(markup),scriptSha256:digest(script)}}});
 const listener=runtime.app.listen(0,'127.0.0.1');
 await new Promise(resolve=>listener.once('listening',resolve));
 t.after(()=>{runtime.close();listener.closeAllConnections();return new Promise(resolve=>listener.close(resolve));});
 const base=`http://127.0.0.1:${listener.address().port}/holodeck/`;
 const surface=base+'api/space/atelier/';
 const document=surface+'api/workspaces/'+workspace;
 async function cookie(identity){
  const response=await fetch(base,{headers:{Cookie:identity}});
  assert.equal(response.status,200);
  return identity+'; '+response.headers.get('set-cookie').split(';')[0];
 }
 const Cookie=await cookie(pairedCookie),visitor=await cookie(guestCookie);
 const post=(url,cookie,body,writeOrigin=origin)=>fetch(url,{method:'POST',
  headers:{Cookie:cookie,Origin:writeOrigin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const move=(cookie,from,to)=>post(base+'api/space',cookie,{from,to,live:1});
 assert.equal((await fetch(surface,{headers:{Cookie}})).status,404);
 assert.equal(forwarded.length,0);
 assert.equal((await move(Cookie,'outside',room)).status,200);
 assert.equal((await move(visitor,'outside',room)).status,200);
 assert.equal((await fetch(surface,{headers:{Cookie:visitor}})).status,404);
 assert.equal((await fetch(surface,{headers:{Cookie:guestCookie+'; '+Cookie.split('; ')[1]}})).status,401);
 const html=await fetch(surface,{headers:{Cookie}});
 assert.equal(html.status,200);
 assert.equal(html.headers.get('cache-control'),'private, no-store');
 assert.match(await html.text(),new RegExp('name="atelier-workspace" content="'+workspace+'"'));
 assert.deepEqual(Buffer.from(await (await fetch(surface+'workshop.js',{headers:{Cookie}})).arrayBuffer()),script);
 alterAsset=true;
 assert.equal((await fetch(surface+'workshop.js',{headers:{Cookie}})).status,503);
 assert.equal((await (await fetch(document,{headers:{Cookie}})).json()).revision.id,revision);
 const count=forwarded.length;
 const write={type:'smooth',operationId:randomUUID(),expectedRevision:revision,
  selection:{objectId:randomUUID(),triangleIndex:4,barycentric:[.2,.3,.5]},radiusMm:5,strength:.4};
 assert.equal((await post(document+'/smooth',Cookie,write,'https://foreign.test')).status,401);
 assert.equal(forwarded.length,count);
 const accepted=await post(document+'/smooth',Cookie,write);
 assert.equal(accepted.status,200);
 assert.equal((await accepted.json()).revisionId,child);
 assert.deepEqual(forwarded.at(-1).args,write);
 revokeWhenReading=true;
 const interrupted=await fetch(document,{headers:{Cookie}});
 assert.equal(interrupted.status,404);
 assert.deepEqual(await interrupted.json(),{error:'workspace-unavailable'});
 assert.equal((await fetch(document,{headers:{Cookie}})).status,401);
 assert.equal(forwarded.length,count+2);
 revokeWhenReading=false;
 homeAdmission=true;
 assert.equal((await move(Cookie,room,'outside')).status,200);
 assert.equal((await fetch(document,{headers:{Cookie}})).status,404);
 assert.equal(forwarded.length,count+2);
});
