import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BeaconControls,BEACON_CONTROLS,nearbyBeaconControl,summarizeBeaconStatus} from '../src/beacon-controls.mjs';

const [spatial,weaver,guitar,shaper]=BEACON_CONTROLS;
const objects=BEACON_CONTROLS.map(({id,revision})=>({id,revision,kind:'workstation'}));

test('a control requires a current room object and nearby player position',()=>{
  assert.equal(nearbyBeaconControl([],spatial.position),null);
  assert.equal(nearbyBeaconControl(objects,{...spatial.position,y:4}),null);
  assert.equal(nearbyBeaconControl([{...objects[0],revision:2}],spatial.position),null);
  assert.equal(nearbyBeaconControl(objects,spatial.position),spatial);
  assert.equal(nearbyBeaconControl(objects,weaver.position),weaver);
  assert.equal(nearbyBeaconControl(objects,guitar.position),guitar);
  assert.equal(nearbyBeaconControl(objects,shaper.position),shaper);
  assert.equal(nearbyBeaconControl(objects.filter(object=>object.id!==guitar.id),guitar.position),null);
});

test('a nearby bench mounts one owner panel only on open and discards it when access changes',()=>{
  const link={hidden:true,getAttribute:name=>link[name],removeAttribute:name=>delete link[name]};
  const stage={children:[],replaceChildren(...children){this.children=children;}};
  const elements={'.beacon-panel-stage':stage,h2:{},a:{},button:{}};
  const panel={open:false,querySelector:selector=>elements[selector],ownerDocument:{createElement:()=>({})},
    showModal(){this.open=true;},close(){this.open=false;},removeAttribute(){},addEventListener(type,listener){this[type]=listener;}};
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
  controls.update(objects,guitar.position);
  assert.equal(link.href,'/harmonic_lab/?service=guitar');
  link.onclick(click);
  assert.equal(stage.children[0].src,link.href+'&projection=guitar');
  controls.update(objects,shaper.position);
  assert.equal(link.href,'/harmonic_lab/?service=body&view=instrumento');
  assert.deepEqual(stage.children,[]);
  assert.equal(controls.nearbyAction().label,'Abrir Shaper');
  const shortcut={code:'KeyE',composedPath:()=>[]};
  assert.equal(controls.useNearby(shortcut,objects,spatial.position),false);
  assert.equal(controls.useNearby(shortcut,[],shaper.position),false);
  assert.equal(controls.useNearby({...shortcut,repeat:true},objects,shaper.position),false);
  assert.equal(controls.useNearby({...shortcut,composedPath:()=>[{matches:()=>true}]},objects,shaper.position),false);
  assert.equal(controls.useNearby(shortcut,objects,shaper.position),true);
  assert.equal(controls.nearbyAction(),null);
  assert.equal(controls.reference().id,shaper.id);
});

test('station status uses only confirmed tool states and hides host identities',()=>{
  const status={csrf:'private',hosts:[
    {id:'private',online:true,services:[{id:'audio',status:'ready'},{id:'body',status:'stopped'},{id:'guitar',enabled:false,installed:true,status:'stopped'}]},
    {id:'other',online:false},
  ]};
  assert.equal(summarizeBeaconStatus(status,'audio'),'En marcha (1) · Sin respuesta (1)');
  assert.equal(summarizeBeaconStatus(status,'guitar'),'No seleccionado (1) · Sin respuesta (1)');
  assert.equal(summarizeBeaconStatus(status,'body'),'Detenido (1) · Sin respuesta (1)');
  assert.equal(summarizeBeaconStatus({hosts:[{online:false}]},'body'),'Sin respuesta.');
  assert.equal(summarizeBeaconStatus({hosts:[{online:true,services:[]}]},'body'),'Sin confirmar.');
  assert.equal(summarizeBeaconStatus(null,'body'),'Estado sin confirmar.');
});

test('the status check is explicit, deduplicated and discarded when the bench changes',async()=>{
  const link={hidden:true,removeAttribute:name=>delete link[name]};
  const elements={'.beacon-panel-stage':{},h2:{},a:{},button:{}};
  const panel={open:false,querySelector:selector=>elements[selector],addEventListener(){},removeAttribute(){}};
  const statusButton={hidden:true},statusText={};
  let release,signal,reads=0;
  const controls=new BeaconControls(link,panel,{statusButton,statusText,readStatus:incoming=>{
    signal=incoming;reads++;return new Promise(resolve=>{release=resolve;});
  }});
  controls.update(objects,spatial.position);
  assert.equal(reads,0);
  assert.equal(statusButton.hidden,false);
  const first=controls.checkStatus();
  await controls.checkStatus();
  assert.equal(reads,1);
  assert.equal(statusButton.disabled,true);
  controls.update(objects,weaver.position);
  assert.equal(signal.aborted,true);
  release({hosts:[{online:true,services:[{id:'audio',status:'ready'}]}]});
  await first;
  assert.equal(statusText.textContent,'');
  const second=controls.checkStatus();
  release({denied:true});
  await second;
  assert.equal(statusText.textContent,'Se necesita acceso a Harmonic Lab.');
  controls.clear();
  assert.equal(statusText.textContent,'');
  assert.equal(statusButton.hidden,true);
});
