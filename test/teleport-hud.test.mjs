import test from 'node:test';
import assert from 'node:assert/strict';
import {TeleportHud} from '../src/teleport-hud.mjs';

test('the teleport graph opens branches, returns one level and travels only on confirmation',async()=>{
  const house={id:'house:home',house:'home',houseTitle:'Casa',title:'Entrada exterior'};
  const room={...house,id:'room:lab',title:'Laboratorio',to:'lab'};
  const table={...room,id:'object:lab:worktable',title:'Mesa de trabajo'};
  const plaza={id:'terrain:arrival',title:'Plaza'};
  const residence={id:'terrain:residence',title:'Residencia',links:[room.id,'room:hidden']};
  const trips=[];
  let state;
  const hud=new TeleportHud({
    storage:{getItem:()=>null},send:(type,{value})=>{if(type==='updateDataModel')state=value;},
    onOpen:()=>{hud.group={};},onClose:()=>{},focus:()=>{},
    read:async()=>({space:'outside',destinations:[house,room,table,plaza,residence]}),go:entry=>trips.push(entry),
  });
  await hud.open({id:'outside',actorRef:'human:visitor'});
  const act=(name,context={})=>hud.activate({name,context:{epoch:state.epoch,level:state.level,...context}});
  const choose=()=>act('slot0',{selected:state.slot0Key});
  assert.equal(state.slot0Key,plaza.id);
  act('slot1',{selected:residence.id});
  assert.equal(state.backLabel,'Volver desde Residencia');
  assert.equal(state.slot0Key,room.id);
  assert.equal(state.slot1Visible,false);
  act('back');
  assert.equal(state.destination,residence.id);
  act('houses');
  assert.equal(state.slot0Key,house.id);
  choose();
  assert.equal(state.backLabel,'Volver desde Casa');
  assert.equal(state.slot0Key,room.id);
  const stale=state.level;
  choose();
  assert.equal(state.backLabel,'Volver desde Laboratorio');
  assert.equal(state.slot0Key,table.id);
  act('back',{level:stale});
  assert.equal(state.backLabel,'Volver desde Laboratorio');
  act('back');
  assert.equal(state.backLabel,'Volver desde Casa');
  assert.equal(state.destination,room.id);
  act('back');
  assert.equal(state.hasParent,false);
  assert.equal(state.slot0Key,house.id);
  assert.deepEqual(trips,[]);

  assert.equal(hud.selectDestination(table.id),true);
  assert.equal(state.backLabel,'Volver desde Laboratorio');
  assert.equal(state.slot0Active,true);
  act('go',{selected:state.destination});
  assert.deepEqual(trips,[table]);
});
