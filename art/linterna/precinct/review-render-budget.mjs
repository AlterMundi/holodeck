const cadence = 1000 / 30;

export const motionProfiles = [
  { pixels: 38500, effects: 'direct', distance: 0.54 },
  { pixels: 82000, effects: 'direct', distance: 0.73 },
  { pixels: 145000, effects: 'direct', distance: 1 },
  { pixels: 270000, effects: 'direct', distance: 1.2 },
];

const restProfiles = [
  { pixels: 76000, effects: 'direct', distance: 0.75 },
  { pixels: 140000, effects: 'direct', distance: 0.98 },
  { pixels: 285000, effects: 'bloom', distance: 1.25 },
  { pixels: 530000, effects: 'full', distance: 1.5 },
];

// Use wall time for the render budget. A slow device must not appear to meet
// the target because the movement integrator clamps its simulation delta.
export class ReviewBudget {
  constructor(compact) {
    this.level = compact ? 1 : 2;
    this.motionAt = -Infinity;
    this.next = null;
    this.lastDraw = null;
    this.motion = null;
    this.windowAt = 0;
    this.samples = [];
    this.movingFrames = 0;
  }

  resetFrames() {
    this.next = null;
    this.lastDraw = null;
    this.samples.length = 0;
    this.movingFrames = 0;
  }

  plan(time, active, dirty) {
    if (active) this.motionAt = time;
    const moving = time - this.motionAt < 280;
    const changed = moving !== this.motion;
    this.motion = moving;
    if (changed) this.resetFrames();
    if (!moving) return { draw: dirty || changed, profile: restProfiles[this.level], moving };
    const draw = this.next === null || time + 2 >= this.next;
    if (draw) {
      const next = (this.next ?? time) + cadence;
      this.next = next > time ? next : time + cadence;
    }
    return { draw, profile: motionProfiles[this.level], moving };
  }

  observe(time, cpuTime) {
    if (this.lastDraw === null) this.windowAt = time;
    if (this.lastDraw !== null) this.samples.push([time - this.lastDraw, cpuTime]);
    this.lastDraw = time;
    this.movingFrames++;
    const elapsed = time - this.windowAt;
    if (this.samples.length < 3 || elapsed < 700) return;
    const mean = this.samples.reduce((sum, sample) => sum + sample[0], 0) / this.samples.length;
    const cpu = this.samples.reduce((sum, sample) => sum + sample[1], 0) / this.samples.length;
    if (mean > 38 || cpu > 28) {
      this.level = Math.max(0, this.level - 1);
    } else if (elapsed < 4200) {
      return;
    } else if (mean <= 34.5 && cpu < 13) {
      this.level = Math.min(motionProfiles.length - 1, this.level + 1);
    }
    this.samples.length = 0;
    this.windowAt = time;
  }
}

export function reviewPixelRatio(width, height, deviceRatio, pixelBudget) {
  return Math.min(1.5, deviceRatio, Math.sqrt(pixelBudget / (width * height)));
}

export const reviewFast = { value: 1 };

export function spatialTiles(items, locate, width) {
  const tiles = new Map();
  for (const item of items) {
    const [x, z] = locate(item);
    const key = Math.floor(x / width) + ':' + Math.floor(z / width);
    if (!tiles.has(key)) tiles.set(key, []);
    tiles.get(key).push(item);
  }
  return tiles.values();
}

// Keep the same distributed cards when lowering density, independent of the
// order in which individual plants were authored.
export function distributeSamples(items) {
  return items.map((item, index) => ({ item, key: Math.imul(index + 1, 0x9e3779b1) >>> 0 }))
    .sort((a, b) => a.key - b.key).map(({ item }) => item);
}

export function clusterReviewMesh(THREE, original, cell) {
  const position = original.getAttribute('position');
  const normal = original.getAttribute('normal');
  const index = original.getIndex();
  const clusters = new Map();
  const remap = new Uint32Array(position.count);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const key = [x, y, z].map(value => Math.round(value / cell)).join(':');
    let cluster = clusters.get(key);
    if (!cluster) {
      cluster = { index: clusters.size, count: 0, position: [0,0,0], normal: [0,0,0] };
      clusters.set(key, cluster);
    }
    cluster.count++;
    cluster.position[0] += x;
    cluster.position[1] += y;
    cluster.position[2] += z;
    cluster.normal[0] += normal.getX(i);
    cluster.normal[1] += normal.getY(i);
    cluster.normal[2] += normal.getZ(i);
    remap[i] = cluster.index;
  }
  const vertices = [], normals = [], triangles = [], seen = new Set();
  for (const cluster of clusters.values()) {
    vertices.push(...cluster.position.map(value => value / cluster.count));
    const length = Math.hypot(...cluster.normal) || 1;
    normals.push(...cluster.normal.map(value => value / length));
  }
  for (let i = 0; i < index.count; i += 3) {
    const a = remap[index.getX(i)], b = remap[index.getX(i+1)], c = remap[index.getX(i+2)];
    if (a === b || b === c || a === c) continue;
    const start = Math.min(a,b,c), end = Math.max(a,b,c);
    const key = start + ':' + (a+b+c-start-end) + ':' + end;
    if (seen.has(key)) continue;
    seen.add(key);
    triangles.push(a,b,c);
  }
  const mesh = new THREE.BufferGeometry();
  mesh.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  mesh.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  mesh.setIndex(triangles);
  return mesh;
}

export function updateReviewDetail(objects, camera, scale, moving) {
  for (const object of objects) {
    const data = object.userData.reviewDetail;
    const distance = Math.hypot(camera.x - data.center.x, camera.z - data.center.z) - data.radius;
    if (data.full && !data.grass) {
      const boundary = (moving ? data.moving : data.still) * scale;
      object.geometry = distance < boundary ? data.full : data.light;
    } else if (data.grass) {
      object.visible = distance < 34 * scale;
      object.count = Math.ceil(data.total * (distance < 7 * scale ? 1 : distance < 16 * scale ? .55 : .19));
      object.geometry = !moving && distance < 5 * scale ? data.full : data.light;
    } else {
      const cost = distance < 10 * scale ? 1 : distance < 27 * scale ? .62 : .29;
      object.geometry.setDrawRange(0, Math.ceil(data.total * cost / 6) * 6);
    }
  }
}
