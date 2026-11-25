import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {arrivalDoor,doorLocation,indoorDoorLabelAnchor,showSpaceLinks} from '../src/space-travel.mjs';

test('a doorway label sits forward of the approach point along the visible passage',()=>{
  const door={x:-3,y:.11,z:-4.81,yaw:180};
  const label=indoorDoorLabelAnchor(door,'door');
  assert.ok(Math.abs(label.x+3)<1e-6);
  assert.ok(Math.abs(label.z+5.39)<1e-6);
  assert.ok(label.y>2.1);
  const portal=indoorDoorLabelAnchor(door,'portal');
  assert.equal(portal.z,door.z);
});

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
  assert.deepEqual(arrivalDoor(from,{...next,exits:[{to:'gallery',kind:'door',door}]}),{...door,yaw:270});
  assert.deepEqual(arrivalDoor(from,{...next,exits:[{to:'gallery',kind:'door',door:{...door,yaw:180}}]}),
    {...door,yaw:0});
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
    const marked=update.bearing();
    assert.deepEqual(marked,{id:marked.id,label:'Torre',heading:50*Math.PI/180,distance:'8 m'});
    assert.equal(update.mapDismiss('different-passage'),false);
    update(far,east);
    assert.equal(guide.style.getPropertyValue('--door-direction'),'-40deg');
    assert.equal(update.bearing().heading,-40*Math.PI/180);
    update({x:3,y:.1,z:-4.81},east);
    assert.equal(guide.hidden,true);
    assert.equal(document.querySelector('#house-door').hidden,false);
    assert.equal(update.bearing(),null);
    update(far,east);
    assert.equal(update.mapDismiss(marked.id),true);
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


test('a physical crossing is rechecked after a pending visit check', async ()=>{
  const dom=new JSDOM('<details id="space-travel"><nav></nav></details><button id="house-door"></button>',
    {url:'https://fixture.test/holodeck/'});
  const prior=globalThis.document, priorFetch=globalThis.fetch;
  globalThis.document=dom.window.document;
  let verify, requests=0;
  globalThis.fetch=async (url,{body})=>{
    requests++;
    assert.equal(url.pathname,'/holodeck/api/space');
    assert.deepEqual(JSON.parse(body),{from:'gallery',to:'tower',live:1});
    return Response.json({id:'tower',live:1,exits:[]});
  };
  const update=showSpaceLinks({id:'gallery',exits:[
    {to:'tower',title:'Torre',door:{x:0,y:.1,z:0}},
  ]},{canLeave:()=>new Promise(resolve=>{verify=resolve;}),onError:assert.fail,
    onMoved:next=>assert.equal(next.id,'tower'),revision:()=>undefined});
  try{
    update({x:0,y:.1,z:.2});
    const offered=update.doorOffer();
    const pending=update.followDoor(offered.scope,offered.revision);
    update({x:4,y:.1,z:4});
    update({x:0,y:.1,z:.2});
    verify(true);
    await pending;
    assert.equal(requests,0,'re-entering the same door does not revive the old action');
    assert.equal(update.followDoor(offered.scope,offered.revision),undefined);
    const current=update.doorOffer();
    const covered=update.followDoor(current.scope,current.revision);
    const dialog=document.createElement('dialog');
    dialog.open=true;
    document.body.append(dialog);
    assert.equal(update.doorOffer(),null);
    verify(true);
    await covered;
    assert.equal(requests,0,'opening another surface also cancels the pending check');
    dialog.remove();
    const button=document.getElementById('house-door');
    const previousCheck=verify;
    update.buttonKey(new dom.window.KeyboardEvent('keydown',{key:' '}));
    update({x:4,y:.1,z:4});
    update({x:0,y:.1,z:.2});
    button.click();
    assert.equal(verify,previousCheck,'a held Space cannot activate the replacement offer');
    button.onpointerdown({button:0});
    update({x:4,y:.1,z:4});
    update({x:0,y:.1,z:.2});
    button.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,detail:1}));
    assert.equal(verify,previousCheck,'a pointer release cannot activate the replacement offer');
    const replacement=update.doorOffer();
    const next=update.followDoor(replacement.scope,replacement.revision);
    verify(true);
    await next;
    assert.equal(requests,1);
  }finally{
    update.dispose();globalThis.document=prior;globalThis.fetch=priorFetch;dom.window.close();
  }
});
