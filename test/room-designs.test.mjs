import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RoomDesigns,DESIGN_SAVE_BYTES} from '../src/room-designs.mjs';
import {RoomStore,RoomCommitUncertain} from '../src/room-store.mjs';

test('an uncertain design write fences the session and recovers its exact receipt from disk',()=>{
  const dir=mkdtempSync(join(tmpdir(),'holodeck-design-'));
  const owner={kind:'daimon',id:'dm:being:v1:'+'o'.repeat(43),rights:['observe','edit']};
  const options={spaces:{rooms:new Map([['foyer',{house:'house'}]])},
    houses:{directory:()=>[{id:'house',owner:owner.id}]},legacyRooms:new Set(),
    kits:new Map([['first',{title:'First'}],['second',{title:'Second'}]])};
  const original={type:'design.put',id:'design-01',room:'foyer',kit:'first',expectedRevision:null};
  const update={...original,id:'design-02',kit:'second',expectedRevision:1};
  const store=new RoomStore(dir,{maxBytes:DESIGN_SAVE_BYTES});
  const first=new RoomDesigns({...options,persist:state=>store.save(state)});
  const accepted=first.put(owner,original);
  try{
    store.synchronizeDirectory=()=>{throw Error('simulated directory sync failure');};
    assert.throws(()=>first.put(owner,update),RoomCommitUncertain);
    assert.equal(first.inspect(owner,'foyer'),null);
    assert.equal(first.put(owner,original),null);
    const recovered=new RoomDesigns({...options,state:store.load()});
    assert.deepEqual(recovered.result(owner,original.id),accepted);
    assert.deepEqual(recovered.result(owner,update.id),{owner:owner.id,room:'foyer',kit:'second',revision:2});
    assert.deepEqual(recovered.put(owner,update),recovered.result(owner,update.id));
    assert.equal(recovered.put(owner,{...update,kit:'first'}),null);
  }finally{
    rmSync(dir,{force:true,recursive:true});
  }
});
