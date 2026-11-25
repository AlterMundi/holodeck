import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CollectionHud} from '../src/collection-hud.mjs';

test('collection actions follow the displayed edition and room',()=>{
  const panel={toggleAttribute(){},hasAttribute:()=>false};
  const state={room:'matter',entries:[{id:'model',label:'Modelo'}],
    archive:{id:'first',label:'Inicial',page:'1 / 2',canStep:true,canRestore:true}};
  const actions=[];
  const owner={panel,hudCollection:()=>state,
    placeShelfEdition:id=>actions.push(['place',id]),shelfViewerPath:id=>'/view/'+id,
    archive:{panel,step:()=>{
      actions.push(['step',state.archive.id]);
      state.archive={...state.archive,id:'second',label:'Revisión',page:'2 / 2'};
    },returnToShelf:()=>actions.push(['restore',state.archive.id])}};
  const hud=new CollectionHud({owner,focusControl(){},currentFocus(){},openViewer:path=>actions.push(['view',path]),
    send:type=>{if(type==='createSurface')hud.group={};}});
  const act=(name,context)=>hud.activate({name,context});
  hud.update(true);
  const shelf={scope:hud.scope,mode:'shelf',edition:'model'};
  act('place',{...shelf,edition:'other'});
  act('viewShelf',shelf);
  act('showArchive',shelf);
  const archive={scope:hud.scope,mode:'archive',edition:'first'};
  act('next',archive);
  act('restore',archive);
  const current={scope:hud.scope,mode:'archive',edition:'second'};
  state.room='elsewhere';
  act('restore',current);
  state.room='matter';
  act('restore',current);
  hud.update(false);
  act('restore',current);
  assert.deepEqual(actions,[['view','/view/model'],['step','first'],['restore','second']]);
});
