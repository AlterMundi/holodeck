import {createHash} from 'node:crypto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readWorktableReview} from '../src/collection-review.mjs';

const resource='1'.repeat(32),version='2'.repeat(64);
const base='/works/'+resource+'/'+version+'/';
const part={id:'edge',label:'Edge',color:'#007766'};
const scene={id:'sample',title:'Working study',version:'3'.repeat(64),units:'mm',
  parts:[{...part,vertices:[[0,0,0],[1000,0,0],[0,1000,1000]],faces:[[0,1,2]]}]};
const content=value=>Buffer.from(JSON.stringify(value));
const sha=value=>createHash('sha256').update(value).digest('hex');

test('worktable reads the exact selected scene and preserves the full authored triangles',async()=>{
  const data=content({scenes:[scene]});
  const index=content({schema:'dm.review-scene-index/v1',initial:scene.id,entries:[
    {file:'scene-000.json',sha256:sha(data),scene:{...scene,parts:[part]}},
  ]});
  const seen=[];
  const request=async (path,options)=>{
    seen.push(path);
    assert.equal(options.cache,'no-store');
    assert.equal(options.credentials,'same-origin');
    assert.equal(options.redirect,'error');
    const bytes=new Map([[base+'scene-index.json',index],[base+'scene-000.json',data]]).get(path);
    assert.ok(bytes);
    return new Response(bytes,{headers:{'X-Home-Version':version}});
  };
  const edition={resource,version,gallerySha256:'0'.repeat(64),sceneIndexSha256:sha(index)};
  const review=await readWorktableReview(edition,null,{request});
  assert.deepEqual(seen,[base+'scene-index.json',base+'scene-000.json']);
  assert.equal(review.version,scene.version);
  assert.deepEqual(Array.from(review.parts[0].positions,n=>n||0),[0,0,0,1,0,0,0,1,-1]);
  assert.deepEqual(Array.from(review.parts[0].indices),[0,1,2]);
});

test('worktable rejects changed reader versions and bad publication bytes before drawing',async()=>{
  const data=content({scenes:[scene]});
  await assert.rejects(readWorktableReview({resource,version,gallerySha256:sha(data)},null,{
    request:async()=>new Response(data,{headers:{'X-Home-Version':'a'.repeat(64)}}),
  }),/source unavailable/);
  await assert.rejects(readWorktableReview({resource,version,gallerySha256:'0'.repeat(64)},null,{
    request:async()=>new Response(data,{headers:{'X-Home-Version':version}}),
  }),/checksum changed/);
});

test('a scene can carry its exact complete model, which the worktable animates over invisible part proxies',async()=>{
  const {AnimationClip,NumberKeyframeTrack,BoxGeometry,Group,Mesh,MeshStandardMaterial}=await import('three');
  const {loadSceneModel,makeModel,presentModel}=await import('../src/collection-worktable.mjs');
  const glb=Buffer.from('glTF fixture bytes for the exact presentation');
  const model={file:'explorer-hero-v29.glb',sha256:sha(glb),bytes:glb.length,clip:'hero_idle'};
  const data=content({scenes:[{...scene,model}]});
  const edition={resource,version,gallerySha256:sha(data)};
  const request=async path=>new Response(path.endsWith('.glb')?glb:data,{headers:{'X-Home-Version':version}});
  const review=await readWorktableReview(edition,null,{request});
  assert.deepEqual(review.model,model);
  for(const bad of [{...model,file:'../x.glb'},{...model,bytes:9e9},{...model,sha256:'z'},{file:'a.glb'}]){
    const broken=content({scenes:[{...scene,model:bad}]});
    await assert.rejects(readWorktableReview({...edition,gallerySha256:sha(broken)},null,{
      request:async()=>new Response(broken,{headers:{'X-Home-Version':version}})}),/scene model/);
  }
  // exact bytes from the same edition reach the loader; anything else is refused
  const seen=[];
  const loader={parseAsync:async bytes=>{seen.push(Buffer.from(bytes).equals(glb));
    const root=new Group();root.add(new Mesh(new BoxGeometry(1,1,1),new MeshStandardMaterial()));
    const wave=new NumberKeyframeTrack('.position[x]',[0,1],[0,.2]);
    return {scene:root,animations:[new AnimationClip('other',1,[wave]),new AnimationClip('hero_idle',1,[wave])]};}};
  const gltf=await loadSceneModel(edition,model,{request,loader});
  assert.deepEqual(seen,[true]);
  await assert.rejects(loadSceneModel(edition,{...model,sha256:'0'.repeat(64)},{request,loader}),/changed/);
  await assert.rejects(loadSceneModel(edition,model,{loader,
    request:async()=>new Response(glb,{headers:{'X-Home-Version':'a'.repeat(64)}})}),/unavailable/);
  const table=makeModel(review,{x:0,y:1,z:0});
  presentModel(table,gltf,model.clip);
  assert.equal(table.clip,'hero_idle');
  assert.ok(table.presentation.parent===table.group.children[0],'shares the parts frame and scale');
  const proxy=table.parts.get('edge');
  assert.equal(proxy.material.opacity,0);
  assert.equal(proxy.userData.matterProxy,true);
  table.mixer.update(.5);
  assert.ok(table.presentation.position.x>.05,'the chosen clip plays');
});
