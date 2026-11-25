import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Scene} from 'three';
import {WorldActionLabel} from '../src/world-action-label.mjs';

test('a floating label uses view depth and hides near-clipped or off-screen anchors',()=>{
  const context={
    measureText:text=>({width:text.length*20}),createLinearGradient:()=>({addColorStop(){}}),
    beginPath(){},roundRect(){},fill(){},stroke(){},moveTo(){},lineTo(){},fillText(){},
  };
  const document={createElement:()=>({getContext:()=>context})};
  const scene=new Scene();
  const label=new WorldActionLabel({scene,document});
  const camera={position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0,w:1},fov:60,aspect:1.5};
  const bench={anchor:{x:0,y:0,z:-3},label:'Usar mesa',key:'E'};
  label.update(bench,camera,800);
  const scale=label.sprite.scale.y;
  assert.ok(scale>0&&scale<.3);
  assert.equal(label.sprite.material.depthTest,true);
  assert.equal(label.sprite.material.depthWrite,false);
  label.update({...bench,anchor:{x:1.4,y:0,z:-3}},camera,800);
  assert.equal(label.sprite.scale.y,scale);
  let released=false;
  label.texture.addEventListener('dispose',()=>{released=true;});
  label.update({...bench,label:'Ir a · Vestíbulo'},camera,800);
  assert.equal(released,true);
  label.update({...bench,anchor:{x:0,y:0,z:-.05}},camera,800);
  assert.equal(label.sprite.visible,false);
  label.update({...bench,anchor:{x:0,y:-2,z:-3}},camera,800);
  assert.equal(label.sprite.visible,false);
  label.dispose();
  assert.equal(scene.children.length,0);
});
