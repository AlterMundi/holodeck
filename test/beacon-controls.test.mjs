import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BeaconControls,BEACON_CONTROLS,nearbyBeaconControl} from '../src/beacon-controls.mjs';

const spatial=BEACON_CONTROLS[0],weaver=BEACON_CONTROLS[1];
const objects=BEACON_CONTROLS.map(({id,revision})=>({id,revision,kind:'workstation'}));

test('a control requires a current room object and nearby player position',()=>{
  assert.equal(nearbyBeaconControl([],spatial.position),null);
  assert.equal(nearbyBeaconControl(objects,{...spatial.position,y:4}),null);
  assert.equal(nearbyBeaconControl([{...objects[0],revision:2}],spatial.position),null);
  assert.equal(nearbyBeaconControl(objects,spatial.position),spatial);
  assert.equal(nearbyBeaconControl(objects,weaver.position),weaver);
});

test('each bench opens its fixed owner panel and only an explicit visit supplies its reference',()=>{
  const link={hidden:true,removeAttribute:name=>delete link[name]};
  const controls=new BeaconControls(link);
  controls.update(objects,spatial.position);
  assert.equal(link.hidden,false);
  assert.equal(link.href,'/harmonic_lab/?service=audio');
  assert.equal(controls.reference(),null);
  link.onclick();
  assert.deepEqual(controls.reference(),{id:spatial.id,revision:1});

  controls.update(objects,weaver.position);
  assert.equal(link.href,'/harmonic_lab/?service=body');
  assert.equal(controls.reference(),null);
  link.onclick();
  assert.deepEqual(controls.reference(),{id:weaver.id,revision:1});
  controls.clear();
  assert.equal(link.hidden,true);
  assert.equal(link.href,undefined);
  assert.equal(controls.reference(),null);
  controls.update(objects,weaver.position);
  assert.equal(controls.reference(),null);
});
