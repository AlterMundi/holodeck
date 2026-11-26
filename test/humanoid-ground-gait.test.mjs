import assert from 'node:assert/strict';
import {test} from 'node:test';
import {groundGaitSample} from '../src/humanoid-ground-gait.mjs';

const wrap=value=>value-Math.floor(value);
const step=1/60;
const jogDuration=.7,runDuration=19/30;
const original={0:.5,1:.2,2:.1,3:.3,4:.4,5:.5,6:.6};
const jog={1:1,2:0},run={1:0,2:1};

test('ground gait advances by travel and compensates the renderer mixer step',()=>{
  for(const [lane,weights,duration,lead,speed,stride] of [
    [1,jog,jogDuration,0,5,4.55*jogDuration],
    [2,run,runDuration,.1,8,6.15*runDuration],
  ]){
    const current=groundGaitSample(.99,original,weights,speed*step,step);
    const phase=wrap(.99+speed*step/stride);
    assert.ok(Math.abs(current.phase-phase)<1e-9);
    assert.ok(Math.abs(wrap((current.times[lane]+step)/duration)-wrap(phase-lead))<1e-9);
    for(const index of [0,3,4,5,6])assert.equal(current.times[index],original[index]);
    assert.deepEqual(original,{0:.5,1:.2,2:.1,3:.3,4:.4,5:.5,6:.6});
  }
});

test('jog and run share contact phase while stops and jumps in position stay bounded',()=>{
  const blend=groundGaitSample(.42,original,{1:.35,2:.65},0,step);
  assert.ok(blend.phase>.42&&blend.phase<.43);
  const jogPhase=wrap((blend.times[1]+step)/jogDuration);
  const runPhase=wrap((blend.times[2]+step)/runDuration+.1);
  assert.ok(Math.abs(jogPhase-runPhase)<1e-9);
  const advancing=groundGaitSample(.42,original,jog,6,step);
  assert.equal(advancing.phase,.42+step/jogDuration);
  assert.deepEqual(advancing,groundGaitSample(.42,original,jog,null,step));
  assert.equal(groundGaitSample(.42,original,{1:0,2:0},.03,step),null);
  assert.equal(groundGaitSample(.42,original,run,.3,.12).phase,.42+.12/runDuration);
  assert.equal(groundGaitSample(null,original,run,null,step),null);
});

test('batched simulation steps drive cadence with just one renderer mixer step',()=>{
  const distance=5*step*2;
  const result=groundGaitSample(.42,original,jog,distance,step,step*2);
  const phase=.42+distance/(4.55*jogDuration);
  assert.ok(Math.abs(result.phase-phase)<1e-9);
  assert.ok(Math.abs((result.times[1]+step)/jogDuration-phase)<1e-9);
});
