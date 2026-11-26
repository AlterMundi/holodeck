import assert from 'node:assert/strict';
import {test} from 'node:test';
import {WorldMapHud,terrainPeekId} from '../src/world-map-hud.mjs';

function fixture(){
  const panel={open:true,hidden:false,dataset:{}};
  const state={scope:'west',busy:false,canExit:true,map:{
    destinations:[{id:'0',title:'Taller'},{id:'1',title:'Vestíbulo'}],
  }};
  const effects=[];
  let bearing={id:'0',label:'Taller',heading:0,distance:'3 m'};
  const hud=new WorldMapHud({panel,mapState:()=>state,selectDestination:id=>effects.push(id),
    readBearing:()=>bearing,dismissBearing:id=>{effects.push(id);bearing=null;return true;},
    returnOutside:()=>effects.push('exit'),focusLauncher:()=>effects.push('focus'),
    send:type=>effects.push(type),invalidate(){}});
  hud.group={};hud.mapScope=state.scope;hud.scope=4;
  const action=(name,context={})=>hud.activate({name,context:{scope:4,...context}});
  return {hud,panel,state,effects,action,setBearing:value=>{bearing=value;}};
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


test('the read-only terrain preview has its own surface and releases it when suppressed',()=>{
  const {hud}=fixture();
  const messages=[];
  hud.send=(type,content,id)=>messages.push({type,content,id});
  hud.updatePeek(true);
  hud.updatePeek(true);
  hud.updatePeek(false);
  assert.deepEqual(messages.map(({type,id})=>[type,id]),[
    ['createSurface',terrainPeekId],['updateComponents',terrainPeekId],['deleteSurface',terrainPeekId],
  ]);
  assert.ok(messages[1].content.components.every(component=>!component.action));
  assert.equal(hud.scope,4);
  assert.equal(hud.peekGroup,null);
});

test('rotating an open room map keeps its current destination and action scope',()=>{
  const {hud,panel,action}=fixture();
  const updates=[];
  panel.querySelector=()=>({hidden:true});
  hud.send=(type,content)=>updates.push({type,...content});
  hud.update(true,false,true);
  action('next');
  hud.update(true,false,true);
  hud.update(true,false,false);
  assert.equal(hud.scope,4);
  assert.equal(hud.index,1);
  assert.deepEqual(updates.map(({type})=>type),[
    'updateComponents','updateDataModel','updateDataModel','updateComponents',
  ]);
  assert.deepEqual(updates[0].components.find(({id})=>id==='body').children,['map','controls']);
  assert.equal(updates[2].value.destination,'1');
  assert.equal(updates[3].components[0].children.includes('map'),true);
});

test('bearing dismissal is bound to the selection, room and presentation epoch',()=>{
  const {hud,panel,state,effects,setBearing}=fixture();
  panel.open=false;
  hud.bearingGroup={};
  hud.bearingSpace='west';
  const dismiss=(destination='0',epoch=0)=>hud.activateBearing({name:'dismiss',context:{destination,epoch}});
  dismiss('0',1);
  panel.open=true;
  dismiss();
  panel.open=false;
  state.scope='east';
  dismiss();
  state.scope='west';
  setBearing({id:'1',label:'Vestíbulo',heading:0,distance:'4 m'});
  dismiss();
  assert.deepEqual(effects,[]);
  dismiss('1');
  assert.deepEqual(effects,['1','deleteSurface','focus']);
  assert.equal(hud.bearingEpoch,1);
});
