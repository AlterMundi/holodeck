import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial} from 'three';
import {TeleportModels} from '../src/teleport-models.mjs';
import {iconGlb,fitIcon} from '../src/teleport-icons.mjs';
import {teleportModelId} from '../src/teleport-hud.mjs';

const glb=()=>{
  const positions=new Float32Array([0,0,0, 1,0,0, 0,1,0]);
  const colors=new Float32Array([1,0,0, 0,1,0, 0,0,1]);
  return iconGlb(fitIcon({positions,colors,indices:[0,1,2]}));
};

function setup({respond}){
  const teleport={entries:[{id:'room:a',icon:'/api/space/destinations/icon/'+'a'.repeat(32)}],slots:null,branch:''};
  teleport.slots=[teleport.entries[0]];
  const models=new TeleportModels(teleport,{base:'http://holodeck.test/',reduced:()=>false,invalidate:()=>{}});
  const authored=new Group();authored.name='authored';
  authored.add(new Mesh(new BoxGeometry(.1,.1,.1),new MeshStandardMaterial()));
  models.figures=new Map([[teleportModelId('room:a'),authored]]);
  const calls=[];
  globalThis.fetch=async url=>{calls.push(String(url));return respond();};
  const state={anchor:new Group(),slot:0,figure:null,key:null};
  return {models,state,calls};
}
const meshNames=figure=>{const names=[];figure?.traverse(o=>{if(o.isMesh)names.push(o.name||o.parent?.name);});return names;};
const settle=()=>new Promise(resolve=>setTimeout(resolve,30));

test('a pedestal waits for its own icon instead of flashing the authored miniature',async()=>{
  const bytes=glb();
  const {models,state,calls}=setup({respond:()=>new Response(bytes)});
  models.prefetchIcons();
  models.syncFigure(state,0);
  assert.equal(state.figure,null,'nothing generic is shown while the icon loads');
  await settle();
  models.syncFigure(state,10);
  assert.ok(state.figure,'the icon appears once ready');
  let authored=false;state.figure.traverse(o=>{if(o.name==='authored')authored=true;});
  assert.equal(authored,false,'the shown figure is the generated icon');
  assert.equal(state.appearAt,10,'it grows in');
  // Reopening uses the cached icon at once, without a second request.
  models.clearFigure(state);state.key=undefined;
  models.syncFigure(state,20);
  assert.ok(state.figure&&state.appearAt===null);
  assert.equal(calls.length,1);
});

test('the authored miniature is only a fallback when the icon cannot be produced',async()=>{
  const {models,state}=setup({respond:()=>new Response('',{status:404})});
  models.syncFigure(state,0);
  assert.equal(state.figure,null);
  await settle();
  models.syncFigure(state,5);
  let authored=false;state.figure?.traverse(o=>{if(o.name==='authored')authored=true;});
  assert.ok(authored);
  void meshNames;
});
