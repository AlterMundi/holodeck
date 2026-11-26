import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createGalleryPlaqueBlob} from '../src/gallery-plaque-art.mjs';

test('the plaque uses one embedded opaque mesh and the lettering paths stay local',async()=>{
  const painted=[];
  const canvas={
    getContext:()=>({fillRect(){},fillText:text=>painted.push(text)}),
    toDataURL:()=> 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aTuoAAAAASUVORK5CYII=',
  };
  const document={createElement:()=>canvas};
  const source=await createGalleryPlaqueBlob(document,[
    {text:'Una obra\nen dos líneas',y:0,fontSize:8,fontColor:'#fff'},
  ],true).arrayBuffer();
  const header=new DataView(source);
  assert.equal(header.getUint32(0,true),0x46546c67);
  assert.equal(header.getUint32(8,true),source.byteLength);
  const end=20+header.getUint32(12,true);
  const graph=JSON.parse(new TextDecoder().decode(new Uint8Array(source,20,end-20)));
  assert.deepEqual(graph.meshes.map(mesh=>mesh.primitives.length),[1]);
  assert.equal(graph.accessors[0].min[1],0);
  assert.equal(graph.accessors[0].count,72);
  assert.equal(graph.accessors[3].count,108);
  assert.equal(graph.materials[0].alphaMode,undefined);
  assert.equal(graph.images[0].uri,undefined);
  assert.equal(graph.buffers[0].uri,undefined);
  assert.equal(canvas.width,256);
  assert.equal(canvas.height,128);
  assert.deepEqual(painted,['Una obra','en dos líneas']);
  assert.ok(source.byteLength<64000);
});
