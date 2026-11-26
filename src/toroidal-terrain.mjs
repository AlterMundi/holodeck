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

export const TOROIDAL_OVERLOOK = Object.freeze({u:.007,v:.49});
const overlookHeight=44.29;
const overlookRingScale=TAU*(TOROIDAL_TERRAIN.majorRadius+
  (TOROIDAL_TERRAIN.tubeRadius+overlookHeight)*Math.cos(TOROIDAL_OVERLOOK.v*TAU));
const overlookTubeScale=TAU*(TOROIDAL_TERRAIN.tubeRadius+overlookHeight);

export function overlookCoordinates(x,z){
  return {u:TOROIDAL_OVERLOOK.u+x/overlookRingScale,v:TOROIDAL_OVERLOOK.v+z/overlookTubeScale};
}

function overlookGrade(u,v,elevation){
  const z=(wrap(v-TOROIDAL_OVERLOOK.v+.5)-.5)*overlookTubeScale;
  if(Math.abs(z)>=25)return elevation;
  const x=wrappedDistance(u,TOROIDAL_OVERLOOK.u)*overlookRingScale;
  if(x>=14)return elevation;
  const weight=(1-fade(Math.max(0,(x-4.4)/9.6)))*
    (1-fade(Math.max(0,(Math.abs(z)-8)/17)));
  return mix(elevation,overlookHeight+.025*z,weight);
}

// Widely spaced ridges break up the opposite arc and give the traveler
// landmarks on both sides of its opening. Their relief is part of the
// terrain sampler, so the silhouette and traversal share the same shape.
const ridges = [
  {...TOROIDAL_OVERLOOK,along:61,across:63,lift:22},
  {u:.023,v:.465,along:46,across:110,lift:24},
  {u:.24,v:.488,along:110,across:49,lift:40},
  {u:.52,v:.466,along:82,across:75,lift:37},
  {u:.79,v:.48,along:105,across:70,lift:44},
];
function ridgeRelief(u,v,terrain) {
  let lift=0;
  for(const ridge of ridges){
    const cross=wrappedDistance(v,ridge.v)*TAU*terrain.tubeRadius;
    if(cross>=ridge.across)continue;
    const along=wrappedDistance(u,ridge.u)*TAU*
      (terrain.majorRadius+terrain.tubeRadius*Math.cos(ridge.v*TAU));
    const distance=Math.hypot(along/ridge.along,cross/ridge.across);
    if(distance<1)lift+=ridge.lift*(1-fade(distance));
  }
  return lift;
}

// Broad basins and ridges use the same global samples at every tile level.
export function terrainElevation(u, v, terrain = TOROIDAL_TERRAIN) {
  const { seed } = terrain;
  const landform = periodicNoise(u, v, 32, 8, seed);
  const foothills = periodicNoise(u, v, 96, 24, seed ^ 0x42d31f);
  const detail = periodicNoise(u, v, 256, 64, seed ^ 0xe31aac);
  const grit = periodicNoise(u, v, 1024, 256, seed ^ 0x8034bc);
  const elevation = 52 * landform + 15 * foothills + 5 * detail + 1.25 * grit + ridgeRelief(u,v,terrain);
  const distance = Math.hypot(wrappedDistance(u, 0) * TAU * terrain.majorRadius,
    wrappedDistance(v, .25) * TAU * terrain.tubeRadius);
  if (distance >= 76) return terrain.id===TOROIDAL_TERRAIN.id?overlookGrade(u,v,elevation):elevation;
  const pavedGrade = (terrain.tubeRadius + 18) / Math.sin(wrap(v) * TAU) - terrain.tubeRadius;
  return mix(pavedGrade, elevation, fade(Math.max(0, distance - 32) / 44));
}

// The low-contrast worn route wraps around the broad shoulder. A spur
// leads from the house past the cave and toward the inner-ring overlook.
const spurLatitude=v=>Math.max(.25,Math.min(wrap(v),TOROIDAL_OVERLOOK.v));
const spurLongitude=v=>TOROIDAL_OVERLOOK.u+.003*Math.sin((v-.25)/(TOROIDAL_OVERLOOK.v-.25)*Math.PI);

export function toroidalSpurPoint(latitude){
  const v=spurLatitude(latitude);
  return {u:spurLongitude(v),v};
}

