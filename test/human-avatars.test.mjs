import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdirSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {HumanAvatarProfiles,humanWardrobeAssets,personalAvatarFile} from '../src/human-avatars.mjs';
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

test('explicit avatar choices outlive session leases and have bounded durable retention',()=>{
  const first=session('human:first').actor;
  const second=session('human:second').actor;
  let saved;
  const profiles=new HumanAvatarProfiles(null,null,null,value=>{saved=value;});
  assert.equal(profiles.choose(first,6),true);
  profiles.retain([session('human:replacement')]);
  assert.equal(profiles.model(first),'avatar-wardrobe-v1-3.glb');
  assert.equal(profiles.preference(second),null);
  assert.equal(profiles.choose(session('other','daimon').actor,4),false);
  assert.equal(profiles.choose(first,-1),false);
  assert.doesNotMatch(JSON.stringify(saved),/human:/);
  const restored=new HumanAvatarProfiles(null,null,saved,value=>{saved=value;});
  assert.equal(restored.preference(first),6);
  assert.equal(restored.choose(first,null),true);
  assert.equal(restored.preference(first),null);
  for(let i=0;i<65;i++)restored.choose(session(`human:fixture-${i}`).actor,3);
  assert.equal(saved.choices.length,64);
  assert.equal(restored.preference(session('human:fixture-0').actor),null);
  assert.equal(restored.preference(session('human:fixture-64').actor),3);
});

test('only the configured paired human gets Explorer by default and can still choose a wardrobe',()=>{
  const paired=session('human:paired').actor,guest=session('human:guest').actor;
  let saved;
  const previous=new HumanAvatarProfiles(null,null,null,value=>{saved=value;});
  previous.choose(paired,4);
  previous.choose(guest,6);
  const entering=new HumanAvatarProfiles(null,null,saved,value=>{saved=value;},paired.id);
  assert.equal(entering.model(paired),personalAvatarFile);
  assert.equal(entering.preference(paired),null);
  assert.equal(entering.model(guest),'avatar-wardrobe-v1-3.glb');
  assert.equal(entering.choose(paired,4),true);
  const returning=new HumanAvatarProfiles(null,null,saved,value=>{saved=value;},paired.id);
  assert.equal(returning.model(paired),'avatar-wardrobe-v1-1.glb');
  assert.equal(returning.choose(paired,null),true);
  assert.equal(returning.model(paired),personalAvatarFile);
  assert.equal(new HumanAvatarProfiles(null,null,saved).model(guest),'avatar-wardrobe-v1-3.glb');
});

test('appearance writes require the authenticated actor and survive a runtime restart',async t=>{
  const stateDir=mkdtempSync(join(tmpdir(),'holodeck-avatar-choice-'));
  const startup=async()=>{
    const runtime=await createHolodeck({production:true,basePath:'/holodeck/',stateDir,
      publicOrigin:'https://world.test',identityResolver:async req=>{
        const id=/fixture=(first|second)/.exec(req.headers.cookie??'')?.[1];
        return id?{id,kind:'human',rights:['observe']}:null;
      }});
    const server=runtime.app.listen(0,'127.0.0.1');
    await once(server,'listening');
    const base=`http://127.0.0.1:${server.address().port}/holodeck/`;
    const close=()=>{runtime.close();server.closeAllConnections();return new Promise(resolve=>server.close(resolve));};
    return {base,close};
  };
  let runtime=await startup();
  t.after(async()=>{await runtime?.close();rmSync(stateDir,{recursive:true,force:true});});
  const login=async id=>{
    const fixture='fixture='+id;
    const response=await fetch(runtime.base,{headers:{Cookie:fixture}});
    return fixture+'; '+response.headers.get('set-cookie').split(';')[0];
  };
  const read=cookie=>fetch(runtime.base+'api/appearance',{headers:{Cookie:cookie}});
  const write=(cookie,data,origin='https://world.test')=>fetch(runtime.base+'api/appearance',{
    method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(data)
  });
  const first=await login('first'),second=await login('second');
  assert.equal((await write(first,{choice:3},'https://elsewhere.test')).status,403);
  assert.equal((await write(first,{choice:3,actor:'second'})).status,400);
  assert.equal((await write(first.replace('fixture=first','fixture=second'),{choice:3})).status,401);
  assert.deepEqual(await (await write(first,{choice:3})).json(),{choice:3});
  assert.deepEqual(await (await read(second)).json(),{choice:null});
  await runtime.close();runtime=null;
  runtime=await startup();
  assert.deepEqual(await (await read(await login('first'))).json(),{choice:3});
  assert.deepEqual(await (await read(await login('second'))).json(),{choice:null});
});

