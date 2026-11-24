// Versioned shared coordinates. u circles the ring and v circles its tube;
// both use turns. Positions and radial heights are in metres.
const TAU = 2 * Math.PI;
// A common binary grid keeps duplicated borders bit-exact after Float32
// quantization in different tile-local origins. Leave one bit for edge midpoints.
const MESH_GRID = 1024;
const quantizeMeshPoint = point => point.map(value => Math.round(value * MESH_GRID) / MESH_GRID);

export const TOROIDAL_TERRAIN = Object.freeze({
  id: 'toroidal-terrain@1',
  seed: 0x7f41c5a1,
  majorRadius: 1800,
  tubeRadius: 480,
  waterLevel: -9,
  rootColumns: 4,
  maxLevel: 7,
});

export const TOROIDAL_PARCEL_Y = TOROIDAL_TERRAIN.tubeRadius + 18;

export function toroidalParcelPoint(point) {
  return {...point, x: point.x + TOROIDAL_TERRAIN.majorRadius, y: point.y + TOROIDAL_PARCEL_Y};
}

export const TOROIDAL_SPAWN = Object.freeze(toroidalParcelPoint({x:0,y:.15,z:11}));

function wrap(value, period = 1) {
  const remainder = value % period;
  return remainder < 0 ? remainder + period : remainder + 0;
}

export function terrainFrame(u, v, terrain = TOROIDAL_TERRAIN) {
  const a = TAU * wrap(u), b = TAU * wrap(v);
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  const up = [ca * cb, sb, sa * cb];
  return {
    center: [terrain.majorRadius * ca, 0, terrain.majorRadius * sa],
    up,
    down: up.map(value => -value),
    alongRing: [-sa, 0, ca],
    aroundTube: [-ca * sb, cb, -sa * sb],
  };
}

export function terrainPosition(u, v, height = 0, terrain = TOROIDAL_TERRAIN) {
  const { center, up } = terrainFrame(u, v, terrain);
  const radius = terrain.tubeRadius + height;
  return center.map((value, axis) => value + radius * up[axis]);
}

export function terrainCoordinates([x, y, z], terrain = TOROIDAL_TERRAIN) {
  const horizontal = Math.hypot(x, z);
  const offset = horizontal - terrain.majorRadius;
  return {
    u: wrap(Math.atan2(z, x) / TAU),
    v: wrap(Math.atan2(y, offset) / TAU),
    height: Math.hypot(offset, y) - terrain.tubeRadius,
  };
}

function latticeValue(x, y, seed) {
  let hash = Math.imul(x ^ seed, 0x21f0aaad) ^ Math.imul(y, 0x735a2d97);
  hash = Math.imul(hash ^ (hash >>> 15), 0x2c1b3c6d);
  return ((hash ^ (hash >>> 12)) >>> 0) / 0x80000000 - 1;
}

const mix = (a, b, t) => a + (b - a) * t;
const fade = t => t * t * t * (t * (t * 6 - 15) + 10);

function periodicNoise(u, v, columns, rows, seed) {
  const x = wrap(u) * columns, y = wrap(v) * rows;
  const i = Math.floor(x), j = Math.floor(y);
  const nextI = (i + 1) % columns, nextJ = (j + 1) % rows;
  const f = fade(x - i), g = fade(y - j);
  return mix(
    mix(latticeValue(i, j, seed), latticeValue(nextI, j, seed), f),
    mix(latticeValue(i, nextJ, seed), latticeValue(nextI, nextJ, seed), f),
    g,
  );
}

// Broad basins and ridges use the same global samples at every tile level.
export function terrainElevation(u, v, terrain = TOROIDAL_TERRAIN) {
  const { seed } = terrain;
  const landform = periodicNoise(u, v, 32, 8, seed);
  const foothills = periodicNoise(u, v, 96, 24, seed ^ 0x42d31f);
  const detail = periodicNoise(u, v, 256, 64, seed ^ 0xe31aac);
  const grit = periodicNoise(u, v, 1024, 256, seed ^ 0x8034bc);
  const elevation = 52 * landform + 15 * foothills + 5 * detail + 1.25 * grit;
  const distance = Math.hypot(wrappedDistance(u, 0) * TAU * terrain.majorRadius,
    wrappedDistance(v, .25) * TAU * terrain.tubeRadius);
  if (distance >= 76) return elevation;
  const pavedGrade = (terrain.tubeRadius + 18) / Math.sin(wrap(v) * TAU) - terrain.tubeRadius;
  return mix(pavedGrade, elevation, fade(Math.max(0, distance - 32) / 44));
}

