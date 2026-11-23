import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {arrivalDoor,doorLocation,showSpaceLinks} from '../src/space-travel.mjs';

test('crossing a house threshold uses both sides of the same door',()=>{
  const exterior={id:'outside'};
  const interior={id:'studio',exitDoor:{x:0,y:.11,z:4.9},
    exteriorDoor:{x:-2.65,y:.11,z:15.5,facing:-1},exits:[]};
  const landing=arrivalDoor(exterior,interior);
  assert.deepEqual(landing,{x:0,y:.11,z:4,yaw:180});
  assert.ok(doorLocation(landing).split(',').map(Number).every(Number.isFinite));
  assert.deepEqual(arrivalDoor(interior,exterior),interior.exteriorDoor);
  assert.equal(arrivalDoor(interior,interior),null);
});

test('an interior crossing uses the authorized return passage in the destination',()=>{
  const door={x:-4.4,y:.12,z:1.2,yaw:90};
  const from={id:'gallery'};
  const next={id:'tower',exits:[{to:'workshop',door:{x:4}},{to:'gallery',door}]};
  assert.deepEqual(arrivalDoor(from,next),door);
  assert.equal(arrivalDoor({id:'unlinked'},next),null);
});

test('the tower portal warms near the gallery stair without offering the wrong action',()=>{
  const dom=new JSDOM('<div id="space-travel"><nav></nav></div><button id="house-door" hidden></button>');
  const prior=globalThis.document;
  globalThis.document=dom.window.document;
  const prefetched=[];
  const update=showSpaceLinks({id:'gallery',exits:[
    {to:'lab',title:'Laboratorio',kind:'stair',rise:-1,door:{x:3,y:-.73,z:-5.52}},
    {to:'tower',title:'Torre',kind:'portal',door:{x:4.81,y:.11,z:-3}},
  ]},{onNear:space=>prefetched.push(space)});
  const button=document.querySelector('#house-door');
  try{
    update({x:3.51,y:.1,z:-2.56});
    assert.equal(button.hidden,true);
    assert.deepEqual(prefetched,['tower']);

    update({x:4.4,y:.1,z:-3.1});
    assert.equal(button.hidden,false);
    assert.equal(button.textContent,'Cruzar portal · Torre');

    update({x:3.4,y:-.60,z:-5.40});
    assert.equal(button.hidden,false);
    assert.equal(button.textContent,'Bajar · Laboratorio');
  }finally{
    update.dispose();
    globalThis.document=prior;
    dom.window.close();
  }
});

test('the room map follows the actor and only highlights authorized physical doors',()=>{
  const dom=new JSDOM(`<details id="space-travel"><summary></summary>
    <section class="room-map" hidden><div class="room-map-plot"></div><div class="room-map-destinations"></div></section>
    <nav></nav></details><aside id="door-guidance" hidden><span class="door-guide-title"></span>
    <span class="door-guide-distance"></span><button></button></aside><button id="house-door" hidden></button>`);
  const prior=globalThis.document;
  globalThis.document=dom.window.document;
  const travel=document.querySelector('details');
  const guide=document.querySelector('#door-guidance');
  const north=()=>({x:0,y:0,z:0,w:1});
  const east=()=>({x:0,y:-Math.SQRT1_2,z:0,w:Math.SQRT1_2});
  const far={x:-3,y:.1,z:0};
  const show=space=>showSpaceLinks(space,{onError:assert.fail});
  const mapButtons=()=>[...travel.querySelectorAll('.room-map-destinations button')];
  const portal={to:'tower',title:'Torre',kind:'portal',door:{x:3,y:.11,z:-4.81}};
  let update=show({id:'gallery',exits:[portal]});
  try{
    travel.open=true;
    assert.equal(travel.hidden,false);
    assert.deepEqual(mapButtons().map(button=>button.textContent),['Torre']);
    mapButtons()[0].click();
    assert.equal(mapButtons()[0].getAttribute('aria-pressed'),'true');
    assert.equal(travel.querySelector('.room-map-pin[data-selected]').style.left,'75%');
    update(far,north);
    assert.equal(travel.querySelector('.room-map-player').style.left,'25%');
    assert.equal(travel.querySelector('.room-map-player').style.getPropertyValue('--map-heading'),'0deg');
    assert.equal(document.querySelector('#house-door').hidden,true,'selection does not activate a crossing');
    assert.equal(guide.hidden,true);
    travel.open=false;
    update(far,north);
    assert.equal(guide.hidden,false);
    assert.equal(guide.querySelector('.door-guide-distance').textContent,'8 m');
    assert.equal(guide.style.getPropertyValue('--door-direction'),'50deg');
    update(far,east);
    assert.equal(guide.style.getPropertyValue('--door-direction'),'-40deg');
    update({x:3,y:.1,z:-4.81},east);
    assert.equal(guide.hidden,true);
    assert.equal(document.querySelector('#house-door').hidden,false);
    update(far,east);
    guide.querySelector('button').click();
    assert.equal(guide.hidden,true);
    assert.equal(mapButtons()[0].getAttribute('aria-pressed'),'false');
    mapButtons()[0].click();
    update(far,north);
    assert.equal(guide.hidden,false);
    update.suspend();
    assert.equal(guide.hidden,true);
    assert.equal(guide.querySelector('.door-guide-title').textContent,'');
    assert.equal(travel.open,false);
    assert.equal(travel.hidden,true);
    assert.equal(mapButtons().length,0);
    assert.equal(travel.querySelector('.room-map-plot').childElementCount,0);
    update.dispose();
    update=show({id:'gallery',exits:[],emergencyExit:true});
    assert.equal(mapButtons().length,0);
    assert.equal(travel.querySelector('nav button').textContent,'Volver al exterior');
    assert.doesNotMatch(travel.textContent,/Torre/);
  }finally{
    update.dispose();
    globalThis.document=prior;
    dom.window.close();
  }
});
