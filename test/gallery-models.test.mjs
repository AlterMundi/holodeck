import {createHash} from 'node:crypto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Box3,BoxGeometry,Group,Mesh,MeshStandardMaterial,Vector3} from 'three';
import {GalleryModels,placeGalleryModel,readGalleryModel} from '../src/gallery-models.mjs';

const pin={kind:'artifact_review',adapter:'interactive_3d',tableId:'table-1',reviewId:'workshop',revision:'pinned-1'};
const source={resource:'a'.repeat(32),publicationVersion:'b'.repeat(64)};
const path='/works/'+source.resource+'/'+source.publicationVersion+'/';
const entry={id:'house-exhibit',pin,nodeRevision:1,galleryDisplay:true};

function snapshot(document){
  const json=JSON.stringify(document),length=(json.length+3)&~3;
  const file=Buffer.alloc(20+length+8+4);
  file.write('glTF');file.writeUInt32LE(2,4);file.writeUInt32LE(file.length,8);file.writeUInt32LE(length,12);
  file.write('JSON',16);file.fill(32,20,20+length);file.write(json,20);
  file.writeUInt32LE(4,20+length);file.write('BIN\0',24+length);
  return file;
}
const staticDocument={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],
  nodes:[{mesh:0}],buffers:[{byteLength:4}],accessors:[{count:3,type:'VEC3',componentType:5126}]};

function sourceRequest({file=snapshot(staticDocument),review={},creation={},headers={},paths=[]}={}){
  const sha256=createHash('sha256').update(file).digest('hex');
  return async (url,options)=>{
    paths.push(url);assert.equal(options.cache,'no-store');assert.equal(options.redirect,'error');
    if(url==='/nexus/api/tables/table-1/artifact-review')
      return Response.json({schema_version:1,table_id:pin.tableId,review_id:pin.reviewId,revision:pin.revision,adapter:pin.adapter,source,...review});
    const local={'X-Home-Version':source.publicationVersion,...headers};
    if(url===path+'creation.json')return Response.json({schema:'holodeck.creation-source/v1',snapshotSha256:sha256,...creation},{headers:local});
    assert.equal(url,path+'snapshot.glb');
    return new Response(file,{headers:local});
  };
}

test('reads only authenticated exact Nexus and Home versioned paths and checks the published snapshot hash',async()=>{
  const paths=[],file=snapshot(staticDocument);
  assert.deepEqual(Buffer.from(await readGalleryModel(pin,{request:sourceRequest({paths,file})})),file);
  assert.deepEqual(paths,['/nexus/api/tables/table-1/artifact-review',path+'creation.json',path+'snapshot.glb']);
  await assert.rejects(readGalleryModel(pin,{request:sourceRequest({review:{revision:'latest'}})}),/edition changed/);
  await assert.rejects(readGalleryModel(pin,{request:sourceRequest({headers:{'X-Home-Version':'wrong'}})}),/source unavailable/);
  await assert.rejects(readGalleryModel(pin,{request:sourceRequest({creation:{snapshotSha256:'0'.repeat(64)}})}),/snapshot changed/);
  await assert.rejects(readGalleryModel(pin,{request:sourceRequest({file:snapshot({...staticDocument,buffers:[{uri:'https://elsewhere.test/file'}]})})}),/display format/);
});

function scene(){
  const group=new Group(),island=new Mesh(new BoxGeometry(60,8,48),new MeshStandardMaterial());
  const water=new Mesh(new BoxGeometry(220,.1,220),new MeshStandardMaterial({name:'water'}));
  island.position.set(4,2,-8);
  group.add(island,water);
  return {group,island,water};
}
test('fits actual geometry above the pedestal without the horizon plane',()=>{
  const {group,island,water}=scene(),plinth={x:2.5,y:.965,z:1.25};
  const model=placeGalleryModel(group,plinth);
  model.updateMatrixWorld(true);
  const bounds=new Box3().setFromObject(island),center=bounds.getCenter(new Vector3());
  assert.equal(water.visible,false);
  for(const [actual,expected] of [[center.x,plinth.x],[bounds.min.y,plinth.y+.015],[center.z,plinth.z]])
    assert.ok(Math.abs(actual-expected)<1e-9);
  assert.ok(bounds.getSize(new Vector3()).x<=1.1);
});

test('never attaches a late or unauthorized model and removes expired or revoked assets',async()=>{
  const canvas=new Group();
  let resolve,reads=0,clock=0;
  const display=new GalleryModels(canvas,{now:()=>clock,readModel:()=>{
    reads++;
    return new Promise(done=>{resolve=done;});
  },loader:{parseAsync:async()=>({scene:scene().group})}});
  display.sync([{...entry,galleryDisplay:false}]);assert.equal(reads,0);
  display.sync([entry]);display.clear();resolve(new ArrayBuffer(0));
  await new Promise(setImmediate);assert.equal(canvas.children.length,0);
  display.sync([entry]);resolve(new ArrayBuffer(0));
  await new Promise(setImmediate);assert.equal(canvas.children.length,1);
  clock=20000;display.sync([entry]);
  assert.equal(reads,2);
  clock=31000;display.update();assert.equal(canvas.children.length,1);
  display.sync([]);assert.equal(canvas.children.length,0);
  display.sync([entry]);resolve(new ArrayBuffer(0));
  await new Promise(setImmediate);clock=62000;display.update();assert.equal(canvas.children.length,0);
});
