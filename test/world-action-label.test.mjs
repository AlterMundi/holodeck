import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Scene} from 'three';
import {WorldActionLabel} from '../src/world-action-label.mjs';

test('a floating label uses a gold leader and hides near-clipped or off-screen anchors',()=>{
  const context={
    measureText:text=>({width:text.length*20}),createLinearGradient:()=>({addColorStop(){}}),
    beginPath(){},roundRect(){},fill(){},stroke(){},moveTo(){},lineTo(){},fillText(){},
  };
  const document={createElement:()=>({getContext:()=>context})};
  const scene=new Scene();
  let wall=false;
  const label=new WorldActionLabel({scene,document,colliders:{raycastFirst:()=>wall?[1]:null}});
  const camera={position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0,w:1},fov:60,aspect:1.5};
  const bench={anchor:{x:0,y:0,z:-3},label:'Usar mesa',key:'E'};
  label.update(bench,camera,800);
  const scale=label.sprite.scale.y;
  assert.ok(scale>0&&scale<.3);
  assert.equal(label.sprite.material.depthTest,false);
  assert.equal(label.sprite.material.depthWrite,false);
  assert.equal(label.leader.visible,true);
  assert.equal(label.leader.material.color.getHex(),0xdab77e);
  label.update(bench,camera,800,{feet:{x:0,y:-1.4,z:-2}});
  assert.ok(Math.abs(label.sprite.position.x)>.2);
  assert.ok(Math.abs(label.sprite.position.y+.02)<1e-6);
  const endpoints=label.leader.geometry.attributes.position;
  assert.ok(Math.abs(endpoints.getX(0)-label.sprite.position.x)<1e-6);
  assert.deepEqual(Array.from(endpoints.array.slice(3)),[0,0,-3]);
  const placement=label.update(bench,camera,800,{card:false,feet:{x:0,y:-1.4,z:-2}});
  assert.ok(placement.x>650&&Math.abs(placement.y-405)<=1);
  assert.equal(label.sprite.visible,false);
  assert.equal(label.leader.visible,true);
  wall=true;
  label.update(bench,camera,800);
  assert.equal(label.sprite.visible,false);
  assert.equal(label.leader.visible,false);
  wall=false;
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
