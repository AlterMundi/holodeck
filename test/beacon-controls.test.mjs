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

test('a nearby bench mounts one owner panel only on open and discards it when access changes',()=>{
  const link={hidden:true,getAttribute:name=>link[name],removeAttribute:name=>delete link[name]};
  const stage={children:[],replaceChildren(...children){this.children=children;}};
  const elements={'.beacon-panel-stage':stage,h2:{},a:{},button:{}};
  const panel={open:false,querySelector:selector=>elements[selector],ownerDocument:{createElement:()=>({})},
    showModal(){this.open=true;},close(){this.open=false;},addEventListener(type,listener){this[type]=listener;}};
  const controls=new BeaconControls(link,panel);
  const click={button:0,preventDefault(){this.handled=true;}};
  controls.update(objects,spatial.position);
  assert.equal(link.hidden,false);
  assert.equal(link.href,'/harmonic_lab/?service=audio');
  assert.equal(controls.reference(),null);
  assert.deepEqual(stage.children,[]);
  link.onclick(click);
  assert.equal(click.handled,true);
  assert.equal(controls.opened,true);
  assert.equal(stage.children[0].src,link.href);
  assert.equal(stage.children[0].allow,"camera 'none'; microphone 'none'");
  assert.equal(elements.a.href,link.href);
  assert.deepEqual(controls.reference(),{id:spatial.id,revision:1});
  link.onclick(click);
  assert.equal(stage.children.length,1);
  elements.button.onclick();
  assert.equal(controls.opened,false);
  assert.deepEqual(stage.children,[]);
  assert.deepEqual(controls.reference(),{id:spatial.id,revision:1});

  controls.update(objects,weaver.position);
  assert.equal(link.href,'/harmonic_lab/?service=body');
  assert.equal(controls.reference(),null);
  link.onclick({button:0,ctrlKey:true,preventDefault(){throw Error('ordinary link navigation must remain available');}});
  assert.deepEqual(controls.reference(),{id:weaver.id,revision:1});
  assert.equal(controls.opened,false);
  link.onclick(click);
  controls.clear();
  assert.equal(link.hidden,true);
  assert.equal(controls.opened,false);
  assert.deepEqual(stage.children,[]);
  assert.equal(link.href,undefined);
  assert.equal(controls.reference(),null);
  controls.update(objects,weaver.position);
  assert.equal(controls.reference(),null);
});
