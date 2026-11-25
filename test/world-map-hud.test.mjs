import assert from 'node:assert/strict';
import {test} from 'node:test';
import {WorldMapHud} from '../src/world-map-hud.mjs';

function fixture(){
  const panel={open:true,hidden:false,dataset:{}};
  const state={scope:'west',busy:false,canExit:true,map:{
    destinations:[{id:'0',title:'Taller'},{id:'1',title:'Vestíbulo'}],
  }};
  const effects=[];
  const hud=new WorldMapHud({panel,mapState:()=>state,selectDestination:id=>effects.push(id),
    returnOutside:()=>effects.push('exit'),focusLauncher:()=>effects.push('focus'),
    send:type=>effects.push(type),invalidate(){}});
  hud.group={};hud.mapScope=state.scope;hud.scope=4;
  const action=(name,context={})=>hud.activate({name,context:{scope:4,...context}});
  return {hud,panel,state,effects,action};
}

test('map actions retain the exact drawn destination and reject an old room',()=>{
  const {state,effects,action}=fixture();
  action('navigation',{destination:'0'});
  action('next');
  action('navigation',{destination:'0'});
  action('navigation',{destination:'1'});
  state.scope='east';
  action('exit');
  action('navigation',{destination:'1'});
  assert.deepEqual(effects,['0','1']);
});

test('map only acts while open and a busy return keeps the navigation mounted',()=>{
  const {action,effects,state,hud,panel}=fixture();
  state.busy=true;
  action('exit');
  assert.deepEqual(effects,[]);
  assert.equal(panel.open,true);
  action('close');
  assert.equal(panel.open,false);
  assert.deepEqual(effects,['deleteSurface','focus']);
  assert.equal(hud.scope,5);
  action('exit');
  assert.deepEqual(effects,['deleteSurface','focus']);
});

test('a raster paint is retained while a contextual map is suppressed',()=>{
  const {hud,panel}=fixture();
  hud.texture={needsUpdate:false};
  hud.update(false,true);
  assert.equal(hud.texture.needsUpdate,true);
  assert.equal(hud.group,null);
  assert.equal(panel.open,true);
});
