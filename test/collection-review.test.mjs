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