export function terrainTile(level, column, row, terrain = TOROIDAL_TERRAIN) {
  if (!Number.isInteger(level) || level < 0 || level > terrain.maxLevel ||
      !Number.isInteger(column) || !Number.isInteger(row)) {
    throw new RangeError('Invalid terrain tile address');
  }
  const rows = 2 ** level;
  const columns = rows * terrain.rootColumns;
  const x = wrap(column, columns), y = wrap(row, rows);
  return {
    key: `${level}/${x}/${y}`, level, column: x, row: y,
    columns, rows,
  };
}

// A fine tile uses the exact chord of the adjacent coarse tile along shared
// edges. Normals sample the common field independently of triangulation.
export const TERRAIN_EDGES = Object.freeze({ west: 1, east: 2, south: 4, north: 8 });

export function buildTerrainTile(tile, segmentCount, coarseEdges = 0, terrain = TOROIDAL_TERRAIN) {
  if (!Number.isInteger(segmentCount) || segmentCount < 2 || segmentCount > 64 || segmentCount % 2) {
    throw new RangeError('Terrain tiles require an even segment count from 2 to 64');
  }
  const { column, row, columns, rows } = tile;
  const width = segmentCount + 1;
  const origin = quantizeMeshPoint(terrainPosition((column + .5) / columns, (row + .5) / rows, 0, terrain));
  const positions = new Float32Array(width * width * 3);
  const normals = new Float32Array(positions.length);
  const indices = new Uint16Array(segmentCount * segmentCount * 6);
  const terrainSample = (u, v) => terrainPosition(u, v, terrainElevation(u, v, terrain), terrain);
  const sample = (i, j) => quantizeMeshPoint(terrainSample(
    (column + i / segmentCount) / columns, (row + j / segmentCount) / rows,
  ));
  const midpoint = (a, b) => a.map((value, axis) => (value + b[axis]) / 2);
  for (let j = 0; j < width; j += 1) {
    for (let i = 0; i < width; i += 1) {
      const index = (j * width + i) * 3;
      const westOrEast = (i === 0 && (coarseEdges & TERRAIN_EDGES.west)) ||
        (i === segmentCount && (coarseEdges & TERRAIN_EDGES.east));
      const southOrNorth = (j === 0 && (coarseEdges & TERRAIN_EDGES.south)) ||
        (j === segmentCount && (coarseEdges & TERRAIN_EDGES.north));
      let point = sample(i, j);
      // Each edge's endpoints stay identical to the canonical field samples.
      if (westOrEast && j % 2) point = midpoint(sample(i, j - 1), sample(i, j + 1));
      if (southOrNorth && i % 2) point = midpoint(sample(i - 1, j), sample(i + 1, j));
      for (let axis = 0; axis < 3; axis += 1) positions[index + axis] = point[axis] - origin[axis];

      const u = (column + i / segmentCount) / columns, v = (row + j / segmentCount) / rows;
      const du = 1 / 8192, dv = 1 / 2048;
      const west = terrainSample(u - du, v), east = terrainSample(u + du, v);
      const south = terrainSample(u, v - dv), north = terrainSample(u, v + dv);
      const [ax, ay, az] = north.map((value, axis) => value - south[axis]);
      const [bx, by, bz] = east.map((value, axis) => value - west[axis]);
      const normal = [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
      const length = Math.hypot(...normal);
      normal.forEach((value, axis) => { normals[index + axis] = value / length; });
      if (i < segmentCount && j < segmentCount) {
        const a = j * width + i, b = a + 1, c = a + width, d = c + 1;
        indices.set([a, c, b, b, c, d], (j * segmentCount + i) * 6);
      }
    }
  }
  return { origin, positions, normals, indices };
}

const neighbors = [
  { edge: TERRAIN_EDGES.west, x: -1, y: 0 },
  { edge: TERRAIN_EDGES.east, x: 1, y: 0 },
  { edge: TERRAIN_EDGES.south, x: 0, y: -1 },
  { edge: TERRAIN_EDGES.north, x: 0, y: 1 },
];

function adjacentCoarser(leaves, tile, {x, y}, terrain) {
  for (let level = tile.level - 1; level >= 0; level -= 1) {
    const scale = 2 ** (tile.level - level);
    const candidate = terrainTile(level, Math.floor((tile.column + x) / scale),
      Math.floor((tile.row + y) / scale), terrain);
    if (leaves.has(candidate.key)) return candidate;
  }
}

function subdivide(leaves, tile, terrain) {
  leaves.delete(tile.key);
  const column = tile.column * 2, row = tile.row * 2;
  for (let y = 0; y < 2; y += 1) {
    for (let x = 0; x < 2; x += 1) {
      const child = terrainTile(tile.level + 1, column + x, row + y, terrain);
      leaves.set(child.key, child);
    }
  }
}

function balance(leaves, budget, terrain) {
  // Refinements only. At most one level separates two edge neighbors,
  // including the two periodic seams.
  for (const tile of leaves.values()) {
    for (const direction of neighbors) {
      let coarse = adjacentCoarser(leaves, tile, direction, terrain);
      while (coarse && coarse.level + 1 < tile.level) {
        if (leaves.size + 3 > budget) return false;
        subdivide(leaves, coarse, terrain);
        coarse = adjacentCoarser(leaves, tile, direction, terrain);
      }
    }
  }
  // A newly split neighbor may expose a smaller tile to a leaf visited
  // earlier. New children are visited by the map iterator above.
  return true;
}

function wrappedDistance(a, b) {
  return Math.abs(wrap(a - b + .5) - .5);
}

function refinementPriority(tile, viewer, terrain) {
  const distanceU = Math.max(0, wrappedDistance(viewer.u, (tile.column + .5) / tile.columns) - .5 / tile.columns);
  const distanceV = Math.max(0, wrappedDistance(viewer.v, (tile.row + .5) / tile.rows) - .5 / tile.rows);
  const distance = Math.hypot(distanceU * TAU * terrain.majorRadius,
    distanceV * TAU * terrain.tubeRadius, Math.max(6, viewer.height - 55));
  const span = TAU * Math.max(terrain.majorRadius / tile.columns, terrain.tubeRadius / tile.rows);
  return span / distance;
}

export function selectTerrainTiles(viewer, {
  budget = 112, threshold = .8, terrain = TOROIDAL_TERRAIN,
} = {}) {
  if (!Number.isInteger(budget) || budget < terrain.rootColumns || budget > 512 ||
      !Number.isFinite(threshold) || threshold <= 0 ||
      ![viewer.u, viewer.v, viewer.height].every(Number.isFinite)) {
    throw new RangeError('Invalid terrain selection');
  }
  let leaves = new Map();
  for (let x = 0; x < terrain.rootColumns; x += 1) {
    const tile = terrainTile(0, x, 0, terrain);
    leaves.set(tile.key, tile);
  }
  const rejected = new Set();
  while (leaves.size + 3 <= budget) {
    let selected, priority = threshold;
    for (const tile of leaves.values()) {
      if (tile.level === terrain.maxLevel || rejected.has(tile.key)) continue;
      const candidatePriority = refinementPriority(tile, viewer, terrain);
      if (candidatePriority <= priority) continue;
      selected = tile;
      priority = candidatePriority;
    }
    if (!selected) break;
    const candidate = new Map(leaves);
    subdivide(candidate, selected, terrain);
    if (balance(candidate, budget, terrain)) leaves = candidate;
    else rejected.add(selected.key);
  }
  return [...leaves.values()].map(tile => ({
    ...tile,
    coarseEdges: neighbors.reduce((edges, direction) =>
      adjacentCoarser(leaves, tile, direction, terrain) ? edges | direction.edge : edges, 0),
  }));
}
