import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ContentVisitor} from '../src/content-visitor.mjs';

const pin={kind:'artifact_review',tableId:'table',reviewId:'review',revision:'edition',adapter:'interactive_3d'};
const entry={id:'display',node:'display',nodeRevision:2,pin};
const scope=()=>Object.assign(Object.create(ContentVisitor.prototype),{
  scoped:true,roomId:'gallery',visitRoom:'gallery',visitId:'visit',entry,entries:[entry],
  frame:{},parked:false,accessGeneration:0,disposed:false,readyAcknowledged:true,ready:Promise.resolve(),
  panel:{classList:{contains:()=>true}},minimize(){this.minimized=true;},
});

test('a suspended visit never supplies a room reference from another room',async()=>{
  const visitor=scope();
  assert.deepEqual(visitor.reference(),{id:'display',revision:2});
  visitor.entries=[];
  visitor.reconcileVisitAccess();
  assert.equal(visitor.minimized,true);
  assert.equal(await visitor.allowLeaveRoom(),true);
  visitor.roomId='archive';
  visitor.entries=[entry];
  visitor.reconcileVisitAccess();
  assert.equal(visitor.reference(),null);
  assert.equal(await visitor.context(),null);
  visitor.roomId='gallery';
  visitor.reconcileVisitAccess();
  assert.deepEqual(visitor.reference(),{id:'display',revision:2});
});

test('losing the exact edition during getContext drops even a successful delayed reply',async()=>{
  let reply,requestStarted;
  const started=new Promise(resolve=>{requestStarted=resolve;});
  const visitor=scope();
  visitor.request=method=>new Promise(resolve=>{
    assert.equal(method,'getContext');reply=resolve;requestStarted();
  });
  const capture=visitor.context();
  await started;
  visitor.entries=[{...entry,nodeRevision:3}];
  visitor.reconcileVisitAccess();
  visitor.entries=[entry];
  visitor.reconcileVisitAccess();
  reply({state:{dirty:false,recording:false,processing:false,playing:false}});
  assert.equal(await capture,null);
  assert.equal(visitor.lastContext,undefined);
});

test('a room transport interruption hides its visit until the room and edition are confirmed again',async()=>{
  const visitor=Object.assign(scope(),{
    catalogGeneration:1,button:{hidden:false},index:{close(){},update(){}},onCatalog(){},
  });
  const before=visitor.frame;
  visitor.suspendRoom();
  assert.equal(visitor.button.hidden,true);
  assert.equal(visitor.reference(),null);
  assert.equal(visitor.frame,before);
  assert.equal(await visitor.loadCatalog(),false);
  visitor.loadCatalog=async()=>{
    visitor.entries=[entry];
    visitor.reconcileVisitAccess();
  };
  visitor.confirmRoom();
  await visitor.catalog;
  assert.equal(visitor.frame,before);
  assert.deepEqual(visitor.reference(),{id:'display',revision:2});
});

test('an interrupted open cannot mount an old viewer after reconnect',async()=>{
  let release;
  const visitor=Object.assign(scope(),{
    frame:null,catalogGeneration:1,button:{hidden:false},index:{close(){},update(){}},onCatalog(){},
    loadCatalog:()=>new Promise(resolve=>{release=resolve;}),
  });
  const pending=visitor.open(entry.id,{nodeRevision:entry.nodeRevision,expectedPin:pin});
  assert.equal(typeof release,'function');
  visitor.suspendRoom();
  visitor.loadCatalog=async()=>{visitor.entries=[entry];};
  visitor.confirmRoom();
  await visitor.catalog;
  release(true);
  await pending;
  assert.equal(visitor.frame,null);
  assert.equal(visitor.opening,false);
});
