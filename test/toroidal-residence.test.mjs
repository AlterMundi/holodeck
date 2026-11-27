import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {Group, Mesh, BoxGeometry, Scene, Vector3} from 'three';
import {residenceAssets} from '../src/toroidal-residence-assets.mjs';
import {plantedWoodlandTrees, woodlandTrees} from '../src/toroidal-woodland.mjs';
import {residencePlacement, ToroidalResidence} from '../src/toroidal-residence.mjs';
import {
  residenceCoordinates, residenceLocal, residencePlantClearance, terrainElevation, terrainFrame, terrainPosition,
  TOROIDAL_RESIDENCE, TOROIDAL_TERRAIN,
} from '../src/toroidal-terrain.mjs';

const {origin, quaternion} = residencePlacement();
const up = new Vector3(0, 1, 0).applyQuaternion(quaternion);

// (u, v) whose palace-local Blender coordinates are (x, y).
function at(x, y) {
  let u = TOROIDAL_RESIDENCE.u, v = TOROIDAL_RESIDENCE.v;
  for (let k = 0; k < 40; k++) {
    const a = residenceLocal(u, v), d = 1e-7, b = residenceLocal(u + d, v), c = residenceLocal(u, v + d);
    const j = [[(b.x - a.x) / d, (c.x - a.x) / d], [(b.y - a.y) / d, (c.y - a.y) / d]];
    const ex = x - a.x, ey = y - a.y, det = j[0][0] * j[1][1] - j[0][1] * j[1][0];
    u += (j[1][1] * ex - j[0][1] * ey) / det;
    v += (-j[1][0] * ex + j[0][0] * ey) / det;
  }
  return {u, v};
}
const aboveGround = (x, y, terrain) => {
  const {u, v} = at(x, y);
  return new Vector3(...terrainPosition(u, v, terrainElevation(u, v, terrain))).sub(origin).dot(up);
};

test('the palace floors, podium and stair lie on one plane in the palace frame', () => {
  for (const [x, y] of [[0, 0], [12, 9], [-20, -14], [0, 22], [-15.5, 0]])
    assert.ok(Math.abs(aboveGround(x, y) - TOROIDAL_RESIDENCE.floor) < 1e-6, `interior floor at ${x},${y}`);
  for (const [x, y] of [[27.5, 0], [0, -27], [-6, -34]])
    assert.ok(Math.abs(aboveGround(x, y) - TOROIDAL_RESIDENCE.podium) < 1e-6, `podium at ${x},${y}`);
  const {top, bottom} = TOROIDAL_RESIDENCE.stair;
  let previous = Infinity;
  for (let y = top; y >= bottom; y -= .5) {
    const h = aboveGround(0, y);
    assert.ok(h <= previous + 1e-9, 'the fan stair descends steadily');
    previous = h;
  }
  assert.ok(Math.abs(aboveGround(0, bottom)) < 1e-6);
});

test('the grade meets the surrounding terrain without cliffs and leaves the plaza and far ring unchanged', () => {
  const comparator = {...TOROIDAL_TERRAIN, id: 'ungraded comparison'};
  assert.equal(terrainElevation(0, .25), 18);
  for (const [u, v] of [[0, .25], [.5, .25], [.0096, .265], [.02, .25]])
    assert.equal(terrainElevation(u, v), terrainElevation(u, v, comparator));
  assert.ok(Math.abs(terrainElevation(.007, .49) - 44.29) < 1e-8, 'the inner overlook keeps its grade');
  for (const [dx, dy] of [[1, 0], [0, -1], [.7, .7], [-.7, -.7]]) {
    for (let s = 30; s < 75; s += .4) {
      const a = aboveGround(dx * s, dy * s), b = aboveGround(dx * (s + .4), dy * (s + .4));
      assert.ok(Math.abs(b - a) / .4 < .9, `walkable bank at ${dx},${dy},${s}`);
    }
  }
});

test('the entrance faces the house plaza', () => {
  const plaza = new Vector3(...terrainPosition(0, .25, 18));
  const entrance = new Vector3(0, 0, 1).applyQuaternion(quaternion);
  const toward = plaza.clone().sub(origin);
  toward.addScaledVector(up, -toward.dot(up)).normalize();
  assert.ok(entrance.dot(toward) > .99);
  assert.ok(origin.distanceTo(plaza) > 100 && origin.distanceTo(plaza) < 135);
});

test('the approach grade and building share an upright basis, with a clear planted perimeter', () => {
  const {u, v, stair} = TOROIDAL_RESIDENCE;
  const arrival = residenceCoordinates(0, stair.bottom);
  const approachUp = new Vector3(...terrainFrame(arrival.u, arrival.v).up);
  const originalUp = new Vector3(...terrainFrame(u, v).up);
  assert.ok(up.angleTo(approachUp) < originalUp.angleTo(approachUp));
  const top = residenceCoordinates(0, stair.top);
  assert.ok(residencePlantClearance(top.u, top.v));
  const trees = plantedWoodlandTrees();
  const tall = trees.filter(tree => tree.araucaria);
  assert.equal(tall.length, 5);
  assert.equal(trees.length, woodlandTrees().length + tall.length);
  assert.ok(tall.every(tree => tree.height >= 26 && tree.height < 44));
  for (const tree of trees)
    assert.ok(!residencePlantClearance(tree.u, tree.v, 2.4 + tree.width * .28));
});

test('the shipped models are the exact Blender exports', () => {
  for (const {path, bytes, sha256} of Object.values(residenceAssets)) {
    const data = readFileSync(new URL('../public/' + path, import.meta.url));
    assert.equal(data.length, bytes);
    assert.equal(createHash('sha256').update(data).digest('hex'), sha256);
  }
});

test('the palace loads once, owns one collision shell and releases it away from the site', async () => {
  const scene = new Scene();
  const added = [], removed = [];
  const model = solid => {
    const root = new Group();
    root.add(new Mesh(new BoxGeometry(1, 1, 1)));
    if (!solid) root.add(new Mesh(new BoxGeometry(2, 2, 2)));
    return {scene: root};
  };
  const residence = new ToroidalResidence(scene, 'https://holodeck.test/', {
    addCollider: mesh => added.push(mesh), removeCollider: mesh => removed.push(mesh),
  }, {
    fetchModel: async (base, asset) => asset === residenceAssets.visual ? 'visual' : 'collision',
    loader: {parseAsync: async buffer => model(buffer === 'collision')},
  });
  const near = origin.clone().addScaledVector(up, 2);
  residence.update(new Vector3(NaN, 0, 0));
  assert.equal(residence.loading, null);
  residence.update(near);
  await residence.load.call(residence);
  residence.update(near);
  assert.equal(scene.children[0].name, 'Residencia de la Nobleza IA');
  assert.equal(added.length, 1);
  assert.equal(added[0].visible, false);
  assert.equal(added[0].parent, scene.children[0]);
  residence.update(origin.clone().addScaledVector(new Vector3(1, 0, 0), 400));
  assert.deepEqual(removed, added);
  assert.equal(scene.children[0].visible, true, 'the dome remains a landmark from afar');
  residence.dispose();
  assert.equal(scene.children.length, 0);
});
