import assert from 'node:assert/strict';
import test from 'node:test';
import {Scene, Vector3} from 'three';
import {buildTerrainTile, selectTerrainTiles, terrainPosition} from '../src/toroidal-terrain.mjs';
import {ToroidalTerrainRenderer} from '../src/toroidal-terrain-renderer.mjs';

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
