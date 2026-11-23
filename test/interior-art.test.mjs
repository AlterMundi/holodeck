import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {captureNativeSituation} from '../src/native-conversation.mjs';
import {interiorArt} from '../src/interior-art.mjs';
import {interiorDocument} from '../src/interior-spaces.mjs';
import {houseId} from '../src/houses.mjs';
import {RoomStore} from '../src/room-store.mjs';
import {createHolodeck} from '../src/server.mjs';

const owner = 'dm:being:v1:2wG9cFk2YwACrjlcc6JFGux_lcGN_thQ5lq4WdDefKU';
const house = houseId(owner);
const lab = 'compaii-lab';

test('authored room surfaces retain collision and the engine stair geometry',()=>{
  const room={id:lab,title:'Laboratorio',level:-1};
  const passages=[{kind:'stair',slot:0,rise:1,label:'Galería'}];
  const visuals={src:'/candidate.glb',colliders:'',replacesShell:true,authoredStairs:true};
  const markup=interiorDocument(room,passages,null,visuals);
  assert.match(markup,/id="room-art"[^>]+collide="false"/);
  assert.match(markup,/width="1.7" height="0.14" depth="0.45"[^>]+opacity="0" cast-shadows="false"/);
  assert.match(markup,/height="0.2" depth="12"[^>]+opacity="0" cast-shadows="false"/);
  assert.doesNotMatch(markup,/id="room-marker"/);
  assert.match(interiorDocument(room,passages),/id="room-marker"/);
  const exhibition=interiorDocument(room,passages,{revision:5},{...visuals,authoredExhibitBase:true});
  assert.match(exhibition,/id="house-exhibit" data-exhibit-revision="5"/);
  assert.doesNotMatch(exhibition,/width="1.34" height="0.49"/);
});

