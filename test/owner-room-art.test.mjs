import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {test} from 'node:test';
import {loadOwnerRoomArt,ownerRoomCache} from '../src/owner-room-art.mjs';
import {arrivalDoor} from '../src/space-travel.mjs';

const sha=content=>createHash('sha256').update(content).digest('hex');
const glb=Buffer.from('glTF fixture content bounded to this test');
const model={file:'atlas.glb',sha256:sha(glb),bytes:glb.length};
const manifest={
  schema:'holodeck.linterna.hefesto-slice/v2',
  cells:{arrival:{models:[model],floor:[{x:[-8,8],z:[-12,12],top:.1,depth:.2}],colliders:[]}},
  passages:[{sides:[{cell:'street',keepParcelOffer:true},
    {cell:'arrival',threshold:[0,5],stand:[0,4],surfaceY:.1,yaw:180}]}],
};
const link='https://owner.dmn.homes/edition/manifest.json';
const rooms=new Map([['atlas',{house:'house-fixture',entry:true,links:[]}]]);
const select=(data=manifest)=>({manifest:link,sha256:sha(JSON.stringify(data)),rooms:{arrival:'atlas'}});
const reply=(data=manifest,bytes=glb)=>async url=>
  new Response(url.pathname.endsWith('.json')?JSON.stringify(data):bytes);

test('owner art is selected by content hash and keeps the existing arrival semantics',async()=>{
  const scene=(await loadOwnerRoomArt([select()],rooms,reply())).get('atlas');
  assert.deepEqual(scene.models.get(model.sha256+'.glb').bytes,glb);
  assert.match(scene.colliders,/width="16".*depth="24"/);
  const landed=arrivalDoor({id:'outside'},{id:'atlas',entryLanding:scene.exterior.landing});
  assert.deepEqual(landed,{x:0,y:.11,z:4,yaw:180});
  assert.equal(scene.exterior.door.yaw,0);
});

test('corrupt bytes, off-Home URLs and missing reciprocal graph fail closed',async()=>{
  await assert.rejects(loadOwnerRoomArt([select()],rooms,reply(manifest,Buffer.alloc(glb.length))),/selected revision/);
  await assert.rejects(loadOwnerRoomArt([{...select(),manifest:'https://other.example/data.json'}],rooms,reply()),/Home manifest/);
  const changed=new Map([['atlas',{...rooms.get('atlas'),links:[{to:'workshop',kind:'door'}]}]]);
  await assert.rejects(loadOwnerRoomArt([select()],changed,reply()),/every published door/);
});

test('the packaged reader loads only exact staged bytes without fetching Home',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'holodeck-owner-room-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const selection=select();
  const asset=join(directory,model.sha256+'.glb');
  await writeFile(join(directory,selection.sha256+'.json'),JSON.stringify(manifest));
  await writeFile(asset,glb);
  const read=ownerRoomCache(pathToFileURL(directory+'/'));
  assert.equal((await loadOwnerRoomArt([selection],rooms,read)).get('atlas').models.size,1);
  await writeFile(asset,Buffer.alloc(glb.length));
  await assert.rejects(loadOwnerRoomArt([selection],rooms,read),/selected revision/);
});
