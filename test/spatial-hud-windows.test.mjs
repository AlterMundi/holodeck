import assert from 'node:assert/strict';
import test from 'node:test';
import {placeHudWindow,SpatialHudWindows} from '../src/spatial-hud-windows.mjs';

test('custom HUD placement remains fully recoverable after a narrow resize',()=>{
  const bounds={left:-.65,right:.65,top:.12,bottom:-1.63};
  const view={width:320,height:420};
  const wide={x:1080,y:645,scale:310};
  const actual=placeHudWindow(view,bounds,wide);
  assert.ok(actual.scale<wide.scale);
  assert.ok(actual.x+bounds.left*actual.scale>=8-.01);
  assert.ok(actual.x+bounds.right*actual.scale<=view.width-8+.01);
  assert.ok(actual.y-bounds.top*actual.scale>=8-.01);
  assert.ok(actual.y-bounds.bottom*actual.scale<=view.height-8+.01);
});

test('an inspection window leaves the chosen viewing and thumb zones clear',()=>{
  const bounds={left:-.96,right:.96,top:.03,bottom:-1.023};
  const view={width:568,height:320,insets:{left:245,right:12,top:0,bottom:169}};
  const {x,y,scale}=placeHudWindow(view,bounds,{x:404,y:10,scale:202});
  assert.ok(x+bounds.left*scale>=253-.01);
  assert.ok(x+bounds.right*scale<=548+.01);
  assert.ok(y-bounds.top*scale>=8-.01);
  assert.ok(y-bounds.bottom*scale<=143+.01);
});

function dragFixture(dismissChoice){
  const canvas=new EventTarget();
  let capture;
  Object.assign(canvas,{
    getBoundingClientRect:()=>({left:0,top:0}),
    setPointerCapture:id=>{capture=id;},
    hasPointerCapture:id=>capture===id,
    releasePointerCapture:()=>{capture=undefined;},
  });
  const windows=new SpatialHudWindows({canvas,hit:()=> 'background',dismissChoice});
  const geometry={rect:{left:310,right:548,top:8,bottom:153},resizable:true,
    placementKey:'matter',view:{width:568,height:320}};
  windows.geometry.set('matter',geometry);
  const press={button:0,isPrimary:true,clientX:342,clientY:20,pointerId:7,
    preventDefault(){this.prevented=true;},stopImmediatePropagation(){}};
  return {canvas,windows,geometry,press};
}

test('a press on the drag strip dismisses the choice without moving its panel',()=>{
  let dismissed;
  const {canvas,windows,press}=dragFixture(id=>{dismissed=id;return true;});
  windows.pointerdown(press);
  windows.pointermove({...press,clientX:362,clientY:25});
  assert.equal(windows.panels.size,0);
  windows.pointerup(press);
  assert.equal(dismissed,'matter');
  assert.equal(press.prevented,true);
  assert.equal(canvas.hasPointerCapture(press.pointerId),false);
  windows.dispose();
});


test('disappearing or resized windows release a held pointer before the next gesture',()=>{
  const {canvas,windows,geometry,press}=dragFixture();
  windows.pointerdown(press);
  assert.equal(canvas.hasPointerCapture(press.pointerId),true);
  windows.begin();
  windows.end();
  assert.equal(canvas.hasPointerCapture(press.pointerId),false);

  windows.geometry.set('matter',geometry);
  windows.pointerdown(press);
  assert.equal(canvas.hasPointerCapture(press.pointerId),true);
  windows.begin();
  windows.geometry.set('matter',{...geometry,view:{width:320,height:568}});
  windows.end();
  assert.equal(canvas.hasPointerCapture(press.pointerId),false);

  windows.pointerdown(press);
  assert.equal(canvas.hasPointerCapture(press.pointerId),true);
  windows.dispose();
  assert.equal(canvas.hasPointerCapture(press.pointerId),false);
});
