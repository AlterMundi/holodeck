import assert from 'node:assert/strict';
import test from 'node:test';
import {Group, Scene, Vector3} from 'three';
import {buildTerrainTile, selectTerrainTiles, terrainCoordinates, terrainElevation, terrainPosition} from '../src/toroidal-terrain.mjs';
import {ToroidalTerrainRenderer} from '../src/toroidal-terrain-renderer.mjs';
import {buildReflectionBank,REFLECTION_BANK} from '../src/toroidal-bank-reflection.mjs';

class TestWorker {
  pending = null;
  terminated = false;

  postMessage(message) {
    assert.equal(this.pending, null, 'only one worker request is allowed');
    this.pending = message;
  }

  answer() {
    const message = this.pending;
    this.pending = null;
    if(message.kind==='reflection-bank'){
      this.onmessage({data:{bank:buildReflectionBank(message.row,message.rows)}});
      return;
    }
    this.onmessage({data: message.kind === 'select' ?
      {tiles: selectTerrainTiles(message.viewer, message.options)} :
      {mesh: buildTerrainTile(message.tile, message.segments, message.tile.coarseEdges)}});
  }

  terminate() {
    this.terminated = true;
  }
}

const position = (u, v) => new Vector3(...terrainPosition(u, v, 10));
const base = 'http://127.0.0.1/holodeck/';

test('streamed tiles replace visible terrain together and release superseded geometry', () => {
  const scene = new Scene();
  const renderer = new ToroidalTerrainRenderer(scene, base, TestWorker);
  const worker = renderer.worker;
  const start = position(.998, .998);
  const acrossSeam = position(.001, .999);
  const initial = renderer.group.children.slice();
  renderer.update(start, true);
  worker.answer();
  for (let i = 0; i < 10; i += 1) worker.answer();
  assert.deepEqual(renderer.group.children, initial);
  assert.equal(renderer.status().stagedTiles, 10);
  assert.equal(renderer.hasDetailedTerrain, false);
  while (worker.pending) worker.answer();
  assert.equal(renderer.hasDetailedTerrain, true);
  assert.equal(renderer.status().visibleTiles, 64);
  assert.equal(renderer.status().settled, true);

  // Returning to the committed viewer location while a mesh is pending must
  // release the unfinished meshes without dispatching the same tile again.
  renderer.update(acrossSeam, true);
  assert.equal(renderer.status().settled, false);
  assert.equal(renderer.hasDetailedTerrain, true);
  worker.answer();
  worker.answer();
  const staged = renderer.target.received.values().next().value;
  let released = false;
  staged.geometry.addEventListener('dispose', () => { released = true; });
  renderer.update(start, true);
  worker.answer();
  assert.equal(worker.pending, null);
  assert.equal(released, true);
  assert.equal(renderer.status().settled, true);
  assert.equal(renderer.status().stagedTiles, 0);

  renderer.dispose();
  assert.equal(renderer.hasDetailedTerrain, false);
  assert.equal(worker.terminated, true);
  assert.equal(scene.children.length, 0);
  assert.equal(renderer.status().visibleTiles, 0);
});

test('water keeps one blended surface across the shore and deep tiles', () => {
  const renderer = new ToroidalTerrainRenderer(new Scene(), base, TestWorker);
  renderer.update(position(.0171,.258), true);
  while (renderer.worker.pending) renderer.worker.answer();
  const water = [];
  renderer.group.traverse(mesh => {
    if (mesh.name === 'Water surface') water.push(mesh);
  });
  const isShallow = mesh => mesh.geometry.getAttribute('shoreDepth').array.some(depth => depth < 3.6);
  assert.ok(water.some(isShallow));
  assert.ok(water.some(mesh => !isShallow(mesh)));
  for (const {material} of water) {
    assert.equal(material, renderer.waterMaterial);
    assert.equal(material.transparent, true);
    assert.equal(material.opacity, .8);
    assert.equal(material.depthWrite, false);
  }
  renderer.dispose();
});

