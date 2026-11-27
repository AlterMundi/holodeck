import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {test} from 'node:test';
import {hostedHomeUrl} from '../src/hosted-entrances.mjs';
import {houseId} from '../src/houses.mjs';
import {createHolodeck} from '../src/server.mjs';
import {RoomStore} from '../src/room-store.mjs';

test('a hosted entrance accepts only a named HTTPS Home path',()=>{
  assert.equal(hostedHomeUrl('https://owner.dmn.homes/casa/'),'https://owner.dmn.homes/casa/');
  for(const url of ['http://owner.dmn.homes/casa/','//owner.dmn.homes/casa/',
    'https://owner.dmn.homes@other.example/casa/','https://owner.dmn.homes.other.example/casa/',
    'https://owner.dmn.homes:3012/casa/','https://owner.dmn.homes/casa/#unsafe'])
    assert.equal(hostedHomeUrl(url),null);
});

test('the protected crossing returns the configured link without a shared-world move',async t=>{
  const stateDir=await mkdtemp(join(tmpdir(),'holodeck-hosted-'));
  t.after(()=>rm(stateDir,{recursive:true,force:true}));
  const origin='https://world.test';
  const owner='dm:being:v1:'+'a'.repeat(43);
  const house=houseId(owner), room='hosted-fixture';
  const human='human:telegram:7001', outsider='human:telegram:7002';
  const home='https://owner.dmn.homes/casa/';
  new RoomStore(join(stateDir,'houses')).save({schema:'holodeck.houses/v1',receipts:[],houses:[
    {id:house,owner,revision:1,parcel:'parcel-east-1',facade:{title:'Fixture',color:'#477050',width:3,depth:1.3,height:2}},
  ]});
  const runtime=await createHolodeck({production:true,stateDir,publicOrigin:origin,
    identityResolver:async req=>{
      const ref=req.headers.cookie?.startsWith('home=allowed')?human:outsider;
      return {id:ref,ref,kind:'human',rights:['observe']};
    },
    interiorSpaces:[{id:room,house,title:'Fixture',level:0,entry:true,links:[],guests:[human]}],
    hostedEntrances:[{room,home}],
  });
  const listener=runtime.app.listen(0,'127.0.0.1');
  await new Promise(resolve=>listener.once('listening',resolve));
  t.after(()=>{runtime.close();listener.closeAllConnections();return new Promise(resolve=>listener.close(resolve));});
  const base='http://127.0.0.1:'+listener.address().port;
  async function session(value){
    const cookie='home='+value;
    const response=await fetch(base+'/',{headers:{Cookie:cookie}});
    assert.equal(response.status,200);
    return cookie+'; '+response.headers.get('set-cookie').split(';')[0];
  }
  const allowed=await session('allowed'), denied=await session('denied');
  const move=(Cookie,body)=>fetch(base+'/api/space',{method:'POST',
    headers:{Cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const request={from:'outside',to:room,live:1};
  assert.equal((await move(denied,request)).status,409);
  assert.equal((await move(allowed,{...request,home:'https://attacker.example/'})).status,409);
  const offered=await move(allowed,request);
  assert.equal(offered.status,200);
  assert.deepEqual(await offered.json(),{id:'outside',hostedEntrance:home});
  const current=await fetch(base+'/api/space',{headers:{Cookie:allowed}});
  assert.equal((await current.json()).id,'outside');
  assert.equal((await fetch(base+'/api/space/scene?room='+room,{headers:{Cookie:allowed}})).status,404);
});
