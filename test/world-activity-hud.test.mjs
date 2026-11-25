import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldActivityHud} from '../src/world-activity-hud.mjs';

test('Activity ignores stale page or selection actions and keeps the same controller on fallback',()=>{
  let pointed=0;
  const notes=[];
  const history={
    native:true,epoch:5,page:0,launcher:{hidden:false,toggleAttribute(){}},
    getState:()=>({actorRef:'visitor',run:'world'}),
    data:{observer:'visitor',run:'world',items:[],gaps:{},retention:{count:0}},
    selected:{sequence:6},message:text=>notes.push(text),
    point:()=>pointed++,fallback(){this.native=false;},
  };
  const hud=new WorldActivityHud({owner:()=>history,send(){},focus(){}});
  hud.group={};
  const context={epoch:hud.epoch,pageRevision:5,selected:'6'};
  hud.activate({name:'point',context:{...context,pageRevision:4}});
  hud.activate({name:'point',context:{...context,selected:'7'}});
  assert.equal(pointed,0);
  assert.ok(notes.some(note=>note.includes('Actualizala')));
  hud.activate({name:'point',context});
  assert.equal(pointed,1);
  hud.present(false,false);
  assert.equal(history.native,false);
  assert.equal(history.selected.sequence,6);
  assert.equal(history.launcher.hidden,false);
});
