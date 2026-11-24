import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TOROIDAL_TERRAIN, TERRAIN_EDGES, buildTerrainTile, selectTerrainTiles,
  terrainCoordinates, terrainElevation, terrainFrame, terrainPosition, terrainTile,
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
