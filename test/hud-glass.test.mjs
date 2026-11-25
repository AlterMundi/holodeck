import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Group} from 'three';
import {HudLookPreview} from '../src/hud-look-preview.mjs';

test('the native instrument surround follows layout and reuses its noninteractive pane',()=>{
  const parent=new Group();
  const holder=new Group();
  const source=new Group();
  parent.add(holder);
  holder.add(source);
  const body={dataset:{}};
  const colors={'--hud-glass':'#34576a','--hud-rim':'#72cbcd','--hud-brass':'#edbd84'};
  const document={body,defaultView:{
    matchMedia:()=>({matches:true}),
    getComputedStyle:()=>({getPropertyValue:name=>colors[name]??" "}),
  }};
  let repaints=0;
  const look=new HudLookPreview({document,parent,invalidate:()=>repaints++});
  const key='matter-worktable',bounds={left:-1,right:1,top:0,bottom:-1};
  look.draw(key,source,bounds);
  const {anchor,shell}=look.panels.get(key);
  assert.equal(shell.group.material.uniforms.rim.value.getHexString(),'72cbcd');
  assert.equal(shell.group.material.depthWrite,false);
  assert.equal(shell.group.renderOrder,-1);
  assert.doesNotThrow(()=>shell.group.raycast());
  const initial=repaints;
  look.draw(key,source,bounds);
  assert.equal(repaints,initial);
  source.position.x=.25;
  look.draw(key,source,bounds);
  assert.equal(anchor.matrix.elements[12],.25);
  assert.equal(repaints,initial+1);
  holder.visible=false;
  look.draw(key,source,bounds);
  assert.equal(anchor.visible,false);
  holder.visible=true;
  body.dataset.roomLook='amber';
  colors['--hud-rim']='#e8a677';
  look.draw(key,source,{...bounds,bottom:-1.4});
  assert.equal(anchor.visible,true);
  assert.equal(look.panels.get(key).shell.group,shell.group);
  assert.equal(shell.group.position.y,-.7);
  assert.equal(shell.group.material.uniforms.rim.value.getHexString(),'e8a677');
  look.dispose();
  assert.deepEqual(parent.children,[holder]);
});
