import {once} from 'node:events';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {allowedGalleryVisits,gallerySlots} from '../src/gallery-catalog.mjs';
import {houseId} from '../src/houses.mjs';
import {RoomStore} from '../src/room-store.mjs';
import {createHolodeck} from '../src/server.mjs';

const edition=revision=>({kind:'artifact_review',adapter:'interactive_3d',
  tableId:'model-'+revision,reviewId:'sculpture',revision});
const selection={room:'gallery',draft:edition('draft-v1'),archive:edition('archive-v1')};
const published=edition('published-v1');

test('gallery roles have stable object IDs and distinguish exact versions',()=>{
  const rooms=new Map([['gallery',{}]]);
  const before=gallerySlots(selection,rooms);
  const after=gallerySlots({...selection,draft:edition('draft-v2')},rooms);
  assert.equal(before.slots[0].node,after.slots[0].node);
  assert.notEqual(before.slots[0].nodeRevision,after.slots[0].nodeRevision);
  assert.deepEqual(before.slots[1],after.slots[1]);
  assert.throws(()=>gallerySlots({...selection,archive:selection.draft},rooms),/distinct/);
  assert.throws(()=>gallerySlots({...selection,room:'foreign'},rooms),/existing gallery room/);
  assert.throws(()=>gallerySlots({...selection,draft:{...selection.draft,adapter:'video'}},rooms),/exact existing 3D/);
});

test('catalog omits a replaced edition while exact source authorization is in flight',async()=>{
  const rooms=new Map([['gallery',{}]]);
  const before=gallerySlots(selection,rooms).slots;
  const after=gallerySlots({...selection,draft:edition('draft-v2')},rooms).slots;
  assert.deepEqual(await allowedGalleryVisits({entries:before,authorize:async pin=>({editionTitle:'Title '+pin.revision}),
    currentEntries:()=>after}),[{...after[1],editionTitle:'Title archive-v1'}]);
});

test('gallery HTTP catalog checks each source grant and rechecks active room before responding',async t=>{
  const owner='dm:being:v1:'+'a'.repeat(43),house=houseId(owner);
  const directory=mkdtempSync(join(tmpdir(),'holodeck-gallery-'));
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  new RoomStore(join(directory,'houses')).save({schema:'holodeck.houses/v1',receipts:[],houses:[{
    id:house,owner,revision:1,parcel:'parcel-west-1',
    facade:{color:'#226655',title:'House',width:2,depth:1,height:2},
  }]});
  new RoomStore(join(directory,'exhibits')).save({schema:'holodeck.exhibits/v1',receipts:[],exhibits:[{
    owner,room:'gallery',revision:1,source:'node-model-published',sourceRevision:1,pin:published,
  }]});
  let revoked=false,hold;
  const runtime=await createHolodeck({stateDir:directory,gallerySelection:selection,
    interiorSpaces:[{id:'gallery',house,title:'Galería',entry:true,level:0,guests:['human:guest'],links:[]}],
    identityResolver:async req=>req.headers.cookie?.includes('fixture=owner')
      ?{id:owner,kind:'daimon',rights:['observe','edit']}
      :req.headers.cookie?.includes('fixture=guest')?{id:'human:guest',kind:'human',rights:['observe']}:null,
    galleryAuthorization:async (cookie,pin)=>{
      if(hold)await hold();
      if(cookie.includes('fixture=owner')||pin.revision===published.revision&&!revoked)
        return {editionTitle:'Protected title '+pin.revision};
      return false;
    },
  });
  const listener=runtime.app.listen(0,'127.0.0.1');
  t.after(async()=>{
    runtime.close();
    listener.closeAllConnections();
    await new Promise(resolve=>listener.close(resolve));
  });
  await once(listener,'listening');
  const base='http://127.0.0.1:'+listener.address().port+'/';
  async function session(actor){
    const cookie='fixture='+actor;
    const admission=await fetch(base,{headers:{Cookie:cookie,Accept:'application/json'}});
    assert.equal(admission.status,200);
    const headers={Cookie:cookie+'; '+admission.headers.get('set-cookie').split(';')[0],
      'Content-Type':'application/json'};
    return {
      move:(from,to)=>fetch(base+'api/space',{headers,method:'POST',body:JSON.stringify({from,to,live:1})}),
      catalog:()=>fetch(base+'api/space/content-visits',{headers}),
    };
  }
  const [author,visitor]=await Promise.all([session('owner'),session('guest')]);
  assert.equal((await visitor.catalog()).status,404);
  assert.equal((await author.move('outside','gallery')).status,200);
  const entered=await visitor.move('outside','gallery');
  assert.equal(entered.status,200);
  assert.doesNotMatch(JSON.stringify(await entered.json()),/draft-v1|archive-v1|model-published-v1/);
  const response=await author.catalog();
  assert.match(response.headers.get('Cache-Control'),/no-store/);
  const {visits,gallery}=await response.json();
  assert.equal(gallery,true);
  assert.deepEqual(visits.map(visit=>visit.id),['house-exhibit','house-exhibit-draft','house-exhibit-archive']);
  assert.deepEqual(visits.map(visit=>visit.title),['Terminado','En proceso','Archivo']);
  assert.deepEqual(visits.map(visit=>visit.pin),[published,selection.draft,selection.archive]);
  assert.deepEqual(visits.map(visit=>visit.editionTitle),['Protected title published-v1','Protected title draft-v1','Protected title archive-v1']);
  assert.deepEqual((await (await visitor.catalog()).json()).visits,[visits[0]]);
  revoked=true;
  assert.deepEqual(await (await visitor.catalog()).json(),{gallery:true,visits:[]});
  revoked=false;
  assert.deepEqual((await (await visitor.catalog()).json()).visits,[visits[0]]);

  let started,release;
  const pending=new Promise(resolve=>{started=resolve;});
  const wait=new Promise(resolve=>{release=resolve;});
  hold=()=>{started();return wait;};
  const racing=author.catalog();
  await pending;
  try{assert.equal((await author.move('gallery','outside')).status,200);}
  finally{release();}
  assert.deepEqual(await (await racing).json(),{gallery:false,visits:[]});
});