export function terrainTrail(u,v,terrain = TOROIDAL_TERRAIN) {
  const mainDistance=wrappedDistance(v,.25) * TAU * terrain.tubeRadius;
  const spurV=spurLatitude(v);
  const ringMeters=wrappedDistance(u,spurLongitude(spurV)) * TAU *
    (terrain.majorRadius + terrain.tubeRadius * Math.cos(spurV*TAU));
  const crossMeters=wrappedDistance(v,spurV) * TAU * terrain.tubeRadius;
  const distance=Math.min(mainDistance,Math.hypot(ringMeters,crossMeters));
  return 1-fade(Math.max(0,Math.min(1,(distance-1.2)/2.4)));
}

// Seeded woodland belts along the arrival meadow and south ridge. Offsets
// remain in the same parcel frame as the house and footpath.
const woodlandBelts=[
  [71,66,37,54], [124,106,63,60], [170,61,59,56],
  [-61,62,32,35], [-85,105,43,49],
  [61,-81,36,56], [117,-125,57,71], [164,-197,59,72],
  [-81,-78,46,64], [-114,-172,67,84], [-156,-255,73,68],
];

export function woodlandCoordinates(x,z,terrain = TOROIDAL_TERRAIN) {
  return {u:z/(TAU*terrain.majorRadius),v:.25-x/(TAU*(terrain.tubeRadius+18))};
}

// Forest stands across the inner arc. The angular footprint is shared
// with the terrain worker and measured around the existing ridge landforms.
export const INNER_WOODLANDS = [
  {u:.241,v:.487,across:.030,along:.020},
  {u:.520,v:.467,across:.027,along:.019},
  {u:.544,v:.500,across:.033,along:.020},
  {u:.596,v:.477,across:.036,along:.018},
  {u:.793,v:.495,across:.033,along:.023},
  {u:.880,v:.507,across:.031,along:.019},
];

export function terrainWoodland(u,v,height,terrain = TOROIDAL_TERRAIN) {
  if(height<terrain.waterLevel+4||height>59)return 0;
  let edge=0;
  const latitude=wrap(v);
  if(latitude>.43&&latitude<.541){
    for(const stand of INNER_WOODLANDS){
      const radius=(wrappedDistance(u,stand.u)/stand.along)**2+((latitude-stand.v)/stand.across)**2;
      edge=Math.max(edge,1-radius);
    }
  }else{
    const x=(wrap(.75-v)-.5)*TAU*(terrain.tubeRadius+18);
    const z=(wrap(u+.5)-.5)*TAU*terrain.majorRadius;
    if(Math.abs(x)>235||z< -323||z>170)return 0;
    for(const [cx,cz,width,length] of woodlandBelts){
      const radius=((x-cx)/width)**2+((z-cz)/length)**2;
      edge=Math.max(edge,1-radius);
    }
  }
  if(edge<=0)return 0;
  const variation=periodicNoise(u,v,416,112,terrain.seed^0xa6c738);
  const irregular=fade(Math.max(0,Math.min(1,edge*1.85+variation*.19)));
  const understory=fade(Math.min(1,(height-terrain.waterLevel-4)/7));
  const treeline=fade(Math.min(1,(59-height)/12));
  return irregular*understory*treeline*(1-terrainTrail(u,v,terrain));
}

const meadowSwathTint=[.16,.16,.09],meadowSwathRadius=76;
const groundColors={
  woodland:[.071,.109,.041], moss:[.077,.168,.065], grass:[.163,.256,.079], straw:[.276,.261,.107],
  scree:[.291,.264,.227], highStone:[.367,.348,.294], wetSand:[.28,.239,.172],
  sediment:[.136,.16,.12], trail:[.423,.344,.214],
};

// Broad exposures shape both the ground and the tufts. Use the canonical
// periodic samples so the field survives profile and tile changes.
export function terrainMeadowMoisture(u,v,height,terrain = TOROIDAL_TERRAIN) {
  const basin=periodicNoise(u,v,64,24,terrain.seed^0xac5127);
  const pocket=periodicNoise(u,v,176,64,terrain.seed^0x9c4256);
  const exposed=fade(Math.max(0,Math.min(1,(height-23)/35)));
  const shore=Number.isFinite(terrain.waterLevel)?
    fade(Math.max(0,1-Math.abs(height-terrain.waterLevel-6)/16)):0;
  return Math.max(0,Math.min(1,.50+basin*.35+pocket*.15+shore*.13-exposed*.20));
}

