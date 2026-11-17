import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHolodeck} from '../src/server.mjs';

test('protected prefixed runtime binds sessions to current actors and rejects forged or revoked authority',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'holodeck-server-'));
 let allowed=true;
 const runtime=await createHolodeck({production:true,basePath:'/holodeck/',publicOrigin:'https://world.test',stateDir:directory,
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
  assert.equal((await fetch(base+'api/state',{headers:{Cookie:`home=fixture-b; ${localCookie}`,'X-Daimon-Actor':'human:fixture-a'}})).status,401);
  assert.equal((await fetch(base+'api/observe',{method:'POST',headers:{...headers,Origin:'https://foreign.test','Content-Type':'application/json'},body:'{}'})).status,403);
  const observation=await(await fetch(base+'api/observe',{method:'POST',headers:{...headers,Origin:'https://world.test','Content-Type':'application/json'},body:'{}'})).json();
  const command={id:crypto.randomUUID(),issuedAt:Date.now(),run:observation.run,edition:observation.edition,
    observation:observation.id,type:'bridge.set',target:'bridge',expectedRevision:0,args:{raised:true}};
  allowed=false;
  assert.equal((await fetch(base+'api/commands',{method:'POST',headers:{...headers,Origin:'https://world.test','Content-Type':'application/json'},body:JSON.stringify(command)})).status,401);
  assert.equal(runtime.room.entities.bridge.raised,false);
 }finally{await new Promise(resolve=>listener.close(resolve));runtime.close();rmSync(directory,{recursive:true,force:true});}
});
