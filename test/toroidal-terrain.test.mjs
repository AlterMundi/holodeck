import assert from 'node:assert/strict';
import test from 'node:test';
import {Group,Matrix4,Vector3} from 'three';
import {innerWoodlandTrees,ToroidalWoodland,woodlandTrees} from '../src/toroidal-woodland.mjs';
import {
  TOROIDAL_TERRAIN, TOROIDAL_PARCEL_Y, TOROIDAL_OVERLOOK, TERRAIN_EDGES, buildTerrainTile, selectTerrainTiles,
  terrainColor, terrainCoordinates, terrainElevation, terrainFrame, terrainMeadowMoisture, terrainPosition, terrainTile, terrainTrail, terrainWoodland, toroidalParcelPoint,
} from '../src/toroidal-terrain.mjs';

const near = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} ≠ ${b}`);
const point = (mesh, i, j, n) => mesh.origin.map((value, axis) =>
  value + mesh.positions[3 * (j * (n + 1) + i) + axis]);

test('toroidal coordinates close in both directions and gravity points to the slice center', () => {
  for (const [u, v] of [[0, 0], [.31, .25], [.72, .5], [.998, .75]]) {
    const position = terrainPosition(u, v, 21);
    const wrapped = terrainPosition(u + 3, v - 1, 21);
    const coords = terrainCoordinates(position);
    const frame = terrainFrame(u, v);
    near(coords.u, u);
    near(coords.v, v);
    near(coords.height, 21);
    position.forEach((value, axis) => {
      near(value, wrapped[axis]);
      near((frame.center[axis] - value) / (TOROIDAL_TERRAIN.tubeRadius + 21), frame.down[axis]);
    });
  }
  assert.equal(terrainElevation(0, 0), terrainElevation(1, -2));
  assert.notEqual(terrainElevation(.245, .007), terrainElevation(.245, .007, {...TOROIDAL_TERRAIN, seed: 1}));
});

test('meadow moisture wraps with the torus and distinguishes sheltered green from dry straw', () => {
  const dry=[.005,.255], sheltered=[.006,.293];
  const dryMoisture=terrainMeadowMoisture(...dry,17);
  const shelteredMoisture=terrainMeadowMoisture(...sheltered,17);
  assert.ok(dryMoisture<.25&&shelteredMoisture>.70);
  near(terrainMeadowMoisture(dry[0]+1,dry[1]-1,17),dryMoisture);
  near(terrainMeadowMoisture(sheltered[0]-1,sheltered[1]+1,17),shelteredMoisture);
  const [dryRed,dryGreen]=terrainColor(...dry,17,.01);
  const [wetRed,wetGreen]=terrainColor(...sheltered,17,.01);
  assert.ok(dryRed>dryGreen&&wetGreen>wetRed&&dryRed>1.4*wetRed);
});

test('the parcel and its portals share a level strip of analytic ground', () => {
  for (const [x,z] of [[-8,23],[8,15],[-2,0],[0,-18]]) {
    const world=toroidalParcelPoint({x,y:.11,z,facing:1});
    const coord=terrainCoordinates([world.x,TOROIDAL_PARCEL_Y,world.z]);
    const surface=terrainPosition(coord.u,coord.v,terrainElevation(coord.u,coord.v));
    near(surface[1]+.11,world.y);
    near(surface[0],world.x);
    near(surface[2],world.z);
    assert.equal(world.facing,1);
  }
});

test('a fine edge follows the adjacent coarse edge across a periodic seam', () => {
  const count = 16;
  const coarse = buildTerrainTile(terrainTile(3, -1, 2), count);
  const fine = buildTerrainTile(terrainTile(4, 0, 4), count, TERRAIN_EDGES.west);
  for (let j = 0; j <= count; j += 1) {
    const lower = point(coarse, count, Math.floor(j / 2), count);
    const upper = point(coarse, count, Math.ceil(j / 2), count);
    const vertex = point(fine, 0, j, count);
    vertex.forEach((value, axis) => assert.equal(value, (lower[axis] + upper[axis]) / 2));
  }
  const southern = buildTerrainTile(terrainTile(3, 3, -1), count);
  const northern = buildTerrainTile(terrainTile(4, 6, 0), count, TERRAIN_EDGES.south);
  for (let i = 0; i <= count; i += 1) {
    const lower = point(southern, Math.floor(i / 2), count, count);
    const upper = point(southern, Math.ceil(i / 2), count, count);
    point(northern, i, 0, count).forEach((value, axis) =>
      assert.equal(value, (lower[axis] + upper[axis]) / 2));
  }
});

test('baked meadow RGB interpolates coarse edges on both arrival axes',()=>{
  const count=12;
  const coarse=buildTerrainTile(terrainTile(5,-1,8),count);
  const fine=buildTerrainTile(terrainTile(6,0,16),count,TERRAIN_EDGES.west);
  const color=(mesh,i,j)=>Array.from(mesh.colors.subarray((j*(count+1)+i)*3,(j*(count+1)+i)*3+3));
  assert.notDeepEqual(color(fine,0,0),color(fine,0,3));
  for(let j=0;j<=count;j++){
    const lower=color(coarse,count,Math.floor(j/2));
    const upper=color(coarse,count,Math.ceil(j/2));
    const rgb=color(fine,0,j);
    assert.ok(rgb.every(Number.isFinite));
    assert.deepEqual(rgb,lower.map((value,axis)=>Math.fround((value+upper[axis])/2)));
  }
  const southern=buildTerrainTile(terrainTile(6,0,16),count);
  const northern=buildTerrainTile(terrainTile(7,0,34),count,TERRAIN_EDGES.south);
  for(let i=0;i<=count;i++){
    const lower=color(southern,Math.floor(i/2),count);
    const upper=color(southern,Math.ceil(i/2),count);
    const rgb=color(northern,i,0);
    assert.ok(rgb.every(Number.isFinite));
    assert.deepEqual(rgb,lower.map((value,axis)=>Math.fround((value+upper[axis])/2)));
  }
});

test('terrain selection partitions both axes under the tile budget and balances neighbors', () => {
  const columns = TOROIDAL_TERRAIN.rootColumns * 2 ** TOROIDAL_TERRAIN.maxLevel;
  const rows = 2 ** TOROIDAL_TERRAIN.maxLevel;
  for (const [u, v, budget] of [[0, 0, 112], [.9999, .9999, 64], [.499, .5, 91], [.22, .12, 4]]) {
    const picked = selectTerrainTiles({u, v, height: 1.75}, {budget});
    assert.ok(picked.length <= budget);
    const cells = new Int16Array(rows * columns).fill(-1);
    picked.forEach((tile, index) => {
      const scale = rows / tile.rows;
      for (let y = tile.row * scale; y < (tile.row + 1) * scale; y += 1) {
        for (let x = tile.column * scale; x < (tile.column + 1) * scale; x += 1) {
          assert.equal(cells[y * columns + x], -1, 'overlapping tile');
          cells[y * columns + x] = index;
        }
      }
    });
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < columns; x += 1) {
        const tile = picked[cells[y * columns + x]];
        const west = picked[cells[y * columns + (x + columns - 1) % columns]];
        const south = picked[cells[((y + rows - 1) % rows) * columns + x]];
        assert.ok(Math.abs(tile.level - west.level) <= 1);
        assert.ok(Math.abs(tile.level - south.level) <= 1);
        if (tile.level > west.level) assert.ok(tile.coarseEdges & TERRAIN_EDGES.west);
        if (tile.level > south.level) assert.ok(tile.coarseEdges & TERRAIN_EDGES.south);
      }
    }
  }
});

test('wet terrain emits bounded geometry at the shared radial water level', () => {
  const dry = buildTerrainTile(terrainTile(7, 0, 32),16);
  assert.equal(dry.water,null);
  const wet = buildTerrainTile(terrainTile(7, 9, 32),16);
  assert.ok(wet.water?.indices.length>0 && wet.water.indices.length<=wet.indices.length);
  const i=wet.water.indices[0]*3;
  const p=wet.origin.map((value,axis)=>value+wet.water.positions[i+axis]);
  near(terrainCoordinates(p).height,TOROIDAL_TERRAIN.waterLevel,.001);
  assert.equal(wet.water.depth.length, wet.positions.length/3);
  assert.ok(wet.water.depth.some(depth => depth>0));
  for(let vertex=0;vertex<wet.water.depth.length;vertex++){
    const terrainPoint=wet.origin.map((value,axis)=>value+wet.positions[vertex*3+axis]);
    near(wet.water.depth[vertex], TOROIDAL_TERRAIN.waterLevel-terrainCoordinates(terrainPoint).height,.001);
  }
});

test('water edges use the same exact coarse-to-fine seam as ground', () => {
  const allWet={...TOROIDAL_TERRAIN,waterLevel:80};
  const count=16;
  const coarse=buildTerrainTile(terrainTile(3,-1,2),count,0,allWet);
  const fine=buildTerrainTile(terrainTile(4,0,4),count,TERRAIN_EDGES.west,allWet);
  const coarseSurface={origin:coarse.origin,positions:coarse.water.positions};
  const fineSurface={origin:fine.origin,positions:fine.water.positions};
  for(let j=0;j<=count;j++){
    const lower=point(coarseSurface,count,Math.floor(j/2),count);
    const upper=point(coarseSurface,count,Math.ceil(j/2),count);
    point(fineSurface,0,j,count).forEach((value,axis)=>
      assert.equal(value,(lower[axis]+upper[axis])/2));
  }
});

test('wayfinding forms a periodic loop and rises to the inner lookout', () => {
  assert.equal(terrainTrail(.8,.25),1);
  assert.equal(terrainTrail(-.2,1.25),1);
  assert.equal(terrainTrail(.8,.35),0);
  const {u,v}=TOROIDAL_OVERLOOK;
  assert.equal(terrainTrail(u,v),1);
  assert.ok(terrainElevation(u,v)>40);
  assert.deepEqual(terrainColor(0,.25,18,0),terrainColor(1,.25,18,0));
  assert.notDeepEqual(terrainColor(.7,.23,5,0),terrainColor(.7,.23,5,.45));
});

test('woodland roots are deterministic and agree with the periodic terrain field', () => {
  const trees=woodlandTrees();
  assert.deepEqual(trees,woodlandTrees());
  assert.ok(trees.length>400&&trees.length<1000);
  assert.equal(new Set(trees.map(tree=>tree.u+':'+tree.v)).size,trees.length);
  for(const {u,v,h} of trees){
    near(h,terrainElevation(u,v));
    assert.ok(terrainTrail(u,v)<.026);
    assert.ok(terrainWoodland(u,v,h)>=.16);
    near(terrainWoodland(u,v,h),terrainWoodland(u+1,v-1,h));
  }
  assert.equal(terrainWoodland(0,.25,18),0);
});

test('the spreading stem passes through the upper whorl hubs', () => {
  const grove=new ToroidalWoodland(new Group(),null,()=>{},{value:1});
  try{
    const position=grove.geometry[6].getAttribute('position');
    const expectedLean=.12*.75**2;
    const ringHeight=.27+.45*.75+.008;
    const ring=new Map();
    for(let i=0;i<position.count;i++){
      if(Math.abs(position.getY(i)-ringHeight)>1e-6)continue;
      const point=[position.getX(i),position.getZ(i)];
      if(Math.hypot(point[0]-expectedLean,point[1]+.4*expectedLean)>.01)ring.set(point.join(','),point);
    }
    const points=[...ring.values()];
    assert.equal(points.length,9);
    const centre=points.reduce(([x,z],[a,b])=>[x+a/points.length,z+b/points.length],[0,0]);
    assert.ok(Math.abs(centre[0]-expectedLean)<1e-6);
    assert.ok(Math.abs(centre[1]+.4*expectedLean)<1e-6);
  }finally{grove.dispose();}
});

test('woodland representation changes preserve roots and release nearby trunk collision', () => {
  const scene=new Group(),active=new Set();
  const woodland=new ToroidalWoodland(scene,{
    addCollider:mesh=>active.add(mesh),
    removeCollider:mesh=>assert.ok(active.delete(mesh)),
  },()=>{},null);
  const root=woodlandTrees().find(tree=>tree.x>70&&tree.z>25);
  const position=new Vector3().fromArray(terrainPosition(root.u,root.v,root.h));
  woodland.update(position,false);
  const nearCount=woodland.meshes[2].count;
  const total=woodland.meshes.reduce((count,mesh)=>count+mesh.count,0);
  const collision=Array.from(active);
  assert.ok(nearCount>0&&collision.length>0);
  const undergrowthCount=woodland.undergrowth.count+woodland.ferns.count;
  assert.ok(woodland.undergrowth.count>0&&woodland.ferns.count>0&&undergrowthCount<=384);
  const transform=new Matrix4(),plantRoot=new Vector3();
  for(const batch of [woodland.undergrowth,woodland.ferns])for(let index=0;index<batch.count;index++){
    batch.getMatrixAt(index,transform);
    const {u,v,height}=terrainCoordinates(plantRoot.setFromMatrixPosition(transform).toArray());
    near(height,terrainElevation(u,v)-.08,.0005);
    assert.ok(terrainTrail(u,v)<=.0121);
  }
  const spreadingRoots=()=>{
    const roots=[];
    for(const mesh of woodland.meshes.slice(4)){
      for(let index=0;index<mesh.count;index++){
        mesh.getMatrixAt(index,transform);
        roots.push(plantRoot.setFromMatrixPosition(transform).toArray().join(':'));
      }
    }
    return roots.sort();
  };
  const broadCrownRoots=spreadingRoots();
  assert.ok(broadCrownRoots.length>0&&broadCrownRoots.length<total);
  woodland.update(position,true);
  assert.deepEqual(spreadingRoots(),broadCrownRoots);
  assert.ok(woodland.meshes[2].count<nearCount);
  assert.ok(woodland.ferns.count>0&&woodland.undergrowth.count+woodland.ferns.count<undergrowthCount);
  assert.equal(woodland.meshes.reduce((count,mesh)=>count+mesh.count,0),total);
  assert.deepEqual(Array.from(active),collision);
  woodland.dispose();
  assert.equal(scene.children.length,0);
  assert.equal(active.size,0);
});

test('a distant inner crown becomes the same rooted tree near the grove', () => {
  const trees=innerWoodlandTrees();
  assert.deepEqual(trees,innerWoodlandTrees());
  assert.ok(trees.length>200&&trees.length<450);
  assert.equal(new Set(trees.map(tree=>tree.u+':'+tree.v)).size,trees.length);
  const sample=trees.find(({u})=>u>.52&&u<.54);
  const point=new Vector3().fromArray(terrainPosition(sample.u,sample.v,sample.h));
  near(terrainWoodland(sample.u,sample.v,sample.h),
    terrainWoodland(sample.u+1,sample.v-1,sample.h));
  const scene=new Group(),active=new Set();
  const woodland=new ToroidalWoodland(scene,{
    addCollider:mesh=>active.add(mesh),
    removeCollider:mesh=>assert.ok(active.delete(mesh)),
  },()=>{},null);
  const matrix=new Matrix4(),root=new Vector3();
  const find=mesh=>{
    for(let index=0;index<mesh.count;index++){
      mesh.getMatrixAt(index,matrix);
      if(root.setFromMatrixPosition(matrix).distanceTo(point)<.001)return matrix.toArray();
    }
  };
  const viewpoint=new Vector3().fromArray(terrainPosition(TOROIDAL_OVERLOOK.u,TOROIDAL_OVERLOOK.v,45));
  woodland.update(viewpoint,true);
  const far=find(woodland.meshes[3]);
  assert.ok(far);
  assert.equal(find(woodland.meshes[2]),undefined);
  woodland.update(point,true);
  assert.deepEqual(find(woodland.meshes[2]),far);
  assert.equal(find(woodland.meshes[3]),undefined);
  const owned=[...woodland.chunks.values()].flatMap(chunk=>chunk.trees)
    .find(tree=>tree.inner&&tree.point.distanceTo(point)<.001);
  const boundary=Math.sqrt(owned.skylineDistanceSq);
  assert.ok(boundary>=520&&boundary<=640);
  const atDistance=distance=>{
    woodland.update(point.clone().add(new Vector3(distance,0,0)),true);
    const place=[0,3,4,7].filter(level=>find(woodland.meshes[level]));
    assert.equal(place.length,1);
    assert.deepEqual(find(woodland.meshes[place[0]]),far);
    return place[0]%4;
  };
  assert.equal(atDistance(boundary-14),0);
  assert.equal(atDistance(boundary+10),3);
  assert.equal(atDistance(boundary-2),3);
  assert.equal(atDistance(boundary-14),0);
  woodland.update(point,true);
  assert.ok(active.size>0);
  woodland.dispose();
  assert.equal(active.size,0);
});
