import assert from 'node:assert/strict';
import test from 'node:test';
import {ReviewBudget, distributeSamples, reviewPixelRatio, updateReviewDetail} from '../art/linterna/precinct/review-render-budget.mjs';

test('the moving tour uses a 30 fps cadence even when refresh is faster', () => {
  const budget = new ReviewBudget(false);
  let frames = 0;
  for (let i = 0; i < 240; i++) {
    const time = i * 1000 / 120;
    if (budget.plan(time, true, false).draw) {
      frames++;
      budget.observe(time, 5);
    }
  }
  assert.equal(frames, 60);
});

test('slow real frames lower the budget and the idle tour redraws only when needed', () => {
  const budget = new ReviewBudget(true);
  for (let time = 0; time <= 900; time += 110) {
    if (budget.plan(time, true, false).draw) budget.observe(time, 31);
  }
  assert.equal(budget.level, 0);
  assert.ok(budget.plan(1320, false, false).draw);
  assert.equal(budget.plan(1337, false, false).draw, false);
  assert.ok(budget.plan(1354, false, true).draw);
});

test('a renewed movement period can regain a quality step with measured headroom', () => {
  const budget = new ReviewBudget(true);
  for (let i = 0; i < 310; i++) {
    const time = i * 1000 / 60;
    if (budget.plan(time, true, false).draw) budget.observe(time, 5);
  }
  assert.equal(budget.level, 2);
});

test('resolution and effects ease out and back after motion instead of jumping', () => {
  const budget = new ReviewBudget(false);
  budget.level = 3;
  const resting = budget.plan(0, false, false).profile;
  assert.equal(resting.contact, 1);
  const first = budget.plan(16, true, false).profile;
  assert.ok(first.pixels < resting.pixels && first.pixels > 450000);
  assert.ok(first.contact < 1 && first.contact > .85);
  let moving = first;
  for (let t=32;t<=1200;t+=16) moving=budget.plan(t, true, false).profile;
  assert.ok(moving.pixels < 280000);
  assert.equal(moving.glow,0);
  for (let t=1216;t<=1440;t+=16) budget.plan(t,false,false);
  assert.ok(budget.plan(1456,false,false).moving);
  const recovery=budget.plan(1488,false,false);
  assert.equal(recovery.moving,false);
  assert.ok(recovery.profile.pixels > moving.pixels && recovery.profile.pixels < 330000);
  let final=recovery;
  for (let t=1504;t<=3808;t+=16) final=budget.plan(t,false,false);
  assert.ok(Math.abs(final.profile.pixels-resting.pixels) < 1);
  assert.equal(final.draw,false);
});

test('resolution and vegetation work stay bounded by quality and view distance', () => {
  assert.equal(reviewPixelRatio(320, 500, 3, 40000), .5);
  const full = {}, light = {};
  const grass = {
    userData: {reviewDetail: {grass:true, center:{x:0,z:0}, radius:3, total:100, full, light}},
  };
  updateReviewDetail([grass], {x:0,z:0}, 1, false);
  assert.equal(grass.geometry, full);
  assert.equal(grass.count, 100);
  updateReviewDetail([grass], {x:24,z:0}, 1, true);
  assert.equal(grass.geometry, light);
  assert.equal(grass.count, 19);
  updateReviewDetail([grass], {x:40,z:0}, 1, true);
  assert.equal(grass.visible, false);
  assert.deepEqual(distributeSamples([0, 1, 2, 3]).sort(), [0, 1, 2, 3]);
});
