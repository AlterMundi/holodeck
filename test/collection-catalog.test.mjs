import {once} from 'node:events';
import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {collectionSelection} from '../src/collection-catalog.mjs';
import {houseId} from '../src/houses.mjs';
import {RoomStore} from '../src/room-store.mjs';
import {createHolodeck} from '../src/server.mjs';

const main='1'.repeat(32),component='2'.repeat(32),lenses='3'.repeat(32),foreign='4'.repeat(32);
const version='a'.repeat(64),gallerySha256='b'.repeat(64),oldVersion='f'.repeat(64);
const selected={room:'matter',projects:[
  {id:'guitar',resources:[main,component]},
  {id:'lenses',resources:[lenses]},
]};

test('collection positions reject missing rooms and ambiguous resource placements',()=>{
  const rooms=new Map([['matter',{}]]);
  assert.deepEqual(collectionSelection(selected,rooms),selected);
  assert.throws(()=>collectionSelection({...selected,art:'matter-workshop-v1'},
    new Map([['matter',{links:[{kind:'stair'}]}]])),/without stairs/);
  assert.throws(()=>collectionSelection({...selected,room:'other'},rooms),/existing Collection room/);
  assert.throws(()=>collectionSelection({...selected,projects:[
    {id:'guitar',resources:[main]},
    {id:'lenses',resources:[main]},
  ]},rooms),/distinct Home resources/);
});

