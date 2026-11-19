import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
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
