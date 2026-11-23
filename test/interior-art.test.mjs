import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {interiorArt} from '../src/interior-art.mjs';
import {houseId} from '../src/houses.mjs';
import {RoomStore} from '../src/room-store.mjs';
import {createHolodeck} from '../src/server.mjs';

const owner = 'dm:being:v1:2wG9cFk2YwACrjlcc6JFGux_lcGN_thQ5lq4WdDefKU';
const house = houseId(owner);
const lab = 'compaii-lab';

test('workshop art follows the exact house, current room grant and asset revision', async()=>{
  const definition={id:lab,house,title:'Laboratorio',level:-1,entry:false,guests:['human:guest'],
    links:[{kind:'stair',to:'vestibulo'}]};
  const art=interiorArt(definition);
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
    const prepared=await (await read('api/space/scene?room='+lab)).json();
    assert.match(prepared.markup,/id="room-art"/);
    assert.equal((await read(model)).status,404);
    const entered=await (await move('vestibulo',lab)).json();
    assert.equal(entered.id,lab);
    assert.match(entered.scene.markup,/id="room-art"/);
    assert.equal((await read(model+'wrong')).status,404);
    const response=await read(model);
    assert.equal(response.status,200);
    assert.match(response.headers.get('Cache-Control'),/no-store/);
    assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex')+'.glb',art.revision);
    grant=false;
    assert.equal((await read(model)).status,404);
    const after=await (await read('api/space?live=1')).json();
    assert.equal(after.id,'outside');
    assert.equal(after.scene,null);
  } finally {
    runtime?.close();
    if(listener){
      listener.closeAllConnections();
      await new Promise(resolve=>listener.close(resolve));
    }
    rmSync(stateDir,{recursive:true,force:true});
  }
});
