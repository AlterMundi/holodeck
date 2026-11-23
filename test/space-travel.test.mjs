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