function arrivalMeadowSwath(u,v,terrain){
  const across=wrappedDistance(v,.25)*TAU*terrain.tubeRadius;
  if(across<=3.8||across>=meadowSwathRadius)return 0;
  const along=wrappedDistance(u,0)*TAU*terrain.majorRadius;
  const distance=Math.hypot(across,along);
  if(distance>=meadowSwathRadius)return 0;
  // The periodic cells are about 50 by 31 metres at the arrival latitude.
  return periodicNoise(u,v,224,96,terrain.seed^0x5a8c43)*(1-fade(Math.max(0,(distance-34)/42)))
    *fade(Math.min(1,(across-3.8)/6));
}

export function terrainColor(u,v,height,slope,terrain = TOROIDAL_TERRAIN) {
  const moisture=terrainMeadowMoisture(u,v,height,terrain);
  const woodland=terrainWoodland(u,v,height,terrain);
  const growth=fade(Math.max(0,Math.min(1,moisture/.61)));
  const moss=fade(Math.max(0,Math.min(1,(moisture-.56)/.39)));
  const patch=(periodicNoise(u,v,512,192,terrain.seed^0x412da5)+1)/2;
  const rock=fade(Math.max(0,Math.min(1,(slope-.08)/.32)));
  const crest=fade(Math.max(0,Math.min(1,(height-23)/34)));
  const shore=Number.isFinite(terrain.waterLevel)?
    fade(Math.max(0,1-Math.abs(height-terrain.waterLevel)/4.8)):0;
  const submerged=Number.isFinite(terrain.waterLevel)?
    fade(Math.max(0,Math.min(1,(terrain.waterLevel-height)/9))):0;
  const trailMask=terrainTrail(u,v,terrain);
  const trail=trailMask*(1-submerged)*.72;
  const soil=groundColors;
  const swath=arrivalMeadowSwath(u,v,terrain)*(1-trailMask)*(1-shore)*(1-submerged);
  return soil.grass.map((value,axis)=>{
    const meadow=mix(mix(soil.straw[axis],value,growth),soil.moss[axis],moss)
      *(1+swath*meadowSwathTint[axis]);
    const vegetation=mix(meadow,soil.woodland[axis],woodland*.60);
    const stone=mix(soil.scree[axis],soil.highStone[axis],crest);
    const dry=mix(vegetation,stone,Math.max(rock,crest*.86));
    const shoreColor=mix(mix(dry,soil.wetSand[axis],shore*.85),soil.sediment[axis],submerged);
    return mix(shoreColor,soil.trail[axis],trail) * (.87+.23*patch);
  });
}

