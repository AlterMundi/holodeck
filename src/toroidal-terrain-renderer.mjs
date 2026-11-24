import {BufferAttribute, BufferGeometry, Group, Mesh, MeshStandardMaterial} from 'three';
import {
  TOROIDAL_TERRAIN, buildTerrainTile, terrainCoordinates, terrainTile,
} from './toroidal-terrain.mjs';

const profiles = Object.freeze({
  normal: {budget: 112, segments: 16},
  light: {budget: 64, segments: 12},
});
const ROOT_SEGMENTS = 16;

function tileKey(tile, segments) {
  return `${tile.key}:${tile.coarseEdges ?? 0}:${segments}`;
}

function meshFor(data, material) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(data.positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(data.normals, 3));
  if(data.colors)geometry.setAttribute('color',new BufferAttribute(data.colors,3));
  geometry.setIndex(new BufferAttribute(data.indices, 1));
  geometry.computeBoundingSphere();
  return new Mesh(geometry,material);
}

function createTile(data, material, waterMaterial) {
  const mesh = meshFor(data,material);
  if(data.water){
    const water=meshFor(data.water,waterMaterial);
    water.name='Water surface';
    mesh.add(water);
  }
  mesh.position.fromArray(data.origin);
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  return mesh;
}

function releaseTile(tile) {
  tile.traverse(mesh=>mesh.geometry?.dispose());
}

function viewerKey(viewer, profile) {
  const longitude = TOROIDAL_TERRAIN.rootColumns * 2 ** TOROIDAL_TERRAIN.maxLevel;
  const latitude = 2 ** TOROIDAL_TERRAIN.maxLevel;
  return `${profile}:${Math.floor(viewer.u * longitude)}:${Math.floor(viewer.v * latitude)}:${Math.floor(viewer.height / 12)}`;
}

export class ToroidalTerrainRenderer {
  constructor(scene, base, WorkerType = globalThis.Worker) {
    this.group = new Group();
    this.group.name = 'Toroidal terrain';
    this.material = new MeshStandardMaterial({vertexColors:true,roughness:.96});
    this.waterMaterial = new MeshStandardMaterial({color:0x138583,roughness:.26,metalness:.18});
    this.active = new Map();
    this.target = null;
    this.requested = null;
    this.selectedKey = null;
    this.inFlight = null;
    this.disposed = false;
    for (let column = 0; column < TOROIDAL_TERRAIN.rootColumns; column += 1) {
      const tile = terrainTile(0, column, 0);
      const mesh = createTile(buildTerrainTile(tile, ROOT_SEGMENTS), this.material, this.waterMaterial);
      this.active.set(tileKey(tile, ROOT_SEGMENTS), mesh);
      this.group.add(mesh);
    }
    scene.add(this.group);
    try {
      this.worker = new WorkerType(new URL('client/toroidal-terrain-worker.js', base), {type: 'module'});
      this.worker.onmessage = ({data}) => this.receive(data);
      this.worker.onerror = event => {
        event.preventDefault();
        this.stopWorker();
      };
    } catch {
      this.stopWorker();
    }
  }

  update(position, lightweight = false) {
    if (!this.worker || ![position.x, position.y, position.z].every(Number.isFinite)) return;
    const viewer = terrainCoordinates([position.x, position.y, position.z]);
    const profile = lightweight ? 'light' : 'normal';
    this.requested = {viewer, profile, key: viewerKey(viewer, profile)};
    this.pump();
  }

  pump() {
    if (!this.worker || !this.requested || this.inFlight) return;
    const request = this.requested;
    if (this.target?.key !== request.key) this.discardTarget();
    if (this.selectedKey === request.key) return;
    if (!this.target) {
      this.inFlight = {kind: 'select', request};
      this.worker.postMessage({kind: 'select', viewer: request.viewer,
        options: {budget: profiles[request.profile].budget}});
      return;
    }
    const target = this.target;
    if (!target) return;
    const next = target.missing[target.received.size];
    if (!next) {
      this.commit();
      return;
    }
    this.inFlight = {kind: 'mesh', target, key: next.key};
    this.worker.postMessage({kind: 'mesh', tile: next.tile, segments: target.segments});
  }

  receive(data) {
    const job = this.inFlight;
    if (!job || this.disposed) return;
    this.inFlight = null;
    if (data.failed) {
      this.stopWorker();
      return;
    }
    if (job.kind === 'select' && job.request.key === this.requested.key) {
      const {segments} = profiles[job.request.profile];
      const entries = data.tiles.map(tile => ({key: tileKey(tile, segments), tile}));
      const missing = entries.filter(({key}) => !this.active.has(key));
      this.target = {key: job.request.key, entries, missing, segments, received: new Map()};
    } else if (job.kind === 'mesh' && job.target === this.target && job.target.key === this.requested.key) {
      job.target.received.set(job.key, createTile(data.mesh, this.material, this.waterMaterial));
    }
    this.pump();
  }

  commit() {
    const target = this.target;
    const next = new Map();
    for (const {key} of target.entries) {
      const existing = this.active.get(key);
      const mesh = existing ?? target.received.get(key);
      next.set(key, mesh);
      if (!existing) this.group.add(mesh);
    }
    for (const [key, mesh] of this.active) {
      if (next.has(key)) continue;
      this.group.remove(mesh);
      releaseTile(mesh);
    }
    this.active = next;
    this.selectedKey = target.key;
    this.target = null;
  }

  discardTarget() {
    for (const mesh of this.target?.received.values() ?? []) releaseTile(mesh);
    this.target = null;
  }

  stopWorker() {
    this.worker?.terminate();
    this.worker = null;
    this.inFlight = null;
    this.discardTarget();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stopWorker();
    for (const mesh of this.active.values()) releaseTile(mesh);
    this.active.clear();
    this.selectedKey = null;
    this.requested = null;
    this.group.clear();
    this.group.removeFromParent();
    this.material.dispose();
    this.waterMaterial.dispose();
  }

  status() {
    return {
      visibleTiles: this.active.size,
      stagedTiles: this.target?.received.size ?? 0,
      settled: this.selectedKey !== null && this.selectedKey === this.requested?.key,
      worker: this.worker !== null,
    };
  }
}