test('workshop art follows the exact house, current room grant and asset revision', async()=>{
  const definition={id:lab,house,title:'Laboratorio',level:-1,entry:false,guests:['human:guest'],
    links:[{kind:'stair',to:'vestibulo'}]};
  const art=interiorArt(definition);
  const variant=(name)=>{
    const bytes=Buffer.from(name);
    return {bytes,revision:createHash('sha256').update(bytes).digest('hex')+'.glb',colliders:''};
  };
  const open=variant('stair visible'),closed=variant('stair covered');
  assert.ok(art);
  assert.equal(interiorArt({...definition,house:houseId('dm:being:v1:'+'z'.repeat(43))}),null);
  const stateDir=mkdtempSync(join(tmpdir(),'holodeck-interior-art-'));
  new RoomStore(join(stateDir,'houses')).save({schema:'holodeck.houses/v1',receipts:[],houses:[{
    id:house,owner,revision:1,parcel:'parcel-west-1',
    facade:{color:'#226655',title:'House',width:2,depth:1,height:2},
  }]});
  let grant=true,runtime,listener;
  try {
    runtime=await createHolodeck({basePath:'/holodeck/',stateDir,
      interiorSpaces:[definition,{id:'vestibulo',house,title:'Vestíbulo',level:0,entry:true,
        guests:['human:guest'],links:[{kind:'stair',to:lab}]}],
      interiorGuestAccess:(_actor,id)=>id!==lab||grant,
      interiorArtwork:(room,passages=[])=>room?.id==='vestibulo'?
        (passages.some(p=>p.to===lab)?open:closed):interiorArt(room),
      identityResolver:async req=>req.headers.cookie?.includes('fixture=guest')?
        {id:'human:guest',kind:'human',rights:['observe']}:null,
    });
    listener=runtime.app.listen(0,'127.0.0.1');
    await once(listener,'listening');
    const base='http://127.0.0.1:'+listener.address().port+'/holodeck/';
    const admission=await fetch(base,{headers:{Cookie:'fixture=guest',Accept:'application/json'}});
    assert.equal(admission.status,200);
    const headers={Cookie:'fixture=guest; '+admission.headers.get('set-cookie').split(';')[0],
      'Content-Type':'application/json'};
    const model='api/space/art/'+art.revision;
    const read=(path)=>fetch(base+path,{headers});
    const move=(from,to)=>fetch(base+'api/space',{headers,method:'POST',body:JSON.stringify({from,to,live:1})});
    assert.equal((await fetch(base+model)).status,401);
    assert.equal((await read(model)).status,404);
    assert.equal((await read('assets/beacon-workshop.glb')).status,404);
    assert.equal((await move('outside','vestibulo')).status,200);
    const openUrl='api/space/art/'+open.revision;
    const closedUrl='api/space/art/'+closed.revision;
    assert.equal(await (await read(openUrl)).text(),'stair visible');
    assert.equal((await read(closedUrl)).status,404);
    const prepared=await (await read('api/space/scene?room='+lab)).json();
    assert.match(prepared.markup,/id="room-art"/);
    assert.equal((await read(model)).status,404);
    assert.equal((await read('api/space/content-visits')).status,200);
    assert.deepEqual(await (await read('api/space/content-visits')).json(),{visits:[]});
    const entered=await (await move('vestibulo',lab)).json();
    assert.equal(entered.id,lab);
    const station=entered.objects.find(item=>item.id==='beacon-prototypes');
    assert.deepEqual(station,{id:'beacon-prototypes',kind:'workstation',title:'Banco de prototipos',
      position:{x:1.5,y:.1,z:2.75},revision:1});
    assert.match(entered.scene.markup,/id="beacon-prototypes"/);
    assert.doesNotMatch(entered.scene.markup,/guitar-review/);
    const catalog=await (await read('api/space/content-visits')).json();
    assert.equal(catalog.visits.length,1);
    assert.equal(catalog.visits[0].node,station.id);
    assert.equal(catalog.visits[0].nodeRevision,station.revision);
    assert.deepEqual(catalog.visits[0].position,station.position);
    const interior={id:'capture-id',run:runtime.room.run,edition:runtime.room.edition,
      sequence:runtime.room.sequence,capturedAt:123,place:{...entered,participants:[]}};
    const capture=(workstation)=>captureNativeSituation(runtime.room,{id:'human:guest'},
      {id:'message-id',view:{spaceId:lab,workstation}},{interior});
    assert.equal(capture({id:station.id,revision:station.revision}).referredWorkstation.title,station.title);
    assert.equal(capture({id:station.id,revision:station.revision+1}).referredWorkstation,undefined);
    assert.doesNotMatch(JSON.stringify(capture(station)),/guitar-review|published-935e6262/);

    assert.match(catalog.visits[0].descriptor,/guitar-review-935e6262\/artifact-review\/hb-guitar\/published-935e6262-organic-head\/visit$/);
    assert.match(entered.scene.markup,/id="room-art"/);
    assert.equal((await read(model+'wrong')).status,404);
    const response=await read(model);
    assert.equal(response.status,200);
    assert.match(response.headers.get('Cache-Control'),/no-store/);
    assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex')+'.glb',art.revision);
    grant=false;
    assert.equal((await read(model)).status,404);
    const after=await (await read('api/space?live=1')).json();
    assert.equal((await read('api/space/content-visits')).status,404);
    assert.equal(after.id,'outside');
    assert.equal(after.scene,null);
    const denied=await (await move('outside','vestibulo')).json();
    assert.ok(denied.scene.markup.includes(closed.revision));
    assert.ok(!denied.scene.markup.includes(open.revision));
    assert.equal((await read(openUrl)).status,404);
    assert.equal(await (await read(closedUrl)).text(),'stair covered');
  } finally {
    runtime?.close();
    if(listener){
      listener.closeAllConnections();
      await new Promise(resolve=>listener.close(resolve));
    }
    rmSync(stateDir,{recursive:true,force:true});
  }
});