export function terrainWaterDepth(u, v, terrain = TOROIDAL_TERRAIN) {
  return Math.max(0, terrain.waterLevel - terrainElevation(u, v, terrain));
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
  const colors = new Float32Array(positions.length);
  const indices = new Uint16Array(segmentCount * segmentCount * 6);
  const waterLevel = terrain.waterLevel;
  const elevations = new Float64Array(width * width);
  const terrainSample = (u, v) => terrainPosition(u, v, terrainElevation(u, v, terrain), terrain);
  const coordinates = (i, j) => [(column + i / segmentCount) / columns, (row + j / segmentCount) / rows];
  const sample = (i, j) => quantizeMeshPoint(terrainSample(...coordinates(i,j)));
  const midpoint = (a, b) => a.map((value, axis) => (value + b[axis]) / 2);
  const stitch = (samplePoint,i,j) => {
    const coarseVertical = (i === 0 && (coarseEdges & TERRAIN_EDGES.west)) ||
      (i === segmentCount && (coarseEdges & TERRAIN_EDGES.east));
    const coarseHorizontal = (j === 0 && (coarseEdges & TERRAIN_EDGES.south)) ||
      (j === segmentCount && (coarseEdges & TERRAIN_EDGES.north));
    // Edge endpoints stay at the canonical samples while odd vertices use
    // their enclosing coarse edge. Apply the same rule to both surfaces.
    if (coarseVertical && j % 2) return midpoint(samplePoint(i,j-1),samplePoint(i,j+1));
    if (coarseHorizontal && i % 2) return midpoint(samplePoint(i-1,j),samplePoint(i+1,j));
    return samplePoint(i,j);
  };
  for (let j = 0; j < width; j += 1) {
    for (let i = 0; i < width; i += 1) {
      const index = (j * width + i) * 3;
      const point = stitch(sample,i,j);
      for (let axis = 0; axis < 3; axis += 1) positions[index + axis] = point[axis] - origin[axis];

      const [u,v] = coordinates(i,j);
      elevations[j * width + i] = terrainCoordinates(point,terrain).height;
      const du = 1 / 8192, dv = 1 / 2048;
      const west = terrainSample(u - du, v), east = terrainSample(u + du, v);
      const south = terrainSample(u, v - dv), north = terrainSample(u, v + dv);
      const [ax, ay, az] = north.map((value, axis) => value - south[axis]);
      const [bx, by, bz] = east.map((value, axis) => value - west[axis]);
      const normal = [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
      const length = Math.hypot(...normal);
      const {up}=terrainFrame(u,v,terrain);
      let alignment=0;
      normal.forEach((value, axis) => {
        const normalized=value/length;
        normals[index + axis] = normalized;
        alignment+=normalized*up[axis];
      });
      colors.set(terrainColor(u,v,elevations[j*width+i],1-alignment,terrain),index);
      if (i < segmentCount && j < segmentCount) {
        const a = j * width + i, b = a + 1, c = a + width, d = c + 1;
        indices.set([a, c, b, b, c, d], (j * segmentCount + i) * 6);
      }
    }
  }
  if(coarseEdges){
    // Interpolate the existing RGB stream along each stitched chord as well.
    const colorSample=(i,j)=>{
      const offset=(j*width+i)*3;
      return colors.subarray(offset,offset+3);
    };
    const nearSwath=(i,j)=>{
      const [u,v]=coordinates(i,j);
      return Math.hypot(wrappedDistance(u,0)*TAU*terrain.majorRadius,
        wrappedDistance(v,.25)*TAU*terrain.tubeRadius)<meadowSwathRadius;
    };
    const alignColor=(i,j,di,dj)=>{
      if(nearSwath(i-di,j-dj)||nearSwath(i,j)||nearSwath(i+di,j+dj))
        colorSample(i,j).set(stitch(colorSample,i,j));
    };
    for(let step=1;step<segmentCount;step+=2){
      if(coarseEdges&TERRAIN_EDGES.west)alignColor(0,step,0,1);
      if(coarseEdges&TERRAIN_EDGES.east)alignColor(segmentCount,step,0,1);
      if(coarseEdges&TERRAIN_EDGES.south)alignColor(step,0,1,0);
      if(coarseEdges&TERRAIN_EDGES.north)alignColor(step,segmentCount,1,0);
    }
  }
  const waterIndices = [];
  if (Number.isFinite(waterLevel)) {
    for (let index = 0; index < indices.length; index += 3) {
      const a = indices[index], b = indices[index + 1], c = indices[index + 2];
      if (Math.min(elevations[a], elevations[b], elevations[c]) < waterLevel + .002)
        waterIndices.push(a,b,c);
    }
  }
  let water = null;
  if (waterIndices.length) {
    const waterPositions = new Float32Array(positions.length);
    const waterNormals = new Float32Array(normals.length);
    const waterSample = (i,j) => quantizeMeshPoint(terrainPosition(...coordinates(i,j),waterLevel,terrain));
    for (let j = 0; j < width; j += 1) {
      for (let i = 0; i < width; i += 1) {
        const index = (j * width + i) * 3;
        const point = stitch(waterSample,i,j);
        const {up} = terrainFrame(...coordinates(i,j),terrain);
        for (let axis = 0; axis < 3; axis += 1) {
          waterPositions[index + axis] = point[axis] - origin[axis];
          waterNormals[index + axis] = up[axis];
        }
      }
    }
    // Interpolate signed vertex depths to shade the shoreline where the river
    // or lake meets the rendered terrain.
    const depth = Float32Array.from(elevations, height => waterLevel - height);
    water = {positions:waterPositions,normals:waterNormals,depth,indices:new Uint16Array(waterIndices)};
  }
  return {origin, positions, normals, colors, indices, water};
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