test('collection projects stay grouped and editions follow each visitor and their current room',async t=>{
  const owner='dm:being:v1:'+'p'.repeat(43),house=houseId(owner);
  const stateDir=mkdtempSync(join(tmpdir(),'holodeck-collection-'));
  t.after(()=>rmSync(stateDir,{recursive:true,force:true}));
  new RoomStore(join(stateDir,'houses')).save({schema:'holodeck.houses/v1',receipts:[],houses:[{
    id:house,owner,revision:1,parcel:'parcel-west-1',
    facade:{color:'#226655',title:'House',width:2,depth:1,height:2},
  }]});
  const archived=[{resource:main,version:oldVersion,label:'Guitarra · Banco inicial'}];
  const sceneVersion='d'.repeat(64);
  const json=Buffer.from(JSON.stringify({asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],
    nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0},indices:1}]}],buffers:[{byteLength:44}],
    accessors:[{count:3,type:'VEC3',componentType:5126},{count:3,type:'SCALAR',componentType:5123}]}));
  const length=(json.length+3)&~3,glb=Buffer.alloc(20+length+8+44);
  glb.write('glTF');glb.writeUInt32LE(2,4);glb.writeUInt32LE(glb.length,8);glb.writeUInt32LE(length,12);
  glb.write('JSON',16);glb.fill(32,20,20+length);json.copy(glb,20);
  glb.writeUInt32LE(44,20+length);glb.write('BIN\0',24+length);
  const sha256=createHash('sha256').update(glb).digest('hex'),models=join(stateDir,'collection-representatives');
  mkdirSync(models);
  writeFileSync(join(models,sha256+'.glb'),glb);
  writeFileSync(join(models,'index.json'),JSON.stringify({schema:'holodeck.collection-representatives/v1',
    entries:[version,oldVersion].map(version=>({resource:main,version,scene:sceneVersion,sha256}))}));
  const thumbnail='/api/space/collection-model/'+main+'/'+version;
  const archivedThumbnail='/api/space/collection-model/'+main+'/'+oldVersion;
  let revoked=false,unavailable=false,hold,expiredSession=false,mainVersion=version,historicalDenied=false;
  const requests=[];
  const runtime=await createHolodeck({
    stateDir,publicOrigin:'https://home.test',matterCollection:{...selected,art:'matter-workshop-v1',archive:archived},
    interiorSpaces:[{id:'matter',house,title:'Manipulación de Materia',entry:true,level:0,guests:['human:guest'],links:[]}],
    identityResolver:async req=>{
      if(expiredSession)return null;
      return req.headers.cookie?.includes('__Host-home=owner')?{id:owner,kind:'daimon',rights:['observe']}:
        req.headers.cookie?.includes('__Host-home=guest')?{id:'human:guest',kind:'human',rights:['observe']}:null;
    },
    collectionSourceRequest:async (url,{headers,redirect,cache,signal})=>{
      assert.equal(url.origin,'https://home.test');
      assert.match(headers.Cookie,/^__Host-home=(owner|guest)$/);
      assert.equal(redirect,'error');
      assert.equal(cache,'no-store');
      assert.equal(signal.aborted,false);
      requests.push(url.pathname);
      if(url.pathname==='/catalog.json'){
        if(unavailable)return new Response('',{status:503});
        const allowed=headers.Cookie.endsWith('owner')?[main,component,lenses,foreign]:[main,foreign];
        return Response.json({entries:allowed.map(resource=>({resource_ref:'dm:resource:v1:'+resource,
          kind:'artifact',model_review:true,title:'Project '+resource[0],version_ref:resource===main?mainVersion:version}))});
      }
      const [, ,resource,requestedVersion]=url.pathname.split('/');
      assert.notEqual(resource,foreign);
      if(hold)await hold();
      if(resource===main&&(revoked||requestedVersion===oldVersion&&historicalDenied))return new Response('',{status:404});
      return Response.json({schema:'dm.review-live/v1',gallery:'gallery.json',sha256:gallerySha256},
        {headers:{'X-Home-Version':resource===lenses?'c'.repeat(64):requestedVersion}});
    },
  });
  const listener=runtime.app.listen(0,'127.0.0.1');
  t.after(async()=>{
    runtime.close();
    listener.closeAllConnections();
    await new Promise(resolve=>listener.close(resolve));
  });
  await once(listener,'listening');
  const base='http://127.0.0.1:'+listener.address().port+'/';
  async function session(actor){
    const cookie='__Host-home='+actor+'; unrelated=private';
    const admission=await fetch(base,{headers:{Cookie:cookie,Accept:'application/json'}});
    const headers={Cookie:cookie+'; '+admission.headers.get('set-cookie').split(';')[0],
      Origin:'https://home.test','Content-Type':'application/json'};
    return {
      move:(from,to)=>fetch(base+'api/space',{headers,method:'POST',body:JSON.stringify({from,to,live:1})}),
      catalog:()=>fetch(base+'api/space/collection',{headers}),
      art:path=>fetch(new URL(path,base),{headers}),
    };
  }
  const [author,visitor]=await Promise.all([session('owner'),session('guest')]);
  assert.equal((await visitor.catalog()).status,404);
  assert.equal((await visitor.art(thumbnail)).status,404);
  assert.equal(requests.length,0);
  const entered=await author.move('outside','matter');
  assert.equal(entered.status,200);
  const scene=await entered.json();
  const asset=scene.scene.markup.match(/src="([^"]+\.glb)"/)?.[1];
  assert.match(asset,/^\/api\/space\/art\/[a-f0-9]{64}\.glb$/);
  assert.deepEqual(scene.objects.map(object=>object.id),['worktable','archive-turntable']);
  assert.equal((await visitor.art(asset)).status,404);
  const delivered=await author.art(asset);
  assert.equal(delivered.status,200);
  assert.equal(Buffer.from(await delivered.arrayBuffer()).subarray(0,4).toString(),'glTF');
  assert.equal((await visitor.move('outside','matter')).status,200);

  const response=await author.catalog();
  assert.equal(response.headers.get('cache-control'),'no-store');
  const model=resource=>({resource,version,title:'Project '+resource[0],gallerySha256,
    ...(resource===main?{representative:{scene:sceneVersion,sha256}}:{})});
  const guitar=(...resources)=>({id:'guitar',shelf:0,anchor:{x:-5.25,y:.688,z:-1.36},editions:resources.map(model)});
  const archive={anchor:{x:3.35,y:1.061,z:-3.68},
    editions:[{...model(main),version:oldVersion,label:archived[0].label}]};
  assert.deepEqual(await response.json(),{room:'matter',projects:[guitar(main,component)],archive});
  assert.deepEqual(await (await visitor.catalog()).json(),{room:'matter',projects:[guitar(main)],archive});
  assert.equal((await visitor.art(archivedThumbnail)).status,200);
  historicalDenied=true;
  assert.deepEqual((await (await visitor.catalog()).json()).archive,{...archive,editions:[]});
  assert.equal((await visitor.art(archivedThumbnail)).status,404);
  assert.equal((await visitor.art(thumbnail)).status,200);
  historicalDenied=false;
  const thumbnailResponse=await visitor.art(thumbnail);
  assert.equal(thumbnailResponse.status,200);
  assert.equal(thumbnailResponse.headers.get('cache-control'),'no-store');
  assert.deepEqual(Buffer.from(await thumbnailResponse.arrayBuffer()),glb);
  mainVersion='e'.repeat(64);
  const updated=(await (await visitor.catalog()).json()).projects[0].editions[0];
  assert.equal(updated.version,mainVersion);
  assert.equal(updated.representative,undefined);
  assert.equal((await visitor.art(thumbnail)).status,404);
  mainVersion=version;
  revoked=true;
  assert.equal((await visitor.art(thumbnail)).status,404);
  assert.deepEqual(await (await visitor.catalog()).json(),{room:'matter',projects:[],archive:{...archive,editions:[]}});
  revoked=false;
  unavailable=true;
  assert.equal((await visitor.catalog()).status,503);
  unavailable=false;

  let started,release;
  const pending=new Promise(resolve=>{started=resolve;});
  const wait=new Promise(resolve=>{release=resolve;});
  hold=()=>{started();return wait;};
  const racing=visitor.catalog();
  await pending;
  try{assert.equal((await visitor.move('matter','outside')).status,200);}
  finally{release();}
  assert.equal((await racing).status,404);
  assert.equal((await visitor.art(asset)).status,404);

  const authStarted=new Promise(resolve=>{started=resolve;});
  const authWait=new Promise(resolve=>{release=resolve;});
  hold=()=>{started();return authWait;};
  const losingAdmission=author.catalog();
  await authStarted;
  expiredSession=true;
  release();
  assert.equal((await losingAdmission).status,404);
  assert.equal((await author.catalog()).status,401);
});
