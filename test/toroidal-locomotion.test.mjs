import assert from 'node:assert/strict';
import test from 'node:test';
import {Quaternion, Vector3} from 'three';
import {ToroidalLocomotion, toroidalRotation} from '../src/toroidal-locomotion.mjs';
import {terrainElevation, terrainFrame} from '../src/toroidal-terrain.mjs';

const EPS = 1e-9;

function simulate(motion, seconds, rate, input) {
  for (let i = 0; i < seconds * rate; i += 1) motion.update(1 / rate, input);
  return motion.pose();
}

test('locomotion crosses both terrain seams on the seeded surface', () => {
  const motion = new ToroidalLocomotion({u: .9999, v: .9999});
  const pose = simulate(motion, 2, 60, {right: 1, forward: 1, sprint: true});
  assert.ok(motion.u > 0 && motion.u < .01);
  assert.ok(motion.v > 0 && motion.v < .01);
  assert.equal(pose.grounded, true);
  assert.equal(motion.height, terrainElevation(motion.u, motion.v));
});

test('matched inputs at 30 and 120 Hz produce the same grounded pose', () => {
  const start = {u: .997, v: .999};
  const slow = new ToroidalLocomotion(start);
  const fast = new ToroidalLocomotion(start);
  const action = {forward: .8, right: -.3, yaw: .4, sprint: true};
  assert.deepEqual(simulate(slow, 3, 30, action), simulate(fast, 3, 120, action));
});

test('jump rises along the local up axis and lands at the same point on every face', () => {
  for (const v of [0, .25, .5, .75]) {
    const motion = new ToroidalLocomotion({u: .42, v});
    const start = motion.pose();
    const {position, grounded} = simulate(motion, .2, 60, {jump: true});
    assert.equal(grounded, false);
    const offset = new Vector3(position.x - start.position.x, position.y - start.position.y, position.z - start.position.z);
    const frame = terrainFrame(.42, v);
    assert.ok(offset.length() > .5);
    assert.ok(offset.normalize().distanceTo(new Vector3(...frame.up)) < EPS);
    assert.deepEqual(simulate(motion, 1.25, 60, {jump: true}), start);
  }
});

test('the existing position-and-yaw wire shape reconstructs local up and heading', () => {
  const yaw = -.8;
  for (const [u, v] of [[0, 0], [.999999, .25], [.47, .5], [.002, .75]]) {
    const {position, rotation} = new ToroidalLocomotion({u, v, yaw}).pose();
    const remote = JSON.parse(JSON.stringify({position, rotation}));
    const first = toroidalRotation(position, rotation.eulerY);
    const second = toroidalRotation(remote.position, remote.rotation.eulerY, new Quaternion());
    assert.ok(first.angleTo(second) < 1e-7);
    const frame = terrainFrame(u, v);
    const observedUp = new Vector3(0, 1, 0).applyQuaternion(second);
    const observedHeading = new Vector3(0, 0, 1).applyQuaternion(second);
    const expectedHeading = new Vector3(...frame.aroundTube).multiplyScalar(Math.cos(yaw))
      .addScaledVector(new Vector3(...frame.alongRing), Math.sin(yaw));
    assert.ok(observedUp.distanceTo(new Vector3(...frame.up)) < EPS);
    assert.ok(observedHeading.distanceTo(expectedHeading) < EPS);
  }
});

test('radial motion can complete a lap around the ring on a level reference surface', () => {
  const terrain = {majorRadius: 100, tubeRadius: 30};
  const motion = new ToroidalLocomotion({u: .012, v: .75, ground: () => 0, terrain});
  let wraps = 0;
  let previousU = motion.u;
  for (let i = 0; i < 80 * 60; i += 1) {
    motion.update(1 / 60, {right: 1, sprint: true});
    if (motion.u < previousU) wraps += 1;
    previousU = motion.u;
  }
  assert.equal(wraps, 1);
  assert.ok(motion.u > .02 && motion.u < .04);
  assert.equal(motion.v, .75);
  assert.equal(motion.height, 0);
});
