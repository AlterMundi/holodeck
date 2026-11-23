import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdirSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {HumanAvatarProfiles,humanWardrobeAssets} from '../src/human-avatars.mjs';
import {createHolodeck} from '../src/server.mjs';

const session=(id,kind='human')=>({actor:{kind,id}});
const model=(roster,lease)=>roster.model(lease.actor);

test('every retained human receives a distinct avatar and reconnecting does not move existing profiles',()=>{
  let saved;
  const roster=new HumanAvatarProfiles(null,value=>{saved=structuredClone(value);});
  const humans=Array.from({length:8},(_,i)=>session('human:fixture-'+i));
  const native=session('daimon:fixture','daimon');
  roster.retain([...humans,native]);
  const appearances=humans.map(lease=>model(roster,lease));
  assert.equal(new Set(appearances).size,8);
  assert.equal(model(roster,native),'avatar-1-bodyA-skin01.glb');
  assert.equal(saved.assignments.length,8);
  assert.doesNotMatch(JSON.stringify(saved),/human:|daimon:/);

  const restored=new HumanAvatarProfiles(saved);
  restored.retain([...humans].reverse());
  assert.deepEqual(humans.map(lease=>model(restored,lease)),appearances);

  const current=[session('human:new'),...humans.slice(1)];
  restored.retain(current);
  assert.equal(new Set(current.map(lease=>model(restored,lease))).size,8);
  for(let i=1;i<8;i++)assert.equal(model(restored,humans[i]),appearances[i]);
  restored.retain([session(humans[4].actor.id),...current.filter(lease=>lease!==humans[4])]);
  assert.equal(model(restored,humans[4]),appearances[4]);
});

const rigs=['avatar-1-bodyA-skin01','avatar-2-bodyB-skin03','avatar-3-bodyA-skin05','avatar-4-bodyB-skin07'];
function readGlb(file){
  assert.equal(file.subarray(0,4).toString(),'glTF');
  assert.equal(file.readUInt32LE(8),file.length);
  const offset=file.readUInt32LE(12)+20;
  const json=JSON.parse(file.subarray(20,offset).toString());
  const binary=file.subarray(offset+8);
  assert.equal(binary.length,file.readUInt32LE(offset));
  return {json,buffers:json.bufferViews.map(view=>binary.subarray(view.byteOffset,view.byteOffset+view.byteLength))};
}

test('each alternate wardrobe keeps the original model and replaces only its embedded color atlas',()=>{
  for(const [index,[name,alternate]] of [...humanWardrobeAssets()].entries()){
    assert.equal(name,`avatar-wardrobe-v1-${index+1}.glb`);
    const rig=rigs[index];
    const orig=readGlb(readFileSync(new URL(`../public/assets/${rig}.glb`,import.meta.url)));
    const changed=readGlb(alternate);
    const texture=readFileSync(new URL(`../public/assets/human-outfits/${rig}.jpg`,import.meta.url));
    for(const key of ['accessors','images','materials','meshes','nodes','skins'])
      assert.deepEqual(changed.json[key],orig.json[key]);
    const atlas=orig.json.images.find(image=>image.name==='atlas-base').bufferView;
    assert.deepEqual(changed.buffers[atlas],texture);
    assert.notDeepEqual(changed.buffers[atlas],orig.buffers[atlas]);
    for(let i=0;i<orig.buffers.length;i++)if(i!==atlas)assert.deepEqual(changed.buffers[i],orig.buffers[i]);
  }
});

test('MML can fetch self-contained wardrobe GLBs at the deployed base path',async t=>{
  const runtime=await createHolodeck({basePath:'/holodeck/'});
  const server=runtime.app.listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(()=>{runtime.close();server.closeAllConnections();return new Promise(resolve=>server.close(resolve));});
  const address=`http://127.0.0.1:${server.address().port}/holodeck/assets/`;
  for(const [name,buffer] of humanWardrobeAssets()){
    const response=await fetch(address+name);
    assert.equal(response.status,200);
    assert.match(response.headers.get('content-type'),/^model\/gltf-binary/);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),buffer);
  }
  assert.equal((await fetch(address+'avatar-wardrobe-v1-5.glb')).status,404);
});

test('a failed cosmetic save leaves protected room admission available',async t=>{
  const stateDir=mkdtempSync(join(tmpdir(),'holodeck-avatar-write-'));
  const runtime=await createHolodeck({production:true,basePath:'/holodeck/',stateDir,
    publicOrigin:'https://world.test',identityResolver:async()=>({id:'human:wardrobe-test',ref:'human:wardrobe-test',
      kind:'human',name:'Fixture',rights:['observe']})});
  // A directory here makes the existing atomic writer fail its open.
  mkdirSync(join(stateDir,'human-avatars','room.stage.json'));
  const server=runtime.app.listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(async()=>{
    runtime.close();server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
    rmSync(stateDir,{recursive:true,force:true});
  });
  const base=`http://127.0.0.1:${server.address().port}/holodeck/`;
  const login=await fetch(base);
  assert.equal(login.status,200);
  assert.match(login.headers.get('set-cookie'),/holodeck_session=[a-f0-9]{40}/);
  const state=await fetch(base+'api/state',{headers:{Cookie:login.headers.get('set-cookie').split(';')[0]}});
  assert.equal(state.status,200);
  assert.equal((await state.json()).actorRef,'human:wardrobe-test');
});