test('the bank data follows the curved terrain and stays off the lightweight water path',()=>{
  const renderer=new ToroidalTerrainRenderer(new Scene(),base,TestWorker,{bankReflection:true});
  const worker=renderer.worker,near=new Vector3(...REFLECTION_BANK.center);
  const {size,heightRange,center,along,across,up}=REFLECTION_BANK;
  const drain=()=>{
    while(worker.pending)worker.answer();
  };
  renderer.update(near,true);
  drain();
  renderer.update(near,true);
  assert.equal(renderer.reflectionTexture,undefined);
  assert.equal(worker.pending,null);

  renderer.update(near,false);
  while(worker.pending&&worker.pending.kind!=='reflection-bank')worker.answer();
  renderer.update(near,false);
  assert.equal(worker.pending.kind,'reflection-bank');

  // Switching profile while the worker is busy cannot attach the bank
  // material to the lightweight tiles.
  renderer.update(near,true);
  drain();
  assert.equal(renderer.reflectionTexture,undefined);
  assert.equal(renderer.bankBuild.next,20);
  assert.equal(renderer.visibleWaterMaterial,renderer.waterMaterial);

  renderer.update(near,false);
  drain();
  renderer.update(near,false);
  drain();
  renderer.update(near,false);
  const texture=renderer.reflectionTexture;
  assert.deepEqual(texture.image.data,buildReflectionBank());
  assert.equal(texture.image.data.byteLength,size*size*2);
  for(const j of [0,35,79,120,159])for(const i of [0,31,80,123,159]){
    const at=2*(j*size+i), data=texture.image.data;
    const lift=((256*data[at]+data[at+1])/65535-.5)*heightRange;
    const x=i+.5-size/2,z=j+.5-size/2;
    const point=center.map((coordinate,k)=>coordinate+x*along[k]+z*across[k]+lift*up[k]);
    const {u,v,height}=terrainCoordinates(point);
    assert.ok(Math.abs(height-terrainElevation(u,v))<.01);
  }
  renderer.update(near,false);
  drain();
  const reflected=renderer.visibleWaterMaterial;
  assert.equal(reflected,renderer.reflectionMaterial);
  assert.equal(reflected.opacity,renderer.waterMaterial.opacity);
  assert.notEqual(reflected.customProgramCacheKey(),renderer.waterMaterial.customProgramCacheKey());
  for(const mesh of renderer.active.values())
    for(const water of mesh.children)assert.equal(water.material,reflected);

  renderer.update(near,true);
  assert.equal(renderer.visibleWaterMaterial,renderer.waterMaterial);
  renderer.update(near,false);
  drain();
  renderer.update(near,false);
  assert.equal(renderer.visibleWaterMaterial,reflected);
  worker.onerror({preventDefault() {}});
  assert.equal(renderer.visibleWaterMaterial,renderer.waterMaterial);
  renderer.update(near,true);
  for(const mesh of renderer.active.values())
    for(const water of mesh.children)assert.equal(water.material,renderer.waterMaterial);
  let disposals=0;
  for(const target of [texture,reflected])target.addEventListener('dispose',()=>disposals++);
  renderer.dispose();
  assert.equal(disposals,2);
});

test('worker failure preserves usable distant terrain and releases queued work', () => {
  const renderer = new ToroidalTerrainRenderer(new Scene(), base, TestWorker);
  const worker = renderer.worker;
  renderer.update(position(0, 0));
  worker.onerror({preventDefault() {}});
  assert.equal(renderer.hasDetailedTerrain, false);
  assert.equal(renderer.status().visibleTiles, 4);
  assert.equal(renderer.status().stagedTiles, 0);
  assert.equal(renderer.status().worker, false);
  assert.equal(worker.terminated, true);
  renderer.dispose();
});

test('facade contact follows the authored transform and clears without changing terrain',()=>{
  const scene=new Scene();
  const terrain=new ToroidalTerrainRenderer(scene,base,TestWorker);
  const original=terrain.group.children.slice();
  const facade=new Group();
  facade.position.set(1795.5,498,15.5);
  facade.rotation.y=Math.PI/2;
  scene.add(facade);
  try{
    terrain.setFacadeContact(facade);
    const [x,z,halfX,halfZ]=terrain.environment.facadeGround.value.toArray();
    assert.deepEqual([x,z],[1795.5,15.5]);
    assert.ok(Math.abs(halfX-1.574)<1e-9&&Math.abs(halfZ-.732)<1e-9);
    terrain.setFacadeContact(null);
    assert.deepEqual(terrain.environment.facadeGround.value.toArray(),[0,0,0,0]);
    assert.deepEqual(terrain.group.children,original);
  }finally{terrain.dispose();}
});