test('only the current paired world session receives the exact private Home avatar link',async t=>{
  const stateDir=mkdtempSync(join(tmpdir(),'holodeck-private-avatar-'));
  const resource='a'.repeat(32),version='b'.repeat(64);
  let ownerHasAccess=true;
  const runtime=await createHolodeck({production:true,basePath:'/holodeck/',stateDir,
    releaseControllerRef:'owner',privatePersonalAvatar:{resource,version},publicOrigin:'https://world.test',
    identityResolver:async req=>{
      const id=/fixture=(owner|peer)/.exec(req.headers.cookie??'')?.[1];
      return id?{id,kind:'human',rights:id==='owner'&&!ownerHasAccess?[]:['observe']}:null;
    }});
  const server=runtime.app.listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(async()=>{
    runtime.close();server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
    rmSync(stateDir,{recursive:true,force:true});
  });
  const base=`http://127.0.0.1:${server.address().port}/holodeck/`;
  const login=async id=>{
    const fixture='fixture='+id;
    const response=await fetch(base,{headers:{Cookie:fixture}});
    return fixture+'; '+response.headers.get('set-cookie').split(';')[0];
  };
  const asset=cookie=>fetch(base+'api/appearance/personal-model.glb',{
    redirect:'manual',headers:cookie?{Cookie:cookie}:{}});
  const owner=await login('owner'),peer=await login('peer');
  const personal=await asset(owner);
  assert.equal(personal.status,302);
  assert.equal(personal.headers.get('location'),`/works/${resource}/${version}/assets/explorer-hero-proposal.glb`);
  assert.equal(personal.headers.get('cache-control'),'private, no-store');
  assert.match(personal.headers.get('vary'),/\bCookie\b/);
  const foreign=await asset(peer);
  assert.equal(foreign.status,302);
  assert.equal(foreign.headers.get('location'),'/holodeck/assets/'+personalAvatarFile);
  assert.doesNotMatch(await foreign.text(),new RegExp(resource));
  assert.equal((await asset()).status,401);
  assert.equal((await asset(owner.replace('fixture=owner','fixture=peer'))).status,401);
  ownerHasAccess=false;
  assert.equal((await asset(owner)).status,403);
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

test('each human skin exposes a neutral sparse mouth pose with bounded deformation',()=>{
  for(const rig of rigs){
    const {json,buffers}=readGlb(readFileSync(new URL('../public/assets/'+rig+'.glb',import.meta.url)));
    const mesh=json.meshes[0],primitive=mesh.primitives[0];
    assert.deepEqual(mesh.extras.targetNames,['jawOpen']);
    assert.deepEqual(mesh.weights,[0]);
    const target=primitive.targets[0],position=json.accessors[target.POSITION],normal=json.accessors[target.NORMAL];
    assert.equal(position.count,json.accessors[primitive.attributes.POSITION].count);
    assert.equal(position.componentType,5126);
    assert.equal(position.type,'VEC3');
    assert.equal(position.bufferView,undefined);
    assert.equal(normal.sparse.count,position.sparse.count);
    const indices=buffers[position.sparse.indices.bufferView];
    const displacements=buffers[position.sparse.values.bufferView];
    assert.ok(position.sparse.count>800&&position.sparse.count<1800);
    let last=-1;
    for(let index=0;index<position.sparse.count;index++){
      const vertex=indices.readUInt16LE(index*2);
      assert.ok(vertex>last&&vertex<position.count);
      last=vertex;
      const delta=[0,1,2].map(axis=>displacements.readFloatLE(index*12+axis*4));
      assert.ok(Math.hypot(...delta)<.022);
    }
    assert.ok(position.min[1]<-.012&&position.max[1]>.001);
  }
});

test('the Character Studio keeps the shareable Explorer rig',async()=>{
  const {rigs}=await import('../src/character-studio-rigs.mjs');
  const {personalAvatarFile}=await import('../src/human-avatars.mjs');
  assert.equal(rigs.explorer.file,'assets/'+personalAvatarFile);
  assert.equal(rigs.explorer.clips,rigs.humanoid.clips);
});
